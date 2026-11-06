import React, { useState } from "react";
import { View, Pressable, Linking } from "react-native";
import {
  addDays,
  addWeeks,
  addMonths,
  startOfDay,
  startOfWeek,
  startOfMonth,
  endOfMonth,
  format,
  parseISO,
} from "date-fns";
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Clock,
  Check,
  Navigation,
} from "lucide-react-native";
import {
  Card,
  Label,
  Heading,
  Field,
  Button,
  Sheet,
  Row,
  Tag,
  Empty,
  Chips,
  Avatar,
  useTheme,
} from "../components/ui";
import { uploadPrivatePhoto } from "../lib/photos";
import { db, checked } from "../lib/supabase";
import { useApp } from "../lib/store";
import { translator } from "../lib/i18n";
import { expandSchedule, dateLabel } from "../domain/schedule";
import { seriesSchema, type Occurrence } from "../domain/schema";
export function AppointmentCard({
  o,
  onPress,
}: {
  o: Occurrence;
  onPress: () => void;
}) {
  const { data, language } = useApp(),
    c = useTheme(),
    t = translator(language);
  const h = data.houses.find((h) => h.id === o.house_id);
  const v = data.visits.find(
    (v) => v.series_id === o.series_id && v.original_date === o.original_date,
  );
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      <Card style={{ marginBottom: 12 }}>
        <Row style={{ alignItems: "flex-start" }}>
          <View
            style={{
              width: 64,
              borderRightWidth: 1,
              borderColor: c.line,
              paddingRight: 12,
            }}
          >
            <Label style={{ fontSize: 17, fontWeight: "600" }}>
              {new Date(o.starts_at).toLocaleTimeString(language, {
                hour: "numeric",
                minute: "2-digit",
              })}
            </Label>
            <Label style={{ fontSize: 11, color: c.muted }}>
              {o.duration_minutes} {t("minutes")}
            </Label>
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            <Label style={{ fontSize: 17, fontWeight: "600" }}>
              {h?.nickname ?? "—"}
            </Label>
            <Label style={{ fontSize: 12, color: c.muted }}>
              {h?.address}
              {h?.city ? `, ${h.city}` : ""}
            </Label>
            <Row style={{ gap: 0, marginTop: 4 }}>
              {o.employee_ids.map((id) => {
                const e = data.employees.find((e) => e.id === id);
                return (
                  <Avatar
                    key={id}
                    name={e?.full_name ?? "?"}
                    color={e?.color}
                    size={26}
                  />
                );
              })}
              <Label style={{ fontSize: 11, color: c.muted, marginLeft: 7 }}>
                {new Date(o.ends_at).toLocaleTimeString(language, {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </Label>
            </Row>
          </View>
          <Tag>{t(v?.status ?? "not_started")}</Tag>
        </Row>
      </Card>
    </Pressable>
  );
}
export function Calendar({ initialDate }: { initialDate?: Date }) {
  const app = useApp(),
    { data, language, manager } = app,
    t = translator(language),
    c = useTheme();
  const [date, setDate] = useState(initialDate ?? new Date()),
    [view, setView] = useState("week"),
    [employee, setEmployee] = useState("all"),
    [add, setAdd] = useState(false),
    [selected, setSelected] = useState<Occurrence | null>(null),
    [draft, setDraft] = useState<any>({
      recurrence: "weekly",
      date: format(new Date(), "yyyy-MM-dd"),
      time: "09:00",
      duration_minutes: "120",
      employee_ids: [],
      interval_weeks: "1",
      notes: "",
    }),
    [scope, setScope] = useState("one"),
    [moveDate, setMoveDate] = useState(""),
    [moveTime, setMoveTime] = useState("09:00"),
    [note, setNote] = useState(""),
    [busy, setBusy] = useState(false);
  let from =
    view === "month"
      ? startOfMonth(date)
      : view === "week" || view === "employee"
        ? startOfWeek(date, { weekStartsOn: 1 })
        : startOfDay(date);
  let to =
    view === "month"
      ? addDays(endOfMonth(date), 1)
      : addDays(from, view === "day" ? 1 : 7);
  const items = expandSchedule(
    data.series,
    data.exceptions,
    from,
    to,
    data.timezone,
  ).filter((o) => employee === "all" || o.employee_ids.includes(employee));
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
  const select = (o: Occurrence) => {
    setSelected(o);
    setMoveDate(format(parseISO(o.starts_at), "yyyy-MM-dd"));
    setMoveTime(format(parseISO(o.starts_at), "HH:mm"));
    setScope("one");
    setNote(
      data.visits.find(
        (v) =>
          v.series_id === o.series_id && v.original_date === o.original_date,
      )?.notes ?? "",
    );
  };
  const visit = selected
    ? data.visits.find(
        (v) =>
          v.series_id === selected.series_id &&
          v.original_date === selected.original_date,
      )
    : null;
  const house = selected
    ? data.houses.find((h) => h.id === selected.house_id)
    : null;
  return (
    <>
      <Row style={{ justifyContent: "space-between" }}>
        <Heading>{t("calendar")}</Heading>
        {manager && (
          <Button
            title={t("schedule")}
            onPress={() => setAdd(true)}
            icon={Plus}
          />
        )}
      </Row>
      <Chips
        value={view}
        options={["day", "week", "month", "employee"].map((value) => ({
          value,
          label: t(value === "employee" ? "employeeView" : (value as any)),
        }))}
        onChange={setView}
      />
      <Row style={{ justifyContent: "space-between", marginBottom: 20 }}>
        <Button
          small
          secondary
          title={t("previous")}
          icon={ChevronLeft}
          onPress={() =>
            setDate(
              view === "month"
                ? addMonths(date, -1)
                : addDays(date, view === "day" ? -1 : -7),
            )
          }
        />
        <Label style={{ fontWeight: "600" }}>
          {date.toLocaleDateString(language, {
            month: "long",
            year: "numeric",
            ...(view === "day" ? { day: "numeric" } : {}),
          })}
        </Label>
        <Button
          small
          secondary
          title={t("next")}
          icon={ChevronRight}
          onPress={() =>
            setDate(
              view === "month"
                ? addMonths(date, 1)
                : addDays(date, view === "day" ? 1 : 7),
            )
          }
        />
      </Row>
      {view === "employee" && (
        <Chips
          value={employee}
          options={[
            { value: "all", label: t("allHouses") },
            ...data.employees.map((e) => ({ value: e.id, label: e.full_name })),
          ]}
          onChange={setEmployee}
        />
      )}
      {items.length === 0 ? (
        <Empty title={t("noAppointments")} />
      ) : (
        Array.from(
          new Set(
            items.map((o) => format(parseISO(o.starts_at), "yyyy-MM-dd")),
          ),
        ).map((day) => (
          <View key={day}>
            <Label
              style={{
                fontWeight: "600",
                color: c.muted,
                fontSize: 12,
                marginVertical: 14,
                textTransform: "uppercase",
                letterSpacing: 1,
              }}
            >
              {parseISO(day).toLocaleDateString(language, {
                weekday: "long",
                month: "short",
                day: "numeric",
              })}
            </Label>
            {items
              .filter(
                (o) => format(parseISO(o.starts_at), "yyyy-MM-dd") === day,
              )
              .map((o) => (
                <AppointmentCard key={o.key} o={o} onPress={() => select(o)} />
              ))}
          </View>
        ))
      )}
      <Sheet visible={add} title={t("schedule")} onClose={() => setAdd(false)}>
        <Label>{t("houses")}</Label>
        <Chips
          value={draft.house_id}
          options={data.houses.map((h) => ({ value: h.id, label: h.nickname }))}
          onChange={(v: string) =>
            setDraft({
              ...draft,
              house_id: v,
              duration_minutes: String(
                data.houses.find((h) => h.id === v)?.duration_minutes ?? 120,
              ),
            })
          }
        />
        {["date", "time", "duration_minutes"].map((f) => (
          <Field
            key={f}
            label={t(f === "duration_minutes" ? "duration" : (f as any))}
            value={draft[f]}
            onChangeText={(v: string) => setDraft({ ...draft, [f]: v })}
          />
        ))}
        <Label>{t("recurrence")}</Label>
        <Chips
          value={draft.recurrence}
          options={["once", "weekly", "biweekly", "monthly", "custom"].map(
            (value) => ({ value, label: t(value as any) }),
          )}
          onChange={(v: string) => setDraft({ ...draft, recurrence: v })}
        />
        {draft.recurrence === "custom" && (
          <Field
            label={t("interval")}
            value={draft.interval_weeks}
            onChangeText={(v: string) =>
              setDraft({ ...draft, interval_weeks: v })
            }
          />
        )}
        <Label>{t("employees")}</Label>
        <Chips
          value=""
          options={data.employees
            .filter((e) => e.active)
            .map((e) => ({
              value: e.id,
              label: `${draft.employee_ids.includes(e.id) ? "✓ " : ""}${e.full_name}`,
            }))}
          onChange={(id: string) =>
            setDraft({
              ...draft,
              employee_ids: draft.employee_ids.includes(id)
                ? draft.employee_ids.filter((v: string) => v !== id)
                : [...draft.employee_ids, id],
            })
          }
        />
        <Field
          label={t("seriesNotes")}
          value={draft.notes}
          multiline
          onChangeText={(v: string) => setDraft({ ...draft, notes: v })}
        />
        <Button
          title={busy ? t("loading") : t("save")}
          disabled={busy}
          onPress={() =>
            run(async () => {
              const input = seriesSchema.parse({
                ...draft,
                starts_at: new Date(
                  `${draft.date}T${draft.time}:00`,
                ).toISOString(),
              });
              await app.saveSeries(input);
              setAdd(false);
            })
          }
        />
      </Sheet>
      <Sheet
        visible={!!selected}
        title={house?.nickname ?? t("schedule")}
        onClose={() => setSelected(null)}
      >
        {selected && (
          <>
            <Label style={{ marginBottom: 12 }}>
              {dateLabel(selected.starts_at, language)} →{" "}
              {new Date(selected.ends_at).toLocaleTimeString(language, {
                hour: "numeric",
                minute: "2-digit",
              })}
            </Label>
            <Button
              secondary
              title={t("openMaps")}
              icon={Navigation}
              onPress={() =>
                Linking.openURL(
                  `https://maps.apple.com/?q=${encodeURIComponent([house?.address, house?.city, house?.state].join(" "))}`,
                )
              }
            />
            <Label style={{ marginTop: 20, color: c.muted }}>
              {t("status")}
            </Label>
            <Chips
              value={visit?.status ?? "not_started"}
              options={[
                "not_started",
                "on_the_way",
                "in_progress",
                "paused",
                "completed",
              ].map((value) => ({ value, label: t(value as any) }))}
              onChange={(status: any) =>
                run(() => app.updateVisit(selected, { status }))
              }
            />
            {selected.notes && (
              <Card>
                <Label>{selected.notes}</Label>
              </Card>
            )}
            {house?.warnings && (
              <Label style={{ color: c.danger, marginVertical: 12 }}>
                {house.warnings}
              </Label>
            )}
            <Label
              style={{ fontWeight: "600", marginTop: 20, marginBottom: 12 }}
            >
              {t("checklist")}
            </Label>
            {house?.checklist.map((task) => (
              <Pressable
                key={task}
                onPress={() =>
                  run(async () => {
                    const done = visit?.completed_tasks ?? [];
                    await app.updateVisit(selected, {
                      completed_tasks: done.includes(task)
                        ? done.filter((t) => t !== task)
                        : [...done, task],
                    });
                  })
                }
                style={{
                  padding: 14,
                  borderBottomWidth: 1,
                  borderColor: c.line,
                  flexDirection: "row",
                  gap: 12,
                }}
              >
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderWidth: 1,
                    borderRadius: 6,
                    borderColor: c.accent,
                    backgroundColor: visit?.completed_tasks.includes(task)
                      ? c.accent
                      : "transparent",
                  }}
                >
                  {visit?.completed_tasks.includes(task) && (
                    <Check size={20} color={app.dark ? "#142719" : "#fff"} />
                  )}
                </View>
                <Label>{task}</Label>
              </Pressable>
            ))}
            <Field
              label={t("completionNotes")}
              value={note}
              multiline
              onChangeText={setNote}
            />
            <Button
              secondary
              title={t("addNote")}
              disabled={busy}
              onPress={() =>
                run(() => app.updateVisit(selected, { notes: note }))
              }
            />
            <View style={{ marginTop: 12 }}>
              <Button
                secondary
                title={t("uploadPhoto")}
                disabled={busy}
                onPress={() =>
                  run(async () => {
                    await app.updateVisit(selected, {});
                    const visit = await checked(
                      db()
                        .from("visits")
                        .select("id")
                        .eq("series_id", selected.series_id)
                        .eq("original_date", selected.original_date)
                        .single(),
                    );
                    await uploadPrivatePhoto(
                      app.profile!.business_id,
                      selected.house_id,
                      visit!.id,
                    );
                    await app.refresh();
                  })
                }
              />
            </View>
            {manager && (
              <View style={{ marginTop: 26 }}>
                <Label
                  style={{ fontSize: 20, fontWeight: "600", marginBottom: 12 }}
                >
                  {t("reschedule")}
                </Label>
                <Chips
                  value={scope}
                  options={["one", "future", "all"].map((value) => ({
                    value,
                    label: t(value as any),
                  }))}
                  onChange={setScope}
                />
                <Field
                  label={t("date")}
                  value={moveDate}
                  onChangeText={setMoveDate}
                />
                <Field
                  label={t("time")}
                  value={moveTime}
                  onChangeText={setMoveTime}
                />
                <Row>
                  <Button
                    title={t("reschedule")}
                    disabled={busy}
                    onPress={() =>
                      run(async () => {
                        await app.changeSchedule(
                          selected,
                          scope,
                          new Date(`${moveDate}T${moveTime}:00`).toISOString(),
                          false,
                        );
                        setSelected(null);
                      })
                    }
                  />
                  <Button
                    danger
                    title={t("cancelAppointment")}
                    disabled={busy}
                    onPress={() =>
                      run(async () => {
                        await app.changeSchedule(
                          selected,
                          scope,
                          selected.starts_at,
                          true,
                        );
                        setSelected(null);
                      })
                    }
                  />
                </Row>
              </View>
            )}
          </>
        )}
      </Sheet>
    </>
  );
}
