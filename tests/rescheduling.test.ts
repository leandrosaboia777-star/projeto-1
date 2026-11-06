import test from "node:test";
import assert from "node:assert/strict";
import {
  emptyData,
  type Data,
  type Request,
  type Series,
} from "../src/domain/schema";
import {
  manualRequestTime,
  suggestRequestTimes,
  requestOccurrence,
} from "../src/domain/rescheduling";

const original: Series = {
  id: "series",
  house_id: "house",
  business_id: "business",
  starts_at: "2026-03-06T09:00:00-05:00",
  duration_minutes: 120,
  recurrence: "weekly",
  interval_weeks: 1,
  employee_ids: [],
  notes: "",
  until_at: null,
};
const request: Request = {
  id: "request",
  house_id: "house",
  series_id: "series",
  original_date: "2026-03-06",
  requested_start: "2026-03-09T08:00:00-04:00",
  message: "Reschedule please",
  status: "pending",
};
const now = new Date("2026-03-06T08:00:00-05:00");
function data(): Data {
  return { ...emptyData, series: [original] };
}
test("suggestions respect business timezone, weekends, duration and unassigned jobs", () => {
  const d = data();
  d.series.push({
    ...original,
    id: "other",
    house_id: "other-house",
    starts_at: "2026-03-09T08:00:00-04:00",
    recurrence: "once",
  });
  const slots = suggestRequestTimes(d, request, now);
  assert.equal(slots.length, 3);
  // Monday job ends 10 AM EDT. The next slot includes a 30-minute gap.
  assert.equal(slots[0], "2026-03-09T14:30:00.000Z");
  assert.equal(slots[1], "2026-03-10T12:00:00.000Z");
  assert.equal(new Set(slots.map((s) => s.slice(0, 10))).size, 3);
  assert.equal(d.series[0]!.starts_at, original.starts_at); // Suggestions never mutate.
});
test("the original job does not block its own replacement and past slots are skipped", () => {
  const slots = suggestRequestTimes(
    data(),
    { ...request, requested_start: "2026-03-06T09:30:00-05:00" },
    now,
  );
  assert.equal(slots[0], "2026-03-06T14:30:00.000Z");
  assert.deepEqual(
    suggestRequestTimes(data(), { ...request, series_id: null }, now),
    [],
  );
});
test("manual entry uses business timezone and rejects invalid dates or nonexistent DST times", () => {
  assert.equal(
    manualRequestTime("2026-03-09", "09:00", "America/New_York"),
    "2026-03-09T13:00:00.000Z",
  );
  for (const [date, time] of [
    ["2026-02-30", "09:00"],
    ["2026-03-08", "02:30"],
    ["2026-03-09", "25:00"],
  ])
    assert.throws(() => manualRequestTime(date!, time!, "America/New_York"));
});
test("an already-moved occurrence keeps its current duration and assignments", () => {
  const d = data();
  d.exceptions = [
    {
      id: "e",
      series_id: "series",
      original_date: "2026-03-06",
      starts_at: "2026-03-20T14:00:00-04:00",
      canceled: false,
      duration_minutes: 90,
      employee_ids: ["worker"],
      notes: null,
    },
  ];
  assert.equal(requestOccurrence(d, request)?.duration_minutes, 90);
});
