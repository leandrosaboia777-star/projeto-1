import React, { useState } from "react";
import { View, Pressable } from "react-native";
import {
  House,
  MapPin,
  CalendarDays,
  ClipboardList,
  ShieldCheck,
  Users,
  Check,
  Pencil,
} from "lucide-react-native";
import { formatInTimeZone } from "date-fns-tz";
import { proposalSchema, type Proposal } from "../domain/schema";
import { manualRequestTime } from "../domain/rescheduling";
import { useApp } from "../lib/store";
import { translator } from "../lib/i18n";
import { Card, Label, Button, Field, Chips, Row, useTheme } from "./ui";

type Props = {
  proposal: Proposal;
  busy: boolean;
  onConfirm: (proposal: Proposal) => Promise<void>;
  onCancel: () => void;
};
function Section({
  title,
  icon: Icon,
  children,
  editor,
}: {
  title: string;
  icon: any;
  children: React.ReactNode;
  editor: React.ReactNode;
}) {
  const app = useApp(),
    c = useTheme();
  const [editing, setEditing] = useState(false);
  return (
    <Card style={{ gap: 16 }}>
      <Row>
        <View
          style={{ backgroundColor: c.soft, padding: 10, borderRadius: 12 }}
        >
          <Icon size={20} color={c.accent} />
        </View>
        <Label style={{ fontSize: 18, fontWeight: "600", flex: 1 }}>
          {title}
        </Label>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${app.language === "pt-BR" ? "Editar" : "Edit"} ${title}`}
          accessibilityState={{ expanded: editing }}
          onPress={() => setEditing(!editing)}
          style={{ padding: 10 }}
        >
          <Pencil size={18} color={c.accent} />
        </Pressable>
      </Row>
      {editing ? editor : children}
      {editing && (
        <Button
          small
          secondary
          title={app.language === "pt-BR" ? "Concluir edição" : "Done editing"}
          onPress={() => setEditing(false)}
        />
      )}
    </Card>
  );
}
function Detail({ label, value }: { label: string; value: unknown }) {
  const c = useTheme();
  if (
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && !value.length)
  )
    return null;
  return (
    <View style={{ gap: 4 }}>
      <Label style={{ fontSize: 12, color: c.muted }}>{label}</Label>
      <Label style={{ fontSize: 16, lineHeight: 24 }}>
        {Array.isArray(value)
          ? value.map((v) => `✓ ${v}`).join("\n")
          : String(value)}
      </Label>
    </View>
  );
}

export function ProposalReview({ proposal, busy, onConfirm, onCancel }: Props) {
  const app = useApp(),
    c = useTheme(),
    t = translator(app.language),
    pt = app.language === "pt-BR";
  // A local draft keeps edits isolated until the explicit save. No raw JSON is
  // shown or editable. The complete payload is schema-checked before commit.
  const [draft, setDraft] = useState<any>(() =>
    JSON.parse(JSON.stringify(proposal)),
  );
  const [error, setError] = useState("");
  const initialStart =
    proposal.action === "create_house"
      ? proposal.schedule?.starts_at
      : proposal.action === "create_series"
        ? proposal.series.starts_at
        : proposal.action === "change_occurrence"
          ? proposal.starts_at
          : undefined;
  const [date, setDate] = useState(
    initialStart
      ? formatInTimeZone(initialStart, app.data.timezone, "yyyy-MM-dd")
      : "",
  );
  const [time, setTime] = useState(
    initialStart
      ? formatInTimeZone(initialStart, app.data.timezone, "HH:mm")
      : "",
  );
  const labels: Record<string, string> = {
    nickname: t("nickname"),
    client_name: t("client"),
    address: t("address"),
    phone: t("phone"),
    email: "Email",
    city: t("city"),
    state: t("state"),
    zip: t("zip"),
    duration_minutes: pt ? "Duração em minutos" : "Duration in minutes",
    bedrooms: t("bedrooms"),
    bathrooms: t("bathrooms"),
    checklist: pt ? "O que limpar" : "What to clean",
    restricted_rooms: t("restricted"),
    products: t("products"),
    avoid_products: t("avoid"),
    pets: t("pets"),
    warnings: t("warnings"),
    notes: t("notes"),
    parking: t("parking"),
    language: pt ? "Idioma do cliente" : "Client language",
    contact_preference: pt ? "Contato preferido" : "Preferred contact",
    full_name: pt ? "Nome completo" : "Full name",
    availability: t("availability"),
    role: t("role"),
    active: t("active"),
    interval_weeks: pt ? "A cada quantas semanas?" : "Every how many weeks?",
    recurrence: t("recurrence"),
    starts_at: t("date"),
    employee_ids: t("employees"),
    house_id: pt ? "Casa" : "House",
    color: pt ? "Cor do perfil" : "Profile color",
    user_id: pt ? "Conta vinculada" : "Linked account",
    access_instructions: t("access"),
    original_date: pt ? "Limpeza original" : "Original cleaning",
    canceled: pt ? "Cancelar esta limpeza" : "Cancel this cleaning",
  };
  const house =
    draft.action === "create_house"
      ? draft.house
      : draft.action === "update_house"
        ? draft.changes
        : null;
  const schedule =
    draft.action === "create_house"
      ? draft.schedule
      : draft.action === "create_series"
        ? draft.series
        : null;
  const currentHouse = app.data.houses.find((h) => h.id === draft.house_id);
  const currentSeries = app.data.series.find((s) => s.id === draft.series_id);
  const targetHouse =
    currentHouse ??
    app.data.houses.find(
      (h) => h.id === (schedule?.house_id ?? currentSeries?.house_id),
    );
  const duration = (value: number) =>
    !Number.isFinite(value) || value < 1
      ? pt
        ? "A preencher"
        : "To be filled"
      : `${Math.floor(value / 60) ? `${Math.floor(value / 60)} h` : ""}${value % 60 ? ` ${value % 60} min` : ""}`.trim();
  function update(section: string, key: string, value: unknown) {
    setError("");
    setDraft((d: any) => ({
      ...d,
      [section]: { ...d[section], [key]: value },
    }));
  }
  function root(key: string, value: unknown) {
    setError("");
    setDraft((d: any) => ({ ...d, [key]: value }));
  }
  function input(section: string, key: string) {
    const record = section ? draft[section] : draft;
    const value = record[key];
    const change = (v: unknown) =>
      section ? update(section, key, v) : root(key, v);
    if (key === "language")
      return (
        <View key={key}>
          <Label>{labels[key]}</Label>
          <Chips
            value={value}
            options={[
              { value: "pt-BR", label: "Português" },
              { value: "en-US", label: "English" },
            ]}
            onChange={change}
          />
        </View>
      );
    if (key === "contact_preference")
      return (
        <View key={key}>
          <Label>{labels[key]}</Label>
          <Chips
            value={value}
            options={[
              { value: "text", label: pt ? "Mensagem" : "Message" },
              { value: "phone", label: pt ? "Ligação" : "Phone call" },
              { value: "email", label: "Email" },
            ]}
            onChange={change}
          />
        </View>
      );
    if (
      ["duration_minutes", "bedrooms", "bathrooms", "interval_weeks"].includes(
        key,
      )
    )
      return (
        <Field
          key={key}
          label={labels[key]}
          value={value}
          keyboardType="numeric"
          onChangeText={(v: string) => change(v)}
        />
      );
    if (key === "checklist")
      return (
        <Field
          key={key}
          label={pt ? "Tarefas, uma por linha" : "Tasks, one per line"}
          value={Array.isArray(value) ? value.join("\n") : value}
          onChangeText={(v: string) => change(v.split("\n"))}
          multiline
        />
      );
    return (
      <Field
        key={key}
        label={labels[key]}
        value={value}
        onChangeText={change}
        multiline={[
          "notes",
          "warnings",
          "products",
          "avoid_products",
          "pets",
          "parking",
          "restricted_rooms",
          "availability",
        ].includes(key)}
      />
    );
  }
  function details(record: any, keys: string[]) {
    return keys
      .filter((k) => record[k] !== undefined)
      .map((k) => (
        <Detail
          key={k}
          label={labels[k]!}
          value={
            k === "duration_minutes"
              ? duration(Number(record[k]))
              : k === "language"
                ? record[k] === "pt-BR"
                  ? "Português"
                  : "English"
                : k === "contact_preference"
                  ? ((
                      {
                        text: pt ? "Mensagem" : "Message",
                        phone: pt ? "Ligação" : "Phone call",
                        email: "Email",
                      } as Record<string, string>
                    )[record[k]] ?? (pt ? "Outro" : "Other"))
                  : record[k]
          }
        />
      ));
  }
  function houseSection(title: string, icon: any, keys: string[]) {
    const present = keys.filter((k) => house?.[k] !== undefined);
    if (!present.length) return null;
    return (
      <Section
        title={title}
        icon={icon}
        editor={
          <View>
            {present.map((k) =>
              input(draft.action === "create_house" ? "house" : "changes", k),
            )}
          </View>
        }
      >
        <View style={{ gap: 14 }}>{details(house, present)}</View>
      </Section>
    );
  }
  const names = (ids: string[]) =>
    ids
      .map((id) => app.data.employees.find((e) => e.id === id)?.full_name)
      .filter(Boolean)
      .join(", ") || (pt ? "Sem equipe definida" : "No team assigned");
  const recurrenceLabel = (s: any) =>
    s.recurrence === "custom"
      ? pt
        ? `A cada ${s.interval_weeks} semanas`
        : `Every ${s.interval_weeks} weeks`
      : t(s.recurrence);
  const friendlyDate = () =>
    date && time
      ? (() => {
          try {
            return new Date(
              manualRequestTime(date, time, app.data.timezone),
            ).toLocaleString(app.language, {
              timeZone: app.data.timezone,
              weekday: "long",
              day: "numeric",
              month: "long",
              hour: "2-digit",
              minute: "2-digit",
            });
          } catch {
            return pt ? "Confira a data e o horário" : "Check date and time";
          }
        })()
      : pt
        ? "Sem data definida"
        : "No date set";
  function teamEditor(section: string) {
    const ids =
      (section ? draft[section].employee_ids : draft.employee_ids) ?? [];
    return (
      <View style={{ gap: 8 }}>
        <Label>{t("employees")}</Label>
        {app.data.employees
          .filter((e) => e.active)
          .map((e) => (
            <Button
              key={e.id}
              small
              secondary={!ids.includes(e.id)}
              title={`${ids.includes(e.id) ? "✓ " : ""}${e.full_name}`}
              onPress={() =>
                section
                  ? update(
                      section,
                      "employee_ids",
                      ids.includes(e.id)
                        ? ids.filter((id: string) => id !== e.id)
                        : [...ids, e.id],
                    )
                  : root(
                      "employee_ids",
                      ids.includes(e.id)
                        ? ids.filter((id: string) => id !== e.id)
                        : [...ids, e.id],
                    )
              }
            />
          ))}
      </View>
    );
  }
  async function save() {
    setError("");
    try {
      const value = JSON.parse(JSON.stringify(draft));
      if (initialStart) {
        const start = manualRequestTime(date, time, app.data.timezone);
        if (value.action === "create_house") value.schedule.starts_at = start;
        else if (value.action === "create_series")
          value.series.starts_at = start;
        else if (value.action === "change_occurrence") value.starts_at = start;
      }
      // Blank checklist lines are editing affordances, never saved as tasks.
      for (const record of [value.house, value.changes])
        if (Array.isArray(record?.checklist))
          record.checklist = record.checklist
            .map((v: string) => v.trim())
            .filter(Boolean);
      const result = proposalSchema.safeParse(value);
      if (!result.success) {
        const key = String(result.error.issues[0]?.path.at(-1) ?? "");
        setError(
          `${pt ? "Confira este campo" : "Check this field"}: ${labels[key] ?? (pt ? "dados da solicitação" : "request details")}.`,
        );
        return;
      }
      await onConfirm(result.data);
    } catch (e) {
      setError(
        (e as Error).message === "INVALID_DATE_TIME"
          ? pt
            ? "Confira a data e o horário antes de salvar."
            : "Check the date and time before saving."
          : pt
            ? "Não foi possível salvar. Confira sua conexão e tente novamente."
            : "Could not save. Check your connection and try again.",
      );
    }
  }
  const title =
    draft.action === "create_house"
      ? pt
        ? "Sua nova casa está organizada"
        : "Your new house is organized"
      : draft.action === "update_house"
        ? pt
          ? "Confira as alterações na casa"
          : "Review the house changes"
        : draft.action === "create_employee"
          ? pt
            ? "Novo integrante da equipe"
            : "New team member"
          : draft.action === "create_series"
            ? pt
              ? "Sua limpeza está organizada"
              : "Your cleaning is organized"
            : draft.canceled
              ? pt
                ? "Cancelar esta limpeza?"
                : "Cancel this cleaning?"
              : pt
                ? "Confira a mudança na agenda"
                : "Review the schedule change";
  return (
    <View style={{ gap: 14, marginBottom: 20 }}>
      <Card style={{ backgroundColor: c.soft, gap: 12 }}>
        <Row>
          <ShieldCheck size={24} color={c.accent} />
          <Label style={{ fontSize: 12, fontWeight: "600", color: c.accent }}>
            {pt ? "PRONTO PARA CONFERIR" : "READY TO REVIEW"}
          </Label>
        </Row>
        <Label
          accessibilityRole="header"
          style={{
            fontSize: 26,
            lineHeight: 32,
            fontWeight: "600",
            letterSpacing: -0.5,
          }}
        >
          {title}
        </Label>
        <Label style={{ color: c.muted }}>
          {pt
            ? "Confira os detalhes. Toque no lápis para corrigir alguma coisa."
            : "Review the details. Tap the pencil to make a correction."}
        </Label>
        <Label style={{ color: c.muted, fontSize: 13 }}>
          {pt
            ? "Só será salvo quando você confirmar abaixo."
            : "Only saved when you confirm below."}
        </Label>
      </Card>
      {house && (
        <>
          {draft.action === "update_house" && (
            <Detail
              label={pt ? "Casa" : "House"}
              value={
                currentHouse?.nickname ??
                (pt ? "Casa selecionada" : "Selected house")
              }
            />
          )}
          {houseSection(pt ? "Cliente e casa" : "Client and house", House, [
            "nickname",
            "client_name",
            "phone",
            "email",
            "language",
            "contact_preference",
          ])}
          {houseSection(pt ? "Endereço" : "Address", MapPin, [
            "address",
            "city",
            "state",
            "zip",
          ])}
          {houseSection(pt ? "A limpeza" : "The cleaning", ClipboardList, [
            "duration_minutes",
            "bedrooms",
            "bathrooms",
            "checklist",
            "restricted_rooms",
            "products",
            "avoid_products",
            "pets",
            "warnings",
            "notes",
            "parking",
          ])}
        </>
      )}
      {schedule && (
        <Section
          title={pt ? "Agenda da limpeza" : "Cleaning schedule"}
          icon={CalendarDays}
          editor={
            <View>
              {draft.action === "create_series" && (
                <Chips
                  value={schedule.house_id}
                  options={app.data.houses.map((h) => ({
                    value: h.id,
                    label: h.nickname,
                  }))}
                  onChange={(v: string) => update("series", "house_id", v)}
                />
              )}
              <Field label={t("date")} value={date} onChangeText={setDate} />
              <Field label={t("time")} value={time} onChangeText={setTime} />
              <Chips
                value={schedule.recurrence}
                options={[
                  "once",
                  "weekly",
                  "biweekly",
                  "monthly",
                  "custom",
                ].map((v) => ({ value: v, label: t(v as any) }))}
                onChange={(v: string) =>
                  update(
                    draft.action === "create_house" ? "schedule" : "series",
                    "recurrence",
                    v,
                  )
                }
              />
              {schedule.recurrence === "custom" &&
                input(
                  draft.action === "create_house" ? "schedule" : "series",
                  "interval_weeks",
                )}
              {input(
                draft.action === "create_house" ? "schedule" : "series",
                "duration_minutes",
              )}
              {teamEditor(
                draft.action === "create_house" ? "schedule" : "series",
              )}
              {input(
                draft.action === "create_house" ? "schedule" : "series",
                "notes",
              )}
            </View>
          }
        >
          <View style={{ gap: 14 }}>
            {targetHouse && (
              <Detail
                label={pt ? "Casa" : "House"}
                value={targetHouse.nickname}
              />
            )}
            <Detail
              label={pt ? "Primeira limpeza" : "First cleaning"}
              value={friendlyDate()}
            />
            <Detail label={t("recurrence")} value={recurrenceLabel(schedule)} />
            <Detail
              label={pt ? "Duração" : "Duration"}
              value={duration(Number(schedule.duration_minutes))}
            />
            <Detail
              label={t("employees")}
              value={names(schedule.employee_ids)}
            />
            <Detail label={t("notes")} value={schedule.notes} />
            <Label style={{ fontSize: 12, color: c.muted }}>
              {pt
                ? "Horários no fuso da empresa"
                : "Times in the business timezone"}
              : {app.data.timezone}
            </Label>
          </View>
        </Section>
      )}
      {draft.action === "create_house" && !schedule && (
        <Card>
          <Detail
            label={pt ? "Agenda" : "Schedule"}
            value={
              pt
                ? "Esta casa será salva sem agendamento. Você poderá marcar a limpeza depois."
                : "This house will be saved without a schedule. You can schedule a cleaning later."
            }
          />
        </Card>
      )}
      {draft.action === "create_employee" && (
        <Section
          title={pt ? "Dados da pessoa" : "Team member details"}
          icon={Users}
          editor={
            <View>
              {["full_name", "phone", "availability"].map((k) =>
                input("employee", k),
              )}
              <Chips
                value={draft.employee.role}
                options={[
                  { value: "manager", label: t("manager") },
                  { value: "employee", label: t("employee") },
                ]}
                onChange={(v: string) => update("employee", "role", v)}
              />
              <Chips
                value={String(draft.employee.active)}
                options={[
                  { value: "true", label: t("active") },
                  { value: "false", label: t("inactive") },
                ]}
                onChange={(v: string) =>
                  update("employee", "active", v === "true")
                }
              />
            </View>
          }
        >
          <View style={{ gap: 14 }}>
            {details(draft.employee, ["full_name", "phone", "availability"])}
            <Detail label={t("role")} value={t(draft.employee.role)} />
            <Detail
              label={pt ? "Situação" : "Status"}
              value={t(draft.employee.active ? "active" : "inactive")}
            />
          </View>
        </Section>
      )}
      {draft.action === "change_occurrence" && (
        <Section
          title={pt ? "Mudança nesta limpeza" : "Change to this cleaning"}
          icon={CalendarDays}
          editor={
            <View>
              {initialStart && (
                <>
                  <Field
                    label={t("date")}
                    value={date}
                    onChangeText={setDate}
                  />
                  <Field
                    label={t("time")}
                    value={time}
                    onChangeText={setTime}
                  />
                </>
              )}
              <Chips
                value={String(draft.canceled)}
                options={[
                  {
                    value: "false",
                    label: pt ? "Manter limpeza" : "Keep cleaning",
                  },
                  {
                    value: "true",
                    label: pt ? "Cancelar limpeza" : "Cancel cleaning",
                  },
                ]}
                onChange={(v: string) => root("canceled", v === "true")}
              />
              {draft.employee_ids !== undefined && teamEditor("")}
              {draft.notes !== undefined && input("", "notes")}
            </View>
          }
        >
          <View style={{ gap: 14 }}>
            <Detail
              label={pt ? "Casa" : "House"}
              value={
                targetHouse?.nickname ??
                (pt ? "Casa selecionada" : "Selected house")
              }
            />
            <Detail
              label={labels.original_date!}
              value={new Date(
                `${draft.original_date}T12:00:00`,
              ).toLocaleDateString(app.language, {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            />
            <Detail
              label={pt ? "O que vai mudar" : "What changes"}
              value={
                draft.canceled
                  ? pt
                    ? "Cancelar somente esta limpeza"
                    : "Cancel only this cleaning"
                  : initialStart
                    ? friendlyDate()
                    : pt
                      ? "Atualizar os detalhes desta limpeza"
                      : "Update this cleaning's details"
              }
            />
            {draft.employee_ids !== undefined && (
              <Detail
                label={t("employees")}
                value={names(draft.employee_ids)}
              />
            )}
            <Detail label={t("notes")} value={draft.notes} />
            <Label style={{ color: c.muted, fontSize: 13 }}>
              {pt
                ? "As outras limpezas da agenda continuam como estão."
                : "Other scheduled cleanings stay as they are."}
            </Label>
          </View>
        </Section>
      )}
      {draft.access_instructions !== undefined && (
        <Section
          title={pt ? "Acesso à casa" : "House access"}
          icon={ShieldCheck}
          editor={
            <Field
              label={t("access")}
              value={draft.access_instructions}
              secureTextEntry
              onChangeText={(v: string) => root("access_instructions", v)}
            />
          }
        >
          <Detail
            label={
              pt
                ? "Instruções de acesso privadas"
                : "Private access instructions"
            }
            value={
              draft.access_instructions
                ? pt
                  ? "Incluídas. Toque no lápis para editar."
                  : "Included. Tap the pencil to edit."
                : pt
                  ? "Nenhuma instrução de acesso"
                  : "No access instructions"
            }
          />
        </Section>
      )}
      {!!error && (
        <Label accessibilityRole="alert" style={{ color: c.danger }}>
          {error}
        </Label>
      )}
      <Button
        title={busy ? t("loading") : t("confirm")}
        icon={Check}
        disabled={busy || !app.manager}
        onPress={save}
      />
      <Button
        title={pt ? "Descartar esta sugestão" : "Discard this suggestion"}
        secondary
        disabled={busy}
        onPress={onCancel}
      />
    </View>
  );
}
