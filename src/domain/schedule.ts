import {
  addDays,
  addWeeks,
  addMonths,
  format,
  parseISO,
  startOfDay,
  differenceInCalendarDays,
} from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import type { Series, Exception, Occurrence, Visit } from "./schema";
export function occursOn(
  s: Series,
  date: string,
  timezone = "America/New_York",
): boolean {
  const start = toZonedTime(s.starts_at, timezone),
    day = parseISO(`${date}T12:00:00`),
    diff = differenceInCalendarDays(day, start);
  if (diff < 0) return false;
  const original = fromZonedTime(
    `${date}T${format(start, "HH:mm:ss")}`,
    timezone,
  );
  if (s.until_at && original >= parseISO(s.until_at)) return false;
  if (s.recurrence === "once") return diff === 0;
  if (s.recurrence === "monthly") return day.getDate() === start.getDate();
  const weeks =
    s.recurrence === "biweekly"
      ? 2
      : s.recurrence === "custom"
        ? s.interval_weeks
        : 1;
  return diff % (7 * weeks) === 0;
}
// Recurrence is evaluated in the business timezone, independently of device timezone.
// Monthly series skip months lacking the original day. Windows are end-exclusive.
export function expandSchedule(
  series: Series[],
  exceptions: Exception[],
  from: Date,
  to: Date,
  timezone = "America/New_York",
): Occurrence[] {
  const result: Occurrence[] = [];
  for (const s of series) {
    const start = toZonedTime(s.starts_at, timezone);
    let cursor = start;
    let index = 0;
    const interval =
      s.recurrence === "biweekly"
        ? 2
        : s.recurrence === "custom"
          ? s.interval_weeks
          : 1;
    const append = (date: string, instant: Date, ex?: Exception) => {
      if (
        ex?.canceled ||
        instant < from ||
        instant >= to ||
        !occursOn(s, date, timezone)
      )
        return;
      const duration = ex?.duration_minutes ?? s.duration_minutes;
      result.push({
        key: `${s.id}:${date}`,
        series_id: s.id,
        house_id: s.house_id,
        original_date: date,
        starts_at: instant.toISOString(),
        ends_at: new Date(+instant + duration * 60000).toISOString(),
        duration_minutes: duration,
        employee_ids: ex?.employee_ids ?? s.employee_ids,
        notes: ex?.notes ?? s.notes,
      });
    };
    while (fromZonedTime(cursor, timezone) < to && index < 12000) {
      const date = format(cursor, "yyyy-MM-dd"),
        ex = exceptions.find(
          (e) => e.series_id === s.id && e.original_date === date,
        );
      if (s.recurrence !== "monthly" || cursor.getDate() === start.getDate())
        append(
          date,
          ex?.starts_at
            ? parseISO(ex.starts_at)
            : fromZonedTime(cursor, timezone),
          ex,
        );
      index++;
      if (s.recurrence === "once") break;
      cursor =
        s.recurrence === "monthly"
          ? addMonths(start, index)
          : addWeeks(start, index * interval);
    }
    for (const ex of exceptions.filter(
      (e) => e.series_id === s.id && e.starts_at && !e.canceled,
    )) {
      if (!result.some((o) => o.key === `${s.id}:${ex.original_date}`))
        append(ex.original_date, parseISO(ex.starts_at!), ex);
    }
  }
  return result.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}
export function conflicts(
  candidate: Occurrence,
  others: Occurrence[],
): Occurrence[] {
  return others.filter(
    (o) =>
      o.key !== candidate.key &&
      o.starts_at < candidate.ends_at &&
      o.ends_at > candidate.starts_at &&
      (o.house_id === candidate.house_id ||
        o.employee_ids.some((id) => candidate.employee_ids.includes(id))),
  );
}
export function durationSuggestion(
  visits: Visit[],
  estimated: number,
): number | null {
  const durations = visits
    .filter((v) => v.status === "completed" && v.actual_start && v.actual_end)
    .sort((a, b) => a.actual_end!.localeCompare(b.actual_end!))
    .slice(-10)
    .map((v) => (+new Date(v.actual_end!) - +new Date(v.actual_start!)) / 60000)
    .filter((n) => n >= 15 && n <= 1440);
  if (durations.length < 3) return null;
  const sorted = durations.sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)]!;
  const rounded = Math.round(median / 15) * 15;
  return Math.abs(rounded - estimated) >= 15 ? rounded : null;
}
export function dayWindow(date: Date) {
  const from = startOfDay(date);
  return { from, to: addDays(from, 1) };
}
export function dateLabel(iso: string, locale: string) {
  return new Date(iso).toLocaleString(locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
