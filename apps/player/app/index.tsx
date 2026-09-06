import { dailyLabel, type DailyRound } from "../src/lib/daily";
import { useDaily } from "../src/lib/useDaily";
import React, { useState, useCallback } from "react";
import {
  View,
  Pressable,
  TextInput,
  useWindowDimensions,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { categories, quizzes } from "@bivia/core";
import { Page } from "../src/components/Page";
import { T, Icon, LegacyIcon, Button, c, s, font } from "../src/components/ui";
import { supabase } from "../src/lib/supabase";
import { useBivia } from "../src/lib/store";
const icons: Record<string, string> = {
  fitness: "barbell-outline",
  geography: "earth-outline",
  sports: "football-outline",
  media: "film-outline",
  music: "musical-notes-outline",
  science: "flask-outline",
};
export default function Home() {
  const { width } = useWindowDimensions();
  const { profile, session, authReady } = useBivia();
  const daily = useDaily();
  function openQuiz(round?: DailyRound) {
    if (daily.error) { void daily.refresh(); return; }
    if (!authReady || daily.loading || !round) return;
    const destination = `/quiz/${round.quizId}?mode=${round.mode}&daily=${round.id}${round.attemptId ? `&attempt=${round.attemptId}${round.status === "completed" ? "&view=results" : ""}` : ""}`;
    router.push(session ? destination as any : {
      pathname: "/auth",
      params: { next: destination },
    });
  }
  const [search, setSearch] = useState("");
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [favoritesError, setFavoritesError] = useState(false);
  useFocusEffect(useCallback(() => {
    let active = true;
    setFavorites([]);setFavoritesError(false);
    if (session && supabase) void supabase.from("profiles").select("preferred_categories").eq("id", session.user.id).single().then(({data,error}) => {
      if (active) {setFavorites(data?.preferred_categories ?? []);setFavoritesError(!!error);}
    });
    return () => {active=false;};
  }, [session?.user.id]));
  const compact = width < 760;
  const topicWidth = compact ? "48%" : "32%";
  const timed = daily.data?.rounds.find(q => q.mode === "timed"),
    challenger = daily.data?.rounds.find(q => q.mode === "challenger");
  const shown = (daily.data?.categories ?? categories).filter(
    (cat) =>
      cat.name.toLowerCase().includes(search.toLowerCase()) &&
      (!session || !onlyFavorites || favorites.includes(cat.id)),
  );
  return (
    <Page>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 28,
        }}
      >
        <View style={{ flex: 1 }}>
          <T accessibilityRole="header" style={[s.h1, { fontSize: compact ? 28 : 34 }]}>
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </T>
          <T style={{ fontSize: 14, color: c.muted, marginTop: 8 }}>
            Trivia with a hint of bible
          </T>
        </View>
        {!compact && (
          <View
            style={{
              backgroundColor: c.lavender,
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderRadius: 30,
            }}
          >
            <T
              style={{
                color: c.primary,
                fontSize: 13,
                fontFamily: font.semibold,
              }}
            >
              Made for curious minds
            </T>
          </View>
        )}
      </View>
      <LinearGradient
        colors={["#5f00e6", "#7307e9"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          borderRadius: 24,
          padding: compact ? 24 : 36,
          overflow: "hidden",
        }}
      >
        <View style={{ flexDirection: "row", gap: 20, alignItems: "center" }}>
          <View style={{ flex: 1 }}>
            <T
              style={{
                fontSize: compact ? 28 : 36,
                lineHeight: compact ? 36 : 44,
                fontFamily: font.bold,
                color: "white",
                letterSpacing: -1,
              }}
            >
              Give your curiosity{compact ? " " : "\n"}a little daily exercise.
            </T>
            <T
              style={{
                color: "#e7d8ff",
                marginTop: 13,
                maxWidth: 420,
                lineHeight: 24,
              }}
            >
              Pick a topic, follow the clues, and see what you know. Your next
              “I knew that!” is waiting.
            </T>
            <Button
              variant="white"
              icon="arrow-forward"
              disabled={!authReady || (!!session && (daily.loading || (!daily.data?.rounds.length && !daily.error)))}
              onPress={() => session
                ? openQuiz(daily.data?.rounds.find(round => round.status === "active")
                  ?? daily.data?.rounds.find(round => round.status === "unplayed")
                  ?? daily.data?.rounds[0])
                : router.push(`/quiz/${quizzes[0].id}` as any)}
              style={{ alignSelf: "flex-start", marginTop: 24 }}
            >
              Let’s play
            </Button>
          </View>
          {!compact && (
            <View
              style={{
                width: 185,
                height: 185,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 96,
                borderWidth: 1,
                borderColor: "#ffffff35",
                backgroundColor: "#ffffff0d",
                transform: [{ rotate: "-10deg" }],
              }}
            >
              <View
                style={{
                  width: 118,
                  height: 138,
                  backgroundColor: "white",
                  borderRadius: 18,
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 12px 30px #36006d35",
                }}
              >
                <T
                  style={{
                    fontSize: 90,
                    lineHeight: 108,
                    fontFamily: font.bold,
                    color: c.primary,
                  }}
                >
                  ?
                </T>
                <View
                  style={{
                    position: "absolute",
                    right: -20,
                    bottom: -10,
                    backgroundColor: "#f9d1e8",
                    borderRadius: 16,
                    padding: 13,
                    transform: [{ rotate: "20deg" }],
                  }}
                >
                  <Icon name="sparkles" size={32} color={c.pink} />
                </View>
              </View>
            </View>
          )}
        </View>
      </LinearGradient>
      <View
        style={{
          marginTop: 36,
          marginBottom: 18,
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <T accessibilityRole="header" style={s.h2}>
          Today’s trivia
        </T>

      </View>
      <View style={{ flexDirection: compact ? "column" : "row", gap: 16 }}>
        {[
          {
            quiz: timed,
            title: "Beat the clock",
            description: "Think fast. Every second counts.",
            icon: "timed" as const,
            bg: "#f2ebff",
            color: c.primary,
            label: "Timed trivia",

          },
          {
            quiz: challenger,
            title: "Go the distance",
            description: "How far can your knowledge take you?",
            icon: "trophy" as const,
            bg: "#fff0f7",
            color: "#b80070",
            label: "Challenger",

          },
        ].map((x) => (
          <Pressable
            key={x.title}
            accessibilityRole="button"
            accessibilityLabel={`${session ? "Play" : "Sign in to play"} ${x.label}`}
            disabled={!authReady || daily.loading || (!x.quiz && !daily.error)}
            onPress={() => openQuiz(x.quiz)}
            style={({ hovered, pressed }: any) => ({
              flex: 1,
              padding: compact ? 22 : 26,
              borderRadius: 22,
              opacity: pressed ? 0.88 : 1,
              backgroundColor: x.bg,
              borderWidth: 1,
              borderColor: hovered ? x.color + "55" : "transparent",
            })}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <View
                style={{
                  backgroundColor: "white",
                  borderRadius: 14,
                  padding: 11,
                }}
              >
                <LegacyIcon name={x.icon} size={26} />
              </View>
              <T
                style={{
                  fontSize: 12,
                  color: x.color,
                  fontFamily: font.semibold,
                }}
              >
                {x.label}
              </T>
            </View>
            <T style={[s.h2, { marginTop: 20, fontSize: 23, lineHeight: 31 }]}>{x.title}</T>
            <T style={{ fontSize: 14, color: c.muted, marginTop: 5 }}>
              {x.description}
            </T>
            <View
              style={{
                marginTop: 22,
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <View style={{ gap: 4 }}>
                {!!x.quiz && <T style={{ fontSize: 12, color: x.color }}>{x.quiz.questionCount} questions</T>}
                <T style={{ fontSize: 13, color: x.color, fontFamily: font.semibold }}>
                  {dailyLabel(x.quiz, daily.loading, daily.error)}
                </T>
              </View>
              <Icon name={x.quiz?.status === "completed" ? "checkmark-circle" : "arrow-forward"} color={x.color} size={20} />
            </View>
          </Pressable>
        ))}
      </View>
      <View style={{ marginTop: 36, marginBottom: 18, gap: 16 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <T accessibilityRole="header" style={s.h2}>
            Find your thing
          </T>
          {session && <Pressable
            accessibilityRole="button"
            onPress={() => setOnlyFavorites(!onlyFavorites)}
          >
            <T
              style={{
                color: c.primary,
                fontSize: 13,
                fontFamily: font.semibold,
              }}
            >
              {onlyFavorites ? "All topics" : "My topics"}
            </T>
          </Pressable>}
        </View>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            paddingHorizontal: 15,
            borderRadius: 14,
            backgroundColor: c.surface,
          }}
        >
          <Icon name="search-outline" size={18} color={c.muted} />
          <TextInput
            accessibilityLabel="Search topics"
            placeholder="Search topics"
            placeholderTextColor={c.muted}
            value={search}
            onChangeText={setSearch}
            style={
              {
                flex: 1,
                fontFamily: font.regular,
                paddingVertical: 13,
                fontSize: 14,
                color: c.text,
              } as any
            }
          />
        </View>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: "2%", rowGap: 14 }}>
        {shown.map((cat) => {
          const quiz = daily.data?.rounds.find(q => q.categoryId === cat.id && q.mode === "category");
          const played = quiz?.status === "completed";
          return (
            <Pressable
              key={cat.id}
              accessibilityRole="button"
              accessibilityLabel={`${session ? "Play" : "Sign in to play"} ${cat.name}`}
              disabled={!authReady || daily.loading || (!quiz && !daily.error)}
              onPress={() => openQuiz(quiz)}
              style={({ hovered, pressed }: any) => ({
                width: topicWidth,
                backgroundColor: pressed ? c.lavender : hovered ? "#fcfaff" : "white",
                borderWidth: 1,
                borderColor: hovered ? "#d4c2f4" : c.border,
                borderRadius: 20,
                padding: compact ? 16 : 22,
                gap: 18,
              })}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 14,
                    backgroundColor: cat.color + "15",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon
                    name={icons[cat.id] || "bulb-outline"}
                    color={cat.color}
                    size={23}
                  />
                </View>
                {played ? (
                  <Icon name="checkmark-circle" size={18} color={c.success} />
                ) : (
                  <Icon name="arrow-forward" size={17} color={c.muted} />
                )}
              </View>
              <View>
                <T style={{ fontFamily: font.semibold, fontSize: 16 }}>
                  {cat.name}
                </T>
                <T style={{ fontSize: 12, color: c.muted, marginTop: 3 }}>
                  {quiz ? `${quiz.questionCount} questions · ` : ""}
                  {dailyLabel(quiz, daily.loading, daily.error)}
                </T>
              </View>
            </Pressable>
          );
        })}
      </View>
      {onlyFavorites && favoritesError && <T style={{ color: c.muted }}>Couldn’t load your favorite topics. Open your profile to try again.</T>}
      {!shown.length && !favoritesError && (
        <View style={s.empty}>
          <Icon name="search-outline" size={30} color={c.muted} />
          <T>No topics found.</T>
          <Button
            variant="ghost"
            onPress={() => {
              setSearch("");
              setOnlyFavorites(false);
            }}
          >
            Show all topics
          </Button>
        </View>
      )}
      <View
        style={{
          marginTop: 36,
          paddingTop: 23,
          borderTopWidth: 1,
          borderColor: c.border,
          alignItems: "center",
          gap: 5,
        }}
      >
        <T style={{ fontSize: 13, color: c.muted }}>
          A fresh perspective. One question at a time.
        </T>
        <T style={{ fontSize: 11, color: "#928b9d" }}>
          Daily rounds reset at midnight UTC
        </T>
      </View>
    </Page>
  );
}
