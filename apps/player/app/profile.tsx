import { ProfilePhoto } from "../src/components/ProfilePhoto";
import { DeleteAccount } from "../src/components/DeleteAccount";
import React, { useEffect, useState } from "react";
import { View, TextInput, Pressable, Modal } from "react-native";
import { router } from "expo-router";
import { categories, quizzes } from "@bivia/core";
import { Page } from "../src/components/Page";
import {
  T,
  Icon,
  Heading,
  Button,
  Card,
  Notice,
  c,
  s,
  font,
} from "../src/components/ui";
import { useBivia } from "../src/lib/store";
import { supabase } from "../src/lib/supabase";
export default function Profile() {
  const { session } = useBivia();
  // Switching accounts remounts the editor before any previous user's fields render.
  return <ProfileEditor key={session?.user.id ?? "practice"} />;
}
function ProfileEditor() {
  const { profile, results, session, saveProfile, clearPractice } = useBivia();
  const [avatar, setAvatar] = useState<string | null>(null);
  const userId = session?.user.id ?? null;
  const [ready, setReady] = useState(!userId);
  const [loading, setLoading] = useState(Boolean(userId));
  const [loadVersion, setLoadVersion] = useState(0);
  const [name, setName] = useState(userId ? "" : profile.name),
    [selected, setSelected] = useState<string[]>(userId ? [] : profile.categories),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [confirm, setConfirm] = useState(false);
  useEffect(() => {
    if (!userId) {
      setName(profile.name);
      setSelected(profile.categories);
    }
  }, [profile, userId]);
  useEffect(() => {
    if (!userId) return;
    let current = true;
    setReady(false);
    setLoading(true);
    setAvatar(null);
    setName("");
    setSelected([]);
    setMessage("");
    if (!supabase) {
      setLoading(false);
      setMessage("The account service is not configured.");
      return;
    }
    supabase
      .from("profiles")
      .select("display_name, preferred_categories, avatar_url")
      .eq("id", userId)
      .single()
      .then(({ data, error }) => {
        if (!current) return;
        if (error || !data) {
          setMessage(error?.message ?? "Your profile could not be loaded.");
        } else {
          setAvatar(data.avatar_url);
          setName(data.display_name);
          setSelected(data.preferred_categories || []);
          setReady(true);
        }
        setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [userId, loadVersion]);
  async function save() {
    if (!ready || busy) return;
    setBusy(true);
    setMessage("");
    try {
      if (!name.trim()) throw new Error("Please enter your name.");
      if (userId) {
        if (!supabase) throw new Error("The account service is not configured.");
        const { error } = await supabase
          .from("profiles")
          .update({ display_name: name.trim(), preferred_categories: selected })
          .eq("id", userId);
        if (error) throw error;
      } else {
        await saveProfile({ name: name.trim(), categories: selected });
      }
      setMessage("Your profile has been saved.");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page narrow>
      <Heading
        title="Your little corner"
        subtitle="Make Bivia feel a little more like you."
      />
      <Card style={{ gap: 22 }}>
        <View style={s.row}>
          <View
            style={{
              width: 65,
              height: 65,
              borderRadius: 35,
              backgroundColor: c.lavender,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <T
              style={{ fontSize: 26, fontFamily: font.bold, color: c.primary }}
            >
              {name ? name[0].toUpperCase() : "?"}
            </T>
          </View>
          <View style={{ flex: 1 }}>
            <T style={s.h2}>{loading ? "Loading your profile…" : name || "Hello, curious mind"}</T>
            <T style={s.small}>
              {session ? session.user.email : "Your practice profile"}
            </T>
          </View>
        </View>
        {session && ready && (
          <ProfilePhoto
            userId={session.user.id}
            url={avatar}
            onChange={setAvatar}
          />
        )}
        {!session && (
          <Notice>
            Practice is saved on this device. Create an account to join groups
            and play ranked quizzes.
          </Notice>
        )}
        <View style={{ gap: 8 }}>
          <T style={s.label}>Your name</T>
          <TextInput
            accessibilityLabel="Your name"
            value={name}
            editable={ready && !busy}
            onChangeText={setName}
            maxLength={60}
            placeholder="What should we call you?"
            style={s.input}
          />
        </View>
        <View>
          <T style={s.h2}>Your favorite topics</T>
          <T style={[s.small, { marginTop: 5, marginBottom: 18 }]}>
            More of what makes you curious.
          </T>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 9 }}>
            {categories.map((cat) => {
              const active = selected.includes(cat.id);
              return (
                <Pressable
                  key={cat.id}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: active, disabled: !ready || busy }}
                  disabled={!ready || busy}
                  onPress={() =>
                    setSelected(
                      active
                        ? selected.filter((x) => x !== cat.id)
                        : [...selected, cat.id],
                    )
                  }
                  style={{
                    paddingVertical: 10,
                    paddingHorizontal: 16,
                    borderRadius: 30,
                    borderWidth: 1,
                    borderColor: active ? c.primary : c.border,
                    backgroundColor: active ? c.lavender : "white",
                    flexDirection: "row",
                    gap: 7,
                    alignItems: "center",
                  }}
                >
                  {active && (
                    <Icon name="checkmark" size={16} color={c.primary} />
                  )}
                  <T
                    style={{
                      fontSize: 13,
                      color: active ? c.primary : c.muted,
                      fontFamily: font.medium,
                    }}
                  >
                    {cat.name}
                  </T>
                </Pressable>
              );
            })}
          </View>
        </View>
        <Button onPress={save} disabled={busy || !ready}>
          {busy ? "Saving…" : "Save profile"}
        </Button>
        {!!message && (
          <T
            accessibilityLiveRegion="polite"
            style={{
              color: message.includes("saved") ? c.success : c.pink,
              fontSize: 13,
            }}
          >
            {message}
          </T>
        )}
        {session && !ready && !loading && (
          <Button variant="secondary" onPress={() => setLoadVersion(version => version + 1)}>
            Retry loading profile
          </Button>
        )}
        {!session ? (
          <Button variant="secondary" onPress={() => router.push("/auth")}>
            Sign in or create an account
          </Button>
        ) : (
          <Button
            variant="ghost"
            onPress={async () => {
              const { error } = await supabase!.auth.signOut();
              if (error) setMessage(error.message);
            }}
          >
            Sign out
          </Button>
        )}
        {session && <DeleteAccount userId={session.user.id} />}
      </Card>
      <View style={{ marginTop: 32 }}>
        <Heading
          title="Practice history"
          subtitle={`${results.length} rounds · ${results.reduce((sum, r) => sum + r.score, 0)} practice points`}
        />
        {results.length ? (
          <View style={{ gap: 10 }}>
            {results.slice(0, 10).map((r) => (
              <Pressable
                key={r.id}
                accessibilityRole="button"
                onPress={() => router.push(`/results/${r.id}` as any)}
              >
                <Card
                  style={{
                    padding: 18,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 14,
                  }}
                >
                  <Icon name="checkmark-circle-outline" color={c.primary} />
                  <View style={{ flex: 1 }}>
                    <T style={{ fontFamily: font.semibold }}>
                      {quizzes.find((q) => q.id === r.quizId)?.title ||
                        "Trivia round"}
                    </T>
                    <T style={s.small}>
                      {new Date(r.completedAt).toLocaleDateString()}
                    </T>
                  </View>
                  <T style={{ fontFamily: font.bold, color: c.primary }}>
                    {r.score} pts
                  </T>
                </Card>
              </Pressable>
            ))}
            <Button variant="ghost" onPress={() => setConfirm(true)}>
              Clear practice history
            </Button>
          </View>
        ) : (
          <Card style={s.empty}>
            <Icon name="sparkles-outline" color={c.primary} size={30} />
            <T>Your first discovery is waiting.</T>
            <Button variant="secondary" onPress={() => router.push("/")}>
              Find a quiz
            </Button>
          </Card>
        )}
      </View>
      <Modal
        visible={confirm}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirm(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "#17132088",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <Card
            style={{
              alignSelf: "center",
              maxWidth: 420,
              width: "100%",
              gap: 18,
            }}
          >
            <T style={s.h2}>Clear local practice history?</T>
            <T>
              This removes practice results from this device. Ranked scores are
              unaffected.
            </T>
            <Button
              onPress={async () => {
                await clearPractice();
                setConfirm(false);
              }}
            >
              Clear practice history
            </Button>
            <Button variant="secondary" onPress={() => setConfirm(false)}>
              Keep my history
            </Button>
          </Card>
        </View>
      </Modal>
    </Page>
  );
}
