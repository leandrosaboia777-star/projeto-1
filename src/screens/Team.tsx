import React, { useState } from "react";
import { View, Pressable } from "react-native";
import { Plus, Users } from "lucide-react-native";
import { useApp } from "../lib/store";
import { translator } from "../lib/i18n";
import { employeeSchema, type Employee } from "../domain/schema";
import { db, checked } from "../lib/supabase";
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
export function Team() {
  const app = useApp(),
    t = translator(app.language),
    c = useTheme();
  const [open, setOpen] = useState(false),
    [selected, setSelected] = useState<Employee | null>(null),
    [draft, setDraft] = useState<any>({}),
    [busy, setBusy] = useState(false),
    [invite, setInvite] = useState("");
  const edit = (e?: Employee) => {
    setSelected(e ?? null);
    setDraft(
      e ?? {
        full_name: "",
        phone: "",
        role: "employee",
        availability: "",
        active: true,
        color: "#537C70",
        user_id: null,
      },
    );
    setInvite("");
    setOpen(true);
  };
  return (
    <>
      <Row style={{ justifyContent: "space-between" }}>
        <Heading sub={t("emptyTeamBody")}>{t("team")}</Heading>
        {app.manager && (
          <Button title={t("newEmployee")} icon={Plus} onPress={() => edit()} />
        )}
      </Row>
      {!app.data.employees.length ? (
        <Empty icon={Users} title={t("emptyTeam")} body={t("emptyTeamBody")} />
      ) : (
        <View style={{ gap: 14 }}>
          {app.data.employees.map((e) => (
            <Pressable key={e.id} onPress={() => app.manager && edit(e)}>
              <Card>
                <Row>
                  <Avatar name={e.full_name} color={e.color} size={52} />
                  <View style={{ flex: 1 }}>
                    <Label style={{ fontWeight: "600", fontSize: 18 }}>
                      {e.full_name}
                    </Label>
                    <Label style={{ color: c.muted, fontSize: 13 }}>
                      {e.phone}
                    </Label>
                  </View>
                  <Tag>{t(e.active ? "active" : "inactive")}</Tag>
                </Row>
                <Row style={{ marginTop: 16 }}>
                  <Tag>{t(e.role)}</Tag>
                  <Label style={{ color: c.muted, fontSize: 13 }}>
                    {e.availability}
                  </Label>
                </Row>
              </Card>
            </Pressable>
          ))}
        </View>
      )}
      <Sheet
        visible={open}
        title={selected ? t("edit") : t("newEmployee")}
        onClose={() => setOpen(false)}
      >
        <Field
          label={t("name")}
          value={draft.full_name}
          onChangeText={(v: string) => setDraft({ ...draft, full_name: v })}
        />
        <Field
          label={t("phone")}
          value={draft.phone}
          onChangeText={(v: string) => setDraft({ ...draft, phone: v })}
        />
        <Field
          label={t("availability")}
          multiline
          value={draft.availability}
          onChangeText={(v: string) => setDraft({ ...draft, availability: v })}
        />
        {selected && !selected.user_id && (
          <>
            <Button
              title={
                app.language === "pt-BR" ? "Criar convite" : "Create invitation"
              }
              secondary
              onPress={async () => {
                try {
                  const code = await checked(
                    db().rpc("create_employee_invite", {
                      p_employee_id: selected.id,
                    }),
                  );
                  setInvite(code);
                } catch (e) {
                  app.setError((e as Error).message);
                }
              }}
            />
            {invite && (
              <Label selectable style={{ marginVertical: 14, fontSize: 12 }}>
                {app.language === "pt-BR"
                  ? "Compartilhe este código de 48 horas com o funcionário. Ele deve aceitar nas configurações."
                  : "Share this 48-hour code with the employee. They must accept it in Settings."}
                {"\n"}
                {invite}
              </Label>
            )}
          </>
        )}
        <Label>{t("role")}</Label>
        <Chips
          value={draft.role}
          options={["employee", "manager"].map((value) => ({
            value,
            label: t(value as any),
          }))}
          onChange={(v: string) => setDraft({ ...draft, role: v })}
        />
        <Chips
          value={draft.active ? "active" : "inactive"}
          options={["active", "inactive"].map((value) => ({
            value,
            label: t(value as any),
          }))}
          onChange={(v: string) =>
            setDraft({ ...draft, active: v === "active" })
          }
        />
        <Button
          title={busy ? t("loading") : t("save")}
          disabled={busy}
          onPress={async () => {
            setBusy(true);
            try {
              const parsed = employeeSchema.parse(draft);
              const { user_id, ...input } = parsed;
              if (selected) {
                await app.saveEmployee(input, selected.id);
                if (user_id && user_id !== selected.user_id)
                  await checked(
                    db().rpc("link_employee", {
                      p_employee_id: selected.id,
                      p_user_id: user_id,
                    }),
                  );
              } else {
                const e = await checked(
                  db()
                    .from("employees")
                    .insert({ ...input, business_id: app.profile!.business_id })
                    .select()
                    .single(),
                );
                if (user_id)
                  await checked(
                    db().rpc("link_employee", {
                      p_employee_id: e.id,
                      p_user_id: user_id,
                    }),
                  );
              }
              await app.refresh();
              setOpen(false);
            } catch (e) {
              app.setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        />
      </Sheet>
    </>
  );
}
