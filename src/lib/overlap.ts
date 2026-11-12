// Накладки задач з часом. Чисті функції: їх використовують форма задачі й перетягування в календарі.
import { addDays } from "./date";
import type { ScheduledTask } from "@/types";

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + (m || 0);
}

/** Перша задача зі списку, з якою перетинається проміжок start–end (excludeId не рахується). */
export function findOverlap(
  start: string,
  end: string,
  tasks: ScheduledTask[],
  excludeId?: string
): ScheduledTask | null {
  const s = toMinutes(start);
  const e = toMinutes(end);
  if (e <= s) return null;
  for (const t of tasks) {
    if (t.id === excludeId) continue;
    const ts = toMinutes(t.startTime);
    const te = toMinutes(t.endTime);
    if (s < te && ts < e) return t;
  }
  return null;
}

/** Нове місце однієї задачі. */
export interface TaskMove {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
}

/**
 * Перенесення «цієї й наступних» задач серії: кожна копія зсувається на dayShift днів
 * і отримує новий час. Копії, які на новому місці накладаються на іншу задачу, лишаються
 * де були (як у формі редагування серії).
 *
 * copies — копії серії від дати перенесеної задачі; others — задачі на днях призначення
 * (копії серії серед них не рахуються). Пропущена копія лишається на старому місці й
 * сама може заважати іншій — тому перевіряємо, доки список пропущених не перестане рости.
 */
export function planSeriesMove(
  copies: ScheduledTask[],
  others: ScheduledTask[],
  dayShift: number,
  startTime: string,
  endTime: string
): { moves: TaskMove[]; skipped: number } {
  const copyIds = new Set(copies.map((c) => c.id));
  const fixed = others.filter((t) => !copyIds.has(t.id));
  const targets = copies.map((c) => ({ id: c.id, date: addDays(c.date, dayShift), startTime, endTime }));

  const skipped = new Set<string>();
  for (;;) {
    const occupied = [...fixed, ...copies.filter((c) => skipped.has(c.id))];
    let grew = false;
    for (const t of targets) {
      if (skipped.has(t.id)) continue;
      const sameDay = occupied.filter((o) => o.date === t.date);
      if (findOverlap(startTime, endTime, sameDay, t.id)) {
        skipped.add(t.id);
        grew = true;
      }
    }
    if (!grew) break;
  }

  return { moves: targets.filter((t) => !skipped.has(t.id)), skipped: skipped.size };
}
