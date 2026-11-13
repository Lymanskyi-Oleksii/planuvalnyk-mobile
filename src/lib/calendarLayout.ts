// Геометрія погодинної сітки. Чисті функції без React.
// Висота години (hourHeight, px) — параметр: її змінює масштаб (щипок двома пальцями).

/** Висота години за замовчуванням, px. */
export const DEFAULT_HOUR_HEIGHT = 56;
/** Межі масштабу, px на годину. */
const MIN_HOUR_HEIGHT = 32;
const MAX_HOUR_HEIGHT = 120;

/** Початок видимої області без задач. */
const DEFAULT_START_MINUTES = 6 * 60;

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

/** Найменша висота блока, хв. */
const MIN_BLOCK_MINUTES = 20;

/** Місце блока по ширині: доріжка lane з lanes у групі, що перетинається. */
interface BlockLane {
  lane: number;
  lanes: number;
}

/**
 * Запасний варіант для старих даних із накладками (нові задачі не перетинаються):
 * блоки, що перетинаються на екрані, ділять ширину колонки порівну.
 * Кінець рахується з найменшою висотою блока — щоб не накривали один одного й короткі.
 */
export function overlapLanes(
  items: { id: string; startTime: string; endTime: string }[],
): Map<string, BlockLane> {
  const spans = items
    .map((t) => {
      const start = timeToMinutes(t.startTime);
      return { id: t.id, start, end: Math.max(timeToMinutes(t.endTime), start + MIN_BLOCK_MINUTES) };
    })
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const result = new Map<string, BlockLane>();
  let group: { id: string; lane: number }[] = [];
  let laneEnds: number[] = [];
  let groupEnd = -1;

  const closeGroup = () => {
    for (const g of group) result.set(g.id, { lane: g.lane, lanes: laneEnds.length });
    group = [];
    laneEnds = [];
  };

  for (const s of spans) {
    if (s.start >= groupEnd) closeGroup();
    let lane = laneEnds.findIndex((end) => end <= s.start);
    if (lane < 0) {
      lane = laneEnds.length;
      laneEnds.push(s.end);
    } else {
      laneEnds[lane] = s.end;
    }
    group.push({ id: s.id, lane });
    groupEnd = Math.max(groupEnd, s.end);
  }
  closeGroup();
  return result;
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
  const minHeight = minutesToTop(MIN_BLOCK_MINUTES, hourHeight);
  const height = Math.min(Math.max(minutesToTop(end, hourHeight) - top, minHeight), dayHeight(hourHeight) - top);
  return { top, height };
}
