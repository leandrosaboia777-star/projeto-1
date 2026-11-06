import React, { useEffect, useState } from "react";
import {
  View,
  ScrollView,
  Pressable,
  useWindowDimensions,
  Platform,
  Text,
  AppState,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import * as Linking from "expo-linking";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  LayoutDashboard,
  House,
  CalendarDays,
  Users,
  Settings as SettingsIcon,
  Mic,
  Bell,
  ChevronRight,
  RefreshCw,
  X,
} from "lucide-react-native";
import { Provider, useApp } from "./src/lib/store";
import { translator } from "./src/lib/i18n";
import { consumeSharedMessage } from "./src/lib/share";
import { configured, supabase } from "./src/lib/supabase";
import { Auth } from "./src/screens/Auth";
import { Dashboard } from "./src/screens/Dashboard";
import { Houses } from "./src/screens/Houses";
import { Team } from "./src/screens/Team";
import { Calendar } from "./src/screens/Calendar";
import { Assistant } from "./src/screens/Assistant";
import { Requests } from "./src/screens/Requests";
import { Settings } from "./src/screens/Settings";
import {
  Brand,
  Label,
  Row,
  Avatar,
  Button,
  Busy,
  Sheet,
  useTheme,
} from "./src/components/ui";
import { scheduleReminders } from "./src/lib/notifications";
const nav = [
  { id: "dashboard", key: "dashboard", icon: LayoutDashboard },
  { id: "houses", key: "houses", icon: House },
  { id: "calendar", key: "calendar", icon: CalendarDays },
  { id: "team", key: "team", icon: Users },
  { id: "settings", key: "settings", icon: SettingsIcon },
];
function Shell() {
  const app = useApp(),
    c = useTheme(),
    t = translator(app.language),
    { width } = useWindowDimensions();
  const wide = width >= 950;
  const [page, setPage] = useState("dashboard"),
    [inbox, setInbox] = useState(false),
    [sharedText, setSharedText] = useState("");
  useEffect(() => {
    if (Platform.OS === "web") return;
    const openNotification = (response: Notifications.NotificationResponse) => {
      const screen = response.notification.request.content.data?.screen;
      setPage(
        screen === "requests"
          ? "requests"
          : screen === "calendar"
            ? "calendar"
            : "dashboard",
      );
      Notifications.clearLastNotificationResponse();
    };
    const last = Notifications.getLastNotificationResponse();
    if (last) openNotification(last);
    const sub =
      Notifications.addNotificationResponseReceivedListener(openNotification);
    return () => sub.remove();
  }, []);
  useEffect(() => {
    const handle = (url: string) => {
      const parsed = Linking.parse(url);
      if (
        parsed.path === "auth/callback" &&
        typeof parsed.queryParams?.code === "string"
      ) {
        void supabase?.auth
          .exchangeCodeForSession(parsed.queryParams.code)
          .then(({ error }) => {
            if (error) app.setError(error.message);
            else setPage("settings");
          });
      }
      if (
        parsed.path === "share" &&
        typeof parsed.queryParams?.text === "string"
      ) {
        setSharedText(parsed.queryParams.text);
        setPage("requests");
      }
    };
    Linking.getInitialURL().then((url) => url && handle(url));
    const sub = Linking.addEventListener("url", (e) => handle(e.url));
    return () => sub.remove();
  }, []);
  useEffect(() => {
    if (!app.session || Platform.OS === "web") return;
    AsyncStorage.multiGet(["notificationsEnabled", "briefingTime"]).then(
      async (v) => {
        if (v[0]?.[1] === "true")
          try {
            await scheduleReminders(
              app.data,
              app.language,
              v[1]?.[1] ?? "07:00",
            );
          } catch (e) {
            app.setError((e as Error).message);
          }
      },
    );
  }, [
    app.data.series,
    app.data.exceptions,
    app.language,
    app.session?.user.id,
  ]);
  useEffect(() => {
    const consume = async () => {
      const text = await consumeSharedMessage();
      if (text) {
        setSharedText(text);
        setPage("requests");
      }
    };
    void consume();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void consume();
        void app.refresh();
      }
    });
    return () => sub.remove();
  }, [app.session?.user.id]);
  const content =
    page === "dashboard" ? (
      <Dashboard navigate={setPage} />
    ) : page === "houses" ? (
      <Houses />
    ) : page === "calendar" ? (
      <Calendar />
    ) : page === "team" ? (
      <Team />
    ) : page === "assistant" ? (
      <Assistant />
    ) : page === "requests" && app.manager ? (
      <Requests initialText={sharedText} />
    ) : (
      <Settings />
    );
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <StatusBar style={app.dark ? "light" : "dark"} />
      {app.session ? (
        <View style={{ flex: 1, flexDirection: "row" }}>
          {wide && (
            <View
              style={{
                width: 245,
                backgroundColor: c.card,
                borderRightWidth: 1,
                borderColor: c.line,
                padding: 23,
                paddingTop: 30,
              }}
            >
              <Brand />
              <Label
                style={{
                  fontSize: 9,
                  color: c.muted,
                  letterSpacing: 2,
                  marginTop: 48,
                  marginBottom: 18,
                }}
              >
                {t("connection").toUpperCase()}
              </Label>
              {nav.map((n) => (
                <Pressable
                  key={n.id}
                  onPress={() => setPage(n.id)}
                  style={{
                    backgroundColor: page === n.id ? c.soft : "transparent",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    padding: 14,
                    borderRadius: 13,
                    marginBottom: 7,
                  }}
                >
                  <n.icon
                    size={19}
                    color={page === n.id ? c.accent : c.muted}
                  />
                  <Label
                    style={{
                      fontSize: 14,
                      fontWeight: page === n.id ? "600" : "400",
                      color: page === n.id ? c.accent : c.muted,
                    }}
                  >
                    {t(n.key as any)}
                  </Label>
                </Pressable>
              ))}
              <View style={{ marginTop: 27 }}>
                <Button
                  title={t("assistant")}
                  icon={Mic}
                  onPress={() => setPage("assistant")}
                />
              </View>
              <View style={{ flex: 1 }} />
              <View
                style={{
                  backgroundColor: c.bg,
                  borderRadius: 16,
                  padding: 16,
                  marginBottom: 22,
                }}
              >
                <Label style={{ fontSize: 13, fontWeight: "600" }}>
                  {app.language === "pt-BR"
                    ? "Cuidado em cada detalhe."
                    : "A little care goes a long way."}
                </Label>
                <Label style={{ fontSize: 11, color: c.muted, marginTop: 6 }}>
                  {t("security")}
                </Label>
              </View>
              <Row>
                <Avatar name={app.profile?.full_name ?? "S"} size={35} />
                <View style={{ flex: 1 }}>
                  <Label style={{ fontSize: 13, fontWeight: "600" }}>
                    {app.profile?.full_name}
                  </Label>
                  <Label style={{ fontSize: 10, color: c.muted }}>
                    {t(app.manager ? "manager" : "employee")}
                  </Label>
                </View>
              </Row>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <View
              style={{
                height: wide ? 83 : 72,
                borderBottomWidth: 1,
                borderColor: c.line,
                backgroundColor: c.card,
                paddingHorizontal: wide ? 34 : 20,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              {wide ? (
                <Label style={{ fontSize: 14, color: c.muted }}>
                  Saboia Cleaning <Text style={{ color: c.line }}> / </Text>{" "}
                  <Text style={{ color: c.ink }}>{t(page as any)}</Text>
                </Label>
              ) : (
                <Brand />
              )}
              <Row>
                <Pressable
                  accessibilityLabel={t("refresh")}
                  onPress={() => void app.refresh()}
                  style={{ padding: 10 }}
                >
                  <RefreshCw size={18} color={c.muted} />
                </Pressable>
                <Pressable
                  accessibilityLabel={t("notifications")}
                  onPress={() => setInbox(true)}
                  style={{ padding: 10 }}
                >
                  <Bell size={20} color={c.ink} />
                  {app.data.notifications.some((n) => !n.read_at) && (
                    <View
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: 4,
                        backgroundColor: c.accent,
                        position: "absolute",
                        right: 8,
                        top: 7,
                      }}
                    />
                  )}
                </Pressable>
                {wide && (
                  <Avatar name={app.profile?.full_name ?? "S"} size={34} />
                )}
              </Row>
            </View>
            {app.loading && !app.profile ? (
              <Busy />
            ) : (
              <ScrollView
                key={page}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{
                  padding: wide ? 34 : 20,
                  paddingBottom: 100,
                  maxWidth: 1120,
                  width: "100%",
                  alignSelf: "center",
                }}
              >
                {content}
              </ScrollView>
            )}
            {!wide && (
              <View
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  backgroundColor: c.card,
                  borderTopWidth: 1,
                  borderColor: c.line,
                  paddingTop: 10,
                  paddingBottom: Platform.OS === "ios" ? 15 : 10,
                  flexDirection: "row",
                  justifyContent: "space-around",
                }}
              >
                {nav.slice(0, 4).map((n) => (
                  <Pressable
                    key={n.id}
                    onPress={() => setPage(n.id)}
                    style={{ alignItems: "center", padding: 7, gap: 4 }}
                  >
                    <n.icon
                      color={page === n.id ? c.accent : c.muted}
                      size={22}
                    />
                    <Label
                      style={{
                        fontSize: 9,
                        color: page === n.id ? c.accent : c.muted,
                      }}
                    >
                      {t(n.key as any)}
                    </Label>
                  </Pressable>
                ))}
                <Pressable
                  onPress={() => setPage("assistant")}
                  accessibilityRole="button"
                  accessibilityLabel={t("assistant")}
                  style={{
                    backgroundColor: c.accent,
                    padding: 14,
                    borderRadius: 20,
                    marginTop: -20,
                    alignSelf: "center",
                  }}
                >
                  <Mic color={app.dark ? "#18301E" : "#fff"} size={24} />
                </Pressable>
                <Pressable
                  onPress={() => setPage("settings")}
                  accessibilityRole="button"
                  accessibilityLabel={t("settings")}
                  style={{ padding: 7, alignItems: "center", gap: 4 }}
                >
                  <SettingsIcon
                    size={22}
                    color={page === "settings" ? c.accent : c.muted}
                  />
                  <Label style={{ fontSize: 9, color: c.muted }}>
                    {t("settings")}
                  </Label>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      ) : app.loading ? (
        <Busy />
      ) : (
        <Auth />
      )}
      {app.error && (
        <View
          accessibilityRole="alert"
          style={{
            position: "absolute",
            top: 70,
            left: 20,
            right: 20,
            maxWidth: 650,
            alignSelf: "center",
            backgroundColor: app.dark ? "#542F2C" : "#FBE8E2",
            padding: 18,
            borderRadius: 14,
            zIndex: 1000,
            flexDirection: "row",
            gap: 12,
          }}
        >
          <Label style={{ color: c.danger, flex: 1 }}>
            {app.error === "SCHEDULING_CONFLICT" ? t("conflict") : app.error}
          </Label>
          <Pressable
            accessibilityLabel={t("close")}
            onPress={() => app.setError("")}
          >
            <X color={c.danger} size={20} />
          </Pressable>
        </View>
      )}
      <Sheet
        visible={inbox}
        title={t("notifications")}
        onClose={() => setInbox(false)}
      >
        {!app.data.notifications.length ? (
          <Label>{t("notificationsEmpty")}</Label>
        ) : (
          app.data.notifications.map((n) => (
            <View
              key={n.id}
              style={{ padding: 14, borderBottomWidth: 1, borderColor: c.line }}
            >
              <Label style={{ fontWeight: "600" }}>{n.title}</Label>
              <Label>{n.body}</Label>
            </View>
          ))
        )}
      </Sheet>
    </SafeAreaView>
  );
}
export default function App() {
  return (
    <SafeAreaProvider>
      <Provider>
        <Shell />
      </Provider>
    </SafeAreaProvider>
  );
}
