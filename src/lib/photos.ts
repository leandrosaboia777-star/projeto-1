import * as ImagePicker from "expo-image-picker";
import { db, checked } from "./supabase";
export async function uploadPrivatePhoto(
  businessId: string,
  houseId: string,
  visitId?: string,
) {
  const pick = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 0.7,
  });
  if (pick.canceled) return;
  const asset = pick.assets[0]!;
  const bytes = await (await fetch(asset.uri)).arrayBuffer();
  if (bytes.byteLength > 10 * 1024 * 1024)
    throw new Error("Maximum photo size: 10 MB");
  const mime = asset.mimeType ?? "image/jpeg",
    ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
  const path = `${businessId}/${houseId}/${Date.now()}.${ext}`;
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
        }),
    );
  } catch (e) {
    await db().storage.from("house-photos").remove([path]);
    throw e;
  }
  return path;
}
