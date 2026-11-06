import { addDays, startOfDay } from "date-fns";
import { expandSchedule } from "./schedule";
import type { Data } from "./schema";
import type { Language } from "../lib/i18n";
export function makeBriefing(
  data: Data,
  language: Language,
  date = new Date(),
): string {
  const from = startOfDay(date),
    items = expandSchedule(
      data.series,
      data.exceptions,
      from,
      addDays(from, 1),
      data.timezone,
    );
  const pt = language === "pt-BR";
  const intro = pt
    ? `Hoje você tem ${items.length} casas agendadas.`
    : `Today you have ${items.length} houses scheduled.`;
  const details = items.map((o, i) => {
    const h = data.houses.find((h) => h.id === o.house_id),
      team = o.employee_ids
        .map((id) => data.employees.find((e) => e.id === id)?.full_name)
        .filter(Boolean)
        .join(", ");
    const time = new Date(o.starts_at).toLocaleTimeString(language, {
        hour: "numeric",
        minute: "2-digit",
      }),
      end = new Date(o.ends_at).toLocaleTimeString(language, {
        hour: "numeric",
        minute: "2-digit",
      });
    return pt
      ? `${i + 1}. ${h?.nickname ?? ""}, às ${time}, até ${end}. ${team ? `Equipe: ${team}.` : ""} ${h?.warnings ?? ""} ${o.notes}`
      : `${i + 1}. ${h?.nickname ?? ""}, at ${time}, until ${end}. ${team ? `Team: ${team}.` : ""} ${h?.warnings ?? ""} ${o.notes}`;
  });
  return [intro, ...details].join("\n\n");
}
