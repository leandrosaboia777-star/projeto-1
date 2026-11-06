import { encryptAccess } from "./encryption.ts";
const rawKey = "01".repeat(32);
const decode = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
Deno.test("AES-GCM round trip, random nonces, and tenant binding", async () => {
  Deno.env.set("ACCESS_ENCRYPTION_KEY", rawKey);
  const a = await encryptAccess("Garage code: 2468", "business-a", "house-a");
  const b = await encryptAccess("Garage code: 2468", "business-a", "house-a");
  if (a.iv === b.iv || a.ciphertext === b.ciphertext)
    throw new Error("Nonce reuse");
  const key = await crypto.subtle.importKey(
    "raw",
    new Uint8Array(32).fill(1),
    { name: "AES-GCM" },
    false,
    ["decrypt"],
  );
  const plaintext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: decode(a.iv),
      additionalData: new TextEncoder().encode("business-a:house-a"),
    },
    key,
    decode(a.ciphertext),
  );
  if (new TextDecoder().decode(plaintext) !== "Garage code: 2468")
    throw new Error("Round-trip mismatch");
  let rejected = false;
  try {
    await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: decode(a.iv),
        additionalData: new TextEncoder().encode("business-b:house-a"),
      },
      key,
      decode(a.ciphertext),
    );
  } catch {
    rejected = true;
  }
  if (!rejected) throw new Error("Cross-tenant envelope accepted");
});
Deno.test("encryption refuses a missing or malformed key", async () => {
  Deno.env.set("ACCESS_ENCRYPTION_KEY", "invalid");
  let rejected = false;
  try {
    await encryptAccess("code", "business", "house");
  } catch (e) {
    rejected = e instanceof Error && e.message === "ENCRYPTION_NOT_CONFIGURED";
  }
  if (!rejected) throw new Error("Invalid key accepted");
});
