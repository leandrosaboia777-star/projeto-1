import "react-native-url-polyfill/auto";
import { createClient, processLock } from "@supabase/supabase-js";
import { authStorage } from "./authStorage";
import { Platform, AppState } from "react-native";
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
export const configured = !!url && !!key && !url.includes("YOUR_PROJECT");
export const supabase = configured
  ? createClient(url!, key!, {
      auth: {
        flowType: "pkce",
        storage: authStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: Platform.OS === "web",
        lock: processLock,
      },
    })
  : null;
if (Platform.OS !== "web" && supabase) {
  AppState.addEventListener("change", (state) =>
    state === "active"
      ? supabase.auth.startAutoRefresh()
      : supabase.auth.stopAutoRefresh(),
  );
}
export function db() {
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}
export async function checked<T>(
  promise: PromiseLike<{ data: T; error: any }>,
): Promise<T> {
  const { data, error } = await promise;
  if (error) throw new Error(error.message);
  return data;
}

export function authRedirectURL() {
  return Platform.OS === "web"
    ? `${globalThis.location.origin}/auth/callback`
    : "saboiacleaning://auth/callback";
}
