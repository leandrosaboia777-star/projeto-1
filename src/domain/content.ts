import type { Data } from "./schema";
// Translate descriptive content only. Names, addresses, phone numbers, dates,
// identifiers, and encrypted access instructions are never translation inputs.
export function contentTexts(data: Data): string[] {
  const texts: string[] = [];
  const add = (value: unknown) => {
    if (typeof value === "string" && value.trim()) texts.push(value);
  };
  for (const h of data.houses) {
    h.checklist.forEach(add);
    for (const key of [
      "restricted_rooms",
      "products",
      "avoid_products",
      "pets",
      "warnings",
      "notes",
      "parking",
    ] as const)
      add(h[key]);
  }
  for (const e of data.employees) add(e.availability);
  for (const record of [...data.series, ...data.exceptions, ...data.visits])
    add(record.notes);
  for (const p of data.photos) add(p.caption);
  for (const r of data.requests) add(r.message);
  for (const n of data.notifications) {
    add(n.title);
    add(n.body);
  }
  return [...new Set(texts)];
}
export function displayContent(
  text: string,
  translations: Map<string, string>,
): string {
  if (translations.has(text)) return translations.get(text)!;
  return text
    .split("\n")
    .map((line) => {
      const match = line.match(/^(\s*[•✓]\s*)(.*)$/);
      return match
        ? match[1]! + (translations.get(match[2]!) ?? match[2]!)
        : (translations.get(line) ?? line);
    })
    .join("\n");
}
