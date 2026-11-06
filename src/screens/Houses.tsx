import React, { useState } from "react";
import { View, Pressable, Linking, Image, Alert, Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import {
  Plus,
  MapPin,
  ArrowUpRight,
  House as HouseIcon,
  KeyRound,
  Camera,
  Clock,
} from "lucide-react-native";
import { useApp } from "../lib/store";
import { translator } from "../lib/i18n";
import { db, checked } from "../lib/supabase";
import { houseSchema, type House } from "../domain/schema";
import { durationSuggestion } from "../domain/schedule";
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
  useTheme,
} from "../components/ui";
export function Houses() {
  const app = useApp(),
    { data, manager, language, setError } = app,
    t = translator(language),
    c = useTheme();
  const [search, setSearch] = useState(""),
    [selected, setSelected] = useState<House | null>(null),
    [editing, setEditing] = useState(false),
    [draft, setDraft] = useState<any>({}),
    [access, setAccess] = useState<string | undefined>(undefined),
    [busy, setBusy] = useState(false),
    [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  function edit(h?: House) {
    setSelected(h ?? null);
    setDraft(
      h
        ? { ...h, checklist: h.checklist.join("\n") }
        : {
            nickname: "",
            client_name: "",
            address: "",
            duration_minutes: "120",
            checklist: "",
            language,
          },
    );
    setAccess(undefined);
    setEditing(true);
  }
  async function run(fn: () => Promise<any>) {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function view(h: House) {
    setSelected(h);
    setAccess(undefined);
    for (const p of data.photos.filter((p) => p.house_id === h.id)) {
      try {
        const result = await checked(
          db().storage.from("house-photos").createSignedUrl(p.path, 300),
        );
        setPhotoUrls((u) => ({ ...u, [p.id]: result!.signedUrl }));
      } catch (e) {
        setError((e as Error).message);
      }
    }
  }
  const fields = [
    "nickname",
    "client_name",
    "phone",
    "email",
    "address",
    "city",
    "state",
    "zip",
    "bedrooms",
    "bathrooms",
    "duration_minutes",
    "contact_preference",
    "checklist",
    "restricted_rooms",
    "products",
    "avoid_products",
    "pets",
    "warnings",
    "parking",
    "notes",
  ];
  const labels: Record<string, any> = {
    client_name: "client",
    duration_minutes: "duration",
    restricted_rooms: "restricted",
    avoid_products: "avoid",
    contact_preference: "contact",
  };
  return (
    <>
      <Row style={{ justifyContent: "space-between", marginBottom: 8 }}>
        <Heading sub={t("emptyHousesBody")}>{t("houses")}</Heading>
        {manager && (
          <Button title={t("addHouse")} icon={Plus} onPress={() => edit()} />
        )}
      </Row>
      <Field label={t("search")} value={search} onChangeText={setSearch} />
      {data.houses.length === 0 ? (
        <Empty
          title={t("emptyHouses")}
          body={t("emptyHousesBody")}
          action={
            manager && (
              <Button
                title={t("addHouse")}
                onPress={() => edit()}
                icon={Plus}
              />
            )
          }
        />
      ) : (
        <View style={{ gap: 14 }}>
          {data.houses
            .filter((h) =>
              `${h.nickname} ${h.client_name} ${h.address}`
                .toLowerCase()
                .includes(search.toLowerCase()),
            )
            .map((h) => (
              <Pressable
                key={h.id}
                onPress={() => void view(h)}
                accessibilityRole="button"
              >
                <Card>
                  <Row>
                    <View
                      style={{
                        backgroundColor: c.soft,
                        padding: 16,
                        borderRadius: 18,
                      }}
                    >
                      <HouseIcon color={c.accent} size={26} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Label style={{ fontSize: 19, fontWeight: "600" }}>
                        {h.nickname}
                      </Label>
                      <Label style={{ color: c.muted, fontSize: 13 }}>
                        {h.client_name}
                      </Label>
                    </View>
                    <ArrowUpRight size={20} color={c.muted} />
                  </Row>
                  <Row style={{ marginTop: 18 }}>
                    <MapPin size={14} color={c.muted} />
                    <Label style={{ color: c.muted, fontSize: 13, flex: 1 }}>
                      {[h.address, h.city, h.state].filter(Boolean).join(", ")}
                    </Label>
                    <Tag>
                      {h.duration_minutes} {t("minutes")}
                    </Tag>
                  </Row>
                </Card>
              </Pressable>
            ))}
        </View>
      )}
      <Sheet
        visible={editing}
        title={selected ? t("edit") : t("addHouse")}
        onClose={() => setEditing(false)}
      >
        {fields.map((field) => (
          <Field
            key={field}
            label={t(labels[field] ?? (field as any))}
            value={draft[field]}
            multiline={["checklist", "notes", "warnings", "parking"].includes(
              field,
            )}
            keyboardType={
              ["bedrooms", "bathrooms", "duration_minutes"].includes(field)
                ? "numeric"
                : "default"
            }
            onChangeText={(v: string) => setDraft({ ...draft, [field]: v })}
          />
        ))}
        <Label>{t("preferredLanguage")}</Label>
        <Chips
          value={draft.language}
          options={[
            { value: "en-US", label: "English" },
            { value: "pt-BR", label: "Português" },
          ]}
          onChange={(v: string) => setDraft({ ...draft, language: v })}
        />
        <Label style={{ fontSize: 12, color: c.muted, marginBottom: 12 }}>
          {t("accessHelp")}
        </Label>
        <Field
          label={t("access")}
          value={access ?? ""}
          onChangeText={setAccess}
          multiline
        />
        <Button
          title={busy ? t("loading") : t("save")}
          disabled={busy}
          onPress={() =>
            run(async () => {
              const parsed = houseSchema.parse({
                ...draft,
                checklist: String(draft.checklist ?? "")
                  .split("\n")
                  .map((s) => s.trim())
                  .filter(Boolean),
              });
              await app.saveHouse(parsed, selected?.id, access);
              setEditing(false);
              setSelected(null);
            })
          }
        />
      </Sheet>
      <Sheet
        visible={!!selected && !editing}
        title={selected?.nickname}
        onClose={() => setSelected(null)}
      >
        {selected && (
          <>
            <Tag>{selected.client_name}</Tag>
            <Label style={{ marginVertical: 14 }}>
              {[selected.address, selected.city, selected.state, selected.zip]
                .filter(Boolean)
                .join(", ")}
            </Label>
            <Row>
              <Button
                small
                secondary
                title={t("openMaps")}
                icon={MapPin}
                onPress={() =>
                  Linking.openURL(
                    `https://maps.apple.com/?q=${encodeURIComponent([selected.address, selected.city, selected.state, selected.zip].join(" "))}`,
                  )
                }
              />
              {selected.phone && (
                <Button
                  small
                  secondary
                  title={selected.phone}
                  onPress={() => Linking.openURL(`tel:${selected.phone}`)}
                />
              )}
            </Row>
            <Label style={{ marginTop: 18, fontWeight: "600" }}>
              {selected.duration_minutes} {t("minutes")} · {selected.bedrooms}{" "}
              {t("bedrooms")} · {selected.bathrooms} {t("bathrooms")}
            </Label>
            {fields
              .filter(
                (f) =>
                  ![
                    "nickname",
                    "client_name",
                    "address",
                    "city",
                    "state",
                    "zip",
                    "bedrooms",
                    "bathrooms",
                    "duration_minutes",
                  ].includes(f),
              )
              .map((field) => {
                const value = (selected as any)[field];
                return value?.length ? (
                  <View key={field} style={{ marginTop: 18 }}>
                    <Label style={{ color: c.muted, fontSize: 12 }}>
                      {t(labels[field] ?? (field as any))}
                    </Label>
                    <Label>
                      {Array.isArray(value)
                        ? value.map((s) => `• ${s}`).join("\n")
                        : value}
                    </Label>
                  </View>
                ) : null;
              })}
            <View style={{ marginVertical: 20 }}>
              <Button
                secondary
                title={t("access")}
                icon={KeyRound}
                onPress={() =>
                  run(async () => {
                    const result = await checked(
                      db().functions.invoke("private-access", {
                        body: { action: "read", house_id: selected.id },
                      }),
                    );
                    setAccess(result.value ?? "");
                  })
                }
              />
              {access !== undefined && (
                <Label
                  style={{
                    padding: 14,
                    backgroundColor: c.soft,
                    marginTop: 12,
                    borderRadius: 12,
                  }}
                >
                  {access || "—"}
                </Label>
              )}
            </View>
            {manager &&
              (() => {
                const seriesIds = data.series
                  .filter((s) => s.house_id === selected.id)
                  .map((s) => s.id);
                const suggestion = durationSuggestion(
                  data.visits.filter((v) => seriesIds.includes(v.series_id)),
                  selected.duration_minutes,
                );
                return suggestion ? (
                  <Button
                    title={`${t("durationSuggestion")}: ${suggestion} ${t("minutes")}`}
                    secondary
                    onPress={() =>
                      run(() =>
                        app.saveHouse(
                          { ...selected, duration_minutes: suggestion },
                          selected.id,
                        ),
                      )
                    }
                  />
                ) : null;
              })()}
            <Label
              style={{
                fontSize: 18,
                fontWeight: "600",
                marginTop: 16,
                marginBottom: 12,
              }}
            >
              {t("photos")}
            </Label>
            <Row>
              {data.photos
                .filter((p) => p.house_id === selected.id)
                .map((p) => (
                  <View key={p.id} style={{ gap: 4 }}>
                    {photoUrls[p.id] && (
                      <Image
                        source={{ uri: photoUrls[p.id] }}
                        style={{ width: 130, height: 110, borderRadius: 12 }}
                      />
                    )}
                    <Label style={{ fontSize: 11 }}>{p.caption}</Label>
                    {manager && (
                      <Button
                        title={t("delete")}
                        small
                        secondary
                        onPress={() =>
                          run(async () => {
                            await checked(
                              db()
                                .storage.from("house-photos")
                                .remove([p.path]),
                            );
                            await checked(
                              db().from("photos").delete().eq("id", p.id),
                            );
                            await app.refresh();
                          })
                        }
                      />
                    )}
                  </View>
                ))}
            </Row>
            <Button
              title={t("uploadPhoto")}
              icon={Camera}
              secondary
              onPress={() =>
                run(async () => {
                  const pick = await ImagePicker.launchImageLibraryAsync({
                    mediaTypes: ["images"],
                    quality: 0.7,
                  });
                  if (pick.canceled) return;
                  const asset = pick.assets[0]!;
                  const response = await fetch(asset.uri);
                  const bytes = await response.arrayBuffer();
                  if (bytes.byteLength > 10 * 1024 * 1024)
                    throw new Error("Maximum photo size: 10 MB");
                  const mime = asset.mimeType ?? "image/jpeg";
                  const ext =
                    mime === "image/png"
                      ? "png"
                      : mime === "image/webp"
                        ? "webp"
                        : "jpg";
                  const path = `${app.profile!.business_id}/${selected.id}/${Date.now()}.${ext}`;
                  await checked(
                    db()
                      .storage.from("house-photos")
                      .upload(path, bytes, { contentType: mime }),
                  );
                  try {
                    await checked(
                      db()
                        .from("photos")
                        .insert({
                          business_id: app.profile!.business_id,
                          house_id: selected.id,
                          path,
                        }),
                    );
                  } catch (e) {
                    await db().storage.from("house-photos").remove([path]);
                    throw e;
                  }
                  await app.refresh();
                  await view(selected);
                })
              }
            />
            {manager && (
              <Row style={{ marginTop: 24 }}>
                <Button title={t("edit")} onPress={() => edit(selected)} />
                <Button
                  danger
                  title={t("delete")}
                  onPress={() => {
                    const remove = () =>
                      run(async () => {
                        await app.removeHouse(selected.id);
                        setSelected(null);
                      });
                    if (Platform.OS === "web") {
                      if (window.confirm(t("confirmDelete"))) void remove();
                    } else
                      Alert.alert(t("confirmDelete"), undefined, [
                        { text: t("cancel"), style: "cancel" },
                        {
                          text: t("delete"),
                          style: "destructive",
                          onPress: remove,
                        },
                      ]);
                  }}
                />
              </Row>
            )}
          </>
        )}
      </Sheet>
    </>
  );
}
