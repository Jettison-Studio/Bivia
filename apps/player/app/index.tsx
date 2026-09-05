import { CatalogSection } from "../src/components/CatalogSection";
import React, { useState } from "react";
import {
  View,
  Pressable,
  TextInput,
  useWindowDimensions,
  ScrollView,
} from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { categories, quizzes } from "@bivia/core";
import { Page } from "../src/components/Page";
import { T, Icon, LegacyIcon, Button, c, s, font } from "../src/components/ui";
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
  const { profile, results } = useBivia();
  const [search, setSearch] = useState("");
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const compact = width < 760;
  const timed = quizzes.find((q) => q.mode === "timed")!,
    challenger = quizzes.find((q) => q.mode === "challenger")!;
  const shown = categories.filter(
    (cat) =>
      cat.name.toLowerCase().includes(search.toLowerCase()) &&
      (!onlyFavorites || profile.categories.includes(cat.id)),
  );
  return (
    <Page>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 26,
        }}
      >
        <View>
          <T style={{ fontSize: 13, color: c.muted, marginBottom: 6 }}>
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </T>
          <T
            accessibilityRole="header"
            style={[s.h1, { fontSize: compact ? 28 : 34 }]}
          >
            A little trivia. A little faith.
          </T>
          <T style={{ color: c.muted, marginTop: 7 }}>
            Big discoveries start with a good question.
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
          borderRadius: 18,
          padding: compact ? 26 : 36,
          overflow: "hidden",
        }}
      >
        <View style={{ flexDirection: "row", gap: 20, alignItems: "center" }}>
          <View style={{ flex: 1 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                marginBottom: 15,
              }}
            >
              <Icon name="sparkles-outline" size={17} color="#eadfff" />
              <T
                style={{
                  fontSize: 13,
                  color: "#eadfff",
                  fontFamily: font.medium,
                }}
              >
                Trivia with a hint of Bible
              </T>
            </View>
            <T
              style={{
                fontSize: compact ? 29 : 38,
                lineHeight: compact ? 36 : 46,
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
              onPress={() => router.push(`/quiz/${quizzes[0].id}` as any)}
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
      <CatalogSection />
      <View
        style={{
          marginTop: 32,
          marginBottom: 16,
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <T accessibilityRole="header" style={s.h2}>
          Warm up with practice
        </T>
        <T style={s.small}>Try a different pace</T>
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
            count: "10 questions",
          },
          {
            quiz: challenger,
            title: "Go the distance",
            description: "How far can your knowledge take you?",
            icon: "trophy" as const,
            bg: "#fff0f7",
            color: "#b80070",
            label: "Challenger",
            count: "20 questions",
          },
        ].map((x) => (
          <Pressable
            key={x.title}
            accessibilityRole="button"
            accessibilityLabel={`Play ${x.label}`}
            onPress={() => router.push(`/quiz/${x.quiz.id}` as any)}
            style={({ hovered }: any) => ({
              flex: 1,
              padding: 24,
              borderRadius: 15,
              backgroundColor: x.bg,
              borderWidth: 1,
              borderColor: hovered ? x.color : "transparent",
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
                  borderRadius: 11,
                  padding: 10,
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
            <T style={[s.h2, { marginTop: 18 }]}>{x.title}</T>
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
              <T style={{ fontSize: 12, color: x.color }}>{x.count}</T>
              <Icon name="arrow-forward" color={x.color} size={20} />
            </View>
          </Pressable>
        ))}
      </View>
      <View style={{ marginTop: 34, marginBottom: 18, gap: 16 }}>
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
          <Pressable
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
          </Pressable>
        </View>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            paddingHorizontal: 15,
            borderRadius: 10,
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
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
        {shown.map((cat) => {
          const quiz = quizzes.find(
            (q) => q.categoryId === cat.id && q.mode === "category",
          )!;
          const played = results.some((r) => r.quizId === quiz.id);
          return (
            <Pressable
              key={cat.id}
              accessibilityRole="button"
              accessibilityLabel={`Play ${cat.name}`}
              onPress={() => router.push(`/quiz/${quiz.id}` as any)}
              style={({ hovered }: any) => ({
                width: compact ? "47.5%" : "31.8%",
                flexGrow: 1,
                borderWidth: 1,
                borderColor: hovered ? c.primary : c.border,
                borderRadius: 14,
                padding: compact ? 18 : 22,
                gap: 15,
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
                    borderRadius: 12,
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
                  {quiz.questions.length} questions ·{" "}
                  {played ? "Play again" : "Something to discover"}
                </T>
              </View>
            </Pressable>
          );
        })}
      </View>
      {!shown.length && (
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
          Sample quizzes · Practice scores stay on this device
        </T>
      </View>
    </Page>
  );
}
