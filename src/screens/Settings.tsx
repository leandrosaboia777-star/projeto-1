import React, { useState, useEffect } from "react";
import { View, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Bell, LogOut, Shield, Globe, Sun } from "lucide-react-native";
import { useApp } from "../lib/store";
import { db, checked } from "../lib/supabase";
import { translator } from "../lib/i18n";
import { scheduleReminders } from "../lib/notifications";
import {
  enableRequestNotifications,
  disableRequestNotifications,
} from "../lib/requestNotifications";
import {
  Card,
  Label,
  Heading,
  Field,
  Button,
  Chips,
  Row,
  useTheme,
} from "../components/ui";
export function Settings() {
  const app = useApp(),
    t = translator(app.language),
    c = useTheme();
  const [time, setTime] = useState("07:00"),
    [password, setPassword] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [invite, setInvite] = useState("");
  useEffect(() => {
    AsyncStorage.getItem("briefingTime").then((v) => v && setTime(v));
  }, []);
  return (
    <View style={{ gap: 18 }}>
      <Heading>{t("settings")}</Heading>
      <Card>
        <Row>
          <Globe size={20} color={c.accent} />
          <Label style={{ fontSize: 18, fontWeight: "600" }}>
            {t("language")}
          </Label>
        </Row>
        <View style={{ height: 16 }} />
        <Chips
          value={app.language}
          onChange={app.setLanguage}
          options={[
            { value: "en-US", label: "English" },
            { value: "pt-BR", label: "Português brasileiro" },
          ]}
        />
        <Label style={{ fontWeight: "600", marginBottom: 12 }}>
          {t("theme")}
        </Label>
        <Chips
          value={app.dark ? "dark" : "light"}
          onChange={(v: string) => app.setDark(v === "dark")}
          options={[
            { value: "light", label: t("light") },
            { value: "dark", label: t("dark") },
          ]}
        />
      </Card>
      {app.manager && (
        <Card>
          <Label style={{ fontSize: 18, fontWeight: "600" }}>
            {app.language === "pt-BR"
              ? "Lembretes de solicitações"
              : "Request reminders"}
          </Label>
          <Label style={{ color: c.muted, marginVertical: 15 }}>
            {app.language === "pt-BR"
              ? "Primeiro lembrete após 1 hora; depois, a cada 5 horas enquanto o pedido estiver pendente. Requer a automação de lembretes configurada no servidor. A entrega depende da conexão e dos ajustes de notificações do iPhone."
              : "First reminder after 1 hour, then every 5 hours while pending. Requires the reminder automation configured on your server. Delivery depends on connectivity and phone notification settings."}
          </Label>
          <Button
            title={
              app.language === "pt-BR"
                ? "Ativar neste celular"
                : "Enable on this phone"
            }
            disabled={busy}
            onPress={async () => {
              setBusy(true);
              try {
                await enableRequestNotifications(app.language);
                setNotice(t("saved"));
              } catch (e) {
                app.setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          />
          <Button
            secondary
            title={
              app.language === "pt-BR"
                ? "Desativar neste celular"
                : "Disable on this phone"
            }
            disabled={busy}
            onPress={async () => {
              setBusy(true);
              try {
                await disableRequestNotifications();
                setNotice(t("saved"));
              } catch (e) {
                app.setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          />
        </Card>
      )}
      <Card>
        <Row>
          <Bell size={20} color={c.accent} />
          <Label style={{ fontSize: 18, fontWeight: "600" }}>
            {t("notifications")}
          </Label>
        </Row>
        <Label style={{ fontSize: 13, color: c.muted, marginVertical: 15 }}>
          {t("notificationHelp")}
        </Label>
        <Field label={t("briefingTime")} value={time} onChangeText={setTime} />
        <Button
          title={busy ? t("loading") : t("enableNotifications")}
          disabled={busy}
          onPress={async () => {
            setBusy(true);
            try {
              await scheduleReminders(app.data, app.language, time);
              await AsyncStorage.multiSet([
                ["briefingTime", time],
                ["notificationsEnabled", "true"],
              ]);
              setNotice(t("saved"));
            } catch (e) {
              app.setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        />
      </Card>
      <Card>
        <Row>
          <Shield size={20} color={c.accent} />
          <Label style={{ fontWeight: "600", fontSize: 18 }}>
            {t("connection")}
          </Label>
        </Row>
        <Label style={{ marginTop: 12, color: c.muted, fontSize: 13 }}>
          {t("security")}
        </Label>
        <Label selectable style={{ marginTop: 10, fontSize: 12 }}>
          {app.session?.user.email}
          {"\n"}
          {app.session?.user.id}
        </Label>
        <Field
          label={t("password")}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <Button
          title={t("resetPassword")}
          secondary
          onPress={async () => {
            try {
              if (password.length < 8) throw new Error("Minimum 8 characters");
              const { error } = await db().auth.updateUser({ password });
              if (error) throw error;
              setPassword("");
              setNotice(t("saved"));
            } catch (e) {
              app.setError((e as Error).message);
            }
          }}
        />
        <Label style={{ color: c.accent, marginTop: 10 }}>{notice}</Label>
        <Label style={{ fontSize: 12, color: c.muted, marginTop: 18 }}>
          {t("timezone")}: {Intl.DateTimeFormat().resolvedOptions().timeZone}
          {"\n"}
          {t("timezoneHelp")}
        </Label>
      </Card>
      <Card>
        <Field
          label={
            app.language === "pt-BR"
              ? "Código de convite da equipe"
              : "Team invitation code"
          }
          value={invite}
          onChangeText={setInvite}
          autoCapitalize="none"
        />
        <Button
          title={
            app.language === "pt-BR" ? "Aceitar convite" : "Accept invitation"
          }
          disabled={!invite}
          onPress={async () => {
            try {
              await checked(
                db().rpc("accept_employee_invite", { p_token: invite.trim() }),
              );
              setInvite("");
              await app.refresh();
            } catch (e) {
              app.setError((e as Error).message);
            }
          }}
        />
      </Card>
      <Button
        title={t("signOut")}
        icon={LogOut}
        secondary
        onPress={async () => {
          try {
            await disableRequestNotifications();
            const { error } = await db().auth.signOut();
            if (error) throw error;
          } catch (e) {
            app.setError((e as Error).message);
          }
        }}
      />
    </View>
  );
}
