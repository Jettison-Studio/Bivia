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
import { T, Icon, Button, c, s, font } from "../src/components/ui";
import { supabase } from "../src/lib/supabase";
import { useBivia } from "../src/lib/store";
const icons: Record<string, string> = {
  fitness: "barbell-outline",
  geography: "earth-outline",
  sports: "football-outline",
  media: "film-outline",
  music: "musical-notes-outline",
  science: "flask-outline",
  nature: "leaf-outline",
  history: "hourglass-outline",
  food: "restaurant-outline",
  entertainment: "ticket-outline",
};
export default function Home() {
  const { width } = useWindowDimensions();
  const { session, authReady } = useBivia();
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
      cat.id !== "mixed" && cat.name.toLowerCase().includes(search.toLowerCase()) &&
      (!session || !onlyFavorites || favorites.includes(cat.id)),
  );
  const rounds = daily.data?.rounds ?? [];
  const completed = rounds.filter(round => round.status === "completed").length;
  const edition = daily.data?.day ?? new Date().toISOString().slice(0, 10);
  const date = new Date(`${edition}T12:00:00Z`);
  const status = (round?: DailyRound) => {
    if (daily.loading || daily.error || !round) return dailyLabel(round, daily.loading, daily.error);
    if (!session) return `${round.questionCount} questions`;
    if (round.status === "completed") return `Done · ${round.score ?? 0} pts`;
    return round.status === "active" ? "Resume" : `${round.questionCount} questions`;
  };
  return (
    <Page>
      <View style={{ alignItems: "center", paddingTop: 4, paddingBottom: 28, gap: 8 }}>
        <T style={{ fontSize: 11, letterSpacing: 2.5, color: c.muted, fontFamily: font.semibold }}>
          {date.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" }).toUpperCase()}
        </T>
        <T accessibilityRole="header" style={[s.h1, { textAlign: "center", fontSize: compact ? 38 : 52, lineHeight: compact ? 48 : 62 }]}>
          {date.toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" })}
        </T>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ width: 24, height: 1, backgroundColor: c.border }} />
          <T style={{ fontSize: 13, color: c.muted }}>Trivia with a hint of bible</T>
          <View style={{ width: 24, height: 1, backgroundColor: c.border }} />
        </View>
      </View>
      {session && !!rounds.length && !daily.error && <View style={{ gap: 9, marginBottom: 26 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <T style={{ fontSize: 12, color: c.muted }}>Today’s progress</T>
          <T style={{ fontSize: 12, color: c.primary, fontFamily: font.semibold }}>{completed} of {rounds.length} complete</T>
        </View>
        <View accessibilityRole="progressbar" accessibilityLabel="Today’s completed rounds" accessibilityValue={{ min: 0, max: rounds.length, now: completed }} style={{ height: 4, backgroundColor: c.lavender, borderRadius: 4, overflow: "hidden" }}>
          <View style={{ width: `${completed / rounds.length * 100}%`, height: "100%", backgroundColor: c.primary }} />
        </View>
      </View>}
      {!session && <LinearGradient colors={["#5f00e6", "#760ce6"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 22, padding: compact ? 24 : 30, marginBottom: 26, overflow: "hidden" }}>
        <View pointerEvents="none" style={{ position: "absolute", right: -12, top: -35, transform: [{ rotate: "14deg" }], opacity: 0.12 }}>
          <T style={{ fontSize: 230, lineHeight: 270, fontFamily: font.bold, color: "white" }}>?</T>
        </View>
        <T style={{ color: "#e7d8ff", fontSize: 11, letterSpacing: 1.5, fontFamily: font.semibold }}>A LITTLE WARM-UP</T>
        <T style={{ color: "white", fontSize: compact ? 28 : 34, lineHeight: 42, fontFamily: font.bold, marginTop: 8 }}>{quizzes[0].title}</T>
        <T style={{ color: "#e7d8ff", fontSize: 13, marginTop: 5 }}>{quizzes[0].questions.length} questions. See what clicks.</T>
        <Button variant="white" icon="arrow-forward" disabled={!authReady} onPress={() => router.push(`/quiz/${quizzes[0].id}` as any)} style={{ alignSelf: "flex-start", marginTop: 20 }}>Play a sample</Button>
      </LinearGradient>}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
        <T accessibilityRole="header" style={{ fontFamily: font.semibold, fontSize: 18 }}>Today’s challenges</T>
        <T style={{ fontSize: 12, color: c.muted }}>Two ways to play</T>
      </View>
      <View style={{ flexDirection: "row", gap: 12 }}>
        {[
          { quiz: timed, title: "Beat the clock", icon: "timer-outline", bg: "#5f00e6", label: "TIMED" },
          { quiz: challenger, title: "Go the distance", icon: "flash-outline", bg: "#251736", label: "CHALLENGER" },
        ].map(x => <Pressable key={x.label} accessibilityRole="button" accessibilityLabel={`${x.label}. ${status(x.quiz)}${session ? "" : ". Sign in to play"}`} disabled={!authReady || daily.loading || (!x.quiz && !daily.error)} onPress={() => openQuiz(x.quiz)} style={({ pressed, hovered }: any) => ({ flex: 1, minHeight: 178, padding: compact ? 16 : 24, borderRadius: 20, backgroundColor: x.bg, opacity: pressed ? 0.8 : hovered ? 0.94 : 1, justifyContent: "space-between", gap: 18 })}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Icon name={x.icon} size={26} color="white" />
            <Icon name={x.quiz?.status === "completed" ? "checkmark-circle" : session ? "arrow-forward" : "lock-closed-outline"} size={16} color="#dfcaff" />
          </View>
          <View style={{ minHeight: compact ? 100 : 90 }}>
            <T style={{ color: "#dfcaff", fontSize: 9, letterSpacing: 1.3, fontFamily: font.semibold }}>{x.label}</T>
            <T style={{ color: "white", fontSize: compact ? 19 : 25, lineHeight: compact ? 25 : 32, fontFamily: font.bold, marginTop: 5 }}>{x.title}</T>
            <T style={{ color: "#e7d8ff", fontSize: 11, marginTop: 8 }}>{status(x.quiz)}</T>
          </View>
        </Pressable>)}
      </View>
      <View style={{ marginTop: 28, marginBottom: 14, gap: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <T accessibilityRole="header" style={{ fontFamily: font.semibold, fontSize: 18 }}>Find your thing</T>
          {session && <Pressable accessibilityRole="button" onPress={() => setOnlyFavorites(!onlyFavorites)}><T style={{ color: c.primary, fontSize: 13, fontFamily: font.semibold }}>{onlyFavorites ? "All topics" : "My topics"}</T></Pressable>}
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 15, borderRadius: 12, backgroundColor: c.surface }}>
          <Icon name="search-outline" size={18} color={c.muted} />
          <TextInput accessibilityLabel="Search topics" placeholder="Search topics" placeholderTextColor={c.muted} value={search} onChangeText={setSearch} style={{ flex: 1, fontFamily: font.regular, paddingVertical: 12, fontSize: 14, color: c.text }} />
        </View>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: "2%", rowGap: 12 }}>
        {shown.map(cat => {
          const quiz = rounds.find(q => q.categoryId === cat.id && q.mode === "category");
          const played = quiz?.status === "completed";
          const action = quiz && !daily.loading && !daily.error && quiz.status === "unplayed"
            ? `Play · ${quiz.questionCount} questions` : status(quiz);
          return <Pressable key={cat.id} accessibilityRole="button" accessibilityLabel={`${cat.name}. ${quiz?.title ?? ""}. ${action}${session ? "" : ". Sign in to play"}`} disabled={!authReady || daily.loading || (!quiz && !daily.error)} onPress={() => openQuiz(quiz)} style={({ hovered, pressed }: any) => ({ width: topicWidth, minHeight: compact ? 180 : 188, padding: compact ? 14 : 18, borderWidth: 1, borderColor: hovered ? cat.color : c.border, borderRadius: 18, overflow: "hidden", backgroundColor: pressed ? c.lavender : cat.color + "09" })}>
            <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ position: "absolute", right: -15, top: -12, opacity: 0.07, transform: [{ rotate: "-14deg" }] }}>
              <Icon name={icons[cat.id] || "bulb-outline"} color={cat.color} size={100} />
            </View>
            <Icon name={icons[cat.id] || "bulb-outline"} color={cat.color} size={25} />
            <T style={{ fontFamily: font.bold, fontSize: compact && cat.name.length > 12 ? 17 : 19, lineHeight: 25, marginTop: 10 }}>{cat.name}</T>
            <T numberOfLines={2} style={{ fontSize: 12, lineHeight: 17, color: c.muted, marginTop: 4, minHeight: 34 }}>{quiz?.title ?? "A new round is on its way"}</T>
            <View style={{ flex: 1, minHeight: 12 }} />
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 4, paddingTop: 10, borderTopWidth: 1, borderTopColor: cat.color + "20" }}>
              <T style={{ flex: 1, fontSize: 11, color: played ? c.success : c.text, fontFamily: font.semibold }}>{action}</T>
              <Icon name={played ? "checkmark-circle" : session ? "arrow-forward" : "lock-closed-outline"} size={15} color={played ? c.success : cat.color} />
            </View>
          </Pressable>;
        })}
      </View>
      {onlyFavorites && favoritesError && <T style={{ color: c.muted }}>Couldn’t load your favorite topics. Open your profile to try again.</T>}
      {!shown.length && !favoritesError && <View style={s.empty}>
        <Icon name="search-outline" size={30} color={c.muted} /><T>No topics found.</T>
        <Button variant="ghost" onPress={() => { setSearch(""); setOnlyFavorites(false); }}>Show all topics</Button>
      </View>}
      <T style={{ marginTop: 28, fontSize: 11, color: c.muted, textAlign: "center" }}>Daily rounds reset at midnight UTC</T>
    </Page>
  );
}
