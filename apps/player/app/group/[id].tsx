import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Pressable, Modal } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import { Page } from "../../src/components/Page";
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
} from "../../src/components/ui";
import { useBivia } from "../../src/lib/store";
import { rpc } from "../../src/lib/supabase";
type Member = {
  userId: string;
  displayName: string;
  status: "active" | "pending";
};
type GroupSummary = {
  id: string;
  name: string;
  description: string;
  visibility: "public" | "private";
  owner_id: string;
  membership?: "active" | "pending" | null;
};
type GroupDetails = {
  group: GroupSummary;
  members: Member[];
  invites: { id: string; expiresAt: string; revokedAt: string | null }[];
};
type BoardRow = {
  userId: string;
  displayName: string;
  rank: number;
  score: number;
};
export default function Group() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useBivia();
  const [data, setData] = useState<GroupDetails | null>(null),
    [pending, setPending] = useState<GroupSummary | null>(null),
    [board, setBoard] = useState<BoardRow[]>([]),
    [loading, setLoading] = useState(false),
    [loadedFor, setLoadedFor] = useState<string | undefined>(undefined),
    [inviteLink, setInviteLink] = useState(""),
    [period, setPeriod] = useState("weekly"),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const requestSequence = useRef(0);
  const userId = session?.user.id;
  const load = useCallback(async () => {
    const sequence = ++requestSequence.current;
    setData(null);
    setPending(null);
    setBoard([]);
    if (!userId) return;
    setLoading(true);
    try {
      const [details, scores] = await Promise.all([
        rpc<GroupDetails>("bivia_group_v1", { p_group_id: id }),
        rpc<BoardRow[]>("bivia_leaderboard_v1", {
          p_period: period,
          p_group_id: id,
        }),
      ]);
      if (sequence !== requestSequence.current) return;
      setLoadedFor(userId);
      setData(details);
      setBoard(scores);
    } catch (error) {
      // Pending members can read their request summary, not private members/scores.
      try {
        const summaries = await rpc<GroupSummary[]>("bivia_groups_v1");
        if (sequence !== requestSequence.current) return;
        const request = summaries.find(
          (group) => group.id === id && group.membership === "pending",
        );
        if (request) {
          setLoadedFor(userId);
          setPending(request);
        } else setMessage((error as Error).message);
      } catch {
        if (sequence === requestSequence.current)
          setMessage((error as Error).message);
      }
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, [id, userId, period]);
  useEffect(() => {
    setMessage("");
    setInviteLink("");
    void load();
    return () => {
      requestSequence.current += 1;
    };
  }, [load]);
  async function action(a: string, payload: Record<string, unknown> = {}) {
    if (busy) return;
    const sequence = requestSequence.current;
    setBusy(true);
    setMessage("");
    try {
      const result = await rpc<any>("bivia_group_action_v1", {
        p_action: a,
        p_group_id: id,
        p_payload: payload,
      });
      if (sequence !== requestSequence.current) return;
      if (a === "invite") {
        const link = Linking.createURL("/invite", {
          queryParams: { token: result.token },
        });
        setInviteLink(link);
        try {
          await Clipboard.setStringAsync(link);
          setMessage("Invite link copied. Share it with your people.");
        } catch {
          setMessage("Your invite is ready. Copy the link below to share it.");
        }
      }
      if (a === "revoke_invite") {
        setInviteLink("");
        setMessage("Invite revoked. That link can no longer be used.");
      }
      if (a === "remove") setMessage("Membership removed.");
      if (a === "approve") setMessage("Membership approved. Welcome them in!");
      if (a === "leave" || a === "delete") {
        router.replace("/groups");
        return;
      }
      await load();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!session)
    return (
      <Page narrow>
        <Heading title="Your people are waiting." />
        <Button
          onPress={() =>
            router.push({ pathname: "/auth", params: { next: `/group/${id}` } })
          }
        >
          Sign in to view this group
        </Button>
      </Page>
    );
  if ((data || pending) && loadedFor !== session.user.id) {
    return (
      <Page narrow>
        <T>Loading your group…</T>
      </Page>
    );
  }
  return (
    <Page narrow>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push("/groups")}
        style={[s.row, { marginBottom: 25 }]}
      >
        <Icon name="arrow-back" size={19} />
        <T style={s.small}>All groups</T>
      </Pressable>
      {pending && (
        <Card style={{ gap: 18 }}>
          <Heading
            title={pending.name}
            subtitle="Your request is waiting for the group owner."
          />
          <T style={{ color: c.muted }}>
            You’ll be able to see the members and leaderboard once your request
            is approved.
          </T>
          <Button disabled={busy || loading} variant="secondary" onPress={load}>
            Check membership
          </Button>
          <Button
            disabled={busy}
            variant="ghost"
            onPress={() => action("leave")}
          >
            Cancel request
          </Button>
        </Card>
      )}
      {data && (
        <>
          <Heading
            title={data.group.name}
            subtitle={
              data.group.description || "A little friendly competition."
            }
          />
          <View style={[s.row, { marginBottom: 24, flexWrap: "wrap" }]}>
            <T style={s.small}>{data.group.visibility} group</T>
            {data.group.owner_id === session.user.id ? (
              <Button
                disabled={busy}
                variant="secondary"
                icon="link-outline"
                onPress={() => action("invite")}
              >
                Invite your people
              </Button>
            ) : data.members?.some(
                (m) => m.userId === session.user.id && m.status === "active",
              ) ? (
              <Button
                disabled={busy}
                variant="ghost"
                onPress={() => action("leave")}
              >
                Leave group
              </Button>
            ) : data.group.visibility === "public" ? (
              <Button
                disabled={busy}
                variant="secondary"
                onPress={() => action("join")}
              >
                Join group
              </Button>
            ) : null}
          </View>
          <View
            style={{
              flexDirection: "row",
              gap: 6,
              marginBottom: 20,
              flexWrap: "wrap",
            }}
          >
            {[
              ["daily", "Day"],
              ["weekly", "Week"],
              ["monthly", "Month"],
              ["yearly", "Year"],
              ["all", "All time"],
            ].map(([key, label]) => (
              <Pressable
                key={key}
                accessibilityRole="tab"
                accessibilityState={{ selected: period === key }}
                onPress={() => setPeriod(key)}
                style={{
                  paddingHorizontal: 18,
                  paddingVertical: 10,
                  borderRadius: 30,
                  backgroundColor: period === key ? c.primary : c.surface,
                }}
              >
                <T
                  style={{
                    fontSize: 13,
                    fontFamily: font.semibold,
                    color: period === key ? "white" : c.muted,
                  }}
                >
                  {label}
                </T>
              </Pressable>
            ))}
          </View>
          <Card>
            <T style={[s.h2, { marginBottom: 18 }]}>The friendly leaderboard</T>
            {board.length ? (
              board.map((row) => (
                <View
                  key={row.userId}
                  style={{
                    flexDirection: "row",
                    gap: 14,
                    paddingVertical: 15,
                    borderBottomWidth: 1,
                    borderColor: c.border,
                    alignItems: "center",
                  }}
                >
                  <T
                    style={{
                      color: c.primary,
                      fontFamily: font.bold,
                      width: 25,
                    }}
                  >
                    {row.rank}
                  </T>
                  <T style={{ flex: 1, fontFamily: font.medium }}>
                    {row.displayName}
                  </T>
                  <T style={{ fontFamily: font.bold }}>{row.score} pts</T>
                </View>
              ))
            ) : (
              <View style={s.empty}>
                <Icon name="trophy-outline" size={30} color={c.primary} />
                <T style={{ textAlign: "center", color: c.muted }}>
                  The board is waiting for its first score.
                </T>
              </View>
            )}
          </Card>
          {data.group.owner_id === session.user.id &&
            data.members?.some((m) => m.status === "pending") && (
              <Card style={{ marginTop: 20, gap: 14 }}>
                <T style={s.h2}>People at the door</T>
                {data.members
                  .filter((m) => m.status === "pending")
                  .map((m) => (
                    <View key={m.userId} style={s.row}>
                      <T style={{ flex: 1 }}>{m.displayName || "New member"}</T>
                      <Button
                        disabled={busy}
                        onPress={() => action("approve", { userId: m.userId })}
                      >
                        Approve
                      </Button>
                      <Button
                        disabled={busy}
                        variant="ghost"
                        onPress={() => action("remove", { userId: m.userId })}
                      >
                        Decline
                      </Button>
                    </View>
                  ))}
              </Card>
            )}
          {data.group.owner_id === session.user.id && (
            <>
              <Card style={{ marginTop: 20, gap: 14 }}>
                <T style={s.h2}>Your people</T>
                {data.members
                  .filter((member) => member.status === "active")
                  .map((member) => (
                    <View
                      key={member.userId}
                      style={[s.row, { flexWrap: "wrap" }]}
                    >
                      <T style={{ flex: 1 }}>{member.displayName}</T>
                      {member.userId === session.user.id ? (
                        <T style={s.small}>Owner</T>
                      ) : (
                        <Button
                          disabled={busy}
                          variant="ghost"
                          onPress={() =>
                            action("remove", { userId: member.userId })
                          }
                        >
                          Remove
                        </Button>
                      )}
                    </View>
                  ))}
              </Card>
              {!!data.invites.length && (
                <Card style={{ marginTop: 20, gap: 14 }}>
                  <T style={s.h2}>Invitation links</T>
                  {data.invites.map((invite) => {
                    const active =
                      !invite.revokedAt &&
                      new Date(invite.expiresAt).getTime() > Date.now();
                    return (
                      <View
                        key={invite.id}
                        style={[s.row, { flexWrap: "wrap" }]}
                      >
                        <T style={[s.small, { flex: 1 }]}>
                          {invite.revokedAt
                            ? "Revoked"
                            : active
                              ? `Expires ${new Date(invite.expiresAt).toLocaleDateString()}`
                              : "Expired"}
                        </T>
                        {active && (
                          <Button
                            disabled={busy}
                            variant="ghost"
                            onPress={() =>
                              action("revoke_invite", { inviteId: invite.id })
                            }
                          >
                            Revoke link
                          </Button>
                        )}
                      </View>
                    );
                  })}
                </Card>
              )}
            </>
          )}
        </>
      )}
      {data?.group.owner_id === session.user.id && (
        <Button
          variant="ghost"
          disabled={busy}
          onPress={() => setConfirmDelete(true)}
          style={{ marginTop: 24 }}
        >
          Delete group
        </Button>
      )}
      <Modal
        visible={confirmDelete}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!busy) setConfirmDelete(false);
        }}
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
              width: "100%",
              maxWidth: 440,
              alignSelf: "center",
              gap: 18,
            }}
          >
            <T style={s.h2}>Delete this group?</T>
            <T>
              This permanently removes the group, its memberships, and
              invitation links. Players keep their individual ranked results.
            </T>
            <Button
              disabled={busy}
              onPress={async () => {
                await action("delete");
                setConfirmDelete(false);
              }}
            >
              {busy ? "Deleting…" : "Delete group permanently"}
            </Button>
            <Button
              disabled={busy}
              variant="secondary"
              onPress={() => setConfirmDelete(false)}
            >
              Keep group
            </Button>
          </Card>
        </View>
      </Modal>
      {!!inviteLink && (
        <T selectable style={[s.small, { marginTop: 20 }]}>
          {inviteLink}
        </T>
      )}
      {!!message && (
        <View style={{ marginTop: 20 }}>
          <Notice>{message}</Notice>
        </View>
      )}
      {loading && (
        <T style={[s.small, { marginTop: 20 }]}>Loading your group…</T>
      )}
      {!data && !pending && !loading && (
        <Button onPress={load} variant="secondary">
          Reload group
        </Button>
      )}
    </Page>
  );
}
