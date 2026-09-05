import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import type { Mode } from "@bivia/core";
import { listCatalog, type Catalog } from "../lib/remote";
import { useBivia } from "../lib/store";
import { supabase } from "../lib/supabase";
import { Button, Card, Heading, Icon, Notice, T, c, font, s } from "./ui";

const modes: { id: Mode; label: string; icon: string; description: string }[] =
  [
    {
      id: "category",
      label: "Regular",
      icon: "grid-outline",
      description:
        "Take your time. Answer within 30 seconds for the speed bonus.",
    },
    {
      id: "timed",
      label: "Timed",
      icon: "timer-outline",
      description:
        "Race the clock. Each question gives you less time to answer.",
    },
    {
      id: "challenger",
      label: "Challenger",
      icon: "flash-outline",
      description: "Keep your streak going. Five wrong answers end the round.",
    },
  ];

export function CatalogSection() {
  const { session } = useBivia();
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<Mode>("category");
  const mounted = useRef(true);
  const loadingRef = useRef(false);
  const load = useCallback(async () => {
    if (!supabase || loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError("");
    try {
      const next = await listCatalog();
      if (mounted.current) setCatalog(next);
    } catch (failure) {
      if (mounted.current)
        setError(
          failure instanceof Error
            ? failure.message
            : "We couldn’t load the current rounds.",
        );
    } finally {
      loadingRef.current = false;
      if (mounted.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    mounted.current = true;
    void load();
    return () => {
      mounted.current = false;
    };
  }, [load]);

  const rounds =
    catalog?.quizzes
      .filter((quiz) => quiz.question_count > 0)
      .slice()
      .sort((a, b) => Date.parse(b.publish_at) - Date.parse(a.publish_at)) ??
    [];
  return (
    <View style={s.section}>
      <Heading
        title="Play for points"
        subtitle="Save your scores and compete with your groups."
        action={
          supabase ? (
            <Button
              variant="ghost"
              disabled={loading}
              icon="refresh-outline"
              onPress={() => void load()}
            >
              Refresh
            </Button>
          ) : undefined
        }
      />
      {!supabase ? (
        <Notice>
          Ranked rounds aren’t available yet. You can explore the practice
          quizzes below.
        </Notice>
      ) : (
        <>
          {loading && !catalog && (
            <View style={[s.row, { paddingVertical: 18 }]}>
              <ActivityIndicator color={c.primary} />
              <T style={s.small}>Loading current rounds…</T>
            </View>
          )}
          {!!error && (
            <View style={[s.stack, { marginBottom: 18 }]}>
              <Notice>
                {error}
                {catalog
                  ? " The rounds below are from your last successful refresh."
                  : " Please try again to load ranked rounds."}
              </Notice>
              <Button
                variant="secondary"
                disabled={loading}
                onPress={() => void load()}
              >
                Try again
              </Button>
            </View>
          )}
          {catalog && rounds.length === 0 && !loading && (
            <Card>
              <View style={{ gap: 10 }}>
                <Icon name="calendar-outline" color={c.primary} />
                <T style={s.h2}>Your next round is on its way</T>
                <T style={s.small}>
                  There are no published ranked quizzes yet. Try a practice
                  round while you wait.
                </T>
              </View>
            </Card>
          )}
          {rounds.length > 0 && (
            <>
              <View
                accessibilityRole="radiogroup"
                accessibilityLabel="Game mode"
                style={styles.modes}
              >
                {modes.map((item) => (
                  <Pressable
                    key={item.id}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: mode === item.id }}
                    onPress={() => setMode(item.id)}
                    style={({ pressed }) => [
                      styles.mode,
                      mode === item.id && styles.selectedMode,
                      pressed && { opacity: 0.75 },
                    ]}
                  >
                    <Icon
                      name={item.icon}
                      color={mode === item.id ? c.primary : c.muted}
                      size={18}
                    />
                    <T
                      style={{
                        color: mode === item.id ? c.primary : c.muted,
                        fontFamily: font.semibold,
                        fontSize: 13,
                      }}
                    >
                      {item.label}
                    </T>
                  </Pressable>
                ))}
              </View>
              <T style={[s.small, { marginTop: 10, marginBottom: 20 }]}>
                {modes.find((item) => item.id === mode)?.description}
              </T>
              <View style={styles.grid}>
                {rounds.map((quiz) => {
                  const category = catalog?.categories.find(
                    (item) => item.id === quiz.category_id,
                  );
                  return (
                    <Card key={quiz.id} style={styles.quiz}>
                      <View style={[s.row, { marginBottom: 18 }]}>
                        <View
                          style={[
                            styles.dot,
                            { backgroundColor: category?.color ?? c.primary },
                          ]}
                        />
                        <T
                          style={{
                            fontSize: 12,
                            fontFamily: font.semibold,
                            color: c.muted,
                          }}
                        >
                          {category?.name ?? "Trivia"} · {quiz.question_count}{" "}
                          questions
                        </T>
                      </View>
                      <T style={s.h2}>{quiz.title}</T>
                      {!!quiz.description && (
                        <T style={[s.small, { marginTop: 8 }]}>
                          {quiz.description}
                        </T>
                      )}
                      <View style={{ flex: 1, minHeight: 22 }} />
                      <Button
                        icon="arrow-forward"
                        onPress={() =>
                          router.push({
                            pathname: "/quiz/[id]",
                            params: { id: quiz.id, mode },
                          })
                        }
                      >
                        {session ? "Play for points" : "Sign in to play"}
                      </Button>
                    </Card>
                  );
                })}
              </View>
            </>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  modes: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  mode: {
    minHeight: 45,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 15,
  },
  selectedMode: { backgroundColor: c.lavender, borderColor: c.primary },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  quiz: { flexBasis: 280, flexGrow: 1, flexShrink: 1, minWidth: 240 },
  dot: { width: 9, height: 9, borderRadius: 5 },
});
