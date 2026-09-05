import React from "react";
import { Stack, router, usePathname } from "expo-router";
import {
  View,
  Pressable,
  useWindowDimensions,
  ActivityIndicator,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import { Provider, useBivia } from "../src/lib/store";
import { T, Icon, c, font } from "../src/components/ui";
const nav = [
  { path: "/", label: "Trivia", icon: "grid-outline" },
  { path: "/groups", label: "Groups", icon: "people-outline" },
  { path: "/profile", label: "Profile", icon: "person-outline" },
];
function Shell() {
  const { width } = useWindowDimensions();
  const path = usePathname();
  const { session, authReady } = useBivia();
  const visibleNav = nav.filter((item) => item.path !== "/profile" || !!session);
  const compact = width < 720;
  const gameplay = path.startsWith("/quiz/");
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "white" }}>
      <StatusBar style="dark" />
      <View
        style={{
          height: 80,
          borderBottomWidth: 1,
          borderColor: c.border,
          paddingHorizontal: compact ? 24 : 44,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Bivia home"
          onPress={() => router.push("/")}
        >
          <T
            style={{
              fontSize: 37,
              lineHeight: 46,
              fontFamily: font.bold,
              letterSpacing: -2.5,
              color: c.primary,
            }}
          >
            bivia<T style={{ fontSize: 37, color: c.pink }}>•</T>
          </T>
        </Pressable>
        {!compact && (
          <View style={{ flexDirection: "row", gap: 36 }}>
            {visibleNav.map((n) => (
              <Pressable
                key={n.path}
                accessibilityRole="link"
                onPress={() => router.push(n.path as any)}
                style={{ flexDirection: "row", gap: 8, alignItems: "center" }}
              >
                <Icon
                  name={n.icon}
                  size={19}
                  color={path === n.path ? c.primary : c.muted}
                />
                <T
                  style={{
                    fontFamily: font.semibold,
                    color: path === n.path ? c.primary : c.muted,
                  }}
                >
                  {n.label}
                </T>
              </Pressable>
            ))}
          </View>
        )}
        {authReady && (session ? <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open profile"
          onPress={() => router.push("/profile")}
          style={{
            width: 38,
            height: 38,
            backgroundColor: c.lavender,
            borderRadius: 20,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <T style={{ color: c.primary, fontFamily: font.bold }}>
            <Icon name="person-outline" color={c.primary} size={18} />
          </T>
        </Pressable> : (
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Log in or create an account"
            onPress={() => router.push("/auth")}
            style={{
              minHeight: 44,
              paddingHorizontal: compact ? 12 : 18,
              borderRadius: 24,
              backgroundColor: c.lavender,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <T style={{ color: c.primary, fontFamily: font.semibold, fontSize: 13 }}>
              Log in / Sign up
            </T>
          </Pressable>
        ))}
      </View>
      <View style={{ flex: 1 }}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: "white" },
            animation: "fade",
          }}
        />
      </View>
      {compact && !gameplay && (
        <View
          style={{
            flexDirection: "row",
            borderTopWidth: 1,
            borderColor: c.border,
            paddingTop: 12,
            paddingBottom: 10,
            backgroundColor: "white",
          }}
        >
          {visibleNav.map((n) => (
            <Pressable
              key={n.path}
              accessibilityRole="link"
              onPress={() => router.push(n.path as any)}
              style={{ flex: 1, alignItems: "center", gap: 5 }}
            >
              <Icon
                name={n.icon}
                color={path === n.path ? c.primary : c.muted}
              />
              <T
                style={{
                  fontSize: 11,
                  lineHeight: 16,
                  fontFamily: font.semibold,
                  color: path === n.path ? c.primary : c.muted,
                }}
              >
                {n.label}
              </T>
            </Pressable>
          ))}
        </View>
      )}
    </SafeAreaView>
  );
}
export default function Layout() {
  const [loaded, error] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  if (!loaded && !error)
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={c.primary} />
      </View>
    );
  return (
    <SafeAreaProvider>
      <Provider>
        <Shell />
      </Provider>
    </SafeAreaProvider>
  );
}
