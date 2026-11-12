import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { clampHourHeight, minutesToTop, topToMinutes } from "@/lib/calendarLayout";
import { saveView } from "@/lib/settings";

/**
 * Масштаб календаря (висота години) щипком двома пальцями. Час під пальцями лишається
 * на тому ж місці екрана.
 * Під час щипка сітка не прокручується (overflow: hidden), а WebView не масштабує сторінку
 * (touch-action: pan-y на контейнері + preventDefault). Значення зберігається в
 * planner.view.v1 після жесту.
 *
 * scrollRef — контейнер прокрутки; headerRef — sticky-шапка днів над сіткою.
 */
export function useCalendarZoom(
  scrollRef: RefObject<HTMLDivElement>,
  headerRef: RefObject<HTMLDivElement>,
  savedHourHeight: number,
) {
  const [hourHeight, setHourHeight] = useState(savedHourHeight);
  // Джерело правди між подіями: touchmove приходить частіше, ніж React встигає малювати.
  const hhRef = useRef(savedHourHeight);
  // scrollTop, який треба поставити після того, як сітка перемалюється з новою висотою.
  const pendingScroll = useRef<number | null>(null);

  // Масштаб змінили деінде (інше вікно налаштувань тощо) — підхопити.
  useEffect(() => {
    if (savedHourHeight !== hhRef.current) {
      hhRef.current = savedHourHeight;
      setHourHeight(savedHourHeight);
    }
  }, [savedHourHeight]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && pendingScroll.current !== null) {
      el.scrollTop = pendingScroll.current;
      pendingScroll.current = null;
    }
  }, [hourHeight, scrollRef]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    /** Новий масштаб з якорем у точці clientY (час під нею не зсувається). */
    function zoomTo(next: number, clientY: number) {
      const box = scrollRef.current;
      if (!box) return;
      const target = clampHourHeight(next);
      const prev = hhRef.current;
      if (Math.abs(target - prev) < 0.1) return;
      const headerH = headerRef.current?.offsetHeight ?? 0;
      const y = clientY - box.getBoundingClientRect().top; // точка всередині видимої області
      // Якщо попередній крок ще не намальовано — рахувати від запланованої прокрутки.
      const scrollTop = pendingScroll.current ?? box.scrollTop;
      const minutes = Math.min(24 * 60, Math.max(0, topToMinutes(scrollTop + y - headerH, prev)));
      pendingScroll.current = Math.max(0, minutesToTop(minutes, target) + headerH - y);
      hhRef.current = target;
      setHourHeight(target);
    }

    // Без округлення: інакше після збереження сітка сіпнулася б на частку пікселя на годину.
    const commit = () => saveView({ hourHeight: hhRef.current });

    // ── Щипок ──
    let pinch: { dist: number; hh: number } | null = null;

    const distance = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const midY = (t: TouchList) => (t[0].clientY + t[1].clientY) / 2;

    function endPinch() {
      if (!pinch) return;
      pinch = null;
      if (el) el.style.overflowY = "";
      commit();
    }

    function onTouchStart(e: TouchEvent) {
      if (e.touches.length !== 2) return;
      const dist = distance(e.touches);
      if (dist < 10) return;
      pinch = { dist, hh: hhRef.current };
      // Зупинити прокрутку, яку міг почати перший палець
      el!.style.overflowY = "hidden";
      if (e.cancelable) e.preventDefault();
    }

    function onTouchMove(e: TouchEvent) {
      if (!pinch) return;
      if (e.cancelable) e.preventDefault();
      if (e.touches.length < 2) return;
      zoomTo(pinch.hh * (distance(e.touches) / pinch.dist), midY(e.touches));
    }

    function onTouchEnd(e: TouchEvent) {
      if (pinch && e.touches.length < 2) endPinch();
    }

    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("touchcancel", onTouchEnd);
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
      if (pinch) endPinch();
    };
  }, [scrollRef, headerRef]);

  return { hourHeight, hourHeightRef: hhRef };
}
