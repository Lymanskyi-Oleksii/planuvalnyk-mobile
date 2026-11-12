import { toISODate } from "./date";

/** Короткі назви днів, починаючи з понеділка. */
export const WEEKDAY_SHORT = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"] as const;

/** Парсить "YYYY-MM-DD" як локальну дату (без зсуву часового поясу). */
export function parseISO(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

/** Понеділок того тижня, якому належить дата. */
export function startOfWeekISO(iso: string): string {
  const d = parseISO(iso);
  const dayOfWeek = (d.getDay() + 6) % 7; // 0 = понеділок
  d.setDate(d.getDate() - dayOfWeek);
  return toISODate(d);
}

/** Сім дат тижня, від понеділка до неділі. */
export function weekDates(anchorISO: string): string[] {
  const start = parseISO(startOfWeekISO(anchorISO));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return toISODate(d);
  });
}

/** Число місяця для показу в смужці. */
export function dayOfMonth(iso: string): number {
  return parseISO(iso).getDate();
}

const MONTHS_FULL = [
  "Січень",
  "Лютий",
  "Березень",
  "Квітень",
  "Травень",
  "Червень",
  "Липень",
  "Серпень",
  "Вересень",
  "Жовтень",
  "Листопад",
  "Грудень",
] as const;

const MONTHS_SHORT = [
  "Січень",
  "Лютий",
  "Березень",
  "Квітень",
  "Травень",
  "Червень",
  "Липень",
  "Серпень",
  "Вересень",
  "Жовтень",
  "Листопад",
  "Грудень",
] as const;
/**
 * Підпис місяця/року для тижня. Якщо тиждень (Пн..Нд) повністю в одному
 * місяці — повна назва ("Вересень 2026"). Якщо розрізає два місяці —
 * скорочено ("Вер – Жов 2026"), а якщо ще й рік — з роком з обох боків.
 */
export function weekMonthLabel(anchorISO: string): string {
  const days = weekDates(anchorISO);
  return monthRangeLabel(days[0], days[6]);
}

/** Підпис місяця/року для проміжку дат від firstISO до lastISO — за тими ж правилами. */
export function monthRangeLabel(firstISO: string, lastISO: string): string {
  const first = parseISO(firstISO);
  const last = parseISO(lastISO);

  const sameMonth = first.getMonth() === last.getMonth() && first.getFullYear() === last.getFullYear();
  if (sameMonth) {
    return `${MONTHS_FULL[first.getMonth()]} ${first.getFullYear()}`;
  }

  const sameYear = first.getFullYear() === last.getFullYear();
  const fromLabel = sameYear
    ? MONTHS_SHORT[first.getMonth()]
    : `${MONTHS_SHORT[first.getMonth()]} ${first.getFullYear()}`;
  const toLabel = `${MONTHS_SHORT[last.getMonth()]} ${last.getFullYear()}`;

  return `${fromLabel} – ${toLabel}`;
}
