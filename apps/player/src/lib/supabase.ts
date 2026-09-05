import { AppState, Platform } from "react-native";
import AsyncStorage from "./storage";
import { createClient } from "@supabase/supabase-js";
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
export const supabase =
  url && key
    ? createClient(url, key, {
        auth: {
          storage: AsyncStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: Platform.OS === "web",
        },
      })
    : null;
if (supabase && Platform.OS !== "web")
  AppState.addEventListener("change", (state) => {
    if (state === "active") supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
export async function rpc<T>(
  name: string,
  params: Record<string, unknown> = {},
): Promise<T> {
  if (!supabase)
    throw new Error(
      "Online play is not connected yet. You can explore practice quizzes.",
    );
  const { data, error } = await supabase.rpc(name, params);
  if (error) throw new Error(error.message);
  return data as T;
}
