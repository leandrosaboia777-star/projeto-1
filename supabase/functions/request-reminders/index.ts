import { createClient } from "npm:@supabase/supabase-js@2.119.0";
import { json } from "../_shared/http.ts";

// Called by a Supabase Cron job, never by the mobile app. The cron secret is a
// dedicated random server secret, not an Apple password or client API key.
Deno.serve(async (req) => {
  const secret = Deno.env.get("REQUEST_REMINDER_SECRET");
  const expected = secret ? `Bearer ${secret}` : "";
  const supplied = req.headers.get("Authorization") ?? "";
  const hash = async (s: string) =>
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)),
    );
  const [a, b] = await Promise.all([hash(expected), hash(supplied)]);
  if (
    !secret ||
    a.reduce((difference, v, i) => difference | (v ^ b[i]!), 0) !== 0
  )
    return json({ error: "UNAUTHORIZED" }, 401);
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  const client = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
  try {
    const { data: jobs, error } = await client.rpc("claim_request_reminders");
    if (error) throw new Error("CLAIM_FAILED");
    let accepted = 0;
    for (const job of jobs ?? []) {
      // Recheck after claiming: another device may have resolved the request.
      const { data: pending, error: statusError } = await client
        .from("client_requests")
        .select("status")
        .eq("id", job.request_id)
        .single();
      if (statusError) throw new Error("STATUS_CHECK_FAILED");
      if (pending.status !== "pending") continue;
      const devices = job.devices as { token: string; language: string }[];
      let sent = false;
      // Expo accepts at most 100 messages in one request.
      for (let i = 0; i < devices.length; i += 100) {
        const batch = devices.slice(i, i + 100);
        const response = await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(Deno.env.get("EXPO_ACCESS_TOKEN")
              ? { Authorization: `Bearer ${Deno.env.get("EXPO_ACCESS_TOKEN")}` }
              : {}),
          },
          body: JSON.stringify(
            batch.map((d) => ({
              to: d.token,
              sound: "default",
              title:
                d.language === "pt-BR"
                  ? "Solicitação pendente"
                  : "Pending request",
              body:
                d.language === "pt-BR"
                  ? "Há um pedido de mudança de horário aguardando sua escolha. Abra o app para conferir."
                  : "A rescheduling request is waiting for your choice. Open the app to review.",
              data: { screen: "requests", request_id: job.request_id },
            })),
          ),
          signal: AbortSignal.timeout(15000),
        });
        if (!response.ok) continue;
        const result = await response.json();
        const tickets = Array.isArray(result.data) ? result.data : [];
        for (let n = 0; n < tickets.length; n++) {
          if (tickets[n].status === "ok") sent = true;
          if (tickets[n].details?.error === "DeviceNotRegistered" && batch[n]) {
            const { error: deleteError } = await client
              .from("push_devices")
              .delete()
              .eq("token", batch[n]!.token)
              .eq("user_id", job.user_id);
            if (deleteError) throw new Error("TOKEN_CLEANUP_FAILED");
          }
        }
      }
      if (sent) {
        const { error: ackError } = await client
          .from("request_reminders")
          .update({ last_sent_at: new Date().toISOString(), lease_until: null })
          .eq("request_id", job.request_id)
          .eq("user_id", job.user_id);
        if (ackError) throw new Error("ACK_FAILED");
        accepted++;
      }
    }
    return json({ accepted });
  } catch {
    // Never log message contents, tokens, or secrets.
    console.error("REQUEST_REMINDERS_FAILED");
    return json({ error: "REQUEST_REMINDERS_FAILED" }, 500);
  }
});
