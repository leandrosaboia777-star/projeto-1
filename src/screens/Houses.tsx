import React, { useState } from "react";
import { View, Pressable, Linking, Alert, Platform } from "react-native";
import { PrivatePhoto } from "../components/PrivatePhoto";
import { uploadPrivatePhoto } from "../lib/photos";
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
import { houseSchema, type House, type Photo } from "../domain/schema";
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
    [caption, setCaption] = useState(""),
    [preview, setPreview] = useState<Photo | null>(null),
    [previewCaption, setPreviewCaption] = useState("");
  const pt = language === "pt-BR";
  const cover = (houseId: string) =>
    data.photos.find((p) => p.house_id === houseId && p.is_cover);
  const selectedCover = selected ? cover(selected.id) : undefined;
  async function chooseCover(photoId: string | null) {
    if (!selected) return;
    await checked(
      db().rpc("set_house_cover", {
        p_house_id: selected.id,
        p_photo_id: photoId,
      }),
    );
    await app.refresh();
  }
  async function addCover() {
    if (!selected) return;
    const path = await uploadPrivatePhoto(
      app.profile!.business_id,
      selected.id,
      undefined,
      { cover: true },
    );
    if (!path) return;
    const photo = await checked(
      db()
        .from("photos")
        .select("id")
        .eq("house_id", selected.id)
        .eq("path", path)
        .single(),
    );
    if (!photo)
      throw new Error(pt ? "Foto não encontrada." : "Photo not found.");
    await chooseCover(photo.id);
  }
  function deletePhoto(photo: Photo) {
    const remove = () =>
      run(async () => {
        await checked(db().storage.from("house-photos").remove([photo.path]));
        await checked(db().from("photos").delete().eq("id", photo.id));
        setPreview(null);
        await app.refresh();
      });
    const message = pt
      ? "Excluir esta foto permanentemente?"
      : "Permanently delete this photo?";
    if (Platform.OS === "web") {
      if (window.confirm(message)) void remove();
    } else
      Alert.alert(message, undefined, [
        { text: t("cancel"), style: "cancel" },
        {
          text: t("delete"),
          style: "destructive",
          onPress: () => void remove(),
        },
      ]);
  }
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
  function view(h: House) {
    setSelected(h);
    setAccess(undefined);
    setCaption("");
    setPreview(null);
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
                    {cover(h.id) ? (
                      <PrivatePhoto
                        path={cover(h.id)!.path}
                        label={`${pt ? "Foto da casa" : "House photo"}: ${h.nickname}`}
                        style={{ width: 68, height: 68, borderRadius: 18 }}
                      />
                    ) : (
                      <View
                        style={{
                          backgroundColor: c.soft,
                          padding: 16,
                          borderRadius: 18,
                        }}
                      >
                        <HouseIcon color={c.accent} size={26} />
                      </View>
                    )}
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
        title={
          preview
            ? pt
              ? "Registro com foto"
              : "Photo record"
            : selected?.nickname
        }
        onClose={() => (preview ? setPreview(null) : setSelected(null))}
      >
        {selected && !preview && (
          <>
            <View style={{ gap: 12, marginBottom: 22 }}>
              <Label style={{ fontSize: 18, fontWeight: "600" }}>
                {pt ? "Foto da casa" : "House photo"}
              </Label>
              {selectedCover ? (
                <PrivatePhoto
                  path={selectedCover.path}
                  label={`${pt ? "Foto da casa" : "House photo"}: ${selected.nickname}`}
                  style={{ width: "100%", height: 190, borderRadius: 18 }}
                />
              ) : (
                <View
                  style={{
                    backgroundColor: c.soft,
                    borderRadius: 18,
                    padding: 24,
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <HouseIcon size={36} color={c.accent} />
                  <Label style={{ color: c.muted, textAlign: "center" }}>
                    {pt
                      ? "Escolha uma foto para reconhecer esta casa na lista."
                      : "Choose a photo to recognize this house in the list."}
                  </Label>
                </View>
              )}
              {manager && (
                <>
                  <Button
                    secondary
                    icon={Camera}
                    title={
                      selectedCover
                        ? pt
                          ? "Trocar foto da casa"
                          : "Change house photo"
                        : pt
                          ? "Escolher foto da casa"
                          : "Choose house photo"
                    }
                    disabled={busy}
                    onPress={() => run(addCover)}
                  />
                  {selectedCover && (
                    <Button
                      small
                      secondary
                      title={
                        pt
                          ? "Remover capa e guardar nos registros"
                          : "Remove cover and keep in records"
                      }
                      disabled={busy}
                      onPress={() => run(() => chooseCover(null))}
                    />
                  )}
                </>
              )}
            </View>
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
                        : field === "contact_preference"
                          ? ((
                              {
                                text: pt ? "Mensagem" : "Message",
                                phone: pt ? "Ligação" : "Phone call",
                                email: "Email",
                              } as Record<string, string>
                            )[value] ?? value)
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
            <View style={{ gap: 14, marginTop: 18 }}>
              <Label style={{ fontSize: 19, fontWeight: "600" }}>
                {pt ? "Fotos e registros" : "Photos and records"}
              </Label>
              <Label style={{ color: c.muted, fontSize: 13 }}>
                {pt
                  ? "Guarde fotos de ocorrências, objetos encontrados ou detalhes do serviço. Só a equipe autorizada tem acesso."
                  : "Keep photos of incidents, found items, or work details. Only the authorized team has access."}
              </Label>
              {!data.photos.some(
                (p) => p.house_id === selected.id && !p.is_cover,
              ) && (
                <Label style={{ color: c.muted }}>
                  {pt
                    ? "Nenhum registro com foto ainda."
                    : "No photo records yet."}
                </Label>
              )}
              {data.photos
                .filter((p) => p.house_id === selected.id && !p.is_cover)
                .map((p) => (
                  <Card key={p.id} style={{ padding: 12, gap: 10 }}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={
                        pt ? "Abrir foto do registro" : "Open record photo"
                      }
                      onPress={() => {
                        setPreview(p);
                        setPreviewCaption(p.caption);
                      }}
                    >
                      <PrivatePhoto
                        path={p.path}
                        label={
                          p.caption ||
                          (pt ? "Foto do registro" : "Record photo")
                        }
                        style={{ width: "100%", height: 180, borderRadius: 12 }}
                      />
                    </Pressable>
                    {!!p.caption && <Label>{p.caption}</Label>}
                    {p.created_at && (
                      <Label style={{ color: c.muted, fontSize: 12 }}>
                        {new Date(p.created_at).toLocaleDateString(language)}
                      </Label>
                    )}
                    {manager && (
                      <>
                        <Button
                          small
                          secondary
                          title={
                            pt ? "Usar como foto da casa" : "Use as house photo"
                          }
                          disabled={busy}
                          onPress={() => run(() => chooseCover(p.id))}
                        />
                        <Button
                          small
                          secondary
                          title={pt ? "Editar descrição" : "Edit description"}
                          disabled={busy}
                          onPress={() => {
                            setPreview(p);
                            setPreviewCaption(p.caption);
                          }}
                        />
                        <Button
                          small
                          secondary
                          title={
                            pt ? "Excluir este registro" : "Delete this record"
                          }
                          disabled={busy}
                          onPress={() => deletePhoto(p)}
                        />
                      </>
                    )}
                  </Card>
                ))}
              <Field
                label={
                  pt
                    ? "Descrição do novo registro (opcional)"
                    : "New record description (optional)"
                }
                placeholder={
                  pt
                    ? "Ex.: objeto encontrado na sala, antes da limpeza"
                    : "E.g. item found in the living room before cleaning"
                }
                value={caption}
                onChangeText={setCaption}
                multiline
              />
              <Button
                title={pt ? "Adicionar foto ao registro" : "Add record photo"}
                icon={Camera}
                secondary
                disabled={busy}
                onPress={() =>
                  run(async () => {
                    const path = await uploadPrivatePhoto(
                      app.profile!.business_id,
                      selected.id,
                      undefined,
                      { caption },
                    );
                    if (path) {
                      setCaption("");
                      await app.refresh();
                    }
                  })
                }
              />
            </View>
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
        {preview && (
          <View style={{ gap: 16 }}>
            <Button
              secondary
              title={pt ? "Voltar ao cadastro" : "Back to house"}
              onPress={() => setPreview(null)}
            />
            <PrivatePhoto
              path={preview.path}
              label={
                preview.caption || (pt ? "Foto do registro" : "Record photo")
              }
              style={{ width: "100%", height: 320, borderRadius: 14 }}
              contain
            />
            {manager ? (
              <>
                <Field
                  label={pt ? "Descrição do registro" : "Record description"}
                  value={previewCaption}
                  onChangeText={setPreviewCaption}
                  multiline
                />
                <Button
                  title={t("save")}
                  disabled={busy}
                  onPress={() =>
                    run(async () => {
                      await checked(
                        db()
                          .from("photos")
                          .update({ caption: previewCaption.trim() })
                          .eq("id", preview.id),
                      );
                      setPreview(null);
                      await app.refresh();
                    })
                  }
                />
              </>
            ) : (
              <Label>{preview.caption}</Label>
            )}
          </View>
        )}
      </Sheet>
    </>
  );
}
