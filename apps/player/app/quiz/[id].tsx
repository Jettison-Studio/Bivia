import { VersePreview } from "../../src/components/VersePreview";
import React, { useEffect, useRef, useState } from "react";
import { View, Pressable, Modal, AppState } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as Crypto from "expo-crypto";
import {
  quizzes,
  categories,
  timeLimit,
  scoreAnswer,
  modeLabels,
  type Quiz,
} from "@bivia/core";
import { Page } from "../../src/components/Page";
import {
  T,
  Icon,
  LegacyIcon,
  Button,
  Card,
  Notice,
  c,
  s,
  font,
} from "../../src/components/ui";
import { useBivia } from "../../src/lib/store";
import { RankedGame } from "../../src/components/RankedGame";
export default function QuizRoute() {
  const { session } = useBivia();
  const { id, mode, daily, attempt, view } = useLocalSearchParams<{ id: string; mode?: string; daily?: string; attempt?: string; view?: string }>();
  const quiz = quizzes.find((q) => q.id === id);
  if (!quiz && /^[0-9a-f-]{36}$/i.test(id || ""))
    return (
      <RankedGame
        key={`${id}-${mode}-${daily}-${session?.user.id ?? "guest"}`}
        quizId={id}
        dailyRoundId={daily}
        attemptId={attempt}
        viewResults={view === "results"}
        mode={mode === "timed" || mode === "challenger" ? mode : "category"}
      />
    );
  if (!quiz)
    return (
      <Page narrow>
        <T style={s.h1}>Quiz not found</T>
        <Button onPress={() => router.replace("/")}>Back to trivia</Button>
      </Page>
    );
  return <PracticeGame key={id} quiz={quiz} />;
}
function PracticeGame({ quiz }: { quiz: Quiz }) {
  const { addResult } = useBivia();
  const [phase, setPhase] = useState<
      "intro" | "hint" | "question" | "feedback"
    >("intro"),
    [index, setIndex] = useState(0),
    [wrong, setWrong] = useState<number[]>([]),
    [totalWrong, setTotalWrong] = useState(0),
    [score, setScore] = useState(0),
    [correct, setCorrect] = useState(0),
    [now, setNow] = useState(Date.now()),
    [hintOpen, setHintOpen] = useState(false),
    [hintUsed, setHintUsed] = useState(false),
    [leaveOpen, setLeaveOpen] = useState(false),
    [feedback, setFeedback] = useState(""),
    [hintEnds, setHintEnds] = useState(0);
  const startRef = useRef(0),
    scoreRef = useRef(0),
    correctRef = useRef(0),
    ending = useRef(false),
    inputLock = useRef(false);
  const question = quiz.questions[index],
    cat = categories.find((c) => c.id === quiz.categoryId);
  const elapsed = Math.max(0, (now - startRef.current) / 1000),
    limit = timeLimit(quiz.mode, index),
    remaining = Math.max(0, limit - elapsed);
  const currentPoints = Math.max(0, scoreAnswer(wrong.length, elapsed) - (hintUsed ? 1 : 0));
  useEffect(() => {
    if (phase === "intro") return;
    const timer = setInterval(() => setNow(Date.now()), 100);
    const sub = AppState.addEventListener("change", () => setNow(Date.now()));
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [phase]);
  useEffect(() => {
    if (phase === "hint" && hintEnds > 0 && now >= hintEnds) {
      startRef.current = hintEnds;
      inputLock.current = false;
      setPhase("question");
    }
  }, [now, phase, hintEnds]);
  useEffect(() => {
    if (
      phase === "question" &&
      quiz.mode === "timed" &&
      remaining <= 0 &&
      !inputLock.current
    ) {
      inputLock.current = true;
      setFeedback("Time’s up. Let’s try the next one.");
      setPhase("feedback");
    }
  }, [remaining, phase]);
  function beginHint() {
    setHintOpen(false);
    setHintUsed(false);
    setHintEnds(0);
    setNow(Date.now());
    setPhase("hint");
  }
  async function finish() {
    if (ending.current) return;
    ending.current = true;
    const id = Crypto.randomUUID();
    try {
      await addResult({
        id,
        quizId: quiz.id,
        score: scoreRef.current,
        correct: correctRef.current,
        total: quiz.questions.length,
        completedAt: new Date().toISOString(),
        mode: quiz.mode,
      });
      router.replace(`/results/${id}` as any);
    } catch {
      ending.current = false;
      setFeedback("Your result could not be saved. Try again.");
      setPhase("feedback");
    }
  }
  function next() {
    if (
      index === quiz.questions.length - 1 ||
      (quiz.mode === "challenger" && totalWrong >= 5)
    ) {
      finish();
      return;
    }
    setIndex((i) => i + 1);
    setWrong([]);
    inputLock.current = false;
    beginHint();
  }
  useEffect(() => {
    if (phase !== "feedback" || leaveOpen || feedback === "Your result could not be saved. Try again.") return;
    const timer = setTimeout(() => next(), 0);
    return () => clearTimeout(timer);
  }, [phase, index, leaveOpen, feedback]);
  function answer(answerIndex: number) {
    if (
      inputLock.current ||
      phase !== "question" ||
      wrong.includes(answerIndex)
    )
      return;
    if (answerIndex === question.correctIndex) {
      inputLock.current = true;
      const earned = Math.max(0, scoreAnswer(
        wrong.length,
        Math.max(0, (Date.now() - startRef.current) / 1000),
      ) - (hintUsed ? 1 : 0));
      scoreRef.current += earned;
      correctRef.current++;
      setScore(scoreRef.current);
      setCorrect(correctRef.current);
      setFeedback(
        earned === 3
          ? "That’s right! Curiosity looks good on you."
          : `You got it! +${earned} points`,
      );
      setPhase("feedback");
    } else {
      const nextWrong = [...wrong, answerIndex],
        overall = totalWrong + 1;
      setWrong(nextWrong);
      setTotalWrong(overall);
      if (quiz.mode === "challenger" && overall >= 5) {
        inputLock.current = true;
        setFeedback(
          "Five wrong answers. A good challenge always teaches us something.",
        );
        setPhase("feedback");
      } else if (nextWrong.length >= 3) {
        inputLock.current = true;
        setFeedback(
          "Three wrong guesses. Here’s the answer — let’s keep learning.",
        );
        setPhase("feedback");
      }
    }
  }
  if (phase === "intro")
    return (
      <Page narrow>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          style={[s.row, { marginBottom: 28 }]}
        >
          <Icon name="arrow-back" size={19} />
          <T style={s.small}>Back to trivia</T>
        </Pressable>
        <Card style={{ padding: 32 }}>
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              backgroundColor: c.lavender,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 22,
            }}
          >
            <LegacyIcon
              name={
                quiz.mode === "timed"
                  ? "timed"
                  : quiz.mode === "challenger"
                    ? "trophy"
                    : "trivia"
              }
              size={34}
            />
          </View>
          <T
            style={{
              color: c.primary,
              fontFamily: font.semibold,
              marginBottom: 7,
            }}
          >
            {modeLabels[quiz.mode]} · Practice
          </T>
          <T accessibilityRole="header" style={s.h1}>
            {quiz.title}
          </T>
          <T style={{ color: c.muted, marginTop: 12 }}>{quiz.subtitle}</T>
          <View style={{ marginVertical: 25, gap: 16 }}>
            {[
              {
                icon: "help-circle-outline",
                text: `${quiz.questions.length} questions. Four choices. One curious you.`,
              },
              {
                icon: "sparkles-outline",
                text: "A Bible verse gives you a clever clue before each question.",
              },
              {
                icon: "timer-outline",
                text:
                  quiz.mode === "timed"
                    ? "The clock gets faster. Unanswered questions move on."
                    : "Answer within 30 seconds for the extra point.",
              },
              {
                icon: "trophy-outline",
                text:
                  quiz.mode === "challenger"
                    ? "Five wrong answers end the challenge."
                    : "Start with 3 points. Each wrong guess costs 1.",
              },
            ].map((x) => (
              <View key={x.icon} style={s.row}>
                <Icon name={x.icon} color={c.primary} />
                <T style={{ flex: 1, color: c.muted, fontSize: 14 }}>
                  {x.text}
                </T>
              </View>
            ))}
          </View>
          <Button icon="arrow-forward" onPress={beginHint}>
            Start practice
          </Button>
          <T
            style={{
              textAlign: "center",
              fontSize: 12,
              color: c.muted,
              marginTop: 15,
            }}
          >
            Practice results stay on this device.
          </T>
        </Card>
      </Page>
    );
  return (
    <Page narrow>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 26,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Leave quiz"
          onPress={() => setLeaveOpen(true)}
          style={{ padding: 8 }}
        >
          <Icon name="close" />
        </Pressable>
        <T style={{ fontSize: 13, fontFamily: font.semibold, color: c.muted }}>
          {modeLabels[quiz.mode]} · Practice
        </T>
        <T style={{ color: c.primary, fontFamily: font.bold }}>{score} pts</T>
      </View>
      <View
        style={{
          height: 5,
          backgroundColor: c.lavender,
          borderRadius: 5,
          marginBottom: 30,
        }}
      >
        <View
          style={{
            height: 5,
            width: `${((index + (phase === "feedback" ? 1 : 0)) / quiz.questions.length) * 100}%`,
            backgroundColor: c.primary,
            borderRadius: 5,
          }}
        />
      </View>
      {phase === "hint" ? (
        <VersePreview onExit={() => router.replace("/")} visible verse={question.hint} reference={question.reference} seconds={hintEnds ? Math.ceil((hintEnds - now) / 1000) : 0} reading={!hintEnds} onReady={() => { setNow(Date.now()); setHintEnds(Date.now() + 3000); }} />
      ) : (
        <>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginBottom: 17,
            }}
          >
            <T style={s.label}>
              Question {index + 1} of {quiz.questions.length}
            </T>
            <T
              style={{ fontSize: 13, color: remaining < 5 ? c.pink : c.muted }}
            >
              {phase === "question"
                ? `${Math.ceil(remaining)}s${quiz.mode !== "timed" ? " bonus" : ""}`
                : "Answer revealed"}
            </T>
          </View>
          <T
            accessibilityRole="header"
            style={{
              fontFamily: font.bold,
              fontSize: 28,
              lineHeight: 38,
              letterSpacing: -0.6,
              marginBottom: 25,
            }}
          >
            {question.prompt}
          </T>
          {phase === "question" && (
            <View
              style={{
                height: 4,
                backgroundColor: c.surface,
                borderRadius: 4,
                marginBottom: 23,
              }}
            >
              <View
                style={{
                  height: 4,
                  width: `${Math.max(0, (remaining / limit) * 100)}%`,
                  backgroundColor: remaining < 5 ? c.pink : c.primary,
                  borderRadius: 4,
                }}
              />
            </View>
          )}
          <View style={{ gap: 12 }}>
            {question.answers.map((answerText, i) => {
              const reveal =
                  false,
                incorrect = wrong.includes(i);
              return (
                <Pressable
                  key={i}
                  accessibilityRole="button"
                  accessibilityLabel={`${String.fromCharCode(65 + i)}. ${answerText}`}
                  disabled={incorrect || phase === "feedback"}
                  onPress={() => answer(i)}
                  style={({ hovered }: any) => ({
                    borderWidth: 1,
                    borderColor: reveal
                      ? "#87c6a2"
                      : incorrect
                        ? c.border
                        : hovered
                          ? c.primary
                          : c.border,
                    borderRadius: 10,
                    padding: 17,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 14,
                    backgroundColor: reveal
                      ? "#eaf8ef"
                      : incorrect
                        ? "#f0eef2"
                        : hovered
                          ? c.lavender
                          : "white",
                    minHeight: 64,
                  })}
                >
                  <View
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 8,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: reveal ? "#c9ebd7" : c.surface,
                    }}
                  >
                    <T
                      style={{
                        fontSize: 13,
                        fontFamily: font.semibold,
                        color: incorrect ? "#a39da9" : c.muted,
                      }}
                    >
                      {String.fromCharCode(65 + i)}
                    </T>
                  </View>
                  <T
                    style={{
                      flex: 1,
                      fontSize: 16,
                      color: incorrect
                        ? "#a39da9"
                        : reveal
                          ? c.success
                          : c.text,
                      fontFamily: font.medium,
                    }}
                  >
                    {answerText}
                  </T>
                  {(incorrect || reveal) && (
                    <Icon
                      name={
                        reveal ? "checkmark-circle" : "close-circle-outline"
                      }
                      color={reveal ? c.success : "#a39da9"}
                      size={21}
                    />
                  )}
                </Pressable>
              );
            })}
          </View>
          {phase === "feedback" ? (
            <View style={{ marginTop: 25, gap: 16 }}>
              {feedback === "Your result could not be saved. Try again." && <Notice>{feedback}</Notice>}
              {feedback === "Your result could not be saved. Try again." && <Button onPress={next}>Retry</Button>}
            </View>
          ) : (
            <View style={{ marginTop: 25, gap: 18 }}>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Pressable
                  accessibilityRole="button"
                  onPress={() => { setHintUsed(true); setHintOpen(true); }}
                  style={[s.row, { paddingVertical: 8 }]}
                >
                  <Icon name="sparkles-outline" color={c.primary} size={19} />
                  <T
                    style={{
                      color: c.primary,
                      fontSize: 14,
                      fontFamily: font.semibold,
                    }}
                  >
                    {hintUsed ? "Bible hint" : "Bible hint · −1 point"}
                  </T>
                </Pressable>
                <T style={s.small}>{currentPoints} points available</T>
              </View>
              {quiz.mode === "challenger" && (
                <T style={s.small}>Wrong answers: {totalWrong} of 5</T>
              )}
            </View>
          )}
        </>
      )}
      <Modal
        visible={hintOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setHintOpen(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "#17132088",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <Card style={{ width: "100%", maxWidth: 470, padding: 30, gap: 20 }}>
            <T style={{ color: c.primary, fontFamily: font.semibold }}>
              A little guidance
            </T>
            <T style={{ fontSize: 24, lineHeight: 34 }}>{question.hint}</T>
            <T style={s.small}>{question.reference}</T>
            <Button onPress={() => setHintOpen(false)}>
              Back to the question
            </Button>
          </Card>
        </View>
      </Modal>
      <Modal
        visible={leaveOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setLeaveOpen(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "#17132088",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <Card style={{ width: "100%", maxWidth: 420, gap: 20 }}>
            <T style={s.h2}>Leave this round?</T>
            <T style={{ color: c.muted }}>
              This practice round won’t be saved until you finish.
            </T>
            <Button onPress={() => setLeaveOpen(false)}>Keep playing</Button>
            <Button variant="secondary" onPress={() => router.replace("/")}>
              Leave round
            </Button>
          </Card>
        </View>
      </Modal>
    </Page>
  );
}
