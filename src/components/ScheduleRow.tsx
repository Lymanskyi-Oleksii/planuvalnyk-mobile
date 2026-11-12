import { useEffect, useState } from "react";
import { Checkbox } from "./Checkbox";
import { CategoryBadge } from "./CategoryBadge";
import { useBackHandler } from "@/lib/backButton";
import type { ScheduledTask, SeriesScope } from "@/types";

const RAIL_COLORS: Record<string, string> = {
  study: "bg-category-study-fg",
  university: "bg-category-university-fg",
  work: "bg-category-work-fg",
  sport: "bg-category-sport-fg",
  food: "bg-category-food-fg",
  health: "bg-category-health-fg",
  personal: "bg-category-personal-fg",
  errands: "bg-category-errands-fg",
  other: "bg-category-other-fg",
};

const ROW_TINTS: Record<string, string> = {
  study: "bg-category-study-bg/60",
  university: "bg-category-university-bg/60",
  work: "bg-category-work-bg/60",
  sport: "bg-category-sport-bg/60",
  food: "bg-category-food-bg/60",
  health: "bg-category-health-bg/60",
  personal: "bg-category-personal-bg/60",
  errands: "bg-category-errands-bg/60",
  other: "bg-category-other-bg/60",
};

interface ScheduleRowProps {
  task: ScheduledTask;
  onToggleTask: (id: string, done: boolean) => void;
  onToggleSubtask: (id: string, done: boolean) => void;
  onEdit: (task: ScheduledTask) => void;
  onDelete: (task: ScheduledTask, scope: SeriesScope) => void;
}

// Значок повторюваної задачі біля часу
function RepeatIcon() {
  return (
    <svg viewBox="0 0 16 16" className="ml-1 inline h-3.5 w-3.5 shrink-0 align-[-2px]" fill="none" aria-label="Повторюється щотижня">
      <title>Повторюється щотижня</title>
      <path
        d="M3 7.5V6.5A2.5 2.5 0 0 1 5.5 4H12M10 2l2 2-2 2M13 8.5v1A2.5 2.5 0 0 1 10.5 12H4m2 2-2-2 2-2"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ScheduleRow({ task, onToggleTask, onToggleSubtask, onEdit, onDelete }: ScheduleRowProps) {
  const [expanded, setExpanded] = useState(true);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const hasSubtasks = task.subtasks.length > 0;
  // «Назад» скасовує підтвердження видалення
  useBackHandler(confirmingDelete, () => setConfirmingDelete(false));

  // Коли задачу позначено виконаною — згортаємо список підзадач,
  // щоб рядок одразу виглядав завершеним і не займав місце деталями,
  // які вже неактуальні. Користувач все ще може розгорнути вручну.
  useEffect(() => {
    if (task.done) setExpanded(false);
  }, [task.done]);

  // Коли основна задача виконана — підзадачі показуємо позначеними теж
  // (лише візуально, поточний стан кожної підзадачі не перезаписуємо,
  // тож якщо зняти позначку з основної задачі — підзадачі повернуться
  // до того, як були насправді).
  const effectiveSubtaskDone = (done: boolean) => task.done || done;
  const doneSubtasksCount = task.done ? task.subtasks.length : task.subtasks.filter((s) => s.done).length;

  // Спільний клас для тексту в межах рядка виконаної задачі — щоб
  // перекреслювався не тільки заголовок, а весь рядок (час, підзадачі/деталі).
  // Окремий токен `done` (а не загальний `muted`) — щоб стан "завершено"
  // був явним семантичним кольором, а не побічним ефектом приглушеного тексту.
  const doneText = task.done ? "text-done-fg line-through" : "";

  // Смужка категорії гасне до нейтрального кольору, коли задача виконана —
  // інакше вона лишається яскравою на фоні приглушеного рядка.
  const railClass = task.done ? "bg-line" : RAIL_COLORS[task.category];

  const editDeleteButtons = (
    <>
      <button
        onClick={() => onEdit(task)}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-canvas hover:text-ink sm:h-7 sm:w-7"
        aria-label="Редагувати задачу"
      >
        <svg viewBox="0 0 16 16" className="h-4 w-4 sm:h-3.5 sm:w-3.5" fill="none">
          <path d="M11 2l3 3-8 8H3v-3l8-8Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
        </svg>
      </button>
      {confirmingDelete && task.seriesId ? (
        // Задача із серії: питаємо, видалити лише цю копію чи цю й наступні
        <div
          className="flex shrink-0 items-center gap-1"
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setConfirmingDelete(false);
          }}
        >
          <button
            autoFocus
            onClick={() => onDelete(task, "one")}
            className="flex h-8 items-center rounded-lg bg-danger-soft px-2 text-xs font-medium text-danger sm:h-7"
          >
            Лише цю
          </button>
          <button
            onClick={() => onDelete(task, "following")}
            className="flex h-8 items-center rounded-lg bg-danger-soft px-2 text-xs font-medium text-danger sm:h-7"
          >
            І наступні
          </button>
        </div>
      ) : (
      <button
        onClick={() => (confirmingDelete ? onDelete(task, "one") : setConfirmingDelete(true))}
        onBlur={() => setConfirmingDelete(false)}
        className={`flex h-8 shrink-0 items-center justify-center rounded-lg px-2 text-xs font-medium transition-colors sm:h-7 ${
          confirmingDelete
            ? "bg-danger-soft text-danger"
            : "w-8 text-muted hover:bg-canvas hover:text-danger sm:w-7"
        }`}
        aria-label="Видалити задачу"
      >
        {confirmingDelete ? (
          "Так?"
        ) : (
          <svg viewBox="0 0 16 16" className="h-4 w-4 sm:h-3.5 sm:w-3.5" fill="none">
            <path d="M3 5h10M6.5 5V3.5h3V5M5 5v8.5h6V5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
      )}
    </>
  );

  const subtasksOrDetails = hasSubtasks ? (
    <>
      <button
        onClick={() => setExpanded((e) => !e)}
        className={`flex items-center gap-1 text-xs font-medium ${task.done ? doneText : "text-muted"}`}
        aria-label={expanded ? "Згорнути підзадачі" : "Розгорнути підзадачі"}
      >
        Підзадачі ({doneSubtasksCount}/{task.subtasks.length})
        <svg
          viewBox="0 0 16 16"
          className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none"
        >
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {expanded && (
        <ul className="mt-2 space-y-2">
          {task.subtasks.map((s) => {
            const checked = effectiveSubtaskDone(s.done);
            return (
              <li key={s.id} className="flex items-center gap-2.5">
                <Checkbox
                  size="sm"
                  checked={checked}
                  onChange={(v) => {
                    onToggleSubtask(s.id, v);
                    // Якщо знімаємо галочку з підзадачі, поки основна задача
                    // позначена виконаною — знімаємо позначку і з неї, бо
                    // "виконано" вже не відповідає дійсності.
                    if (task.done && !v) onToggleTask(task.id, false);
                  }}
                />
                <span className={`text-sm transition-colors ${checked ? "text-done-fg line-through" : "text-ink/90"}`}>{s.title}</span>
              </li>
            );
          })}
        </ul>
      )}
    </>
  ) : task.details ? (
    <p className={`text-sm ${task.done ? doneText : "text-muted"}`}>{task.details}</p>
  ) : null;

  return (
    <>
      {/* Мобільна картка */}
      <div
        className={`border-b border-line p-4 transition-colors sm:hidden ${task.done ? "bg-done-bg" : ROW_TINTS[task.category]}`}
      >
        <div className="flex items-start gap-3">
          <Checkbox checked={task.done} onChange={(v) => onToggleTask(task.id, v)} />
          <div className="min-w-0 flex-1">
            {/* Назва зліва, дії — вгорі справа */}
            <div className="flex items-start justify-between gap-2">
              <span className={`min-w-0 break-words pt-0.5 text-sm font-semibold transition-colors ${task.done ? doneText : "text-ink"}`}>
                {task.title}
              </span>
              <div className="-mr-1.5 -mt-1 flex shrink-0 items-center gap-0.5">{editDeleteButtons}</div>
            </div>

            {/* Час і категорія — рядком нижче */}
            <div className={`mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 ${task.done ? "opacity-70" : ""}`}>
              <span className={`text-xs font-medium transition-colors ${task.done ? doneText : "text-muted"}`}>
                {task.startTime}–{task.endTime}
                {task.seriesId && <RepeatIcon />}
              </span>
              <CategoryBadge category={task.category} muted={task.done} />
            </div>

            {subtasksOrDetails && <div className="mt-2.5">{subtasksOrDetails}</div>}
          </div>
        </div>
      </div>

      {/* Десктопна таблиця */}
      <div
        className={`group hidden border-b border-line transition-colors sm:grid sm:grid-cols-[66px_140px_1fr_1.4fr_72px] ${
          task.done ? "bg-done-bg" : ROW_TINTS[task.category]
        }`}
      >
        <div className="flex items-center justify-center px-3 py-4">
          <Checkbox checked={task.done} onChange={(v) => onToggleTask(task.id, v)} />
        </div>

        <div className={`relative flex items-center py-4 pl-4 pr-3 text-sm transition-colors ${task.done ? doneText : "text-ink"}`}>
          <span className={`absolute left-0 top-2 bottom-2 w-[3px] rounded-full transition-colors ${railClass}`} />
          {task.startTime}–{task.endTime}
          {task.seriesId && <RepeatIcon />}
        </div>

        <div className={`flex flex-col justify-center gap-1.5 py-4 pr-4 ${task.done ? "opacity-70" : ""}`}>
          <span className={`text-sm font-semibold transition-colors ${task.done ? doneText : "text-ink"}`}>{task.title}</span>
          <CategoryBadge category={task.category} muted={task.done} />
        </div>

        <div className="py-4 pr-6">{subtasksOrDetails}</div>

        <div className="flex items-start justify-end gap-1 py-4 pr-3 opacity-0 transition-opacity group-hover:opacity-100">
          {editDeleteButtons}
        </div>
      </div>
    </>
  );
}