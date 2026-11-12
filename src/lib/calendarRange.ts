import type { CalendarRange } from "./settings";
import { addDays } from "./date";
import { weekDates } from "./week";

/** Дати, які показує календар: 1 день, 3 дні від активного або тиждень з понеділка. */
export function rangeDates(activeDate: string, range: CalendarRange): string[] {
  if (range === 7) return weekDates(activeDate);
  return Array.from({ length: range }, (_, i) => addDays(activeDate, i));
}
