import { useRef } from "react";
import type { TouchEvent } from "react";

interface SwipeHandlers {
  onTouchStart: (e: TouchEvent) => void;
  onTouchEnd: (e: TouchEvent) => void;
}

/**
 * Розпізнає горизонтальний свайп (вліво/вправо), ігноруючи переважно
 * вертикальні жести, щоб не заважати звичайному скролу списку.
 * Жест, у якому хоч раз було два пальці (щипок у календарі), — не свайп.
 */
export function useHorizontalSwipe(
  onSwipeLeft: () => void,
  onSwipeRight: () => void,
  threshold = 50,
): SwipeHandlers {
  const start = useRef<{ x: number; y: number } | null>(null);
  const multi = useRef(false);

  function onTouchStart(e: TouchEvent) {
    if (e.touches.length > 1) {
      multi.current = true;
      start.current = null;
      return;
    }
    multi.current = false;
    const t = e.touches[0];
    start.current = { x: t.clientX, y: t.clientY };
  }

  function onTouchEnd(e: TouchEvent) {
    if (multi.current) {
      if (e.touches.length === 0) multi.current = false; // усі пальці підняли — жест скінчився
      return;
    }
    const s = start.current;
    start.current = null;
    if (!s) return;

    const t = e.changedTouches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;

    if (Math.abs(dx) < threshold) return;
    if (Math.abs(dx) < Math.abs(dy) * 1.3) return; // це вертикальний скрол, а не свайп

    if (dx < 0) onSwipeLeft();
    else onSwipeRight();
  }

  return { onTouchStart, onTouchEnd };
}
