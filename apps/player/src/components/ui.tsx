import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
  type TextStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SvgXml } from "react-native-svg";
import { legacyIcons } from "./legacy-icons";
export const c = {
  primary: "#5f00e6",
  deep: "#5100e7",
  pink: "#dd0089",
  text: "#171320",
  muted: "#736e7d",
  border: "#eae7ef",
  surface: "#f7f7f9",
  lavender: "#f2ebff",
  white: "#fff",
  success: "#187348",
};
export const font = {
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
};
export function T({
  children,
  style,
  ...props
}: React.ComponentProps<typeof Text>) {
  return (
    <Text
      {...props}
      style={[
        {
          fontFamily: font.regular,
          color: c.text,
          fontSize: 15,
          lineHeight: 23,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
export function Icon({
  name,
  size = 22,
  color = c.text,
}: {
  name: string;
  size?: number;
  color?: string;
}) {
  return (
    <View
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Ionicons name={name as any} size={size} color={color} />
    </View>
  );
}
export function LegacyIcon({
  name,
  size = 24,
}: {
  name: keyof typeof legacyIcons;
  size?: number;
}) {
  return (
    <View
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <SvgXml xml={legacyIcons[name]} width={size} height={size} />
    </View>
  );
}
export function Button({
  children,
  onPress,
  variant = "primary",
  disabled,
  icon,
  style,
  testID,
}: {
  children: React.ReactNode;
  onPress: () => void;
  variant?: "primary" | "secondary" | "white" | "ghost";
  disabled?: boolean;
  icon?: string;
  style?: ViewStyle;
  testID?: string;
}) {
  const white = variant === "primary";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      testID={testID}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed, hovered }: any) => [
        s.button,
        variant === "primary"
          ? { backgroundColor: c.primary }
          : variant === "white"
            ? { backgroundColor: c.white }
            : variant === "secondary"
              ? { backgroundColor: c.lavender }
              : { backgroundColor: "transparent" },
        { opacity: disabled ? 0.45 : pressed ? 0.75 : 1 },
        hovered && !disabled ? { transform: [{ translateY: -1 }] } : null,
        style,
      ]}
    >
      <T
        style={{
          fontFamily: font.semibold,
          color: white ? "white" : c.primary,
        }}
      >
        {children}
      </T>
      {icon && (
        <Icon name={icon} size={18} color={white ? "white" : c.primary} />
      )}
    </Pressable>
  );
}
export function Heading({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={s.heading}>
      <View style={{ flex: 1 }}>
        <T accessibilityRole="header" style={s.h1}>
          {title}
        </T>
        {subtitle && <T style={{ color: c.muted, marginTop: 7 }}>{subtitle}</T>}
      </View>
      {action}
    </View>
  );
}
export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[s.card, style]}>{children}</View>;
}
export function Notice({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{ padding: 14, backgroundColor: c.lavender, borderRadius: 10 }}
    >
      <T style={{ fontSize: 13, color: c.primary, lineHeight: 20 }}>
        {children}
      </T>
    </View>
  );
}
export const s = StyleSheet.create({
  button: {
    minHeight: 48,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 28,
  },
  h1: {
    fontSize: 32,
    lineHeight: 41,
    fontFamily: font.bold,
    letterSpacing: -1,
  },
  h2: {
    fontSize: 21,
    lineHeight: 29,
    fontFamily: font.bold,
    letterSpacing: -0.4,
  },
  label: { fontSize: 13, fontFamily: font.semibold, color: c.muted },
  card: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 15,
    padding: 24,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  input: {
    fontFamily: font.regular,
    fontSize: 15,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 10,
    padding: 14,
    color: c.text,
    minHeight: 50,
  },
  stack: { gap: 16 },
  section: { marginTop: 32 },
  empty: { padding: 40, alignItems: "center", gap: 14 },
  small: { fontSize: 13, lineHeight: 20, color: c.muted },
});
