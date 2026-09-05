import React, { useEffect, useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Page } from "../src/components/Page";
import { T, Button, Card, Notice, s } from "../src/components/ui";
import { useBivia } from "../src/lib/store";
import { rpc } from "../src/lib/supabase";

type MembershipResult = { id: string; status: "active" | "pending" };

export default function Invite() {
  const params = useLocalSearchParams<{ token?: string }>();
  const token = typeof params.token === "string" ? params.token : "";
  const { session } = useBivia();
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [membership, setMembership] = useState<MembershipResult | null>(null);

  const requestSequence = useRef(0);
  useEffect(() => {
    requestSequence.current += 1;
    setMembership(null);
    setMessage("");
  }, [token, session?.user.id]);

  async function accept() {
    if (!token || busy || membership) return;
    if (!session) {
      router.push({
        pathname: "/auth",
        params: { next: `/invite?token=${encodeURIComponent(token)}` },
      });
      return;
    }
    const sequence = requestSequence.current;
    setBusy(true);
    setMessage("");
    try {
      const result = await rpc<MembershipResult>("bivia_group_action_v1", {
        p_action: "accept_invite",
        p_payload: { token },
      });
      if (sequence !== requestSequence.current) return;
      setMembership(result);
      setMessage(
        result.status === "pending"
          ? "Your request has been sent. The group owner needs to approve it before you can see members and scores."
          : "You’re in! Your group is ready for a little friendly competition.",
      );
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page narrow>
      <Card style={{ gap: 20 }}>
        <T style={s.h1}>There’s a place for you.</T>
        <T>
          You’ve been invited to a Bivia group. Private groups need the owner’s
          approval.
        </T>
        {!token && (
          <Notice>
            This invitation is missing its link code. Ask the group owner for a
            new link.
          </Notice>
        )}
        {!!message && <Notice>{message}</Notice>}
        {membership ? (
          <Button onPress={() => router.push(`/group/${membership.id}` as any)}>
            {membership.status === "pending"
              ? "View my request"
              : "Go to my group"}
          </Button>
        ) : (
          <Button disabled={busy || !token} onPress={accept}>
            {!session
              ? "Sign in to accept"
              : busy
                ? "Accepting…"
                : "Accept invitation"}
          </Button>
        )}
        <Button variant="secondary" onPress={() => router.push("/groups")}>
          All groups
        </Button>
      </Card>
    </Page>
  );
}
