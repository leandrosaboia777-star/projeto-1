import React, { useEffect, useState } from "react";
import {
  AppState,
  Image,
  View,
  type ImageStyle,
  type StyleProp,
} from "react-native";
import { House } from "lucide-react-native";
import { db, checked } from "../lib/supabase";
import { useApp } from "../lib/store";
import { useTheme } from "./ui";

// Covers stay private. Refresh short-lived URLs while mounted or returning to
// the foreground; never persist bearer URLs or turn the storage bucket public.
export function PrivatePhoto({
  path,
  label,
  style,
  contain = false,
}: {
  path: string;
  label: string;
  style?: StyleProp<ImageStyle>;
  contain?: boolean;
}) {
  const app = useApp(),
    c = useTheme();
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    setUrl(null);
    setFailed(false);
    const load = async () => {
      try {
        const result = await checked(
          db().storage.from("house-photos").createSignedUrl(path, 300),
        );
        if (active) {
          setUrl(result!.signedUrl);
          setFailed(false);
        }
      } catch {
        if (active) setFailed(true);
      }
    };
    void load();
    const timer = setInterval(() => void load(), 240000);
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") void load();
    });
    return () => {
      active = false;
      clearInterval(timer);
      listener.remove();
    };
  }, [path, app.session?.user.id]);
  if (!url || failed)
    return (
      <View
        accessibilityLabel={label}
        style={[
          {
            backgroundColor: c.soft,
            alignItems: "center",
            justifyContent: "center",
          },
          style as any,
        ]}
      >
        <House size={28} color={c.accent} />
      </View>
    );
  return (
    <Image
      accessibilityLabel={label}
      source={{ uri: url }}
      style={style}
      resizeMode={contain ? "contain" : "cover"}
      onError={() => setFailed(true)}
    />
  );
}
