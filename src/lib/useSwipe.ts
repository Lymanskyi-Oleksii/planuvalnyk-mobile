import { useRef } from "react";
import type { TouchEvent } from "react";

interface SwipeHandlers {
  onTouchStart: (e: TouchEvent) => void;
  onTouchEnd: (e: TouchEvent) => void;
}

/**
 * Розпізнає горизонтальний свайп (вліво/вправо), ігноруючи переважно
 * вертикальні жести, щоб не заважати звичайному скролу списку.
 */
export function useHorizontalSwipe(
  onSwipeLeft: () => void,
  onSwipeRight: () => void,
  threshold = 50,
): SwipeHandlers {
  const start = useRef<{ x: number; y: number } | null>(null);

  function onTouchStart(e: TouchEvent) {
    const t = e.touches[0];
    start.current = { x: t.clientX, y: t.clientY };
  }

  function onTouchEnd(e: TouchEvent) {
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
