import { test, expect } from "@playwright/test";
test("unconfigured workspace gives honest setup instructions in both languages", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByText("Connect your Supabase project to start"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Português", exact: true }).click();
  await expect(
    page.getByText("Conecte seu projeto Supabase para começar"),
  ).toBeVisible();
  await page.screenshot({
    path: "docs/screenshots/setup-iphone.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
