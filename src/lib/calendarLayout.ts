// Геометрія погодинної сітки. Чисті функції без React.
// Висота години (hourHeight, px) — параметр: її змінює масштаб (щипок, Ctrl + колесо).

/** Висота години за замовчуванням, px. */
export const DEFAULT_HOUR_HEIGHT = 56;
/** Межі масштабу, px на годину. */
export const MIN_HOUR_HEIGHT = 32;
export const MAX_HOUR_HEIGHT = 120;

/** Початок видимої області без задач. */
export const DEFAULT_START_MINUTES = 6 * 60;

export function clampHourHeight(px: number): number {
  if (!Number.isFinite(px)) return DEFAULT_HOUR_HEIGHT;
  return Math.min(MAX_HOUR_HEIGHT, Math.max(MIN_HOUR_HEIGHT, px));
}

/** Повна висота доби, px. */
export function dayHeight(hourHeight: number): number {
  return 24 * hourHeight;
}

/** "HH:MM" → хвилини від початку доби. */
export function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
}

/** Хвилини від початку доби → відступ зверху, px. */
export function minutesToTop(min: number, hourHeight: number): number {
  return (min / 60) * hourHeight;
}

/** Відступ зверху, px → хвилини від початку доби. */
export function topToMinutes(top: number, hourHeight: number): number {
  return (top / hourHeight) * 60;
}

/**
 * Куди прокрутити сітку: найраніша задача з відступом на годину вище (не вище 00:00),
 * а якщо задач немає — 06:00.
 */
export function initialScrollTop(startMinutes: number[], hourHeight: number): number {
  if (!startMinutes.length) return minutesToTop(DEFAULT_START_MINUTES, hourHeight);
  return Math.max(0, minutesToTop(Math.min(...startMinutes), hourHeight) - hourHeight);
}

/** Положення блока задачі в колонці дня. Найменша висота — як для 20 хв. */
export function blockRect(
  startTime: string,
  endTime: string,
  hourHeight: number,
): { top: number; height: number } {
  const start = timeToMinutes(startTime);
  const end = Math.max(timeToMinutes(endTime), start);
  const top = minutesToTop(start, hourHeight);
  const minHeight = minutesToTop(20, hourHeight);
  const height = Math.min(Math.max(minutesToTop(end, hourHeight) - top, minHeight), dayHeight(hourHeight) - top);
  return { top, height };
}
