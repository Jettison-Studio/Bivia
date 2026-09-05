import React, { useState } from "react";
import { View, Modal, TextInput } from "react-native";
import { router } from "expo-router";
import { supabase, rpc } from "../lib/supabase";
import { Button, T, Card, Notice, s } from "./ui";
export function DeleteAccount({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false),
    [confirmation, setConfirmation] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function remove() {
    if (!supabase || confirmation !== "DELETE MY ACCOUNT") return;
    setBusy(true);
    setError("");
    try {
      for (;;) {
        const { data, error } = await supabase.storage
          .from("avatars")
          .list(userId, { limit: 100 });
        if (error) throw error;
        if (!data?.length) break;
        const { error: removeError } = await supabase.storage
          .from("avatars")
          .remove(data.map((f) => `${userId}/${f.name}`));
        if (removeError) throw removeError;
      }
      await rpc("bivia_delete_account_v1", { p_confirmation: confirmation });
      await supabase.auth.signOut({ scope: "local" });
      setOpen(false);
      router.replace("/");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Button variant="ghost" onPress={() => setOpen(true)}>
        Delete my account
      </Button>
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => !busy && setOpen(false)}
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
          <Card style={{ maxWidth: 470, width: "100%", gap: 18 }}>
            <T style={s.h2}>Permanently delete your account?</T>
            <T>
              This removes your profile, photos, ranked scores, memberships, and
              groups you own. This cannot be undone. Local practice history
              stays on this device.
            </T>
            <T style={s.label}>Type DELETE MY ACCOUNT to confirm.</T>
            <TextInput
              accessibilityLabel="Delete account confirmation"
              value={confirmation}
              onChangeText={setConfirmation}
              autoCapitalize="characters"
              style={s.input}
            />
            {!!error && <Notice>{error}</Notice>}
            <Button
              disabled={busy || confirmation !== "DELETE MY ACCOUNT"}
              onPress={remove}
            >
              {busy ? "Deleting…" : "Permanently delete account"}
            </Button>
            <Button
              disabled={busy}
              variant="secondary"
              onPress={() => setOpen(false)}
            >
              Keep my account
            </Button>
          </Card>
        </View>
      </Modal>
    </>
  );
}
