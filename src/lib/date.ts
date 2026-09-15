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
