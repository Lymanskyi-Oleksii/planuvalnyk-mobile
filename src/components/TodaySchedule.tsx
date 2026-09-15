import { ScheduleRow } from "./ScheduleRow";
import { formatDayName, formatLongDate, isToday } from "@/lib/date";
import type { ScheduledTask } from "@/types";

interface TodayScheduleProps {
  date: string;
  tasks: ScheduledTask[];
  onPrevDay: () => void;
  onNextDay: () => void;
  onToggleTask: (id: string, done: boolean) => void;
  onToggleSubtask: (id: string, done: boolean) => void;
  onAddTask: () => void;
  onEditTask: (task: ScheduledTask) => void;
  onDeleteTask: (id: string) => void;
}

export function TodaySchedule({
  date,
  tasks,
  onPrevDay,
  onNextDay,
  onToggleTask,
  onToggleSubtask,
  onAddTask,
  onEditTask,
  onDeleteTask,
}: TodayScheduleProps) {
  return (
    <section className="flex flex-col rounded-xl2 border border-line bg-panel shadow-card">
      <header className="flex flex-col gap-3 border-b border-line px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
              <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
              <path d="M3 9.5H21" stroke="currentColor" strokeWidth="1.6" />
              <path d="M8 3V6.5M16 3V6.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold text-ink sm:text-xl">
              {isToday(date) ? "Сьогодні" : formatDayName(date)}
            </h1>
            <p className="truncate text-sm text-muted">
              {formatDayName(date)}, {formatLongDate(date)}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 sm:justify-end">
          <button
            onClick={onAddTask}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent/90 sm:w-auto sm:py-1.5 sm:text-xs"
          >
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" fill="none">
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            Додати задачу
          </button>
          {/* На телефоні дні перемикаються смужкою тижня, тому стрілки тут лише на великих екранах */}
          <div className="hidden shrink-0 items-center gap-2 sm:flex">
            <span className="mx-1 h-5 w-px bg-line" />
            <button
              onClick={onPrevDay}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line text-muted hover:bg-canvas"
              aria-label="Попередній день"
            >
              <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none">
                <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              onClick={onNextDay}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line text-muted hover:bg-canvas"
              aria-label="Наступний день"
            >
              <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none">
                <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <div className="hidden border-b border-line bg-canvas/60 px-0 py-3 text-xs font-medium uppercase tracking-wide text-muted sm:grid sm:grid-cols-[66px_140px_1fr_1.4fr_72px]">
        <div className="px-3 text-center">Статус</div>
        <div className="px-3 text-center">Час</div>
        <div>Задача</div>
        <div className="pr-6">Підзадачі / Деталі</div>
        <div />
      </div>

      {tasks.length === 0 ? (
        <div className="px-6 py-12 text-center text-sm text-muted">
          На цей день ще немає запланованих задач.
        </div>
      ) : (
        <div>
          {tasks.map((task) => (
            <ScheduleRow
              key={task.id}
              task={task}
              onToggleTask={onToggleTask}
              onToggleSubtask={onToggleSubtask}
              onEdit={onEditTask}
              onDelete={onDeleteTask}
            />
          ))}
        </div>
      )}
    </section>
  );
}
