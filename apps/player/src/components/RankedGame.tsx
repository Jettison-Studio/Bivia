import { startDaily } from "../lib/daily";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Pressable,
  Modal,
  StyleSheet,
  View,
} from "react-native";
import { router } from "expo-router";
import { randomUUID } from "expo-crypto";
import { modeLabels, type Mode } from "@bivia/core";
import { useBivia } from "../lib/store";
import {
  getAttempt,
  readyQuestion,
  continueQuestion,
  useQuestionHint,
  listCatalog,
  type Catalog,
  startAttempt,
  submitAnswer,
  type AnswerRequest,
  type RankedAttempt,
  type RankedFeedback,
  type RankedQuestion,
} from "../lib/remote";
import { Button, Card, Heading, Icon, Notice, PointsUnit, T, c, font, s } from "./ui";
import { VersePreview } from "./VersePreview";
import { Page } from "./Page";

type Feedback = { feedback: RankedFeedback; question: RankedQuestion | null };
const message = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Your result could not be confirmed. Please retry.";

/** Ranked play renders only server-issued questions; it never imports sample answer keys. */
export function RankedGame({
  quizId,
  mode = "category",
  dailyRoundId,
  attemptId,
  viewResults = false,
}: {
  quizId: string;
  mode?: Mode;
  dailyRoundId?: string;
  attemptId?: string;
  viewResults?: boolean;
}) {
  const { session } = useBivia();
  const [attempt, setAttempt] = useState<RankedAttempt | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [resultsOpen, setResultsOpen] = useState(viewResults);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [hintOpen, setHintOpen] = useState(false);
  const [overview, setOverview] = useState<Catalog["quizzes"][number] | null>(null);
  const [overviewError, setOverviewError] = useState("");
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const offset = useRef(0);
  const pending = useRef<AnswerRequest | null>(null);
  const locked = useRef(false);
  const alive = useRef(true);
  const state = useRef<RankedAttempt | null>(null);

  const accept = useCallback((next: RankedAttempt) => {
    if (!alive.current) return;
    offset.current = Date.parse(next.serverNow) - Date.now();
    if (state.current?.question?.id !== next.question?.id) setHintOpen(false);
    state.current = next;
    setAttempt(next);
    setFeedback(next.feedback && next.reviewQuestion
      ? { feedback: next.feedback, question: next.reviewQuestion } : null);
    setNow(Date.now() + offset.current);
  }, []);

  const initialize = useCallback(async () => {
    if (!session || locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      const next = attemptId ? await getAttempt(attemptId) : dailyRoundId ? await startDaily(dailyRoundId) : await startAttempt(quizId, mode);
      accept(next);
      if (!attemptId) router.setParams({ attempt: next.id });
      pending.current = null;
    } catch (failure) {
      if (alive.current) setError(message(failure));
    } finally {
      locked.current = false;
      if (alive.current) setBusy(false);
    }
  }, [quizId, mode, dailyRoundId, attemptId, session?.user.id, accept]);

  useEffect(() => {
    alive.current = true;
    const interval = setInterval(
      () => setNow(Date.now() + offset.current),
      100,
    );
    return () => {
      alive.current = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => { if (viewResults && attemptId) void initialize(); }, [viewResults, attemptId, initialize]);

  const loadOverview = useCallback(async () => {
    setOverviewLoading(true);
    setOverviewError("");
    try {
      const catalog = await listCatalog();
      if (!alive.current) return;
      const quiz = catalog.quizzes.find(item => item.id === quizId);
      if (!quiz) throw new Error("This trivia is not available right now.");
      setOverview(quiz);
    } catch (failure) {
      if (alive.current) setOverviewError(message(failure));
    } finally {
      if (alive.current) setOverviewLoading(false);
    }
  }, [quizId]);
  useEffect(() => { void loadOverview(); }, [loadOverview]);

  const sync = useCallback(async () => {
    const current = state.current;
    if (!current || locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      const next = await getAttempt(current.id);
      accept(next);

      pending.current = null;
    } catch (failure) {
      if (alive.current) setError(message(failure));
    } finally {
      locked.current = false;
      if (alive.current) setBusy(false);
    }
  }, [accept]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (status) => {
      if (status === "active" && !pending.current) void sync();
    });
    return () => subscription.remove();
  }, [sync]);

  const answer = useCallback(
    async (optionIndex: number) => {
      const current = state.current;
      if (!current?.question || locked.current || current.status !== "active")
        return;
      locked.current = true;
      setBusy(true);
      setError("");
      const retrying = pending.current !== null;
      try {
        const request = pending.current ?? {
          attemptId: current.id,
          questionId: current.question.id,
          optionIndex,
          requestId: randomUUID(),
        };
        pending.current = request;
        const response = await submitAnswer(request);
        // An idempotent replay contains the original timestamp/state. Refresh it so
        // another device or a long network interruption cannot rewind the UI clock.
        let next = retrying ? await getAttempt(current.id) : response;
        if (next.awaitingNext) next = await continueQuestion(current.id);
        accept(next);
        if (alive.current)
          setFeedback(
            response.feedback
              ? { feedback: response.feedback, question: next.reviewQuestion ?? current.question }
              : null,
          );
        pending.current = null;
      } catch (failure) {
        if (alive.current) setError(message(failure));
      } finally {
        locked.current = false;
        if (alive.current) setBusy(false);
      }
    },
    [accept],
  );

  const nextQuestion = useCallback(async () => {
    if (!attempt || locked.current) return;
    locked.current = true; setBusy(true); setError("");
    try { accept(await continueQuestion(attempt.id)); setFeedback(null); }
    catch (failure) { setError(message(failure)); }
    finally { locked.current = false; setBusy(false); }
  }, [attempt?.id, accept]);

  useEffect(() => {
    if (!attempt || busy || error || leaveOpen || resultsOpen) return;
    if (!attempt.awaitingNext && attempt.status !== "completed") return;
    if (attempt.status === "completed") setResultsOpen(true);
    else void nextQuestion();
  }, [attempt?.id, attempt?.questionIndex, attempt?.awaitingNext, attempt?.status, busy, error, leaveOpen, resultsOpen, nextQuestion]);

  async function revealHint() {
    if (!attempt?.question || locked.current) return;
    if (attempt.question.hintUsed) { setHintOpen(!hintOpen); return; }
    locked.current = true; setBusy(true); setError("");
    try { accept(await useQuestionHint(attempt.id, attempt.question.id)); setHintOpen(true); }
    catch (failure) { setError(message(failure)); }
    finally { locked.current = false; setBusy(false); }
  }

  async function beginCountdown() {
    if (!attempt?.question || locked.current) return;
    locked.current = true; setBusy(true); setError("");
    try { accept(await readyQuestion(attempt.id, attempt.question.id)); }
    catch (failure) { setError(message(failure)); }
    finally { locked.current = false; setBusy(false); }
  }

  const previewSeconds = attempt && !attempt.readingScripture
    ? Math.max(
        0,
        Math.ceil((Date.parse(attempt.questionStartedAt) - now) / 1000),
      )
    : 0;
  const remaining = attempt?.deadlineAt
    ? Math.max(0, (Date.parse(attempt.deadlineAt) - now) / 1000)
    : null;
  const preview = attempt?.status === "active" && !attempt.awaitingNext && (attempt.readingScripture || previewSeconds > 0);
  useEffect(() => {
    if (
      attempt?.status === "active" &&
      !attempt.awaitingNext &&
      remaining === 0 &&
      !busy &&
      !error &&
      !pending.current
    )
      void answer(-1);
  }, [
    attempt?.id,
    attempt?.questionIndex,
    attempt?.status,
    remaining,
    busy,
    error,
    answer,
  ]);

  if (!session)
    return (
      <Page narrow>
        <Heading
          title="Make it count"
          subtitle="Sign in to save your score and compete with friends."
        />
        <Button
          onPress={() =>
            router.push({
              pathname: "/auth",
              params: { next: `/quiz/${quizId}?mode=${mode}${dailyRoundId ? `&daily=${dailyRoundId}` : ""}${attemptId ? `&attempt=${attemptId}` : ""}` },
            })
          }
        >
          Sign in to play
        </Button>
      </Page>
    );
  if (!attempt && viewResults) return <Page narrow><Heading title="Your results" />{error ? <View style={s.stack}><Notice>{error}</Notice><Button onPress={() => void initialize()}>Try again</Button></View> : <ActivityIndicator accessibilityLabel="Loading results" color={c.primary} />}</Page>;
  if (!attempt)
    return (
      <Page narrow>
        <Button variant="ghost" icon="arrow-back" onPress={() => router.push("/")}>Back to trivia</Button>
        <Card style={{ padding: 32, marginTop: 20 }}>
          <View style={[styles.trophy, { marginBottom: 22 }]}>
            <Icon name={mode === "timed" ? "timer-outline" : mode === "challenger" ? "trophy-outline" : "help-circle-outline"} size={32} color={c.primary} />
          </View>
          <T style={[s.label, { color: c.primary, marginBottom: 8 }]}>{modeLabels[mode]}</T>
          <T accessibilityRole="header" style={s.h1}>{overview?.title ?? "Your daily trivia"}</T>
          {!!overview?.description && <T style={{ color: c.muted, marginTop: 12 }}>{overview.description}</T>}
          <View style={{ marginVertical: 25, gap: 16 }}>
            {overview && <T>{overview.question_count} questions. Four choices. One curious you.</T>}
            <View style={s.row}><Icon name="book-outline" color={c.primary} /><T style={{ flex: 1 }}>Read the Scripture at your pace. Tap “I’m ready” to begin.</T></View>
            <View style={s.row}><Icon name="timer-outline" color={c.primary} /><T style={{ flex: 1 }}>{mode === "timed" ? "The clock gets faster as you go." : "Answer within 30 seconds for the extra point."}</T></View>
            <T style={s.small}>Reopening the Bible hint costs 1 point per question.</T>
            {mode === "challenger" && <T>Five wrong answers end the challenge.</T>}
            {!!attemptId && <T style={s.small}>Pick up where you left off.{mode === "timed" ? " If the current question expired, you’ll review it before starting the next." : ""}</T>}
          </View>
          {overviewLoading && <ActivityIndicator color={c.primary} />}
          {!!(error || overviewError) && <Notice>{error || overviewError}</Notice>}
          {overviewError ? <Button onPress={() => void loadOverview()}>Try again</Button> :
            <Button disabled={busy || overviewLoading || !overview} icon="arrow-forward" onPress={() => void initialize()}>
              {busy ? "Opening…" : attemptId ? "Continue round" : "Start trivia"}
            </Button>}
        </Card>
      </Page>
    );

  const question = attempt.question;
  const questionDuration = attempt.deadlineAt
    ? (Date.parse(attempt.deadlineAt) - Date.parse(attempt.questionStartedAt)) / 1000 : 30;
  const secondsLeft = remaining ?? Math.max(0, 30 - (now - Date.parse(attempt.questionStartedAt)) / 1000);
  const timePercent = Math.max(0, Math.min(100, secondsLeft / Math.max(0.1, questionDuration) * 100));
  const originalClue = question?.hintReference.includes("Original clue (not a Bible quotation)") ?? false;
  const feedbackText = feedback
    ? feedback.feedback.timedOut
      ? "Time’s up."
      : feedback.feedback.correct
        ? `Correct! +${feedback.feedback.pointsAwarded} ${feedback.feedback.pointsAwarded === 1 ? "point" : "points"}.`
        : feedback.feedback.resolved
          ? "That question is complete."
          : "Not quite. Try another answer."
    : "";
  return (
    <Page narrow>
      <View
        style={[s.row, { justifyContent: "space-between", marginBottom: 24 }]}
      >
        <Button
          variant="ghost"
          icon="arrow-back"
          onPress={() => setLeaveOpen(true)}
        >
          Exit
        </Button>
        <T style={styles.badge}>
          {modeLabels[attempt.mode]}
        </T>
      </View>
      {!!error && (
        <View style={[s.stack, { marginBottom: 20 }]}>
          <Notice>
            {error} Your score is shown only after the server confirms it.
          </Notice>
          <Button
            disabled={busy}
            onPress={() =>
              pending.current
                ? void answer(pending.current.optionIndex)
                : void sync()
            }
          >
            Retry
          </Button>
          <Button variant="ghost" disabled={busy} onPress={() => void sync()}>
            Refresh saved attempt
          </Button>
        </View>
      )}
      {feedback && !feedback.feedback.resolved && !preview && attempt.status === "active" && (
        <View
          accessibilityLiveRegion="polite"
          style={[
            styles.feedback,
            {
              backgroundColor: feedback.feedback.correct
                ? "#edf8f1"
                : c.lavender,
            },
          ]}
        >
          <T
            style={{
              fontFamily: font.semibold,
              color: feedback.feedback.correct ? c.success : c.primary,
            }}
          >
            {feedbackText}
          </T>
        </View>
      )}
      {leaveOpen && <Card style={{ marginBottom: 20, gap: 16 }}>
        <T style={s.h2}>Leave this round?</T>
        <T>Your progress is saved.{attempt.mode === "timed" ? " The current question’s clock keeps running." : ""}</T>
        <Button onPress={() => setLeaveOpen(false)}>Keep playing</Button>
        <Button variant="ghost" onPress={() => router.replace("/")}>Leave round</Button>
      </Card>}
      {question && <VersePreview onExit={() => router.replace("/")} visible={preview} verse={question.hint} reference={question.hintReference} seconds={previewSeconds} reading={attempt.readingScripture} onReady={() => void beginCountdown()} busy={busy} error={error} />}
      {attempt.status === "completed" ? (
        <Card style={{ alignItems: "center", gap: 20, paddingVertical: 42 }}>
          <View style={styles.trophy}>
            <Icon name="trophy-outline" size={40} color={c.primary} />
          </View>
          <T accessibilityRole="header" style={s.h1}>Round complete!</T>
          <T
            style={{
              fontSize: 62,
              lineHeight: 70,
              fontFamily: font.bold,
              color: c.primary,
            }}
          >
            {attempt.score}
            <PointsUnit />
          </T>
          <T style={{ textAlign: "center", color: c.muted }}>
            Your score is saved.
            {attempt.mode === "challenger" && attempt.wrongCount >= 5
              ? " Five wrong answers ended this challenge."
              : " Come back for your next challenge."}
          </T>
          <Notice>
            One ranked result per quiz and mode each day. Your saved result is
            shown if you open this round again today.
          </Notice>
          <Button onPress={() => router.replace("/")}>Back to trivia</Button>
        </Card>
      ) : (
        question && attempt.status === "active" && !attempt.awaitingNext && (
          <>
            <View
              style={[
                s.row,
                { justifyContent: "space-between", marginBottom: 18 },
              ]}
            >
              <T style={s.label}>
                Question {attempt.questionIndex + 1} of {attempt.questionCount}
              </T>
              <T style={{ fontFamily: font.bold, color: c.primary }}>
                {attempt.score} pts
              </T>
            </View>
            <View style={styles.progress}>
              <View
                style={{
                  backgroundColor: c.primary,
                  width: `${(attempt.questionIndex / attempt.questionCount) * 100}%`,
                  height: 5,
                }}
              />
            </View>
            {attempt.mode === "challenger" && (
              <T style={[s.small, { marginBottom: 18 }]}>
                {Math.max(0, 5 - attempt.wrongCount)} mistakes remaining
              </T>
            )}
            <View style={{ marginBottom: 20, gap: 24 }}>
              {preview ? (
                <>
                  <View style={s.row}>
                    <Icon name="book-outline" color={c.primary} />
                    <T style={{ fontFamily: font.bold, color: c.primary }}>
                      {originalClue ? "A scripture-inspired clue" : "A little help from the Bible"}
                    </T>
                  </View>
                  <T
                    style={{
                      fontSize: 23,
                      lineHeight: 34,
                      fontFamily: font.medium,
                    }}
                  >
                    {originalClue ? question.hint : `“${question.hint}”`}
                  </T>
                  <T style={s.small}>{question.hintReference}</T>
                  <T style={{ fontFamily: font.semibold }}>
                    Your question opens in {previewSeconds}…
                  </T>
                </>
              ) : (
                <>
                  <View style={[s.row, { justifyContent: "space-between" }]}>
                    <T style={s.label}>
                      {remaining !== null
                        ? `${remaining.toFixed(1)}s left`
                        : now - Date.parse(attempt.questionStartedAt) < 30000
                          ? `${Math.max(0, Math.ceil(30 - (now - Date.parse(attempt.questionStartedAt)) / 1000))}s · speed bonus`
                          : "Keep going — you can still earn points"}
                    </T>
                    {busy && (
                      <ActivityIndicator size="small" color={c.primary} />
                    )}
                  </View>
                  <View accessibilityRole="progressbar" accessibilityLabel="Time remaining" accessibilityValue={{ min: 0, max: 100, now: Math.round(timePercent) }} style={[styles.progress, { marginBottom: 0, height: 7 }]}>
                    <View style={{ height: 7, backgroundColor: remaining !== null && remaining < 5 ? c.pink : c.primary, width: `${timePercent}%` }} />
                  </View>
                  <T
                    accessibilityRole="header"
                    style={{
                      fontFamily: font.bold,
                      fontSize: 26,
                      lineHeight: 36,
                      letterSpacing: -0.5,
                    }}
                  >
                    {question.prompt}
                  </T>
                  <View style={{ gap: 10 }}>
                    {question.options.map((option, index) => {
                      const selected = question.selectedIndexes.includes(index);
                      const disabled =
                        busy || selected || !!error || remaining === 0;
                      return (
                        <Pressable
                          key={`${question.id}-${index}`}
                          accessibilityRole="button"
                          accessibilityState={{ disabled }}
                          disabled={disabled}
                          onPress={() => void answer(index)}
                          style={({ pressed }) => [
                            styles.option,
                            selected && {
                              backgroundColor: "#fff0f4",
                              borderColor: "#e5a8ba",
                            },
                            pressed && { backgroundColor: c.lavender },
                            disabled && !selected && { opacity: 0.55 },
                          ]}
                        >
                          <T
                            style={[
                              styles.letter,
                              selected && { color: c.pink },
                            ]}
                          >
                            {String.fromCharCode(65 + index)}
                          </T>
                          <T style={{ flex: 1, fontFamily: font.medium }}>
                            {option}
                          </T>
                          {selected && (
                            <Icon
                              name="close-circle-outline"
                              size={21}
                              color={c.pink}
                            />
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                  <Button
                    variant="secondary"
                    icon="book-outline"
                    disabled={busy || remaining === 0}
                    onPress={() => void revealHint()}
                  >
                    {hintOpen ? "Hide Bible hint" : question.hintUsed ? "Bible hint" : "Bible hint · −1 point"}
                  </Button>
                  <Modal visible={hintOpen && !preview} transparent animationType="fade" onRequestClose={() => setHintOpen(false)}>
                    <View style={{ flex: 1, backgroundColor: "#10091dbb", justifyContent: "center", padding: 24 }}>
                      <Card style={{ alignSelf: "center", width: "100%", maxWidth: 560, gap: 20 }}>
                        <T style={s.h2}>{originalClue ? "Your clue" : "Bible hint"}</T>
                        <T style={{ fontSize: 22, lineHeight: 32 }}>{originalClue ? question.hint : `“${question.hint}”`}</T>
                        <T style={s.small}>{question.hintReference}</T>
                        <T style={s.small}>1 point used{attempt.mode === "timed" ? " · The clock is still running" : ""}</T>
                        <Button onPress={() => setHintOpen(false)}>Back to question</Button>
                      </Card>
                    </View>
                  </Modal>
                </>
              )}
            </View>

          </>
        )
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  badge: {
    fontFamily: font.bold,
    fontSize: 10,
    letterSpacing: 0.7,
    color: c.primary,
  },
  progress: {
    height: 5,
    backgroundColor: c.lavender,
    overflow: "hidden",
    borderRadius: 5,
    marginBottom: 24,
  },
  feedback: { padding: 16, borderRadius: 12, marginBottom: 20, gap: 5 },
  option: {
    minHeight: 60,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 11,
    padding: 14,
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
  },
  letter: { color: c.primary, fontFamily: font.bold, width: 20 },
  trophy: {
    backgroundColor: c.lavender,
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: "center",
    alignItems: "center",
  },
});
