import React, { useState } from "react";
import { View, Image } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { supabase } from "../lib/supabase";
import { Button, T, Notice, s, c } from "./ui";
export function ProfilePhoto({
  userId,
  url,
  onChange,
}: {
  userId: string;
  url: string | null;
  onChange: (url: string) => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function pick() {
    if (!supabase) return;
    setError("");
    setBusy(true);
    try {
      const image = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });
      if (image.canceled) return;
      const normalized = await manipulateAsync(
        image.assets[0].uri,
        [{ resize: { width: 512 } }],
        { compress: 0.8, format: SaveFormat.JPEG },
      );
      const bytes = await (await fetch(normalized.uri)).arrayBuffer();
      if (bytes.byteLength > 2 * 1024 * 1024)
        throw new Error("Choose a smaller photo (under 2 MB).");
      const { data: upload, error: uploadError } =
        await supabase.functions.invoke<{ path: string }>("avatar-upload", {
          body: bytes,
          headers: { "Content-Type": "image/jpeg" },
        });
      if (uploadError) throw uploadError;
      if (!upload?.path || !upload.path.startsWith(`${userId}/`)) {
        throw new Error("Your account changed. Please choose the photo again.");
      }
      const path = upload.path;
      const next = supabase.storage.from("avatars").getPublicUrl(path)
        .data.publicUrl;
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ avatar_url: next })
        .eq("id", userId);
      if (profileError) {
        await supabase.storage.from("avatars").remove([path]);
        throw profileError;
      }
      onChange(next);
      if (url) {
        const prefix = supabase.storage
          .from("avatars")
          .getPublicUrl(`${userId}/`).data.publicUrl;
        if (url.startsWith(prefix)) {
          const oldName = url.slice(prefix.length);
          if (oldName && !oldName.includes("/") && !oldName.includes("?")) {
            const { error: cleanupError } = await supabase.storage
              .from("avatars")
              .remove([`${userId}/${oldName}`]);
            if (cleanupError)
              setError(
                "Photo updated. The previous photo could not be removed; please try again later.",
              );
          }
        }
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={{ gap: 12 }}>
      {!!url && (
        <Image
          source={{ uri: url }}
          accessibilityLabel="Your profile photo"
          style={{ width: 80, height: 80, borderRadius: 40 }}
        />
      )}
      <Button variant="secondary" disabled={busy} onPress={pick}>
        {busy
          ? "Updating photo…"
          : url
            ? "Change profile photo"
            : "Add a profile photo"}
      </Button>
      <T style={s.small}>Your profile photo is visible to other players.</T>
      {!!error && <Notice>{error}</Notice>}
    </View>
  );
}
