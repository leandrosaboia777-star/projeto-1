import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useApp } from "./store";
import { checked, db } from "./supabase";
import { contentTexts, displayContent } from "../domain/content";
const C = createContext({
  text: (value: string) => value,
  loading: false,
  error: false,
  retry: () => {},
});
export const useContent = () => useContext(C);
export function ContentProvider({ children }: { children: React.ReactNode }) {
  const app = useApp();
  // Memory only: translations never overwrite business records or persist in
  // unencrypted device storage. Cache keys include the authenticated user.
  const caches = useRef(new Map<string, Map<string, string>>());
  const [, setVersion] = useState(0),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(false),
    [retry, setRetry] = useState(0);
  const key = `${app.session?.user.id ?? ""}:${app.language}`;
  const source = JSON.stringify(contentTexts(app.data));
  useEffect(() => {
    let active = true;
    if (!app.session) {
      caches.current.clear();
      setLoading(false);
      setError(false);
      return;
    }
    const cache = caches.current.get(key) ?? new Map<string, string>();
    caches.current.set(key, cache);
    const missing = (JSON.parse(source) as string[]).filter(
      (s) => !cache.has(s),
    );
    if (!missing.length) {
      setLoading(false);
      setError(false);
      return;
    }
    setLoading(true);
    setError(false);
    void (async () => {
      try {
        // Keep each authenticated request below the Edge body's byte limit.
        const batches: string[][] = [];
        let batch: string[] = [],
          bytes = 0;
        let tooLong = false;
        for (const text of missing) {
          const length = text.length * 3 + 4;
          if (length > 24000 || text.length > 8000) {
            tooLong = true;
            continue;
          }
          if (batch.length >= 12 || bytes + length > 24000) {
            batches.push(batch);
            batch = [];
            bytes = 0;
          }
          batch.push(text);
          bytes += length;
        }
        if (batch.length) batches.push(batch);
        for (const texts of batches) {
          if (!active) return;
          const result = await checked(
            db().functions.invoke("translate-content", {
              body: { language: app.language, texts },
            }),
          );
          if (
            !Array.isArray(result.translations) ||
            result.translations.length !== texts.length ||
            result.translations.some((v: unknown) => typeof v !== "string")
          )
            throw new Error("INVALID_TRANSLATION");
          if (!active) return;
          texts.forEach((text, i) => cache.set(text, result.translations[i]));
          setVersion((v) => v + 1);
        }
        if (active && tooLong) setError(true);
      } catch {
        if (active) setError(true);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [source, key, retry, app.session?.user.id]);
  const cache = caches.current.get(key) ?? new Map<string, string>();
  return (
    <C.Provider
      value={{
        text: (value) => displayContent(value, cache),
        loading,
        error,
        retry: () => setRetry((v) => v + 1),
      }}
    >
      {children}
    </C.Provider>
  );
}
