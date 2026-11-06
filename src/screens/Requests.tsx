import React, { useState, useEffect } from "react";
import { View, Linking, Platform } from "react-native";
import { addDays, startOfDay } from "date-fns";
import { useApp } from "../lib/store";
import { db, checked } from "../lib/supabase";
import { translator } from "../lib/i18n";
import { formatInTimeZone } from "date-fns-tz";
import type { Request } from "../domain/schema";
import { manualRequestTime, suggestRequestTimes } from "../domain/rescheduling";
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
function RequestCard({ request: r }: { request: Request }) {
  const app = useApp(),
    t = translator(app.language),
    c = useTheme();
  const pt = app.language === "pt-BR";
  const [selected, setSelected] = useState(r.requested_start ?? "");
  const [manual, setManual] = useState(false);
  const [date, setDate] = useState(
    r.requested_start
      ? formatInTimeZone(r.requested_start, app.data.timezone, "yyyy-MM-dd")
      : "",
  );
  const [time, setTime] = useState(
    r.requested_start
      ? formatInTimeZone(r.requested_start, app.data.timezone, "HH:mm")
      : "09:00",
  );
  const [busy, setBusy] = useState(false);
  const suggestions = suggestRequestTimes(app.data, r);
  async function resolve(approve: boolean) {
    setBusy(true);
    try {
      const start = approve
        ? manual
          ? manualRequestTime(date, time, app.data.timezone)
          : selected
        : null;
      if (approve && (!start || +new Date(start) <= Date.now()))
        throw new Error(
          pt ? "Escolha um horário futuro." : "Choose a future time.",
        );
      await checked(
        db().rpc("resolve_request", {
          p_request_id: r.id,
          p_approve: approve,
          p_starts_at: start,
        }),
      );
      await app.refresh();
    } catch (e) {
      app.setError(
        (e as Error).message === "INVALID_DATE_TIME"
          ? pt
            ? "Confira a data e o horário."
            : "Check the date and time."
          : (e as Error).message,
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card>
      <Label style={{ fontWeight: "600" }}>
        {app.data.houses.find((h) => h.id === r.house_id)?.client_name}
      </Label>
      <Label style={{ marginVertical: 12 }}>{r.message}</Label>
      <Label style={{ fontWeight: "600" }}>
        {pt ? "Escolha o novo horário" : "Choose the new time"}
      </Label>
      {r.requested_start && (
        <Button
          small
          secondary={selected !== r.requested_start || manual}
          title={`${pt ? "Pedido do cliente" : "Client's request"}: ${dateLabel(r.requested_start, app.language, app.data.timezone)}`}
          onPress={() => {
            setManual(false);
            setSelected(r.requested_start!);
          }}
        />
      )}
      <Label style={{ color: c.muted, marginVertical: 10 }}>
        {pt
          ? "Sugestões: próximos 14 dias, seg–sex, 8h–18h, com 30 min entre serviços. Confira deslocamento e equipe antes de confirmar."
          : "Suggestions: next 14 days, Mon–Fri, 8am–6pm, with 30 min between jobs. Check travel and staff before confirming."}
      </Label>
      {suggestions.map((start) => (
        <Button
          key={start}
          small
          secondary={manual || selected !== start}
          title={dateLabel(start, app.language, app.data.timezone)}
          onPress={() => {
            setManual(false);
            setSelected(start);
          }}
        />
      ))}
      {!suggestions.length && (
        <Label>
          {pt
            ? "Sem sugestão nessa janela. Escolha outra data abaixo."
            : "No suggestion in this window. Choose another date below."}
        </Label>
      )}
      <Button
        small
        secondary
        title={
          pt
            ? "Escolher outra data manualmente"
            : "Choose another date manually"
        }
        onPress={() => setManual(true)}
      />
      {manual && (
        <View>
          <Field
            label={pt ? "Nova data (AAAA-MM-DD)" : "New date (YYYY-MM-DD)"}
            value={date}
            onChangeText={setDate}
          />
          <Field
            label={`${t("time")} (${app.data.timezone})`}
            value={time}
            onChangeText={setTime}
          />
        </View>
      )}
      <Row>
        <Button
          small
          title={pt ? "Confirmar mudança" : "Confirm change"}
          disabled={
            busy || !r.series_id || !r.original_date || (!manual && !selected)
          }
          onPress={() => void resolve(true)}
        />
        <Button
          small
          secondary
          title={t("decline")}
          disabled={busy}
          onPress={() => void resolve(false)}
        />
      </Row>
      <Button
        secondary
        small
        title={pt ? "Preparar resposta por SMS" : "Prepare SMS reply"}
        onPress={() => {
          const h = app.data.houses.find((h) => h.id === r.house_id);
          if (!h?.phone) {
            app.setError(t("phone"));
            return;
          }
          const reply = pt
            ? `Olá ${h.client_name}, recebemos sua solicitação de alteração. Vamos confirmar o horário em breve.`
            : `Hi ${h.client_name}, we received your rescheduling request. We will confirm the time shortly.`;
          void Linking.openURL(
            `sms:${h.phone}${Platform.OS === "ios" ? "&" : "?"}body=${encodeURIComponent(reply)}`,
          );
        }}
      />
    </Card>
  );
}

export function Requests({ initialText = "" }: { initialText?: string }) {
  const app = useApp(),
    t = translator(app.language),
    c = useTheme();
  const [message, setMessage] = useState(""),
    [house, setHouse] = useState(""),
    [occurrence, setOccurrence] = useState(""),
    [date, setDate] = useState(""),
    [time, setTime] = useState("09:00"),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (initialText) setMessage(initialText);
  }, [initialText]);
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
      app.setError(
        (e as Error).message === "INVALID_DATE_TIME"
          ? app.language === "pt-BR"
            ? "Confira a data e o horário."
            : "Check the date and time."
          : (e as Error).message,
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={{ gap: 16 }}>
      <Label style={{ color: c.muted }}>
        {app.language === "pt-BR"
          ? "Cole a mensagem do cliente. A agenda só muda após sua confirmação. Ative os lembretes de solicitações nas Configurações."
          : "Paste the client's message. Your schedule changes only after confirmation. Enable request reminders in Settings."}
      </Label>
      {app.data.requests
        .filter((r) => r.status === "pending")
        .map((r) => (
          <RequestCard key={r.id} request={r} />
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
              const d = result.request.requested_start;
              setDate(formatInTimeZone(d, app.data.timezone, "yyyy-MM-dd"));
              setTime(formatInTimeZone(d, app.data.timezone, "HH:mm"));
            }
            if (
              result.request?.house_id &&
              result.request?.series_id &&
              result.request?.original_date &&
              result.request?.requested_start
            ) {
              await checked(
                db()
                  .from("client_requests")
                  .insert({
                    business_id: app.profile!.business_id,
                    ...result.request,
                    message,
                  }),
              );
              setMessage("");
              setHouse("");
              setOccurrence("");
              setDate("");
              await app.refresh();
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
          label: dateLabel(o.starts_at, app.language, app.data.timezone),
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
                  requested_start: manualRequestTime(
                    date,
                    time,
                    app.data.timezone,
                  ),
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
