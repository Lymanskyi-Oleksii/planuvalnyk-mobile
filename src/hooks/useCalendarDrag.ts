import { useEffect, useRef, useState, type RefObject } from "react";
import { timeToMinutes, topToMinutes } from "@/lib/calendarLayout";
import { findOverlap } from "@/lib/overlap";
import type { ScheduledTask } from "@/types";

/** Довге натискання, після якого блок можна тягнути, мс. */
const LONG_PRESS_MS = 450;
/** Якщо палець зсунувся більше — це прокрутка, а не довге натискання, px. */
const MOVE_TOLERANCE = 8;
/** Крок часу під час перетягування, хв. */
const STEP = 15;
/** Відстань до краю сітки, з якої вона починає сама прокручуватися, px. */
const EDGE = 48;
const LAST_MINUTE = 23 * 60 + 59;

type DragMode = "move" | "resize";

export interface DragState {
  task: ScheduledTask;
  mode: DragMode;
  /** Куди зараз потрапляє блок: день колонки й час, хв від початку доби. */
  date: string;
  start: number;
  end: number;
  /** Накладається на іншу задачу — відпустити тут не можна. */
  conflict: boolean;
}

export interface DropTarget {
  date: string;
  startTime: string;
  endTime: string;
}

export function formatMinutes(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

interface Options {
  scrollRef: RefObject<HTMLDivElement>;
  headerRef: RefObject<HTMLDivElement>;
  hourHeightRef: RefObject<number>;
  /** Задачі дня з видимих колонок — для пошуку задачі й перевірки накладок. */
  getDayTasks: (date: string) => ScheduledTask[];
  /** Чи можна зараз змінювати задачі (без мережі — ні; сам показує картку-помилку). */
  canDrag: () => boolean;
  onDrop: (task: ScheduledTask, target: DropTarget) => void;
}

/**
 * Перетягування блоків у календарі. Довге натискання на блок — перенесення (час і день),
 * довге натискання біля нижнього краю — зміна тривалості. Час іде кроком 15 хв.
 *
 * Обробники — нативні (passive: false): лише так можна скасувати прокрутку під час
 * перетягування. Кінець жесту не доходить до свайпу днів у App.tsx (stopPropagation),
 * а клік, який браузер шле після довгого натискання, ігнорується (isClickSuppressed).
 */
export function useCalendarDrag({ scrollRef, headerRef, hourHeightRef, getDayTasks, canDrag, onDrop }: Options) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const suppressUntil = useRef(0);

  // Свіжі функції для обробників, які ставляться один раз
  const opts = useRef({ getDayTasks, canDrag, onDrop });
  opts.current = { getDayTasks, canDrag, onDrop };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    let press: { id: string; date: string; x: number; y: number; mode: DragMode; timer: number } | null = null;
    let live: (DragState & { grab: number }) | null = null;
    let last = { x: 0, y: 0 };
    let frame = 0;
    // Довге натискання спрацювало (навіть якщо тягнути не можна) — клік після нього не тап
    let longPressed = false;

    const hh = () => hourHeightRef.current ?? 56;

    function cancelPress() {
      if (press) window.clearTimeout(press.timer);
      press = null;
    }

    /** Колонка дня під пальцем; за межами сітки — крайня. */
    function columnAt(x: number): HTMLElement | null {
      const cols = Array.from(el!.querySelectorAll<HTMLElement>("[data-col]"));
      if (cols.length === 0) return null;
      for (const c of cols) {
        const r = c.getBoundingClientRect();
        if (x >= r.left && x < r.right) return c;
      }
      return x < cols[0].getBoundingClientRect().left ? cols[0] : cols[cols.length - 1];
    }

    function minutesAt(col: HTMLElement, y: number): number {
      return topToMinutes(y - col.getBoundingClientRect().top, hh());
    }

    function update() {
      if (!live) return;
      const { task, mode } = live;
      let { date, start, end } = live;
      if (mode === "move") {
        const col = columnAt(last.x);
        if (!col) return;
        date = col.dataset.col!;
        const dur = timeToMinutes(task.endTime) - timeToMinutes(task.startTime);
        start = Math.round((minutesAt(col, last.y) - live.grab) / STEP) * STEP;
        start = Math.min(Math.max(0, start), LAST_MINUTE - dur);
        end = start + dur;
      } else {
        const col = el!.querySelector<HTMLElement>(`[data-col="${task.date}"]`);
        if (!col) return;
        end = Math.round(minutesAt(col, last.y) / STEP) * STEP;
        end = Math.min(Math.max(end, start + STEP), 24 * 60);
        if (end >= 24 * 60) end = LAST_MINUTE; // кінець доби — 23:59, як у формі
        if (end <= start) end = Math.min(start + 1, LAST_MINUTE);
      }
      if (date === live.date && start === live.start && end === live.end) return;
      const conflict = !!findOverlap(formatMinutes(start), formatMinutes(end), opts.current.getDayTasks(date), task.id);
      live = { ...live, date, start, end, conflict };
      setDrag(live);
    }

    // Біля верхнього чи нижнього краю сітка прокручується сама
    function autoScroll() {
      if (!live) return;
      const box = el!.getBoundingClientRect();
      const top = box.top + (headerRef.current?.offsetHeight ?? 0);
      let delta = 0;
      if (last.y < top + EDGE) delta = -Math.ceil(((top + EDGE - last.y) / EDGE) * 12);
      else if (last.y > box.bottom - EDGE) delta = Math.ceil(((last.y - (box.bottom - EDGE)) / EDGE) * 12);
      if (delta !== 0) {
        const before = el!.scrollTop;
        el!.scrollTop = before + delta;
        if (el!.scrollTop !== before) update();
      }
      frame = requestAnimationFrame(autoScroll);
    }

    function startDrag() {
      const p = press;
      press = null;
      if (!p) return;
      longPressed = true;
      if (!opts.current.canDrag()) return;
      const task = opts.current.getDayTasks(p.date).find((t) => t.id === p.id);
      const col = el!.querySelector<HTMLElement>(`[data-col="${p.date}"]`);
      if (!task || !col) return;
      const start = timeToMinutes(task.startTime);
      const end = timeToMinutes(task.endTime);
      live = {
        task,
        mode: p.mode,
        date: p.date,
        start,
        end,
        conflict: false,
        grab: minutesAt(col, p.y) - start,
      };
      last = { x: p.x, y: p.y };
      el!.style.overflowY = "hidden"; // прокрутку веде лише автопрокрутка
      try {
        navigator.vibrate?.(15);
      } catch {
        // без вібрації
      }
      setDrag(live);
      frame = requestAnimationFrame(autoScroll);
    }

    /** restoreScroll = false: прокрутку щойно заблокував щипок, не знімати. */
    function stopDrag(drop: boolean, restoreScroll = true) {
      const d = live;
      live = null;
      cancelAnimationFrame(frame);
      if (restoreScroll) el!.style.overflowY = "";
      setDrag(null);
      suppressUntil.current = Date.now() + 500;
      if (!drop || !d || d.conflict) return;
      const { task } = d;
      const moved =
        d.date !== task.date || d.start !== timeToMinutes(task.startTime) || d.end !== timeToMinutes(task.endTime);
      if (!moved) return;
      opts.current.onDrop(task, { date: d.date, startTime: formatMinutes(d.start), endTime: formatMinutes(d.end) });
    }

    function onTouchStart(e: TouchEvent) {
      if (e.touches.length !== 1) {
        // Другий палець — це щипок (масштаб), не перетягування
        cancelPress();
        if (live) stopDrag(false, false);
        return;
      }
      const block = (e.target as HTMLElement).closest<HTMLElement>("[data-task]");
      if (!block || !el!.contains(block)) return;
      const t = e.touches[0];
      const r = block.getBoundingClientRect();
      // Нижній край блока — зміна тривалості (лише якщо блок не надто низький)
      const grip = Math.min(16, r.height * 0.3);
      const mode: DragMode = r.height >= 24 && t.clientY >= r.bottom - grip ? "resize" : "move";
      cancelPress();
      press = {
        id: block.dataset.task!,
        date: block.dataset.taskDate!,
        x: t.clientX,
        y: t.clientY,
        mode,
        timer: window.setTimeout(startDrag, LONG_PRESS_MS),
      };
    }

    function onTouchMove(e: TouchEvent) {
      if (live) {
        if (e.cancelable) e.preventDefault();
        const t = e.touches[0];
        last = { x: t.clientX, y: t.clientY };
        update();
        return;
      }
      if (press) {
        const t = e.touches[0];
        if (Math.hypot(t.clientX - press.x, t.clientY - press.y) > MOVE_TOLERANCE) cancelPress();
      }
    }

    function onTouchEnd(e: TouchEvent) {
      cancelPress();
      if (longPressed && e.touches.length === 0) {
        longPressed = false;
        suppressUntil.current = Date.now() + 500;
      }
      if (!live) return;
      e.stopPropagation(); // не свайп днів
      if (e.cancelable) e.preventDefault(); // і без кліку після жесту
      stopDrag(e.type === "touchend");
    }

    // Довге натискання у WebView може відкрити контекстне меню
    function onContextMenu(e: Event) {
      if (press || live || (e.target as HTMLElement).closest("[data-task]")) e.preventDefault();
    }

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: false });
    el.addEventListener("touchcancel", onTouchEnd, { passive: false });
    el.addEventListener("contextmenu", onContextMenu);
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
      el.removeEventListener("contextmenu", onContextMenu);
      cancelPress();
      if (live) stopDrag(false);
    };
  }, [scrollRef, headerRef, hourHeightRef]);

  return {
    drag,
    /** Клік одразу після перетягування — частина жесту, а не тап. */
    isClickSuppressed: () => Date.now() < suppressUntil.current,
  };
}
