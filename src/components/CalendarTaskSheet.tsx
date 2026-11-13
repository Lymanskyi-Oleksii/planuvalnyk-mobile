import { createPortal } from "react-dom";
import { ScheduleRow } from "./ScheduleRow";
import { useBackHandler } from "@/lib/backButton";
import { formatDayName, formatLongDate } from "@/lib/date";
import type { ScheduledTask, SeriesScope } from "@/types";

interface CalendarTaskSheetProps {
  /** null — панель закрита. */
  task: ScheduledTask | null;
  onClose: () => void;
  onToggleTask: (id: string, done: boolean) => void;
  onToggleSubtask: (task: ScheduledTask, id: string, done: boolean) => void;
  onEdit: (task: ScheduledTask) => void;
  onDelete: (task: ScheduledTask, scope: SeriesScope) => void;
}

// Нижня панель з деталями задачі з календаря: усередині той самий рядок, що й у «Списку».
// Закривається тапом поза панеллю і кнопкою «Назад».
export function CalendarTaskSheet({ task, onClose, onToggleTask, onToggleSubtask, onEdit, onDelete }: CalendarTaskSheetProps) {
  useBackHandler(task !== null, onClose, "day");
  if (!task) return null;

  // Портал: панель поза сіткою, а дотики не доходять до свайпу днів у App.tsx
  const stop = (e: React.TouchEvent) => e.stopPropagation();

  return createPortal(
    <div
      className="fixed inset-0 z-40 flex flex-col justify-end bg-scrim/30 dark:bg-scrim/60"
      onClick={onClose}
      onTouchStart={stop}
      onTouchEnd={stop}
    >
      <div
        role="dialog"
        aria-label={task.title}
        className="max-h-[80vh] overflow-y-auto rounded-t-xl2 border-t border-line bg-panel pb-4 shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-2">
          <span className="h-1 w-10 rounded-full bg-line" />
        </div>
        <p className="px-4 pb-1 pt-2 text-xs font-medium text-muted">
          {formatDayName(task.date)}, {formatLongDate(task.date)}
        </p>
        <ScheduleRow
          key={task.id}
          task={task}
          onToggleTask={onToggleTask}
          onToggleSubtask={(id, done) => onToggleSubtask(task, id, done)}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      </div>
    </div>,
    document.body,
  );
}
