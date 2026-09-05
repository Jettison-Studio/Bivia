import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
} from "react";
import { Platform } from "react-native";
import * as Linking from "expo-linking";
import AsyncStorage from "./storage";
import type { Result } from "@bivia/core";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
type LocalProfile = { name: string; categories: string[] };
type Store = {
  ready: boolean;
  authReady: boolean;
  profile: LocalProfile;
  results: Result[];
  session: Session | null;
  saveProfile: (p: LocalProfile) => Promise<void>;
  addResult: (r: Result) => Promise<void>;
  clearPractice: () => Promise<void>;
};
const Context = createContext<Store>(null as never);
export function Provider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false),
    [profile, setProfile] = useState<LocalProfile>({
      name: "",
      categories: [],
    }),
    [results, setResults] = useState<Result[]>([]),
    [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(!supabase);
  const resultsRef = useRef<Result[]>([]);
  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem("bivia.profile.v1"),
      AsyncStorage.getItem("bivia.practice.v1"),
    ])
      .then(([p, r]) => {
        try {
          if (p) setProfile(JSON.parse(p));
          if (r) {
            const saved = JSON.parse(r);
            if (Array.isArray(saved)) {
              resultsRef.current = saved;
              setResults(saved);
            }
          }
        } catch {}
      })
      .catch(() => {})
      .finally(() => setReady(true));
    if (!supabase) return;
    let active = true;
    let authEventReceived = false;
    supabase.auth.getSession().then(({ data }) => {
      if (active && !authEventReceived) setSession(data.session);
    }).catch(() => {}).finally(() => {
      if (active) setAuthReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, s) => {
      authEventReceived = true;
      setSession(s);
      setAuthReady(true);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    if (Platform.OS === "web" || !supabase) return;
    async function handle(url: string | null) {
      if (!url || !supabase) return;
      const fragment = new URLSearchParams(url.split("#")[1] || "");
      const access_token = fragment.get("access_token");
      const refresh_token = fragment.get("refresh_token");
      if (access_token && refresh_token)
        await supabase.auth.setSession({ access_token, refresh_token });
    }
    Linking.getInitialURL().then(handle);
    const listener = Linking.addEventListener("url", ({ url }) => {
      void handle(url);
    });
    return () => listener.remove();
  }, []);
  const value: Store = {
    ready,
    authReady,
    profile,
    results,
    session,
    saveProfile: async (p) => {
      await AsyncStorage.setItem("bivia.profile.v1", JSON.stringify(p));
      setProfile(p);
    },
    addResult: async (r) => {
      const next = [
        r,
        ...resultsRef.current.filter((x) => x.id !== r.id),
      ].slice(0, 100);
      await AsyncStorage.setItem("bivia.practice.v1", JSON.stringify(next));
      resultsRef.current = next;
      setResults(next);
    },
    clearPractice: async () => {
      await AsyncStorage.removeItem("bivia.practice.v1");
      resultsRef.current = [];
      setResults([]);
    },
  };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export const useBivia = () => useContext(Context);
