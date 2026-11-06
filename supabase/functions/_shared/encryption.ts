export async function encryptAccess(
  value: string,
  businessId: string,
  houseId: string,
) {
  const hex = Deno.env.get("ACCESS_ENCRYPTION_KEY");
  if (!hex || !/^[a-fA-F0-9]{64}$/.test(hex))
    throw new Error("ENCRYPTION_NOT_CONFIGURED");
  const key = await crypto.subtle.importKey(
    "raw",
    Uint8Array.from(hex.match(/../g)!, (h) => parseInt(h, 16)),
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const additionalData = new TextEncoder().encode(`${businessId}:${houseId}`);
  const bytes = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData },
    key,
    new TextEncoder().encode(value),
  );
  const encode = (b: Uint8Array) => btoa(String.fromCharCode(...b));
  return { ciphertext: encode(new Uint8Array(bytes)), iv: encode(iv) };
}
