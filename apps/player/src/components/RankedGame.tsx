import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { router } from "expo-router";
import { randomUUID } from "expo-crypto";
import { modeLabels, type Mode } from "@bivia/core";
import { useBivia } from "../lib/store";
import {
  getAttempt,
  startAttempt,
  submitAnswer,
  type AnswerRequest,
  type RankedAttempt,
  type RankedFeedback,
  type RankedQuestion,
} from "../lib/remote";
import { Button, Card, Heading, Icon, Notice, T, c, font, s } from "./ui";
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
}: {
  quizId: string;
  mode?: Mode;
}) {
  const { session } = useBivia();
  const [attempt, setAttempt] = useState<RankedAttempt | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [hintOpen, setHintOpen] = useState(false);
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
    setNow(Date.now() + offset.current);
  }, []);

  const initialize = useCallback(async () => {
    if (!session || locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      const next = await startAttempt(quizId, mode);
      accept(next);
      pending.current = null;
    } catch (failure) {
      if (alive.current) setError(message(failure));
    } finally {
      locked.current = false;
      if (alive.current) setBusy(false);
    }
  }, [quizId, mode, session?.user.id, accept]);

  useEffect(() => {
    alive.current = true;
    void initialize();
    const interval = setInterval(
      () => setNow(Date.now() + offset.current),
      100,
    );
    return () => {
      alive.current = false;
      clearInterval(interval);
    };
  }, [initialize]);

  const sync = useCallback(async () => {
    const current = state.current;
    if (!current || locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      const next = await getAttempt(current.id);
      accept(next);
      if (alive.current && next.feedback)
        setFeedback({ feedback: next.feedback, question: current.question });
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
        const next = retrying ? await getAttempt(current.id) : response;
        accept(next);
        if (alive.current)
          setFeedback(
            response.feedback
              ? { feedback: response.feedback, question: current.question }
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

  const previewSeconds = attempt
    ? Math.max(
        0,
        Math.ceil((Date.parse(attempt.questionStartedAt) - now) / 1000),
      )
    : 0;
  const remaining = attempt?.deadlineAt
    ? Math.max(0, (Date.parse(attempt.deadlineAt) - now) / 1000)
    : null;
  const preview = previewSeconds > 0;
  useEffect(() => {
    if (
      attempt?.status === "active" &&
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
              params: { next: `/quiz/${quizId}?mode=${mode}` },
            })
          }
        >
          Sign in to play
        </Button>
      </Page>
    );
  if (!attempt)
    return (
      <Page narrow>
        <Heading
          title="Your ranked round"
          subtitle="Preparing your questions…"
        />
        {busy && <ActivityIndicator color={c.primary} />}
        {!!error && (
          <View style={s.stack}>
            <Notice>{error}</Notice>
            <Button onPress={() => void initialize()}>Try again</Button>
          </View>
        )}
      </Page>
    );

  const question = attempt.question;
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
  const correctAnswer =
    feedback?.feedback.resolved && feedback.feedback.correctIndex !== undefined
      ? feedback.question?.options[feedback.feedback.correctIndex]
      : undefined;
  return (
    <Page narrow>
      <View
        style={[s.row, { justifyContent: "space-between", marginBottom: 24 }]}
      >
        <Button
          variant="ghost"
          icon="arrow-back"
          onPress={() => router.push("/")}
        >
          Trivia
        </Button>
        <T style={styles.badge}>
          RANKED · {modeLabels[attempt.mode].toUpperCase()}
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
      {feedback && (
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
          {correctAnswer && !feedback.feedback.correct && (
            <T style={s.small}>Answer: {correctAnswer}</T>
          )}
          {!!feedback.feedback.explanation && (
            <T style={s.small}>{feedback.feedback.explanation}</T>
          )}
        </View>
      )}
      {attempt.status === "completed" ? (
        <Card style={{ alignItems: "center", gap: 20, paddingVertical: 42 }}>
          <View style={styles.trophy}>
            <Icon name="trophy-outline" size={40} color={c.primary} />
          </View>
          <T style={s.h1}>Round complete!</T>
          <T
            style={{
              fontSize: 62,
              lineHeight: 70,
              fontFamily: font.bold,
              color: c.primary,
            }}
          >
            {attempt.score}
            <T style={{ color: c.muted }}> pts</T>
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
        question && (
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
            <Card style={{ marginBottom: 20, gap: 18 }}>
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
                          ? "Speed bonus active"
                          : "Keep going — you can still earn points"}
                    </T>
                    {busy && (
                      <ActivityIndicator size="small" color={c.primary} />
                    )}
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
                    onPress={() => setHintOpen(!hintOpen)}
                  >
                    {hintOpen ? "Hide Bible hint" : "Show Bible hint"}
                  </Button>
                  {hintOpen && (
                    <View style={{ gap: 8 }}>
                      <T>{originalClue ? question.hint : `“${question.hint}”`}</T>
                      <T style={s.small}>{question.hintReference}</T>
                    </View>
                  )}
                </>
              )}
            </Card>
            <T style={[s.small, { textAlign: "center" }]}>
              Your answers and points are verified as you play.
            </T>
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
