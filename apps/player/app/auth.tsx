import React, { useEffect, useState } from "react";
import { TextInput, View, Pressable, Platform } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as Linking from "expo-linking";
import { Page } from "../src/components/Page";
import {
  T,
  Heading,
  Button,
  Card,
  Notice,
  c,
  s,
  font,
} from "../src/components/ui";
import { supabase } from "../src/lib/supabase";
export default function Auth() {
  const { next, mode: requestedMode } = useLocalSearchParams<{ next?: string; mode?: string }>();
  const destination =
    next && /^\/(quiz\/|invite[?]|group\/)/.test(next) ? next : "/profile";
  const [mode, setMode] = useState<"login" | "signup" | "reset">(requestedMode === "signup" ? "signup" : "login"),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [firstName, setFirstName] = useState(""),
    [lastName, setLastName] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    setMode(requestedMode === "signup" ? "signup" : "login");
    setMessage("");
  }, [requestedMode]);
  async function submit() {
    setBusy(true);
    setMessage("");
    try {
      if (!supabase)
        throw new Error(
          "Accounts are not connected yet. You can still explore practice trivia.",
        );
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
        throw new Error("Enter a valid email address.");
      if (mode === "signup" && (!firstName.trim() || !lastName.trim()))
        throw new Error("Enter your first and last name.");
      if (mode !== "reset" && password.length < 8)
        throw new Error("Use a password with at least 8 characters.");
      if (mode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(
          email.trim(),
          { redirectTo: Linking.createURL("/reset-password") },
        );
        if (error) throw error;
        setMessage("If an account exists, a reset link is on its way.");
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { first_name: firstName.trim(), last_name: lastName.trim(), display_name: firstName.trim() },
            emailRedirectTo: Linking.createURL("/profile"),
          },
        });
        if (error) throw error;
        if (data.session) router.replace(destination as any);
        else
          setMessage("Check your email to confirm your account, then sign in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        router.replace(destination as any);
      }
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page narrow>
      <Card
        style={{
          maxWidth: 480,
          width: "100%",
          alignSelf: "center",
          gap: 20,
          padding: 30,
        }}
      >
        <Heading
          title={
            mode === "signup"
              ? "Glad you’re game."
              : mode === "reset"
                ? "Let’s get you back in."
                : "Welcome back."
          }
          subtitle={
            mode === "signup"
              ? undefined
              : mode === "reset"
                ? "We’ll email you a password reset link."
                : "Your next discovery is waiting."
          }
        />
        {mode === "signup" && (
          <View style={{ gap: 20 }}>
            <TextInput
              accessibilityLabel="First name"
              placeholder="First name"
              placeholderTextColor={c.muted}
              autoComplete="given-name"
              value={firstName}
              onChangeText={setFirstName}
              style={s.input}
              maxLength={60}
            />
            <TextInput
              accessibilityLabel="Last name"
              placeholder="Last name"
              placeholderTextColor={c.muted}
              autoComplete="family-name"
              value={lastName}
              onChangeText={setLastName}
              style={s.input}
              maxLength={60}
            />
          </View>
        )}
        <View style={{ gap: 7 }}>
          <TextInput
            accessibilityLabel="Email"
            placeholder="Email address"
            placeholderTextColor={c.muted}
            autoComplete="email"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
            style={s.input}
          />
        </View>
        {mode !== "reset" && (
          <View style={{ gap: 7 }}>
            <TextInput
              accessibilityLabel="Password"
              placeholder="Password"
              placeholderTextColor={c.muted}
              autoComplete={
                mode === "signup" ? "new-password" : "current-password"
              }
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={submit}
              style={s.input}
            />
            <T style={s.small}>At least 8 characters</T>
          </View>
        )}
        {!!message && <Notice>{message}</Notice>}
        <Button onPress={submit} disabled={busy}>
          {busy
            ? "One moment…"
            : mode === "signup"
              ? "Create account"
              : mode === "reset"
                ? "Send reset link"
                : "Sign in"}
        </Button>
        <Button
          variant="ghost"
          onPress={() => {
            setMode(mode === "login" ? "signup" : "login");
            setMessage("");
          }}
        >
          {mode === "login"
            ? "New here? Create an account"
            : "Already have an account? Sign in"}
        </Button>
        {mode === "login" && (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setMode("reset");
              setMessage("");
            }}
          >
            <T style={{ textAlign: "center", color: c.muted, fontSize: 13 }}>
              Forgot your password?
            </T>
          </Pressable>
        )}
      </Card>
    </Page>
  );
}
