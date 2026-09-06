import React, { useState } from "react";
import { TextInput } from "react-native";
import { router } from "expo-router";
import { Page } from "../src/components/Page";
import { T, Button, Card, Notice, s } from "../src/components/ui";
import { supabase } from "../src/lib/supabase";
import { useBivia } from "../src/lib/store";
export default function Reset() {
  const { session } = useBivia();
  const [password, setPassword] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <Page narrow>
      <Card style={{ gap: 20 }}>
        <T style={s.h1}>A fresh start.</T>
        <T>Choose your new password.</T>
        <TextInput
          accessibilityLabel="New password"
          placeholder="At least 8 characters"
          secureTextEntry
          autoComplete="new-password"
          value={password}
          onChangeText={setPassword}
          style={s.input}
        />
        {!!message && <Notice>{message}</Notice>}
        <Button
          disabled={busy}
          onPress={async () => {
            if (!supabase || !session) {
              setMessage("Open a valid reset link from your email first.");
              return;
            }
            if (password.length < 8) {
              setMessage("Use at least 8 characters.");
              return;
            }
            setBusy(true);
            try {
              const { error } = await supabase.auth.updateUser({ password });
              if (error) throw error;
              router.replace("/profile");
            } catch (error) {
              setMessage(error instanceof Error ? error.message : "Couldn’t update your password. Try again.");
            } finally { setBusy(false); }
          }}
        >
          {busy ? "Saving…" : "Update password"}
        </Button>
      </Card>
    </Page>
  );
}
