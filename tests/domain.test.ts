import test from "node:test";
import assert from "node:assert/strict";
import {
  expandSchedule,
  conflicts,
  durationSuggestion,
} from "../src/domain/schedule";
import {
  houseSchema,
  proposalSchema,
  seriesSchema,
  type Series,
  type Exception,
  type Visit,
} from "../src/domain/schema";
import { makeBriefing } from "../src/domain/briefing";
import { emptyData } from "../src/domain/schema";
process.env.TZ = "America/New_York";
const sid = "10000000-0000-4000-8000-000000000001",
  hid = "20000000-0000-4000-8000-000000000001",
  eid = "30000000-0000-4000-8000-000000000001";
function series(overrides: Partial<Series> = {}): Series {
  return {
    id: sid,
    business_id: "b",
    house_id: hid,
    starts_at: "2026-03-03T09:00:00-05:00",
    duration_minutes: 120,
    recurrence: "weekly",
    interval_weeks: 1,
    employee_ids: [eid],
    notes: "",
    until_at: null,
    ...overrides,
  };
}
test("weekly recurrence preserves 9 AM across DST", () => {
  const o = expandSchedule(
    [series()],
    [],
    new Date("2026-03-01"),
    new Date("2026-03-20"),
  );
  assert.equal(o.length, 3);
  assert.ok(o.every((v) => new Date(v.starts_at).getHours() === 9));
  assert.equal(o[1]?.starts_at, "2026-03-10T13:00:00.000Z");
});
test("biweekly, custom, and once occurrences", () => {
  const from = new Date("2026-03-01"),
    to = new Date("2026-04-01");
  assert.equal(
    expandSchedule([series({ recurrence: "biweekly" })], [], from, to).length,
    3,
  );
  assert.equal(
    expandSchedule(
      [series({ recurrence: "custom", interval_weeks: 3 })],
      [],
      from,
      to,
    ).length,
    2,
  );
  assert.equal(
    expandSchedule([series({ recurrence: "once" })], [], from, to).length,
    1,
  );
});
test("monthly series skips months without the original day", () => {
  const o = expandSchedule(
    [series({ recurrence: "monthly", starts_at: "2026-01-31T09:00:00-05:00" })],
    [],
    new Date("2026-01-01"),
    new Date("2026-04-01"),
  );
  assert.equal(o.length, 2);
  assert.equal(o[1]?.original_date, "2026-03-31");
});
test("one cancellation and one reschedule do not mutate the series", () => {
  const s = series();
  const exceptions: Exception[] = [
    {
      id: "x",
      series_id: sid,
      original_date: "2026-03-03",
      canceled: true,
      starts_at: null,
      duration_minutes: null,
      employee_ids: null,
      notes: null,
    },
    {
      id: "y",
      series_id: sid,
      original_date: "2026-03-10",
      canceled: false,
      starts_at: "2026-03-12T10:00:00-04:00",
      duration_minutes: 150,
      employee_ids: [],
      notes: "moved",
    },
  ];
  const o = expandSchedule(
    [s],
    exceptions,
    new Date("2026-03-01"),
    new Date("2026-03-20"),
  );
  assert.equal(o.length, 2);
  assert.equal(o[0]?.original_date, "2026-03-10");
  assert.equal(o[0]?.duration_minutes, 150);
  assert.deepEqual(o[0]?.employee_ids, []);
  assert.equal(s.starts_at, "2026-03-03T09:00:00-05:00");
});
test("moved occurrence outside original window appears exactly once", () => {
  const ex: Exception = {
    id: "x",
    series_id: sid,
    original_date: "2026-03-24",
    canceled: false,
    starts_at: "2026-03-05T10:00:00-05:00",
    duration_minutes: null,
    employee_ids: null,
    notes: null,
  };
  const o = expandSchedule(
    [series()],
    [ex],
    new Date("2026-03-05"),
    new Date("2026-03-06"),
  );
  assert.equal(o.length, 1);
  assert.equal(o[0]?.original_date, "2026-03-24");
});
test("future cutoff excludes later cleanings", () => {
  assert.equal(
    expandSchedule(
      [series({ until_at: "2026-03-10T13:00:00Z" })],
      [],
      new Date("2026-03-01"),
      new Date("2026-03-31"),
    ).length,
    1,
  );
});
test("overlaps conflict for the same house or shared employee, adjacent times do not", () => {
  const [a] = expandSchedule(
    [series()],
    [],
    new Date("2026-03-03"),
    new Date("2026-03-04"),
  );
  assert.ok(a);
  assert.equal(
    conflicts(a, [{ ...a, key: "other", house_id: "other" }]).length,
    1,
  );
  assert.equal(
    conflicts(a, [
      {
        ...a,
        key: "other",
        starts_at: a.ends_at,
        ends_at: "2026-03-03T18:00:00Z",
      },
    ]).length,
    0,
  );
});
test("duration learning needs at least three completed visits", () => {
  const visits = [120, 150, 150].map(
    (n, i) =>
      ({
        id: String(i),
        series_id: sid,
        original_date: "2026-01-01",
        status: "completed",
        actual_start: "2026-01-01T09:00:00Z",
        actual_end: new Date(
          +new Date("2026-01-01T09:00:00Z") + n * 60000,
        ).toISOString(),
        completed_tasks: [],
        notes: "",
        employee_count: 2,
      }) as Visit,
  );
  assert.equal(durationSuggestion(visits, 180), 150);
  assert.equal(durationSuggestion(visits.slice(1), 180), null);
});
test("AI validation rejects unknown operations and incomplete houses", () => {
  assert.throws(() => proposalSchema.parse({ action: "delete_all" }));
  assert.throws(() =>
    proposalSchema.parse({
      action: "create_house",
      house: { client_name: "Maria" },
    }),
  );
  assert.throws(() =>
    seriesSchema.parse({
      house_id: hid,
      starts_at: "tomorrow",
      duration_minutes: 0,
      recurrence: "weekly",
    }),
  );
  assert.equal(
    houseSchema.parse({
      nickname: "Maria",
      client_name: "Maria",
      address: "123 Main St",
    }).duration_minutes,
    120,
  );
});
test("briefing only includes actual data and is bilingual", () => {
  const data = {
    ...emptyData,
    houses: [
      {
        ...houseSchema.parse({
          nickname: "Maria",
          client_name: "Maria",
          address: "123 Main",
        }),
        id: hid,
        business_id: "b",
      },
    ],
    series: [series()],
  };
  const en = makeBriefing(data, "en-US", new Date("2026-03-03T12:00:00Z"));
  const pt = makeBriefing(data, "pt-BR", new Date("2026-03-03T12:00:00Z"));
  assert.match(en, /1 houses/);
  assert.match(en, /Maria/);
  assert.match(pt, /1 casas/);
  assert.doesNotMatch(en, /travel/i);
});
test("partial assistant edits cannot overwrite unspecified house fields with defaults", () => {
  const parsed = proposalSchema.parse({
    action: "update_house",
    house_id: hid,
    changes: { notes: "Do not use bleach" },
  });
  assert.equal(parsed.action, "update_house");
  if (parsed.action === "update_house")
    assert.deepEqual(parsed.changes, { notes: "Do not use bleach" });
});
test("business wall time stays stable when a device is in another timezone", () => {
  const previous = process.env.TZ;
  process.env.TZ = "America/Los_Angeles";
  try {
    const o = expandSchedule(
      [series()],
      [],
      new Date("2026-03-10T00:00:00Z"),
      new Date("2026-03-11T00:00:00Z"),
      "America/New_York",
    );
    assert.equal(o[0]?.starts_at, "2026-03-10T13:00:00.000Z");
  } finally {
    process.env.TZ = previous;
  }
});
