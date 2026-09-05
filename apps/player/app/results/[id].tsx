import React, { useState } from "react";
import { View, Share, Platform } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { quizzes } from "@bivia/core";
import { Page } from "../../src/components/Page";
import { T, Icon, Button, Card, c, s, font } from "../../src/components/ui";
import { useBivia } from "../../src/lib/store";
export default function Results() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { results, ready } = useBivia();
  const [message, setMessage] = useState("");
  const result = results.find((r) => r.id === id);
  if (!ready)
    return (
      <Page>
        <T>Loading your result…</T>
      </Page>
    );
  if (!result)
    return (
      <Page narrow>
        <T style={s.h1}>This result lives on another device.</T>
        <T style={{ marginVertical: 20 }}>
          Try a round of your own and see what you discover.
        </T>
        <Button onPress={() => router.replace("/")}>Explore trivia</Button>
      </Page>
    );
  const quiz = quizzes.find((q) => q.id === result.quizId)!;
  async function share() {
    const text = `I scored ${result!.score} points in ${quiz.title} on Bivia. Trivia with a hint of Bible!`;
    try {
      if (Platform.OS === "web") {
        await Clipboard.setStringAsync(text);
        setMessage("Result copied. Share it with a curious friend!");
      } else {
        await Share.share({ message: text });
      }
    } catch {
      setMessage("Sharing was unavailable. Try again.");
    }
  }
  return (
    <Page narrow>
      <Card style={{ padding: 36, alignItems: "center", gap: 20 }}>
        <View
          style={{
            width: 88,
            height: 88,
            borderRadius: 44,
            backgroundColor: c.lavender,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="trophy-outline" color={c.primary} size={43} />
        </View>
        <T
          style={{ color: c.primary, fontFamily: font.semibold, fontSize: 13 }}
        >
          PRACTICE COMPLETE
        </T>
        <T accessibilityRole="header" style={[s.h1, { textAlign: "center" }]}>
          {result.score > 0
            ? "Look at you, curious mind."
            : "Every question is a discovery."}
        </T>
        <T style={{ color: c.muted, textAlign: "center" }}>{quiz.title}</T>
        <T
          style={{
            fontSize: 74,
            lineHeight: 85,
            fontFamily: font.bold,
            letterSpacing: -3,
            color: c.primary,
          }}
        >
          {result.score}
          <T style={{ fontSize: 20, color: c.muted }}> pts</T>
        </T>
        <View style={{ flexDirection: "row", gap: 35, marginBottom: 6 }}>
          <View style={{ alignItems: "center" }}>
            <T style={s.h2}>
              {result.correct} / {result.total}
            </T>
            <T style={s.small}>Questions answered</T>
          </View>
          <View style={{ alignItems: "center" }}>
            <T style={s.h2}>
              {Math.round((result.score / (result.total * 3)) * 100)}%
            </T>
            <T style={s.small}>Available points</T>
          </View>
        </View>
        <T style={{ color: c.muted, textAlign: "center", fontSize: 13 }}>
          Saved to your practice history on this device.
        </T>
        <View style={{ width: "100%", gap: 12, marginTop: 8 }}>
          <Button icon="share-outline" onPress={share}>
            Share your result
          </Button>
          <Button variant="secondary" onPress={() => router.replace("/")}>
            Find another challenge
          </Button>
          <Button
            variant="ghost"
            onPress={() => router.replace(`/quiz/${quiz.id}` as any)}
          >
            Play this one again
          </Button>
        </View>
        {!!message && (
          <T
            accessibilityLiveRegion="polite"
            style={{ fontSize: 13, color: c.success, textAlign: "center" }}
          >
            {message}
          </T>
        )}
      </Card>
    </Page>
  );
}
