import * as ImagePicker from "expo-image-picker";
import { db, checked } from "./supabase";
export async function uploadPrivatePhoto(
  businessId: string,
  houseId: string,
  visitId?: string,
  options: { caption?: string; cover?: boolean } = {},
) {
  const pick = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 0.7,
    allowsEditing: options.cover ?? false,
    ...(options.cover ? { aspect: [1, 1] as [number, number] } : {}),
  });
  if (pick.canceled) return;
  const asset = pick.assets[0]!;
  const bytes = await (await fetch(asset.uri)).arrayBuffer();
  if (bytes.byteLength > 10 * 1024 * 1024)
    throw new Error("Maximum photo size: 10 MB");
  const mime = asset.mimeType ?? "image/jpeg",
    ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
  if (!["image/jpeg", "image/png", "image/webp"].includes(mime))
    throw new Error("Use JPG, PNG ou WEBP / Use JPG, PNG or WEBP");
  const path = `${businessId}/${houseId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
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
          business_id: businessId,
          house_id: houseId,
          visit_id: visitId ?? null,
          path,
          caption: options.caption?.trim() ?? "",
        }),
    );
  } catch (e) {
    await db().storage.from("house-photos").remove([path]);
    throw e;
  }
  return path;
}
