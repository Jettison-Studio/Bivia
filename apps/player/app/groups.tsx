import React, { useEffect, useState } from "react";
import { View, TextInput, Pressable, Modal } from "react-native";
import { router } from "expo-router";
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
import { rpc } from "../src/lib/supabase";
type Group = {
  id: string;
  name: string;
  description: string;
  visibility: string;
  member_count: number;
  membership: string | null;
};
export default function Groups() {
  const { session } = useBivia();
  const [groups, setGroups] = useState<Group[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [create, setCreate] = useState(false),
    [name, setName] = useState(""),
    [visibility, setVisibility] = useState("private"),
    [busy, setBusy] = useState(false),
    [search, setSearch] = useState("");
  async function load() {
    setLoading(true);
    setError("");
    try {
      setGroups(await rpc<Group[]>("bivia_groups_v1"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    if (session) load();
  }, [session]);
  return (
    <Page>
      <Heading
        title="Better with your people."
        subtitle="A little friendly competition brings us together."
        action={
          session ? (
            <Button icon="add" onPress={() => setCreate(true)}>
              Create group
            </Button>
          ) : undefined
        }
      />
      {!session ? (
        <Card style={{ alignItems: "center", gap: 20, padding: 40 }}>
          <View
            style={{
              padding: 22,
              backgroundColor: c.lavender,
              borderRadius: 50,
            }}
          >
            <Icon name="people-outline" size={40} color={c.primary} />
          </View>
          <T style={[s.h2, { textAlign: "center" }]}>
            Your friends. Your family. Your friendly rivals.
          </T>
          <T style={{ maxWidth: 450, color: c.muted, textAlign: "center" }}>
            Create a private group, invite your people, and see who comes out on
            top. Or discover a public group.
          </T>
          <Button onPress={() => router.push("/auth")}>
            Sign in to find your people
          </Button>
        </Card>
      ) : (
        <>
          <TextInput
            accessibilityLabel="Search groups"
            placeholder="Find a group"
            value={search}
            onChangeText={setSearch}
            style={[s.input, { marginBottom: 22 }]}
          />
          {error && (
            <View style={{ gap: 12, marginBottom: 18 }}>
              <Notice>{error}</Notice>
              <Button variant="secondary" onPress={load}>
                Try again
              </Button>
            </View>
          )}
          {loading ? (
            <T>Finding your groups…</T>
          ) : (
            <View style={{ gap: 14 }}>
              {groups
                .filter((g) =>
                  g.name.toLowerCase().includes(search.toLowerCase()),
                )
                .map((g) => (
                  <Pressable
                    key={g.id}
                    accessibilityRole="button"
                    onPress={() => router.push(`/group/${g.id}` as any)}
                  >
                    <Card
                      style={{
                        flexDirection: "row",
                        gap: 18,
                        alignItems: "center",
                      }}
                    >
                      <View
                        style={{
                          width: 52,
                          height: 52,
                          backgroundColor: c.lavender,
                          borderRadius: 14,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Icon
                          name={
                            g.visibility === "private"
                              ? "lock-closed-outline"
                              : "people-outline"
                          }
                          color={c.primary}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <T style={s.h2}>{g.name}</T>
                        <T style={s.small}>
                          {g.visibility === "private" ? "Private" : "Public"} ·{" "}
                          {g.member_count} members
                          {g.membership ? ` · ${g.membership}` : ""}
                        </T>
                      </View>
                      <Icon name="chevron-forward" color={c.muted} />
                    </Card>
                  </Pressable>
                ))}
              {!groups.length && !error && (
                <Card style={s.empty}>
                  <Icon name="people-outline" size={36} color={c.primary} />
                  <T style={s.h2}>Start something together.</T>
                  <T style={{ color: c.muted, textAlign: "center" }}>
                    Create the first group and invite someone curious.
                  </T>
                  <Button variant="secondary" onPress={() => setCreate(true)}>
                    Create a group
                  </Button>
                </Card>
              )}
            </View>
          )}
        </>
      )}
      <Modal
        visible={create}
        transparent
        animationType="fade"
        onRequestClose={() => setCreate(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "#17132088",
            padding: 24,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Card style={{ width: "100%", maxWidth: 480, gap: 18 }}>
            <T style={s.h2}>Make room for your people.</T>
            <TextInput
              accessibilityLabel="Group name"
              value={name}
              onChangeText={setName}
              maxLength={80}
              placeholder="Give your group a name"
              style={s.input}
            />
            <View style={s.row}>
              {["private", "public"].map((v) => (
                <Pressable
                  key={v}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: visibility === v }}
                  onPress={() => setVisibility(v)}
                  style={{
                    flex: 1,
                    borderWidth: 1,
                    borderColor: visibility === v ? c.primary : c.border,
                    borderRadius: 10,
                    padding: 15,
                    backgroundColor: visibility === v ? c.lavender : "white",
                  }}
                >
                  <T
                    style={{
                      fontFamily: font.semibold,
                      textTransform: "capitalize",
                    }}
                  >
                    {v}
                  </T>
                  <T style={s.small}>
                    {v === "private" ? "Invite and approve" : "Anyone can join"}
                  </T>
                </Pressable>
              ))}
            </View>
            {!!error && <Notice>{error}</Notice>}
            <Button
              disabled={busy || !name.trim()}
              onPress={async () => {
                setBusy(true);
                setError("");
                try {
                  await rpc("bivia_group_action_v1", {
                    p_action: "create",
                    p_payload: { name: name.trim(), visibility },
                  });
                  setCreate(false);
                  setName("");
                  await load();
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Creating…" : "Create group"}
            </Button>
            <Button variant="ghost" onPress={() => setCreate(false)}>
              Cancel
            </Button>
          </Card>
        </View>
      </Modal>
    </Page>
  );
}
