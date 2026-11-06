import { addDays, format } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import type { Data, Occurrence, Request } from "./schema";
import { expandSchedule } from "./schedule";

export function requestOccurrence(
  data: Data,
  request: Request,
): Occurrence | undefined {
  if (!request.series_id || !request.original_date) return;
  const moved = data.exceptions.find(
    (e) =>
      e.series_id === request.series_id &&
      e.original_date === request.original_date,
  )?.starts_at;
  const from = moved
    ? new Date(moved)
    : fromZonedTime(`${request.original_date}T00:00:00`, data.timezone);
  return expandSchedule(
    data.series,
    data.exceptions,
    from,
    new Date(+from + 2 * 86400000),
    data.timezone,
  ).find(
    (o) =>
      o.series_id === request.series_id &&
      o.original_date === request.original_date,
  );
}

// Conservative owner-calendar suggestions: no simultaneous jobs, with a 30-minute
// gap. These are proposed windows, not employee availability or route estimates.
export function suggestRequestTimes(
  data: Data,
  request: Request,
  now = new Date(),
): string[] {
  const original = requestOccurrence(data, request);
  if (!original) return [];
  const preferred = request.requested_start
    ? new Date(request.requested_start)
    : now;
  const anchor =
    Number.isFinite(+preferred) && preferred > now ? preferred : now;
  const firstDay = toZonedTime(anchor, data.timezone);
  const until = fromZonedTime(
    `${format(addDays(firstDay, 15), "yyyy-MM-dd")}T00:00:00`,
    data.timezone,
  );
  const others = expandSchedule(
    data.series,
    data.exceptions,
    new Date(+anchor - 2 * 86400000),
    until,
    data.timezone,
  ).filter((o) => o.key !== original.key);
  const result: string[] = [];
  for (let day = 0; day < 14 && result.length < 3; day++) {
    const date = addDays(firstDay, day);
    if ([0, 6].includes(date.getDay())) continue;
    for (
      let minute = 8 * 60;
      minute + original.duration_minutes <= 18 * 60;
      minute += 30
    ) {
      const clock = `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
      const start = fromZonedTime(
        `${format(date, "yyyy-MM-dd")}T${clock}:00`,
        data.timezone,
      );
      const end = +start + original.duration_minutes * 60000;
      if (
        start < anchor ||
        start <= now ||
        start.toISOString() === original.starts_at
      )
        continue;
      if (
        others.some(
          (o) =>
            +new Date(o.starts_at) < end + 30 * 60000 &&
            +new Date(o.ends_at) > +start - 30 * 60000,
        )
      )
        continue;
      result.push(start.toISOString());
      break; // Offer different days, not three adjacent slots on the same day.
    }
  }
  return result;
}

export function manualRequestTime(
  date: string,
  time: string,
  timezone: string,
): string {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)
  )
    throw new Error("INVALID_DATE_TIME");
  const value = fromZonedTime(`${date}T${time}:00`, timezone);
  if (
    !Number.isFinite(+value) ||
    format(toZonedTime(value, timezone), "yyyy-MM-dd HH:mm") !==
      `${date} ${time}`
  )
    throw new Error("INVALID_DATE_TIME");
  return value.toISOString();
}
