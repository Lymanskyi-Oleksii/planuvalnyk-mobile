// Геометрія погодинної сітки. Чисті функції без React.

/** Висота однієї години, px. */
export const HOUR_HEIGHT = 56;
/** Повна висота доби, px. */
export const DAY_HEIGHT = 24 * HOUR_HEIGHT;
/** Найменша висота блока — як для 20 хв. */
export const MIN_BLOCK_HEIGHT = (20 / 60) * HOUR_HEIGHT;

/** "HH:MM" → хвилини від початку доби. */
export function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
}

/** Хвилини від початку доби → відступ зверху, px. */
export function minutesToTop(min: number): number {
  return (min / 60) * HOUR_HEIGHT;
}

/** Положення блока задачі в колонці дня. */
export function blockRect(startTime: string, endTime: string): { top: number; height: number } {
  const start = timeToMinutes(startTime);
  const end = Math.max(timeToMinutes(endTime), start);
  const top = minutesToTop(start);
  const height = Math.min(Math.max(minutesToTop(end) - top, MIN_BLOCK_HEIGHT), DAY_HEIGHT - top);
  return { top, height };
}
