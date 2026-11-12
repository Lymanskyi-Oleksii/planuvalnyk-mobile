const DAY_NAMES = [
  "Неділя",
  "Понеділок",
  "Вівторок",
  "Середа",
  "Четвер",
  "П'ятниця",
  "Субота",
];

const MONTH_NAMES = [
  "січня",
  "лютого",
  "березня",
  "квітня",
  "травня",
  "червня",
  "липня",
  "серпня",
  "вересня",
  "жовтня",
  "листопада",
  "грудня",
];

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fromISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso: string, amount: number): string {
  const d = fromISODate(iso);
  d.setDate(d.getDate() + amount);
  return toISODate(d);
}

/** Скільки днів від from до to (від'ємне, якщо to раніше). */
export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((fromISODate(toIso).getTime() - fromISODate(fromIso).getTime()) / 86_400_000);
}

export function isToday(iso: string): boolean {
  return iso === toISODate(new Date());
}

export function formatDayName(iso: string): string {
  return DAY_NAMES[fromISODate(iso).getDay()];
}

export function formatLongDate(iso: string): string {
  const d = fromISODate(iso);
  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatShortDate(iso: string): string {
  const d = fromISODate(iso);
  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
}

const SHORT_DAY_NAMES = ["нд", "пн", "вт", "ср", "чт", "пт", "сб"];
const SHORT_MONTH_NAMES = ["січ", "лют", "бер", "квіт", "трав", "черв", "лип", "серп", "вер", "жовт", "лист", "груд"];

/** Діапазон днів коротко: «пн 10 – пт 14»; якщо місяці різні — «пт 28 лист – пн 3 груд». */
export function formatDayRange(startIso: string, endIso: string): string {
  const a = fromISODate(startIso);
  const b = fromISODate(endIso);
  const sameMonth = a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
  const part = (d: Date) =>
    `${SHORT_DAY_NAMES[d.getDay()]} ${d.getDate()}${sameMonth ? "" : ` ${SHORT_MONTH_NAMES[d.getMonth()]}`}`;
  return `${part(a)} – ${part(b)}`;
}

export function nextNDays(startIso: string, n: number): string[] {
  const out: string[] = [];
  for (let i = 1; i <= n; i++) out.push(addDays(startIso, i));
  return out;
}

// Повертає дати з anchor по центру: `before` днів до, сам anchor, `after` днів після
export function centeredDays(anchorIso: string, before: number, after: number): string[] {
  const out: string[] = [];
  for (let i = -before; i <= after; i++) out.push(addDays(anchorIso, i));
  return out;
}
