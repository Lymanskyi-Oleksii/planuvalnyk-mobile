import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useCalendarZoom } from "@/hooks/useCalendarZoom";
import { useRangeTasks } from "@/hooks/useRangeTasks";
import { dayHeight, initialScrollTop, timeToMinutes } from "@/lib/calendarLayout";
import { rangeDates } from "@/lib/calendarRange";
import { isToday } from "@/lib/date";
import type { CalendarRange } from "@/lib/settings";
import { WEEKDAY_SHORT, dayOfMonth, parseISO } from "@/lib/week";

interface CalendarViewProps {
  date: string;
  range: CalendarRange;
  refreshKey: number;
  /** Збільшується кнопкою «Сьогодні» — знову перейти до першої задачі. */
  jumpToken: number;
  /** Збережений масштаб (висота години, px). */
  hourHeight: number;
}

const HOURS = Array.from({ length: 24 }, (_, h) => h);

// Погодинна сітка. Шапка днів — sticky всередині того ж контейнера прокрутки, що й сітка:
// повзунок звужує обидві однаково, тож колонки шапки й сітки збігаються.
export function CalendarView({ date, range, refreshKey, jumpToken, hourHeight: savedHourHeight }: CalendarViewProps) {
  const dates = rangeDates(date, range);
  const { tasks, ready } = useRangeTasks(dates, refreshKey);
  const scrollRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const { hourHeight, hourHeightRef } = useCalendarZoom(scrollRef, headerRef, savedHourHeight);

  const cols = `44px repeat(${dates.length}, minmax(0, 1fr))`;

  // Перехід до першої задачі: під час відкриття (монтування — і перемикання «Список» → «Календар»),
  // кнопкою «Сьогодні» і зі зміною діапазону. Свайп на сусідні дні, повернення з налаштувань,
  // зміни задач (refreshKey) прокрутку не чіпають.
  const jumpSig = `${range}:${jumpToken}`;
  const [doneSig, setDoneSig] = useState<string | null>(null);
  const pending = doneSig !== jumpSig;
  // Поки чекаємо дані для переходу, сітку не показуємо (місце те саме — без стрибка висоти),
  // щоб не було видно, як вона їде від 00:00.
  const hidden = pending && !ready;

  // Свіжі значення для ResizeObserver, який живе весь час.
  const latest = useRef({ pending, ready, dates, tasks, jumpSig });
  latest.current = { pending, ready, dates, tasks, jumpSig };

  /** Ставить scrollTop, якщо сітку вже видно. true — перехід зроблено. */
  function tryJump(): boolean {
    const el = scrollRef.current;
    const s = latest.current;
    if (!el || !s.pending || !s.ready) return false;
    if (el.clientHeight === 0) return false; // вкладка схована (display: none) — зробимо, коли з'явиться
    const starts = s.dates.flatMap((d) => (s.tasks[d] ?? []).map((t) => timeToMinutes(t.startTime)));
    el.scrollTop = initialScrollTop(starts, hourHeightRef.current);
    setDoneSig(s.jumpSig);
    return true;
  }

  // До першого малювання, без плавної прокрутки.
  useLayoutEffect(() => {
    tryJump();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, ready, jumpSig]);

  // Календар міг змонтуватися на схованій вкладці «Задачі»/«Нотатки» — перейти, щойно з'явиться.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      tryJump();
    });
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="overflow-hidden rounded-xl2 border border-line bg-panel shadow-card">
      {/* pan-y: браузер сам лише прокручує по вертикалі, щипок віддає нам (useCalendarZoom) */}
      <div
        ref={scrollRef}
        className="h-[65vh] min-h-[320px] overflow-y-auto"
        style={{ touchAction: "pan-y" }}
      >
        <div className={hidden ? "invisible" : undefined}>
          <div
            ref={headerRef}
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

          <div className="grid" style={{ gridTemplateColumns: cols, height: dayHeight(hourHeight) }}>
            <div className="relative">
              {HOURS.slice(1).map((h) => (
                <span
                  key={h}
                  className="absolute right-1.5 -translate-y-1/2 text-[10px] text-muted"
                  style={{ top: h * hourHeight }}
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
                    `${hourHeight - 1}px, rgb(var(--c-line)) ${hourHeight - 1}px, rgb(var(--c-line)) ${hourHeight}px)`,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
