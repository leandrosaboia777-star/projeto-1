import { test, expect } from "@playwright/test";
// Browser-only API fixtures. These tests prove UI wiring, not live Supabase/AI access.
const business = "10000000-0000-4000-8000-000000000001";
const uid = "10000000-0000-4000-8000-000000000002";
const profile = {
  id: uid,
  business_id: business,
  full_name: "Leandro Saboia",
  role: "manager",
};
async function setup(page: any) {
  const rows: Record<string, any[]> = {
    houses: [],
    employees: [],
    cleaning_series: [],
    schedule_exceptions: [],
    visits: [],
    client_requests: [],
    photos: [],
    notifications: [],
  };
  const errors: string[] = [];
  page.on("pageerror", (e: Error) => errors.push(e.message));
  await page.route("http://saboia-test.local/**", async (route: any) => {
    const req = route.request(),
      url = new URL(req.url());
    let result: any = [];
    let status = 200;
    const path = url.pathname;
    const table = path.split("/").pop()!;
    if (req.method() === "OPTIONS") {
      await route.fulfill({
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "*",
          "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
        },
      });
      return;
    }
    if (path.includes("/auth/v1/token")) {
      const user = {
        id: uid,
        email: "owner@example.com",
        aud: "authenticated",
        role: "authenticated",
        app_metadata: { provider: "email" },
        user_metadata: { full_name: "Leandro" },
        created_at: new Date().toISOString(),
      };
      const payload = Buffer.from(
        JSON.stringify({
          sub: uid,
          exp: Math.floor(Date.now() / 1000) + 3600,
          aud: "authenticated",
          role: "authenticated",
        }),
      ).toString("base64url");
      result = {
        access_token: `e30.${payload}.test`,
        refresh_token: "test-refresh",
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        token_type: "bearer",
        user,
      };
    } else if (table === "profiles") result = profile;
    else if (table === "businesses")
      result = {
        id: business,
        timezone: "America/New_York",
        name: "Saboia Cleaning",
      };
    else if (path.includes("/rpc/save_cleaning_series")) {
      const payload = req.postDataJSON().payload;
      rows.cleaning_series!.push({
        ...payload,
        id: "30000000-0000-4000-8000-000000000001",
        business_id: business,
        until_at: null,
      });
      result = rows.cleaning_series!.at(-1).id;
    } else if (path.includes("/functions/v1/confirm-proposal")) {
      const input = req.postDataJSON().proposal;
      rows.houses!.push({
        ...input.house,
        id: "20000000-0000-4000-8000-000000000002",
        business_id: business,
      });
      result = { saved: true };
    } else if (path.includes("/functions/v1/assistant"))
      result = {
        proposal: {
          action: "create_house",
          house: {
            nickname: "Ana’s home",
            client_name: "Ana",
            address: "18 Oak Street",
            duration_minutes: 120,
          },
        },
      };
    else if (rows[table]) {
      if (req.method() === "POST") {
        const input = req.postDataJSON();
        const row = { ...input, id: "20000000-0000-4000-8000-000000000001" };
        rows[table].push(row);
        result = row;
      } else result = rows[table];
    }
    await route.fulfill({
      status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify(result),
    });
  });
  return { rows, errors };
}
async function login(page: any) {
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "Email", exact: true })
    .fill("owner@example.com");
  await page
    .getByRole("textbox", { name: "Password", exact: true })
    .fill("test-password");
  await page
    .getByRole("button", { name: "Sign in", exact: true })
    .last()
    .click();
  await expect(page.getByText("A fresh start.")).toBeVisible();
}
test("manager signs in, saves a house, schedules it, and reviews AI without automatic writes", async ({
  page,
}) => {
  const { rows, errors } = await setup(page);
  await login(page);
  await page.getByRole("button", { name: "Add a house", exact: true }).click();
  await page
    .getByRole("button", { name: "Add a house", exact: true })
    .first()
    .click();
  await page
    .getByRole("textbox", { name: "House nickname", exact: true })
    .fill("Maria’s home");
  await page
    .getByRole("textbox", { name: "Client name", exact: true })
    .fill("Maria Silva");
  await page
    .getByRole("textbox", { name: "Street address", exact: true })
    .fill("123 Main Street");
  await page
    .getByRole("textbox", { name: "City", exact: true })
    .fill("Manchester");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByText("Maria’s home", { exact: true })).toBeVisible();
  expect(rows.houses).toHaveLength(1);
  await page.getByText("Schedule", { exact: true }).first().click();
  await page
    .getByRole("button", { name: "Schedule cleaning", exact: true })
    .click();
  await page.getByRole("button", { name: "Maria’s home", exact: true }).click();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  expect(rows.cleaning_series).toHaveLength(1);
  await expect(page.getByText("Maria’s home", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Assistant", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Assistant", exact: true })
    .fill("Add a house for Ana at 18 Oak Street. Two hours.");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(
    page.getByText("Review before saving", { exact: true }).last(),
  ).toBeVisible();
  expect(rows.houses).toHaveLength(1);
  await page.screenshot({
    path: "docs/screenshots/assistant-review.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Confirm & save", exact: true })
    .click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  expect(rows.houses).toHaveLength(2);
  expect(errors).toEqual([]);
});
test("iPhone layout, dashboard, team and Portuguese settings render", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { errors } = await setup(page);
  await login(page);
  await page.screenshot({
    path: "docs/screenshots/dashboard-iphone.png",
    fullPage: true,
  });
  await page.getByText("Team", { exact: true }).click();
  await expect(
    page.getByText("Great work starts with a great team."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page
    .getByRole("button", { name: "Português brasileiro", exact: true })
    .click();
  await expect(
    page.getByText("Configurações", { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Escuro", exact: true }).click();
  await page.screenshot({
    path: "docs/screenshots/settings-dark-iphone.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
