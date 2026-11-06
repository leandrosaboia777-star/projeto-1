import { createClient } from "npm:@supabase/supabase-js@2.119.0";
export const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
export function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers });
}
export async function authenticated(req: Request) {
  if (req.method !== "POST") throw new Error("METHOD_NOT_ALLOWED");
  if (Number(req.headers.get("content-length") ?? 0) > 32768)
    throw new Error("REQUEST_TOO_LARGE");
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) throw new Error("UNAUTHORIZED");
  const url = Deno.env.get("SUPABASE_URL")!,
    key = Deno.env.get("SUPABASE_ANON_KEY")!;
  const client = createClient(url, key, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const {
    data: { user },
    error,
  } = await client.auth.getUser(auth.slice(7));
  if (error || !user) throw new Error("UNAUTHORIZED");
  const { data: profile, error: pError } = await client
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  if (pError || !profile) throw new Error("UNAUTHORIZED");
  return { client, user, profile };
}
export function failure(e: unknown) {
  const code = e instanceof Error ? e.message : "INTERNAL_ERROR";
  return json(
    {
      error: [
        "UNAUTHORIZED",
        "FORBIDDEN",
        "METHOD_NOT_ALLOWED",
        "REQUEST_TOO_LARGE",
        "AI_NOT_CONFIGURED",
        "ENCRYPTION_NOT_CONFIGURED",
        "RATE_LIMITED",
      ].includes(code)
        ? code
        : "Request could not be completed. Check server configuration and retry.",
    },
    code === "UNAUTHORIZED"
      ? 401
      : code === "FORBIDDEN"
        ? 403
        : code === "RATE_LIMITED"
          ? 429
          : code === "METHOD_NOT_ALLOWED"
            ? 405
            : code === "REQUEST_TOO_LARGE"
              ? 413
              : 500,
  );
}
