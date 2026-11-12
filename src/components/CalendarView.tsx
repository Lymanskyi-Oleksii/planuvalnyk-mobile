import { useEffect, useRef } from "react";
import { useRangeTasks } from "@/hooks/useRangeTasks";
import { DAY_HEIGHT, HOUR_HEIGHT, minutesToTop, timeToMinutes } from "@/lib/calendarLayout";
import { rangeDates } from "@/lib/calendarRange";
import { isToday } from "@/lib/date";
import type { CalendarRange } from "@/lib/settings";
import { WEEKDAY_SHORT, dayOfMonth, parseISO } from "@/lib/week";

interface CalendarViewProps {
  date: string;
  range: CalendarRange;
  refreshKey: number;
}

const HOURS = Array.from({ length: 24 }, (_, h) => h);

// Погодинна сітка. Шапка днів — sticky всередині того ж контейнера прокрутки, що й сітка:
// повзунок звужує обидві однаково, тож колонки шапки й сітки збігаються.
export function CalendarView({ date, range, refreshKey }: CalendarViewProps) {
  const dates = rangeDates(date, range);
  const tasks = useRangeTasks(dates, refreshKey);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrolledFor = useRef("");

  const cols = `44px repeat(${dates.length}, minmax(0, 1fr))`;
  const key = dates.join(",");

  // Прокрутка: сьогодні — до поточної години, інакше — до першої задачі; відступ годину вище.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const hasData = dates.every((d) => tasks[d]);
    if (scrolledFor.current === key && scrolledFor.current !== "") return;
    if (!dates.some(isToday) && !hasData) return; // чекаємо задачі
    let minutes = 8 * 60;
    if (dates.some(isToday)) {
      const now = new Date();
      minutes = now.getHours() * 60 + now.getMinutes();
    } else {
      const starts = dates.flatMap((d) => (tasks[d] ?? []).map((t) => timeToMinutes(t.startTime)));
      if (starts.length) minutes = Math.min(...starts);
    }
    el.scrollTop = Math.max(0, minutesToTop(minutes) - HOUR_HEIGHT);
    scrolledFor.current = key;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, tasks]);

  return (
    <section className="overflow-hidden rounded-xl2 border border-line bg-panel shadow-card">
      <div ref={scrollRef} className="h-[65vh] min-h-[320px] overflow-y-auto">
        <div
          className="sticky top-0 z-20 grid border-b border-line bg-panel"
          style={{ gridTemplateColumns: cols }}
        >
          <div />
          {dates.map((d) => {
            const today = isToday(d);
            return (
              <div key={d} className="flex flex-col items-center gap-0.5 border-l border-line py-2">
                <span className={`text-[11px] font-medium uppercase ${today ? "text-accent" : "text-muted"}`}>
                  {WEEKDAY_SHORT[(parseISO(d).getDay() + 6) % 7]}
                </span>
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${
                    today ? "bg-accent text-white" : "text-ink"
                  }`}
                >
                  {dayOfMonth(d)}
                </span>
              </div>
            );
          })}
        </div>

        <div className="grid" style={{ gridTemplateColumns: cols, height: DAY_HEIGHT }}>
          <div className="relative">
            {HOURS.slice(1).map((h) => (
              <span
                key={h}
                className="absolute right-1.5 -translate-y-1/2 text-[10px] text-muted"
                style={{ top: h * HOUR_HEIGHT }}
              >
                {String(h).padStart(2, "0")}:00
              </span>
            ))}
          </div>
          {dates.map((d) => (
            <div
              key={d}
              data-date={d}
              className="relative border-l border-line"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(to bottom, transparent 0, transparent " +
                  `${HOUR_HEIGHT - 1}px, rgb(var(--c-line)) ${HOUR_HEIGHT - 1}px, rgb(var(--c-line)) ${HOUR_HEIGHT}px)`,
              }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
