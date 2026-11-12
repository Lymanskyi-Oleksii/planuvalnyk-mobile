import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useCalendarZoom } from "@/hooks/useCalendarZoom";
import { useRangeTasks } from "@/hooks/useRangeTasks";
import { blockRect, dayHeight, initialScrollTop, minutesToTop, overlapLanes, timeToMinutes, topToMinutes } from "@/lib/calendarLayout";
import { rangeDates } from "@/lib/calendarRange";
import { isToday } from "@/lib/date";
import { CATEGORY_COLORS } from "@/lib/reminderPlan";
import type { CalendarRange } from "@/lib/settings";
import { WEEKDAY_SHORT, dayOfMonth, parseISO } from "@/lib/week";
import type { ScheduledTask, SeriesScope } from "@/types";
import { CalendarTaskSheet } from "./CalendarTaskSheet";

interface CalendarViewProps {
  date: string;
  range: CalendarRange;
  refreshKey: number;
  /** Збільшується кнопкою «Сьогодні» — знову перейти до першої задачі. */
  jumpToken: number;
  /** Збережений масштаб (висота години, px). */
  hourHeight: number;
  onToggleTask: (id: string, done: boolean) => void;
  /** Задача передається цілком: вона може бути не з активного дня. */
  onToggleSubtask: (task: ScheduledTask, id: string, done: boolean) => void;
  /** dayTasks — задачі дня цієї задачі, для перевірки накладок у формі. */
  onEditTask: (task: ScheduledTask, dayTasks: ScheduledTask[]) => void;
  onDeleteTask: (task: ScheduledTask, scope: SeriesScope) => void;
  /** Тап по порожньому місцю колонки: день, його задачі, початок і кінець (HH:MM). */
  onCreateAt: (slot: { date: string; tasks: ScheduledTask[]; start: string; end: string }) => void;
}

function formatMinutes(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

const HOURS = Array.from({ length: 24 }, (_, h) => h);

function currentMinutes(): number {
  const n = new Date();
  return n.getHours() * 60 + n.getMinutes();
}

/** Відступ блока від країв колонки й від сусідніх блоків, px. */
const GAP = 2;

interface TaskBlockProps {
  task: ScheduledTask;
  hourHeight: number;
  lane: number;
  lanes: number;
  compact: boolean;
  onOpen: () => void;
}

// Блок задачі в колонці дня: залитий кольором категорії, білий текст.
function TaskBlock({ task, hourHeight, lane, lanes, compact, onOpen }: TaskBlockProps) {
  const { top, height } = blockRect(task.startTime, task.endTime, hourHeight);
  const short = timeToMinutes(task.endTime) - timeToMinutes(task.startTime) < 30;
  // Час — лише для задач від 30 хв і не в режимі «Тиждень»
  const showTime = !short && !compact;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation(); // не створювати задачу під блоком
        onOpen();
      }}
      className={`absolute z-10 overflow-hidden rounded-md text-left ${
        task.done ? "bg-done-bg text-done-fg" : "text-white"
      } ${compact ? "px-1 py-0.5" : "px-1.5 py-0.5"}`}
      style={{
        top: top + GAP / 2,
        height: Math.max(height - GAP, 4),
        left: `calc(${(lane / lanes) * 100}% + ${GAP}px)`,
        width: `calc(${100 / lanes}% - ${GAP * 2}px)`,
        backgroundColor: task.done ? undefined : CATEGORY_COLORS[task.category],
      }}
    >
      <span
        className={`block font-semibold ${compact ? "text-[10px] leading-tight" : "text-xs leading-snug"} ${
          short ? "truncate" : "break-words"
        } ${task.done ? "line-through" : ""}`}
      >
        {task.title}
      </span>
      {showTime && (
        <span className="block truncate text-[11px] leading-snug opacity-90">
          {task.startTime}–{task.endTime}
        </span>
      )}
    </button>
  );
}

// Погодинна сітка. Шапка днів — sticky всередині того ж контейнера прокрутки, що й сітка:
// повзунок звужує обидві однаково, тож колонки шапки й сітки збігаються.
export function CalendarView({
  date,
  range,
  refreshKey,
  jumpToken,
  hourHeight: savedHourHeight,
  onToggleTask,
  onToggleSubtask,
  onEditTask,
  onDeleteTask,
  onCreateAt,
}: CalendarViewProps) {
  const dates = rangeDates(date, range);
  const { tasks, ready } = useRangeTasks(dates, refreshKey);
  const scrollRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const { hourHeight, hourHeightRef } = useCalendarZoom(scrollRef, headerRef, savedHourHeight);

  // Відкрита в нижній панелі задача. Береться зі свіжих даних, тож галочки й редагування
  // одразу видно в панелі; якщо задачу видалили — панель закривається.
  const [opened, setOpened] = useState<{ id: string; date: string } | null>(null);
  const openedTask = opened ? (tasks[opened.date] ?? []).find((t) => t.id === opened.id) ?? null : null;

  const cols = `44px repeat(${dates.length}, minmax(0, 1fr))`;

  // Поточний час для червоної лінії: раз на хвилину і при поверненні в застосунок.
  const [nowMin, setNowMin] = useState(currentMinutes);
  useEffect(() => {
    const update = () => setNowMin(currentMinutes());
    const timer = setInterval(update, 60_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") update();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("tauri://resumed", update);
    update();
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("tauri://resumed", update);
    };
  }, []);

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
            {dates.map((d) => {
              const dayTasks = tasks[d] ?? [];
              const lanes = overlapLanes(dayTasks);
              return (
                <div
                  key={d}
                  data-date={d}
                  className="relative border-l border-line"
                  onClick={(e) => {
                    // Початок — за місцем тапу, округлений вниз до 30 хв; тривалість 1 година
                    const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
                    const start = Math.min(Math.floor(topToMinutes(y, hourHeight) / 30) * 30, 23 * 60 + 30);
                    const end = Math.min(start + 60, 23 * 60 + 59);
                    onCreateAt({ date: d, tasks: dayTasks, start: formatMinutes(start), end: formatMinutes(end) });
                  }}
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(to bottom, transparent 0, transparent " +
                      `${hourHeight - 1}px, rgb(var(--c-line)) ${hourHeight - 1}px, rgb(var(--c-line)) ${hourHeight}px)`,
                  }}
                >
                  {dayTasks.map((t) => {
                    const place = lanes.get(t.id) ?? { lane: 0, lanes: 1 };
                    return (
                      <TaskBlock
                        key={t.id}
                        task={t}
                        hourHeight={hourHeight}
                        lane={place.lane}
                        lanes={place.lanes}
                        compact={range === 7}
                        onOpen={() => setOpened({ id: t.id, date: d })}
                      />
                    );
                  })}
                  {isToday(d) && (
                    <div
                      className="pointer-events-none absolute right-0 left-0 z-10 h-0.5 -translate-y-1/2 bg-danger"
                      style={{ top: minutesToTop(nowMin, hourHeight) }}
                    >
                      <span className="absolute -top-[3px] -left-1 h-2 w-2 rounded-full bg-danger" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <CalendarTaskSheet
        task={openedTask}
        onClose={() => setOpened(null)}
        onToggleTask={onToggleTask}
        onToggleSubtask={onToggleSubtask}
        onEdit={(t) => onEditTask(t, tasks[t.date] ?? [])}
        onDelete={onDeleteTask}
      />
    </section>
  );
}
