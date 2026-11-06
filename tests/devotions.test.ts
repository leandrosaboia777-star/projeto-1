import test from "node:test";
import assert from "node:assert/strict";
import {
  devotionFor,
  completedWorkday,
  businessDay,
} from "../src/domain/devotions";
import { emptyData, type Series, type Visit } from "../src/domain/schema";
const now = new Date("2026-11-06T18:00:00Z");
const series = (id: string, start: string): Series => ({
  id,
  house_id: id,
  business_id: "business",
  starts_at: start,
  duration_minutes: 90,
  recurrence: "once",
  interval_weeks: 1,
  employee_ids: [],
  notes: "",
  until_at: null,
});
const visit = (id: string, status: Visit["status"]): Visit => ({
  id,
  series_id: id,
  original_date: "2026-11-06",
  status,
  actual_start: null,
  actual_end: null,
  completed_tasks: [],
  notes: "",
  employee_count: 1,
});
test("Scripture readings are stable by business day, bilingual, and different for morning and evening", () => {
  const morning = devotionFor("2026-11-06", "morning", "pt-BR"),
    evening = devotionFor("2026-11-06", "evening", "pt-BR");
  assert.notEqual(morning.reference, evening.reference);
  assert.notEqual(
    morning.verse,
    devotionFor("2026-11-07", "morning", "pt-BR").verse,
  );
  assert.deepEqual(morning, devotionFor("2026-11-06", "morning", "pt-BR"));
  assert.ok(morning.reflection.length > 80);
  assert.notEqual(
    morning.verse,
    devotionFor("2026-11-06", "morning", "en-US").verse,
  );
  assert.throws(() => devotionFor("not-a-date", "morning", "pt-BR"));
});
test("end of day requires actual completion of every remaining house, not elapsed estimated time", () => {
  const data = {
    ...emptyData,
    series: [
      series("one", "2026-11-06T14:00:00Z"),
      series("two", "2026-11-06T16:00:00Z"),
    ],
  };
  assert.equal(completedWorkday(data, now), false);
  assert.equal(
    completedWorkday({ ...data, visits: [visit("one", "completed")] }, now),
    false,
  );
  assert.equal(
    completedWorkday(
      {
        ...data,
        visits: [visit("one", "completed"), visit("two", "in_progress")],
      },
      now,
    ),
    false,
  );
  assert.equal(
    completedWorkday(
      {
        ...data,
        visits: [visit("one", "completed"), visit("two", "completed")],
      },
      now,
    ),
    true,
  );
  assert.equal(completedWorkday(emptyData, now), false);
  assert.equal(
    completedWorkday(
      { ...data, visits: [visit("one", "canceled"), visit("two", "canceled")] },
      now,
    ),
    false,
  );
  assert.equal(
    completedWorkday(
      {
        ...data,
        visits: [visit("one", "completed"), visit("two", "canceled")],
      },
      now,
    ),
    true,
  );
});
test("business dates follow the company timezone across midnight, independent of device timezone", () => {
  assert.equal(
    businessDay(emptyData, new Date("2026-11-07T02:00:00Z")),
    "2026-11-06",
  );
  assert.equal(
    businessDay(emptyData, new Date("2026-11-07T06:00:00Z")),
    "2026-11-07",
  );
});
