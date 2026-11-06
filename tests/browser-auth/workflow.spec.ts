import { test, expect } from "@playwright/test";
import { houseSchema } from "../../src/domain/schema";
// Browser-only API fixtures. These tests prove UI wiring, not live Supabase/AI access.
const business = "10000000-0000-4000-8000-000000000001";
const uid = "10000000-0000-4000-8000-000000000002";
const profile = {
  id: uid,
  business_id: business,
  full_name: "Leandro Saboia",
  role: "manager",
};
async function setup(page: any, assistantProposal?: any, devotions = false) {
  await page.addInitScript(
    ({ uid, devotions }: { uid: string; devotions: boolean }) =>
      window.localStorage.setItem(
        `devotion:${uid}:settings`,
        JSON.stringify({
          enabled: devotions,
          notifications: false,
          time: "07:00",
        }),
      ),
    { uid, devotions },
  );
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
    if (
      path.includes("/storage/v1/object/sign/house-photos/") &&
      req.method() === "GET"
    ) {
      await route.fulfill({
        status: 200,
        contentType: "image/png",
        body: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jFZkAAAAASUVORK5CYII=",
          "base64",
        ),
      });
      return;
    }
    if (
      path.includes("/storage/v1/object/sign/house-photos/") &&
      req.method() === "POST"
    ) {
      result = {
        signedURL: path.replace("/storage/v1", "") + "?token=fixture-only",
      };
    } else if (path.includes("/rpc/set_house_cover")) {
      const input = req.postDataJSON();
      for (const photo of rows.photos!)
        if (photo.house_id === input.p_house_id)
          photo.is_cover = photo.id === input.p_photo_id;
      result = null;
    } else if (path.includes("/auth/v1/token")) {
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
    } else if (path.includes("/rpc/resolve_request")) {
      const input = req.postDataJSON();
      const request = rows.client_requests!.find(
        (r) => r.id === input.p_request_id,
      );
      if (request) request.status = input.p_approve ? "approved" : "declined";
      result = null;
    } else if (path.includes("/functions/v1/confirm-proposal")) {
      const input = req.postDataJSON().proposal;
      rows.houses!.push({
        ...input.house,
        id: "20000000-0000-4000-8000-000000000002",
        business_id: business,
      });
      result = { saved: true };
    } else if (path.includes("/functions/v1/translate-content")) {
      const input = req.postDataJSON();
      const en: Record<string, string> = {
        "Limpar a cozinha": "Clean the kitchen",
        "Não usar água sanitária": "Do not use bleach",
        "Um gato; manter a porta fechada": "One cat; keep the door closed",
        "Vaso encontrado na sala": "Vase found in the living room",
      };
      result = {
        translations: input.texts.map((text: string) =>
          input.language === "en-US"
            ? (en[text] ?? text)
            : (Object.entries(en).find(([, value]) => value === text)?.[0] ??
              text),
        ),
      };
    } else if (path.includes("/functions/v1/assistant"))
      result = {
        proposal: assistantProposal ?? {
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
      } else if (req.method() === "PATCH") {
        const id = url.searchParams.get("id")?.replace(/^eq\./, "");
        for (const row of rows[table])
          if (row.id === id) Object.assign(row, req.postDataJSON());
        result = null;
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
    page.getByText("Your new house is organized", { exact: true }),
  ).toBeVisible();
  expect(rows.houses).toHaveLength(1);
  await expect(
    page.getByText("Client and house", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("18 Oak Street", { exact: true })).toBeVisible();
  await expect(
    page.getByText(/Structured data|Dados estruturados/),
  ).not.toBeVisible();
  await page.getByRole("button", { name: "Edit Address", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Street address", exact: true })
    .fill("20 Oak Street");
  await page.getByRole("button", { name: "Done editing", exact: true }).click();
  await page
    .getByRole("button", { name: "Edit The cleaning", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Duration in minutes", exact: true })
    .fill("0");
  await page
    .getByRole("button", { name: "Confirm & save", exact: true })
    .click();
  await expect(
    page.getByText("Check this field: Duration in minutes.", { exact: true }),
  ).toBeVisible();
  expect(rows.houses).toHaveLength(1);
  await page
    .getByRole("textbox", { name: "Duration in minutes", exact: true })
    .fill("150");
  await page.getByRole("button", { name: "Done editing", exact: true }).click();
  await page.screenshot({
    path: "docs/screenshots/assistant-review.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Confirm & save", exact: true })
    .click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  expect(rows.houses).toHaveLength(2);
  expect(rows.houses![1].address).toBe("20 Oak Street");
  expect(rows.houses![1].duration_minutes).toBe(150);
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

test("rescheduling waits for explicit confirmation and supports manual business time", async ({
  page,
}) => {
  const { rows, errors } = await setup(page);
  const houseId = "20000000-0000-4000-8000-000000000011";
  const seriesId = "30000000-0000-4000-8000-000000000011";
  rows.houses!.push({
    ...houseSchema.parse({
      nickname: "Test house",
      client_name: "Test client",
      address: "Test address",
    }),
    id: houseId,
    business_id: business,
  });
  const future = new Date(Date.now() + 3 * 86400000);
  future.setUTCHours(14, 0, 0, 0);
  const originalDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
  }).format(future);
  rows.cleaning_series!.push({
    id: seriesId,
    business_id: business,
    house_id: houseId,
    starts_at: future.toISOString(),
    duration_minutes: 120,
    recurrence: "once",
    interval_weeks: 1,
    employee_ids: [],
    notes: "",
    until_at: null,
  });
  rows.client_requests!.push({
    id: "40000000-0000-4000-8000-000000000011",
    business_id: business,
    house_id: houseId,
    series_id: seriesId,
    original_date: originalDate,
    requested_start: new Date(+future + 86400000).toISOString(),
    status: "pending",
    message: "Please change my cleaning date",
  });
  const approvals: any[] = [];
  page.on("request", (req) => {
    if (req.url().includes("/rpc/resolve_request"))
      approvals.push(req.postDataJSON());
  });
  await login(page);
  await page.getByText("Client requests", { exact: true }).click();
  await expect(
    page.getByText("Choose the new time", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/Suggestions: next 14 days/)).toBeVisible();
  expect(approvals).toEqual([]);
  await page
    .getByRole("button", { name: "Choose another date manually", exact: true })
    .click();
  const manual = new Date(+future + 2 * 86400000).toISOString().slice(0, 10);
  await page
    .getByRole("textbox", { name: "New date (YYYY-MM-DD)", exact: true })
    .fill(manual);
  await page
    .getByRole("textbox", {
      name: "Time (HH:mm) (America/New_York)",
      exact: true,
    })
    .fill("11:30");
  expect(approvals).toEqual([]);
  await page
    .getByRole("button", { name: "Confirm change", exact: true })
    .click();
  await expect.poll(() => approvals.length).toBe(1);
  expect(approvals[0].p_approve).toBe(true);
  expect(approvals[0].p_request_id).toBe(rows.client_requests![0].id);
  await expect(
    page.getByText("Please change my cleaning date", { exact: true }),
  ).not.toBeVisible();
  expect(errors).toEqual([]);
});

test("Portuguese phone review uses plain cards, a readable schedule and private access", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { rows, errors } = await setup(page, {
    action: "create_house",
    house: {
      nickname: "Casa da Ana",
      client_name: "Ana Exemplo",
      address: "123 Example Street",
      city: "Manchester",
      state: "NH",
      zip: "03101",
      bedrooms: 3,
      bathrooms: 2,
      duration_minutes: 120,
      checklist: ["Limpar cozinha", "Aspirar", "Passar pano"],
      products: "Produtos sem perfume",
      avoid_products: "Água sanitária",
      pets: "Um gato",
      restricted_rooms: "Escritório",
      parking: "Entrada da garagem",
    },
    schedule: {
      starts_at: "2026-11-10T14:00:00Z",
      duration_minutes: 120,
      recurrence: "weekly",
      interval_weeks: 1,
      employee_ids: [],
      notes: "",
    },
    access_instructions: "fictional-private-test-only",
  });
  await login(page);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page
    .getByRole("button", { name: "Português brasileiro", exact: true })
    .click();
  await page.getByRole("button", { name: "Escuro", exact: true }).click();
  await page.getByRole("button", { name: "Assistente", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Assistente", exact: true })
    .fill("Cadastre a casa fictícia para testar.");
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(
    page.getByText("Sua nova casa está organizada", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Cliente e casa", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Agenda da limpeza", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Semanal", { exact: true })).toBeVisible();
  await expect(page.getByText(/terça-feira, 10 de novembro/)).toBeVisible();
  await expect(
    page.getByText("fictional-private-test-only", { exact: true }),
  ).not.toBeVisible();
  await expect(
    page.getByText(/Dados estruturados|create_house|starts_at/),
  ).not.toBeVisible();
  expect(rows.houses).toHaveLength(0);
  await page
    .getByRole("button", { name: "Editar Agenda da limpeza", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Horário (HH:mm)", exact: true })
    .fill("25:00");
  await page
    .getByRole("button", { name: "Confirmar e salvar", exact: true })
    .click();
  await expect(
    page.getByText("Confira a data e o horário antes de salvar.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(rows.houses).toHaveLength(0);
  await page
    .getByRole("textbox", { name: "Horário (HH:mm)", exact: true })
    .fill("09:00");
  await page
    .getByRole("button", { name: "Concluir edição", exact: true })
    .click();
  await page
    .getByText("PRONTO PARA CONFERIR", { exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "docs/screenshots/assistant-review-iphone-pt.png",
  });
  await page
    .getByRole("button", { name: "Descartar esta sugestão", exact: true })
    .click();
  await expect(
    page.getByText("Sua nova casa está organizada", { exact: true }),
  ).not.toBeVisible();
  expect(rows.houses).toHaveLength(0);
  expect(errors).toEqual([]);
});

for (const [action, heading, fields] of [
  [
    "update_house",
    "Review the house changes",
    {
      house_id: "20000000-0000-4000-8000-000000000011",
      changes: { notes: "Use fragrance-free products" },
    },
  ],
  [
    "create_employee",
    "New team member",
    {
      employee: {
        full_name: "Test teammate",
        phone: "",
        availability: "Weekdays",
        role: "employee",
        active: true,
        user_id: null,
        color: "#537C70",
      },
    },
  ],
  [
    "create_series",
    "Your cleaning is organized",
    {
      series: {
        house_id: "20000000-0000-4000-8000-000000000011",
        starts_at: "2026-11-10T14:00:00Z",
        duration_minutes: 120,
        recurrence: "weekly",
        interval_weeks: 1,
        employee_ids: [],
        notes: "",
      },
    },
  ],
  [
    "change_occurrence",
    "Review the schedule change",
    {
      series_id: "30000000-0000-4000-8000-000000000011",
      original_date: "2026-11-10",
      starts_at: "2026-11-11T14:00:00Z",
      canceled: false,
    },
  ],
] as const) {
  test(`plain review supports ${action} without showing identifiers or making writes`, async ({
    page,
  }) => {
    const { rows, errors } = await setup(page, { action, ...fields });
    rows.houses!.push({
      ...houseSchema.parse({
        nickname: "Test house",
        client_name: "Test client",
        address: "Test address",
      }),
      id: "20000000-0000-4000-8000-000000000011",
      business_id: business,
    });
    rows.cleaning_series!.push({
      id: "30000000-0000-4000-8000-000000000011",
      house_id: rows.houses![0].id,
      business_id: business,
      starts_at: "2026-11-10T14:00:00Z",
      duration_minutes: 120,
      recurrence: "weekly",
      interval_weeks: 1,
      employee_ids: [],
      notes: "",
      until_at: null,
    });
    let writes = 0;
    page.on("request", (req) => {
      if (req.url().includes("/functions/v1/confirm-proposal")) writes++;
    });
    await login(page);
    await page.getByRole("button", { name: "Assistant", exact: true }).click();
    await page
      .getByRole("textbox", { name: "Assistant", exact: true })
      .fill("Prepare this change for review.");
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(page.getByText(heading, { exact: true })).toBeVisible();
    await expect(
      page.getByText("20000000-0000-4000-8000-000000000011", { exact: false }),
    ).not.toBeVisible();
    await expect(page.getByText(/Structured data \(JSON\)/)).not.toBeVisible();
    await page
      .getByRole("button", { name: "Discard this suggestion", exact: true })
      .click();
    expect(writes).toBe(0);
    expect(errors).toEqual([]);
  });
}

test("a chosen house cover replaces the list icon while records and captions are preserved", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { rows, errors } = await setup(page);
  const houseId = "20000000-0000-4000-8000-000000000031";
  rows.houses!.push({
    ...houseSchema.parse({
      nickname: "Test cover house",
      client_name: "Test client",
      address: "Example address",
    }),
    id: houseId,
    business_id: business,
  });
  rows.photos!.push(
    ...["Facade reference", "Found item"].map((caption, i) => ({
      id: `50000000-0000-4000-8000-00000000003${i + 1}`,
      business_id: business,
      house_id: houseId,
      visit_id: null,
      path: `${business}/${houseId}/photo-${i}.jpg`,
      caption,
      is_cover: false,
      created_at: "2026-11-06T10:00:00Z",
    })),
  );
  await login(page);
  await page.getByText("Houses", { exact: true }).click();
  await expect(
    page.getByRole("img", {
      name: "House photo: Test cover house",
      exact: true,
    }),
  ).not.toBeVisible();
  await page.getByText("Test cover house", { exact: true }).click();
  await expect(
    page.getByText("Photos and records", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Use as house photo", exact: true })
    .first()
    .click();
  await expect
    .poll(() => rows.photos!.filter((p) => p.is_cover).length)
    .toBe(1);
  expect(rows.photos![0].is_cover).toBe(true);
  await expect(
    page.getByRole("button", { name: "Use as house photo", exact: true }),
  ).toHaveCount(1);
  await page
    .getByRole("button", { name: "Use as house photo", exact: true })
    .click();
  await expect.poll(() => rows.photos![1].is_cover).toBe(true);
  expect(rows.photos![0].is_cover).toBe(false);
  expect(rows.photos).toHaveLength(2);
  await page
    .getByRole("button", { name: "Edit description", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Record description", exact: true })
    .fill("Saved for comparison with a found item");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect
    .poll(() => rows.photos![0].caption)
    .toBe("Saved for comparison with a found item");
  await expect(
    page.getByText("Photos and records", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Remove cover and keep in records",
      exact: true,
    })
    .click();
  await expect.poll(() => rows.photos!.some((p) => p.is_cover)).toBe(false);
  expect(rows.photos).toHaveLength(2);
  await expect(
    page.getByRole("button", { name: "Use as house photo", exact: true }),
  ).toHaveCount(2);
  await page
    .getByRole("button", { name: "Use as house photo", exact: true })
    .first()
    .click();
  await expect.poll(() => rows.photos![0].is_cover).toBe(true);
  await page.getByLabel("Close", { exact: true }).click();
  await expect(
    page.getByRole("img", {
      name: "House photo: Test cover house",
      exact: true,
    }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("saved descriptions follow the selected language without rewriting originals", async ({
  page,
}) => {
  const { rows, errors } = await setup(page);
  rows.houses!.push({
    ...houseSchema.parse({
      nickname: "Casa da Ana",
      client_name: "Ana Silva",
      address: "123 Main Street",
      checklist: ["Limpar a cozinha"],
      warnings: "Não usar água sanitária",
      pets: "Um gato; manter a porta fechada",
    }),
    id: "20000000-0000-4000-8000-000000000041",
    business_id: business,
  });
  await login(page);
  await page.getByText("Houses", { exact: true }).click();
  await page.getByText("Casa da Ana", { exact: true }).click();
  await expect(
    page.getByText("• Clean the kitchen", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Do not use bleach", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("One cat; keep the door closed", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Close", { exact: true }).click();
  await page.getByText("Settings", { exact: true }).click();
  await page
    .getByRole("button", { name: "Português brasileiro", exact: true })
    .click();
  await page.getByText("Casas", { exact: true }).click();
  await page.getByText("Casa da Ana", { exact: true }).click();
  await expect(
    page.getByText("• Limpar a cozinha", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Não usar água sanitária", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("dialog").getByText("Ana Silva", { exact: true }),
  ).toBeVisible();
  expect(rows.houses![0].checklist).toEqual(["Limpar a cozinha"]);
  expect(rows.houses![0].warnings).toBe("Não usar água sanitária");
  expect(rows.houses![0].address).toBe("123 Main Street");
  expect(errors).toEqual([]);
});

test("daily Scripture opens once and the closing reflection waits for the last completed house", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-11-06T18:00:00Z") });
  const { rows, errors } = await setup(page, undefined, true);
  const houseId = "20000000-0000-4000-8000-000000000051";
  rows.houses!.push({
    ...houseSchema.parse({
      nickname: "Devotion test house",
      client_name: "Test client",
      address: "Test address",
    }),
    id: houseId,
    business_id: business,
  });
  for (let i = 0; i < 2; i++)
    rows.cleaning_series!.push({
      id: `30000000-0000-4000-8000-00000000005${i + 1}`,
      house_id: houseId,
      business_id: business,
      starts_at: `2026-11-06T${i === 0 ? "14" : "16"}:00:00Z`,
      duration_minutes: 90,
      recurrence: "once",
      interval_weeks: 1,
      employee_ids: [],
      notes: "",
      until_at: null,
    });
  await login(page);
  await expect(
    page.getByText("A word to begin your day", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("A moment to reflect", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Continue to my schedule", exact: true })
    .click();
  await page.getByLabel("Refresh", { exact: true }).click();
  await expect(
    page.getByText("A word to begin your day", { exact: true }),
  ).not.toBeVisible();
  function complete(index: number) {
    rows.visits!.push({
      id: `visit-${index}`,
      series_id: rows.cleaning_series![index].id,
      original_date: "2026-11-06",
      status: "completed",
      actual_start: null,
      actual_end: null,
      completed_tasks: [],
      notes: "",
      employee_count: 1,
    });
  }
  complete(0);
  await page.getByLabel("Refresh", { exact: true }).click();
  await expect(
    page.getByText("Today's work is complete", { exact: true }),
  ).not.toBeVisible();
  complete(1);
  await page.getByLabel("Refresh", { exact: true }).click();
  await expect(
    page.getByText("Today's work is complete", { exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "docs/screenshots/daily-reflection.png" });
  await page
    .getByRole("button", { name: "Continue to my schedule", exact: true })
    .click();
  await page.getByLabel("Refresh", { exact: true }).click();
  await expect(
    page.getByText("Today's work is complete", { exact: true }),
  ).not.toBeVisible();
  expect(errors).toEqual([]);
});

test("translation failure stays off the home screen and retry is available in Settings", async ({
  page,
}) => {
  const { rows } = await setup(page);
  rows.houses!.push({
    ...houseSchema.parse({
      nickname: "Test house",
      client_name: "Test",
      address: "Test",
      notes: "Original note",
    }),
    id: "20000000-0000-4000-8000-000000000061",
    business_id: business,
  });
  await page.route("**/functions/v1/translate-content", async (route) =>
    route.fulfill({
      status: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ error: "AI_PROVIDER_ERROR" }),
    }),
  );
  await login(page);
  await expect(
    page.getByText("Some information is still in its original language.", {
      exact: false,
    }),
  ).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Retry translation", exact: true }),
  ).not.toBeVisible();
  await page.getByText("Settings", { exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "Retry saved information translation",
      exact: true,
    }),
  ).toBeVisible();
});
