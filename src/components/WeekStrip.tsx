import { isToday } from "@/lib/date";
import { useHorizontalSwipe } from "@/lib/useSwipe";
import { WEEKDAY_SHORT, dayOfMonth, weekDates, weekMonthLabel } from "@/lib/week";
import type { DaySummary } from "@/types";

interface WeekStripProps {
  /** Тиждень, який зараз показано в смужці (може відрізнятись від activeDate, поки гортаєш). */
  weekAnchor: string;
  /** Обраний день — підсвічується, якщо потрапляє в показаний тиждень. */
  activeDate: string;
  onSelect: (date: string) => void;
  onShiftWeek: (direction: -1 | 1) => void;
  onGoToday: () => void;
  summaries?: DaySummary[];
}

/**
 * Чи є на цей день хоч щось заплановане — щоб намалювати крапку під числом.
 * Читаємо поле обережно, бо набір полів у DaySummary може відрізнятись.
 */
function hasAnything(summary: DaySummary | undefined): boolean {
  if (!summary) return false;
  const raw = summary as unknown as Record<string, unknown>;
  for (const key of ["total", "taskCount", "count", "scheduledCount", "tasksTotal"]) {
    const value = raw[key];
    if (typeof value === "number" && value > 0) return true;
  }
  for (const key of ["tasks", "scheduledTasks", "items"]) {
    const value = raw[key];
    if (Array.isArray(value) && value.length > 0) return true;
  }
  return false;
}

export function WeekStrip({ weekAnchor, activeDate, onSelect, onShiftWeek, onGoToday, summaries }: WeekStripProps) {
  const days = weekDates(weekAnchor);
  const byDate = new Map((summaries ?? []).map((s) => [s.date, s]));
  const weekHasToday = days.some((d) => isToday(d));

  const swipeHandlers = useHorizontalSwipe(
    () => onShiftWeek(1),
    () => onShiftWeek(-1),
  );

  return (
    <div
      className="shrink-0 border-b border-line bg-panel px-2 pb-2 pt-1.5"
      style={{ touchAction: "pan-y" }}
      {...swipeHandlers}
    >
      <div className="pb-1 text-center text-xs font-semibold capitalize text-muted">{weekMonthLabel(weekAnchor)}</div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onShiftWeek(-1)}
          className="flex h-9 w-7 shrink-0 items-center justify-center rounded-lg text-muted active:bg-canvas"
          aria-label="Попередній тиждень"
        >
          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <div className="flex min-w-0 flex-1 justify-between">
          {days.map((date, i) => {
            const active = date === activeDate;
            const today = isToday(date);
            const dot = hasAnything(byDate.get(date));

            return (
              <button
                key={date}
                onClick={() => onSelect(date)}
                aria-current={active ? "date" : undefined}
                className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5 transition-colors ${
                  active ? "bg-accent text-on-accent" : today ? "bg-accent-soft text-accent" : "text-muted active:bg-canvas"
                }`}
              >
                <span className={`text-[10px] font-medium uppercase ${active ? "text-on-accent/80" : ""}`}>
                  {WEEKDAY_SHORT[i]}
                </span>
                <span className={`text-sm font-bold ${active || today ? "" : "text-ink"}`}>
                  {dayOfMonth(date)}
                </span>
                <span
                  className={`h-1 w-1 rounded-full ${
                    dot ? (active ? "bg-on-accent" : "bg-accent") : "bg-transparent"
                  }`}
                />
              </button>
            );
          })}
        </div>

        <button
          onClick={() => onShiftWeek(1)}
          className="flex h-9 w-7 shrink-0 items-center justify-center rounded-lg text-muted active:bg-canvas"
          aria-label="Наступний тиждень"
        >
          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none">
            <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {!weekHasToday && (
        <div className="flex justify-center">
          <button
            onClick={onGoToday}
            className="mt-1 rounded-full px-3 py-0.5 text-[11px] font-medium text-accent active:bg-accent-soft"
          >
            Сьогодні
          </button>
        </div>
      )}
    </div>
  );
}
