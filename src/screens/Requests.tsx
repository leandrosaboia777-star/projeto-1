import React, { useState } from "react";
import { View, Linking, Platform } from "react-native";
import { format, addDays, startOfDay } from "date-fns";
import { useApp } from "../lib/store";
import { db, checked } from "../lib/supabase";
import { translator } from "../lib/i18n";
import { expandSchedule, dateLabel } from "../domain/schedule";
import {
  Card,
  Label,
  Field,
  Button,
  Chips,
  Row,
  useTheme,
} from "../components/ui";
export function Requests() {
  const app = useApp(),
    t = translator(app.language),
    c = useTheme();
  const [message, setMessage] = useState(""),
    [house, setHouse] = useState(""),
    [occurrence, setOccurrence] = useState(""),
    [date, setDate] = useState(""),
    [time, setTime] = useState("09:00"),
    [busy, setBusy] = useState(false),
    [suggestion, setSuggestion] = useState("");
  const appointments = expandSchedule(
    app.data.series,
    app.data.exceptions,
    startOfDay(new Date()),
    addDays(startOfDay(new Date()), 60),
    app.data.timezone,
  ).filter((o) => o.house_id === house);
  async function run(fn: () => Promise<any>) {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      app.setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={{ gap: 16 }}>
      {app.data.requests
        .filter((r) => r.status === "pending")
        .map((r) => (
          <Card key={r.id}>
            <Label style={{ fontWeight: "600" }}>
              {app.data.houses.find((h) => h.id === r.house_id)?.client_name}
            </Label>
            <Label style={{ marginVertical: 12 }}>{r.message}</Label>
            <Label style={{ color: c.muted, marginBottom: 14 }}>
              {r.requested_start
                ? dateLabel(r.requested_start, app.language)
                : "—"}
            </Label>
            <Row>
              <Button
                small
                title={t("approve")}
                disabled={busy}
                onPress={() =>
                  run(async () => {
                    await checked(
                      db().rpc("resolve_request", {
                        p_request_id: r.id,
                        p_approve: true,
                      }),
                    );
                    await app.refresh();
                  })
                }
              />
              <Button
                small
                secondary
                title={t("decline")}
                disabled={busy}
                onPress={() =>
                  run(async () => {
                    await checked(
                      db().rpc("resolve_request", {
                        p_request_id: r.id,
                        p_approve: false,
                      }),
                    );
                    await app.refresh();
                  })
                }
              />
            </Row>
            <Button
              secondary
              small
              title={
                app.language === "pt-BR"
                  ? "Preparar resposta por SMS"
                  : "Prepare SMS reply"
              }
              onPress={() => {
                const h = app.data.houses.find((h) => h.id === r.house_id);
                if (!h?.phone) {
                  app.setError(t("phone"));
                  return;
                }
                const reply =
                  app.language === "pt-BR"
                    ? `Olá ${h.client_name}, recebemos sua solicitação de alteração. Vamos confirmar o horário em breve.`
                    : `Hi ${h.client_name}, we received your rescheduling request. We will confirm the time shortly.`;
                void Linking.openURL(
                  `sms:${h.phone}${Platform.OS === "ios" ? "&" : "?"}body=${encodeURIComponent(reply)}`,
                );
              }}
            />
            <Field
              label={t("suggest")}
              placeholder="2026-11-10T10:00:00-05:00"
              value={suggestion}
              onChangeText={setSuggestion}
            />
            <Button
              secondary
              small
              title={t("suggest")}
              onPress={() =>
                run(async () => {
                  const starts = new Date(suggestion).toISOString();
                  await checked(
                    db()
                      .from("client_requests")
                      .update({ requested_start: starts })
                      .eq("id", r.id),
                  );
                  await app.refresh();
                })
              }
            />
          </Card>
        ))}
      <Label style={{ fontSize: 19, fontWeight: "600" }}>
        {t("importMessage")}
      </Label>
      <Field
        label={t("message")}
        value={message}
        onChangeText={setMessage}
        multiline
      />
      <Button
        title={t("analyze")}
        disabled={busy || !message}
        secondary
        onPress={() =>
          run(async () => {
            const result = await checked(
              db().functions.invoke("assistant", {
                body: {
                  mode: "reschedule",
                  messages: [{ role: "user", content: message }],
                  language: app.language,
                  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                },
              }),
            );
            if (result.request?.house_id) setHouse(result.request.house_id);
            if (result.request?.series_id && result.request?.original_date)
              setOccurrence(
                `${result.request.series_id}:${result.request.original_date}`,
              );
            if (result.request?.requested_start) {
              const d = new Date(result.request.requested_start);
              setDate(format(d, "yyyy-MM-dd"));
              setTime(format(d, "HH:mm"));
            }
            if (result.question) app.setError(result.question);
          })
        }
      />
      <Chips
        value={house}
        options={app.data.houses.map((h) => ({
          value: h.id,
          label: h.client_name,
        }))}
        onChange={(v: string) => {
          setHouse(v);
          setOccurrence("");
        }}
      />
      <Chips
        value={occurrence}
        options={appointments.map((o) => ({
          value: o.key,
          label: dateLabel(o.starts_at, app.language),
        }))}
        onChange={setOccurrence}
      />
      <Field label={t("date")} value={date} onChangeText={setDate} />
      <Field label={t("time")} value={time} onChangeText={setTime} />
      <Button
        title={t("save")}
        disabled={busy || !house || !occurrence || !date}
        onPress={() =>
          run(async () => {
            const o = appointments.find((o) => o.key === occurrence);
            if (!o) throw new Error("Select an appointment");
            await checked(
              db()
                .from("client_requests")
                .insert({
                  business_id: app.profile!.business_id,
                  house_id: house,
                  message,
                  series_id: o.series_id,
                  original_date: o.original_date,
                  requested_start: new Date(`${date}T${time}:00`).toISOString(),
                }),
            );
            setMessage("");
            setDate("");
            await app.refresh();
          })
        }
      />
    </View>
  );
}
