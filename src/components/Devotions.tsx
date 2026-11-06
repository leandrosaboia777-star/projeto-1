import React, { useEffect, useRef, useState } from "react";
import { View, AppState, Platform, ScrollView, Pressable } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { BookOpen, Sun, Heart, X, Volume2 } from "lucide-react-native";
import * as Speech from "expo-speech";
import { speak } from "../lib/voice";
import { useApp } from "../lib/store";
import {
  businessDay,
  completedWorkday,
  devotionFor,
  type DevotionPeriod,
} from "../domain/devotions";
import {
  readDevotionSettings,
  saveDevotionSettings,
  scheduleDevotions,
  notifyWorkdayFinished,
  subscribeDevotions,
  subscribeDevotionOpen,
  takeDevotionNotification,
  type DevotionSettings,
} from "../lib/devotions";
import { Card, Label, Button, Field, Chips, Row, Tag, useTheme } from "./ui";
export function Devotions({ onContinue }: { onContinue?: () => void }) {
  const app = useApp(),
    c = useTheme(),
    pt = app.language === "pt-BR";
  const userId = app.session?.user.id;
  const [settings, setSettings] = useState<DevotionSettings | null>(null),
    [tick, setTick] = useState(0),
    [revision, setRevision] = useState(0);
  const [opened, setOpened] = useState<{
    day: string;
    period: DevotionPeriod;
  } | null>(null);
  const shown = useRef(new Set<string>());
  useEffect(
    () => () => {
      void Speech.stop();
    },
    [opened?.day, opened?.period],
  );
  const day = businessDay(app.data);
  useEffect(() => subscribeDevotions(() => setRevision((v) => v + 1)), []);
  useEffect(() => {
    let active = true;
    setSettings(null);
    if (userId)
      void readDevotionSettings(userId).then((v) => {
        if (active) setSettings(v);
      });
    return () => {
      active = false;
    };
  }, [userId, revision]);
  useEffect(() => {
    const timer = setInterval(() => setTick((v) => v + 1), 60000);
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") setTick((v) => v + 1);
    });
    return () => {
      clearInterval(timer);
      listener.remove();
    };
  }, []);
  useEffect(() => {
    if (!userId || !settings) return;
    void scheduleDevotions(
      userId,
      settings,
      app.language,
      app.data.timezone,
    ).catch(() => {});
    // Refresh also on foreground, without touching briefing/appointment alerts.
  }, [userId, settings, app.language, app.data.timezone, day, revision]);
  useEffect(() => {
    if (!userId || !settings) return;
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active")
        void scheduleDevotions(
          userId,
          settings,
          app.language,
          app.data.timezone,
        ).catch(() => {});
    });
    return () => listener.remove();
  }, [userId, settings, app.language, app.data.timezone]);
  useEffect(() => {
    if (!userId) {
      setOpened(null);
      return;
    }
    const take = () => {
      const value = takeDevotionNotification();
      if (value) setOpened(value);
    };
    take();
    return subscribeDevotionOpen(take);
  }, [userId]);
  useEffect(() => {
    if (!userId || app.loading || !settings?.enabled || opened) return;
    let active = true;
    const period: DevotionPeriod =
      app.profile?.id === userId && completedWorkday(app.data)
        ? "evening"
        : "morning";
    const key = `devotion:${userId}:${day}:${period}`;
    if (shown.current.has(key)) return;
    void AsyncStorage.getItem(key)
      .then((seen) => {
        if (!active || seen) return;
        shown.current.add(key);
        setOpened({ day, period });
        void AsyncStorage.setItem(key, "shown").catch(() => {});
        if (period === "evening" && settings.notifications)
          void notifyWorkdayFinished(userId, day, app.language).catch(() => {});
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [userId, app.profile, app.loading, app.data, day, settings, opened, tick]);
  const reading = opened
    ? devotionFor(opened.day, opened.period, app.language)
    : null;
  if (!reading || !userId) return null;
  return (
    <View
      accessibilityViewIsModal
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 10000,
        backgroundColor: c.bg,
        padding: 20,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <View style={{ width: "100%", maxWidth: 620, maxHeight: "100%" }}>
        <Row style={{ justifyContent: "space-between", marginBottom: 20 }}>
          <Label style={{ fontWeight: "600", fontSize: 18 }}>
            {pt ? "Uma palavra para você" : "A word for you"}
          </Label>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={pt ? "Fechar reflexão" : "Close reflection"}
            onPress={() => setOpened(null)}
            style={{ padding: 12 }}
          >
            <X color={c.ink} size={22} />
          </Pressable>
        </Row>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 24 }}
        >
          {reading && (
            <View style={{ gap: 20 }}>
              <Row>
                <View
                  style={{
                    backgroundColor: c.soft,
                    padding: 14,
                    borderRadius: 16,
                  }}
                >
                  {reading.period === "morning" ? (
                    <Sun color={c.accent} size={26} />
                  ) : (
                    <Heart color={c.accent} size={26} />
                  )}
                </View>
                <Label
                  accessibilityRole="header"
                  style={{
                    fontSize: 23,
                    fontWeight: "600",
                    lineHeight: 30,
                    flex: 1,
                  }}
                >
                  {reading.title}
                </Label>
              </Row>
              <Card style={{ gap: 18, backgroundColor: c.soft }}>
                <BookOpen color={c.accent} size={25} />
                <Label
                  style={{ fontSize: 21, lineHeight: 32, fontStyle: "italic" }}
                >
                  {reading.verse}
                </Label>
                <Tag>{reading.reference}</Tag>
              </Card>
              <Label style={{ fontWeight: "600", fontSize: 17 }}>
                {pt ? "Para refletir" : "A moment to reflect"}
              </Label>
              <Label style={{ lineHeight: 26 }}>{reading.reflection}</Label>
              <Label style={{ fontSize: 12, color: c.muted }}>
                {pt
                  ? "Reflexão sobre a passagem bíblica."
                  : "A reflection on the Scripture passage."}
              </Label>
              <Button
                secondary
                icon={Volume2}
                title={
                  pt
                    ? "Ouvir passagem e reflexão"
                    : "Listen to Scripture and reflection"
                }
                onPress={() =>
                  speak(
                    `${reading.verse} ${reading.reference}. ${reading.reflection}`,
                    app.language,
                  )
                }
              />
              <Button
                title={
                  pt ? "Continuar para minha agenda" : "Continue to my schedule"
                }
                onPress={() => {
                  setOpened(null);
                  onContinue?.();
                }}
              />
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );
}
export function DevotionPreferences() {
  const app = useApp(),
    c = useTheme(),
    pt = app.language === "pt-BR",
    uid = app.session?.user.id;
  const [settings, setSettings] = useState<DevotionSettings>({
      enabled: true,
      notifications: true,
      time: "07:00",
    }),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  useEffect(() => {
    if (uid) void readDevotionSettings(uid).then(setSettings);
  }, [uid]);
  async function save(enableNotifications: boolean) {
    if (!uid) return;
    setBusy(true);
    setNotice("");
    try {
      if (enableNotifications && Platform.OS === "web")
        throw new Error(
          pt
            ? "Ative os avisos no aplicativo instalado no celular."
            : "Enable notifications in the installed mobile app.",
        );
      if (
        enableNotifications &&
        !(await Notifications.requestPermissionsAsync()).granted
      )
        throw new Error(
          pt
            ? "Permita notificações nos Ajustes do iPhone."
            : "Allow notifications in iPhone Settings.",
        );
      const value = { ...settings, notifications: enableNotifications };
      await saveDevotionSettings(uid, value);
      setSettings(value);
      await scheduleDevotions(uid, value, app.language, app.data.timezone);
      setNotice(pt ? "Preferências salvas." : "Preferences saved.");
    } catch (e) {
      app.setError(
        (e as Error).message === "INVALID_TIME"
          ? pt
            ? "Use um horário como 07:00."
            : "Use a time such as 07:00."
          : (e as Error).message,
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card style={{ gap: 12 }}>
      <Row>
        <BookOpen color={c.accent} size={22} />
        <Label style={{ fontWeight: "600", fontSize: 18 }}>
          {pt ? "Passagens e reflexões" : "Scripture and reflections"}
        </Label>
      </Row>
      <Label style={{ color: c.muted }}>
        {pt
          ? "Uma palavra para começar o dia e outra ao concluir todas as casas de hoje. A reflexão aparece uma vez por dia em cada momento."
          : "A word to start the day and another after completing all of today's houses. Each reflection appears once daily."}
      </Label>
      <Chips
        value={String(settings.enabled)}
        options={[
          { value: "true", label: pt ? "Exibir no aplicativo" : "Show in app" },
          { value: "false", label: pt ? "Desativar" : "Turn off" },
        ]}
        onChange={(v: string) =>
          setSettings((s) => ({ ...s, enabled: v === "true" }))
        }
      />
      <Field
        label={pt ? "Horário da manhã (HH:mm)" : "Morning time (HH:mm)"}
        value={settings.time}
        onChangeText={(time: string) => setSettings((s) => ({ ...s, time }))}
      />
      <Label style={{ fontSize: 12, color: c.muted }}>
        {pt ? "Horário da empresa" : "Business timezone"}: {app.data.timezone}
      </Label>
      <Label style={{ fontSize: 12, color: c.muted }}>
        {pt
          ? "Os avisos da manhã ficam agendados por 14 dias e são renovados ao abrir o app. Toque no aviso para ler a mensagem completa."
          : "Morning alerts are scheduled for 14 days and renewed when you open the app. Tap an alert to read the full message."}
      </Label>
      <Button
        title={
          pt ? "Salvar e ativar notificações" : "Save and enable notifications"
        }
        disabled={busy || !settings.enabled}
        onPress={() => void save(true)}
      />
      <Button
        secondary
        title={pt ? "Salvar sem notificações" : "Save without notifications"}
        disabled={busy}
        onPress={() => void save(false)}
      />
      {!!notice && <Label>{notice}</Label>}
    </Card>
  );
}
