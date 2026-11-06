import { createClient } from "npm:@supabase/supabase-js@2.119.0";
import { z } from "npm:zod@4.6.7";
import { authenticated, json, failure } from "../_shared/http.ts";
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("read"), house_id: z.string().uuid() }),
  z.object({
    action: z.literal("save"),
    house_id: z.string().uuid(),
    value: z.string().max(10000),
  }),
]);
const encode = (b: Uint8Array) => btoa(String.fromCharCode(...b));
const decode = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({});
  try {
    const { client, profile, user } = await authenticated(req);
    const body = schema.parse(await req.json());
    const { data: allowed, error } = await client.rpc("can_house", {
      h: body.house_id,
    });
    if (error || !allowed) throw new Error("FORBIDDEN");
    if (body.action === "save" && profile.role !== "manager")
      throw new Error("FORBIDDEN");
    const hex = Deno.env.get("ACCESS_ENCRYPTION_KEY");
    if (!hex || !/^[a-fA-F0-9]{64}$/.test(hex))
      throw new Error("ENCRYPTION_NOT_CONFIGURED");
    const key = await crypto.subtle.importKey(
      "raw",
      Uint8Array.from(hex.match(/../g)!, (h) => parseInt(h, 16)),
      { name: "AES-GCM" },
      false,
      ["encrypt", "decrypt"],
    );
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );
    // Bind ciphertext to its business and house so envelopes cannot be swapped.
    const additionalData = new TextEncoder().encode(
      `${profile.business_id}:${body.house_id}`,
    );
    if (body.action === "save") {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ciphertext = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv, additionalData },
        key,
        new TextEncoder().encode(body.value),
      );
      const { error } = await admin
        .from("house_access")
        .upsert({
          house_id: body.house_id,
          business_id: profile.business_id,
          ciphertext: encode(new Uint8Array(ciphertext)),
          iv: encode(iv),
          updated_at: new Date().toISOString(),
        });
      if (error) throw error;
      await admin
        .from("audit_logs")
        .insert({
          business_id: profile.business_id,
          actor: user.id,
          action: "ACCESS_SAVED",
          table_name: "house_access",
          record_id: body.house_id,
        });
      return json({ saved: true });
    }
    const { data, error: readError } = await admin
      .from("house_access")
      .select("ciphertext,iv")
      .eq("house_id", body.house_id)
      .eq("business_id", profile.business_id)
      .maybeSingle();
    if (readError) throw readError;
    if (!data) return json({ value: "" });
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: decode(data.iv), additionalData },
      key,
      decode(data.ciphertext),
    );
    await admin
      .from("audit_logs")
      .insert({
        business_id: profile.business_id,
        actor: user.id,
        action: "ACCESS_READ",
        table_name: "house_access",
        record_id: body.house_id,
      });
    return json({ value: new TextDecoder().decode(decrypted) });
  } catch (e) {
    return failure(e);
  }
});
