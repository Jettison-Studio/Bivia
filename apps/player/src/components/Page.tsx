import React from "react";
import { ScrollView, useWindowDimensions, View } from "react-native";
export function Page({
  children,
  narrow = false,
}: {
  children: React.ReactNode;
  narrow?: boolean;
}) {
  const { width } = useWindowDimensions();
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ flexGrow: 1 }}
      keyboardShouldPersistTaps="handled"
    >
      <View
        style={{
          width: "100%",
          maxWidth: narrow ? 760 : 1120,
          alignSelf: "center",
          paddingHorizontal: width < 720 ? 24 : 40,
          paddingTop: width < 720 ? 28 : 40,
          paddingBottom: 48,
        }}
      >
        {children}
      </View>
    </ScrollView>
  );
}
