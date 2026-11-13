import { createPortal } from "react-dom";
import { useBackHandler } from "@/lib/backButton";
import type { SeriesScope } from "@/types";

interface MoveScopeDialogProps {
  open: boolean;
  onChoose: (scope: SeriesScope) => void;
  onCancel: () => void;
}

// Перетягнули задачу серії: перенести лише її чи й наступні копії.
export function MoveScopeDialog({ open, onChoose, onCancel }: MoveScopeDialogProps) {
  useBackHandler(open, onCancel);
  if (!open) return null;

  // Портал і stopPropagation: дотики не доходять до свайпу днів у App.tsx
  const stop = (e: React.TouchEvent) => e.stopPropagation();

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-scrim/30 p-6 dark:bg-scrim/60"
      onClick={onCancel}
      onTouchStart={stop}
      onTouchEnd={stop}
    >
      <div
        role="dialog"
        aria-label="Перенести повторювану задачу"
        className="w-full max-w-sm overflow-hidden rounded-xl2 border border-line bg-panel shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pb-3 pt-4">
          <h2 className="text-base font-semibold text-ink">Перенести повторювану задачу</h2>
          <p className="mt-1 text-sm text-muted">
            Змінити лише цю задачу чи також наступні в серії? Дні, де буде накладка, пропускаються.
          </p>
        </div>
        <footer className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-4">
          <button
            onClick={onCancel}
            className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink"
          >
            Скасувати
          </button>
          <button
            onClick={() => onChoose("one")}
            className="rounded-lg border border-accent px-3 py-2 text-sm font-medium text-accent"
          >
            Лише цю
          </button>
          <button
            onClick={() => onChoose("following")}
            className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-on-accent"
          >
            Цю й наступні
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
