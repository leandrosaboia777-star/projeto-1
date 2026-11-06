import { createClient } from "@supabase/supabase-js";
import { addDays, format } from "date-fns";
const url = process.env.EXPO_PUBLIC_SUPABASE_URL,
  key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  email = process.env.SABOIA_SEED_EMAIL,
  password = process.env.SABOIA_SEED_PASSWORD;
if (!url || !key || !email || !password)
  throw new Error(
    "Set public Supabase config and SABOIA_SEED_EMAIL / SABOIA_SEED_PASSWORD. Use a confirmed manager test account.",
  );
const client = createClient(url, key, { auth: { persistSession: false } });
async function check<T>(p: PromiseLike<{ data: T; error: any }>) {
  const r = await p;
  if (r.error) throw new Error(r.error.message);
  return r.data;
}
async function main() {
  const { data: login, error: authError } =
    await client.auth.signInWithPassword({
      email: email!,
      password: password!,
    });
  if (authError) throw authError;
  const profile = await check(
    client.from("profiles").select("*").eq("id", login.user!.id).single(),
  );
  if (profile.role !== "manager") throw new Error("Manager required");
  const samples = [
    {
      nickname: "Sample · Maple House",
      client_name: "Sample Maria",
      address: "123 Main Street",
      city: "Manchester",
      state: "NH",
      duration_minutes: 120,
      checklist: ["Clean kitchen", "Clean bathrooms", "Vacuum floors"],
      pets: "Sample: two dogs",
      notes: "SAMPLE DATA — remove before operational use.",
    },
    {
      nickname: "Sample · Oak House",
      client_name: "Sample John",
      address: "18 Oak Street",
      city: "Manchester",
      state: "NH",
      duration_minutes: 150,
      checklist: ["Dust furniture", "Mop floors"],
      avoid_products: "Bleach",
      notes: "SAMPLE DATA — remove before operational use.",
    },
  ];
  for (const sample of samples) {
    const found = await check(
      client.from("houses").select("id").eq("nickname", sample.nickname),
    );
    if (found?.length) continue;
    const house = await check(
      client
        .from("houses")
        .insert({ ...sample, business_id: profile.business_id })
        .select()
        .single(),
    );
    const date = addDays(new Date(), 1);
    date.setHours(sample.duration_minutes === 120 ? 9 : 13, 0, 0, 0);
    await check(
      client.rpc("save_cleaning_series", {
        payload: {
          house_id: house.id,
          starts_at: date.toISOString(),
          duration_minutes: sample.duration_minutes,
          recurrence: "weekly",
          employee_ids: [],
          notes: "SAMPLE DATA",
        },
      }),
    );
  }
  for (const full_name of ["Sample Ana", "Sample Lucas"]) {
    const found = await check(
      client.from("employees").select("id").eq("full_name", full_name),
    );
    if (!found?.length)
      await check(
        client
          .from("employees")
          .insert({
            business_id: profile.business_id,
            full_name,
            availability: "Weekdays, 8 AM – 5 PM",
          }),
      );
  }
  console.log(
    "Sample houses, recurring cleanings, and employees saved. Re-running skips existing sample names.",
  );
  await client.auth.signOut();
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
