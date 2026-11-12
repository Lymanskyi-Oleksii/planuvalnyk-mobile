import { useEffect, useRef, useState } from "react";
import { Checkbox } from "./Checkbox";
import { Toggle } from "./Toggle";
import { leadLabel, loadSettings } from "@/lib/settings";
import { addDays, fromISODate } from "@/lib/date";
import { useBackHandler } from "@/lib/backButton";
import { findOverlap } from "@/lib/overlap";
import { getSeriesTasksFrom, getTasksOnDates } from "@/db/database";
import { CATEGORY_LABELS, type Category, type ScheduledTask, type SeriesScope, type SubtaskDraft } from "@/types";

export interface TaskFormValues {
  startTime: string;
  endTime: string;
  title: string;
  category: Category;
  details?: string;
  subtasks: SubtaskDraft[]; // порядок = sort_order
  remind: boolean | null; // null = за загальними налаштуваннями
  remindBeforeMin: number | null; // null = загальне значення
  repeatDates: string[]; // нова задача: інші дні повтору, крім поточного (без накладок)
  skipIds: string[]; // «цю й наступні»: копії з накладками, які не змінюємо
}

interface AddTaskModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (values: TaskFormValues, scope: SeriesScope) => void;
  editingTask?: ScheduledTask | null;
  existingTasks: ScheduledTask[]; // задачі того ж дня, для перевірки накладок
  date: string; // день, на який створюємо задачу
  initialStartTime?: string; // початок нової задачі (за замовчуванням 09:00)
  initialEndTime?: string; // кінець нової задачі (за замовчуванням 10:00)
}

const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABELS) as [Category, string][];

// Дні тижня в порядку Пн–Нд; число — як у Date.getDay()
const WEEKDAYS: [number, string][] = [
  [1, "Пн"],
  [2, "Вт"],
  [3, "Ср"],
  [4, "Чт"],
  [5, "Пт"],
  [6, "Сб"],
  [0, "Нд"],
];

const MAX_REPEAT_COPIES = 200;

/** Підзадача у формі: key — лише для React (у нової підзадачі ще немає id). */
type FormSubtask = SubtaskDraft & { key: string };

let nextSubtaskKey = 0;
function formSubtask(s: SubtaskDraft): FormSubtask {
  return { ...s, key: `s${nextSubtaskKey++}` };
}

// Дні повтору після date до until включно, лише позначені дні тижня
function repeatDatesFor(date: string, until: string, weekdays: number[]): string[] {
  const out: string[] = [];
  if (weekdays.length === 0) return out;
  for (let d = addDays(date, 1); d <= until && out.length < MAX_REPEAT_COPIES; d = addDays(d, 1)) {
    if (weekdays.includes(fromISODate(d).getDay())) out.push(d);
  }
  return out;
}

// 24.11
function shortDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}.${m}`;
}

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function AddTaskModal({
  open,
  onClose,
  onSave,
  editingTask,
  existingTasks,
  date,
  initialStartTime = "09:00",
  initialEndTime = "10:00",
}: AddTaskModalProps) {
  const [title, setTitle] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [category, setCategory] = useState<Category>("other");
  const [details, setDetails] = useState("");
  const [subtasks, setSubtasks] = useState<FormSubtask[]>([]);
  const [subtaskDraft, setSubtaskDraft] = useState("");
  const subtaskInputRef = useRef<HTMLInputElement>(null);
  // null = користувач нічого не міняв, діють загальні налаштування
  const [remindOverride, setRemindOverride] = useState<boolean | null>(null);
  const [leadOverride, setLeadOverride] = useState<number | null>(null);
  // Повтор (лише для нової задачі)
  const [repeatOn, setRepeatOn] = useState(false);
  const [repeatWeekdays, setRepeatWeekdays] = useState<number[]>([]);
  const [repeatUntil, setRepeatUntil] = useState("");
  // Задачі інших днів для перевірки накладок; null — ще не завантажено
  const [otherTasks, setOtherTasks] = useState<ScheduledTask[] | null>(null);
  // Наступні копії серії, яку редагуємо
  const [seriesNext, setSeriesNext] = useState<ScheduledTask[] | null>(null);
  const [checkError, setCheckError] = useState(false);

  const newRepeatDates =
    open && !editingTask && repeatOn ? repeatDatesFor(date, repeatUntil, repeatWeekdays) : [];
  const repeatKey = newRepeatDates.join(",");

  // Нова повторювана задача: задачі на дні повтору
  useEffect(() => {
    if (!repeatKey) return;
    let cancelled = false;
    setOtherTasks(null);
    setCheckError(false);
    getTasksOnDates(repeatKey.split(","))
      .then((tasks) => !cancelled && setOtherTasks(tasks))
      .catch(() => !cancelled && setCheckError(true));
    return () => {
      cancelled = true;
    };
  }, [repeatKey]);

  // Редагування копії серії: наступні копії й задачі на їхні дні
  useEffect(() => {
    if (!open || !editingTask?.seriesId) return;
    let cancelled = false;
    setSeriesNext(null);
    setOtherTasks(null);
    setCheckError(false);
    (async () => {
      const next = await getSeriesTasksFrom(editingTask.seriesId!, addDays(editingTask.date, 1));
      const others = await getTasksOnDates(next.map((t) => t.date));
      if (cancelled) return;
      setSeriesNext(next);
      setOtherTasks(others);
    })().catch(() => !cancelled && setCheckError(true));
    return () => {
      cancelled = true;
    };
  }, [open, editingTask]);

  useEffect(() => {
    if (!open) return;
    if (editingTask) {
      setTitle(editingTask.title);
      setStartTime(editingTask.startTime);
      setEndTime(editingTask.endTime);
      setCategory(editingTask.category);
      setDetails(editingTask.details ?? "");
      setSubtasks(editingTask.subtasks.map((s) => formSubtask({ id: s.id, title: s.title, done: s.done })));
      setRemindOverride(editingTask.remind);
      setLeadOverride(editingTask.remindBeforeMin);
    } else {
      setTitle("");
      setStartTime(initialStartTime);
      setEndTime(initialEndTime);
      setCategory("other");
      setDetails("");
      setSubtasks([]);
      setRemindOverride(null);
      setLeadOverride(null);
    }
    setSubtaskDraft("");
    setRepeatOn(false);
    setRepeatWeekdays([fromISODate(date).getDay()]);
    setRepeatUntil(addDays(date, 28));
  }, [open, editingTask, date, initialStartTime, initialEndTime]);

  useBackHandler(open, onClose);

  if (!open) return null;

  const settings = loadSettings();
  const defaultRemind = settings.enabled && settings.categories.includes(category);
  const remindOn = remindOverride ?? defaultRemind;
  const lead = leadOverride ?? settings.leadMinutes;

  const overlap = findOverlap(startTime, endTime, existingTasks, editingTask?.id);
  const invalidRange = toMinutes(endTime) <= toMinutes(startTime);

  // Дні серії, де новий час накладається на іншу задачу, — їх пропускаємо
  const tasksOn = (d: string) => (otherTasks ?? []).filter((t) => t.date === d);
  const repeatSkipped = invalidRange
    ? []
    : newRepeatDates.filter((d) => findOverlap(startTime, endTime, tasksOn(d)));
  const seriesSkipped = invalidRange
    ? []
    : (seriesNext ?? []).filter((t) => findOverlap(startTime, endTime, tasksOn(t.date), t.id));
  const isSeries = !!editingTask?.seriesId;
  // Поки не перевірено накладки на інших днях, серію не зберігаємо
  const repeatPending = !editingTask && repeatOn && (repeatWeekdays.length === 0 || (repeatKey !== "" && otherTasks === null));
  const seriesPending = isSeries && (seriesNext === null || otherTasks === null);
  const canSave = !!title.trim() && !invalidRange && !overlap && !repeatPending;

  function toggleWeekday(day: number) {
    setRepeatWeekdays((days) => (days.includes(day) ? days.filter((d) => d !== day) : [...days, day]));
  }

  function addSubtaskDraft() {
    if (subtaskDraft.trim()) {
      setSubtasks((s) => [...s, formSubtask({ title: subtaskDraft.trim(), done: false })]);
      setSubtaskDraft("");
    }
    // Фокус лишається в полі — одразу писати наступну
    subtaskInputRef.current?.focus();
  }

  function removeSubtask(i: number) {
    setSubtasks((s) => s.filter((_, idx) => idx !== i));
  }

  function handleSubmit(scope: SeriesScope = "one") {
    if (!canSave) return;
    if (scope === "following" && seriesPending) return;
    // Текст, не доданий кнопкою «+», не губиться — стає останньою підзадачею
    const draft = subtaskDraft.trim();
    onSave(
      {
        startTime,
        endTime,
        title: title.trim(),
        category,
        details: details.trim() || undefined,
        subtasks: [
          ...subtasks.map(({ id, title, done }) => ({ id, title, done })),
          ...(draft ? [{ title: draft, done: false }] : []),
        ],
        remind: remindOverride,
        remindBeforeMin: leadOverride,
        repeatDates: newRepeatDates.filter((d) => !repeatSkipped.includes(d)),
        skipIds: seriesSkipped.map((t) => t.id),
      },
      scope
    );
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-scrim/30 p-6 dark:bg-scrim/60"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-xl2 border border-line bg-panel shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-sm font-semibold text-ink">
            {editingTask ? "Редагувати задачу" : "Нова задача на день"}
          </h2>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-canvas"
            aria-label="Закрити"
          >
            <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto px-5 py-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Назва задачі</label>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Напр. Робота над проєктом"
              className="w-full rounded-lg border border-line px-3 py-2 text-sm text-ink outline-none focus:border-accent"
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-muted">Початок</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-lg border border-line px-3 py-2 text-sm text-ink outline-none focus:border-accent"
              />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-muted">Кінець</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full rounded-lg border border-line px-3 py-2 text-sm text-ink outline-none focus:border-accent"
              />
            </div>
          </div>

          {invalidRange && (
            <p className="text-xs font-medium text-danger">Час завершення має бути пізніше за початок.</p>
          )}
          {!invalidRange && overlap && (
            <p className="text-xs font-medium text-danger">
              Накладається на «{overlap.title}» ({overlap.startTime}–{overlap.endTime}). Змініть час.
            </p>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Категорія</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_OPTIONS.map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setCategory(value)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                    category === value
                      ? "border-accent bg-accent-soft text-accent"
                      : "border-line text-muted hover:border-accent/40"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {!editingTask && (
            <div className="rounded-lg border border-line px-3 py-1">
              <Toggle checked={repeatOn} onChange={setRepeatOn} label="Повторювати щотижня" />
              {repeatOn && (
                <div className="space-y-3 border-t border-line py-2">
                  <div className="flex flex-wrap gap-1.5">
                    {WEEKDAYS.map(([day, label]) => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleWeekday(day)}
                        className={`h-8 w-9 rounded-lg border text-xs font-medium transition-colors ${
                          repeatWeekdays.includes(day)
                            ? "border-accent bg-accent-soft text-accent"
                            : "border-line text-muted hover:border-accent/40"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted">До дати</label>
                    <input
                      type="date"
                      value={repeatUntil}
                      min={addDays(date, 1)}
                      onChange={(e) => e.target.value && setRepeatUntil(e.target.value)}
                      className="w-full rounded-lg border border-line px-3 py-2 text-sm text-ink outline-none focus:border-accent"
                    />
                  </div>
                  {repeatWeekdays.length === 0 ? (
                    <p className="text-xs font-medium text-danger">Позначте хоча б один день тижня.</p>
                  ) : checkError ? (
                    <p className="text-xs font-medium text-danger">Не вдалося перевірити інші дні. Спробуйте ще раз.</p>
                  ) : (
                    <p className="text-xs text-muted">
                      Ще {newRepeatDates.length - repeatSkipped.length} дн. до {shortDate(repeatUntil)}
                      {repeatSkipped.length > 0 && (
                        <span className="font-medium text-danger">
                          {" "}
                          · Пропущено через накладки: {repeatSkipped.map(shortDate).join(", ")}
                        </span>
                      )}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {isSeries && (
            <p className="text-xs text-muted">
              Задача повторюється. «Цю й наступні» змінить також{" "}
              {seriesNext === null ? "…" : seriesNext.length - seriesSkipped.length} наступн. копій
              {seriesSkipped.length > 0 && (
                <span className="font-medium text-danger">
                  {" "}
                  · Без змін через накладки: {seriesSkipped.map((t) => shortDate(t.date)).join(", ")}
                </span>
              )}
              {checkError && <span className="font-medium text-danger"> · Не вдалося перевірити інші дні.</span>}
            </p>
          )}

          <div className="rounded-lg border border-line px-3 py-1">
            <Toggle
              checked={remindOn}
              onChange={setRemindOverride}
              label="Нагадати про цю задачу"
              description={
                settings.enabled
                  ? remindOverride === null
                    ? "Зараз як у налаштуваннях для цієї категорії"
                    : undefined
                  : "Нагадування вимкнені в налаштуваннях застосунку"
              }
              disabled={!settings.enabled}
            />
            {remindOn && settings.enabled && (
              <div className="border-t border-line py-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-medium text-muted">Попередити</span>
                  <span className="text-sm font-semibold text-accent">{leadLabel(lead)}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={120}
                  step={5}
                  value={lead}
                  onChange={(e) => setLeadOverride(Number(e.target.value))}
                  className="mt-1 w-full accent-accent"
                  aria-label="За скільки хвилин попередити"
                />
                {leadOverride !== null && (
                  <button
                    type="button"
                    onClick={() => setLeadOverride(null)}
                    className="text-xs font-medium text-muted underline"
                  >
                    Як у налаштуваннях ({leadLabel(settings.leadMinutes)})
                  </button>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted">
              Підзадачі <span className="font-normal">(необов'язково)</span>
            </label>
            <div className="flex gap-2">
              <input
                ref={subtaskInputRef}
                value={subtaskDraft}
                onChange={(e) => setSubtaskDraft(e.target.value)}
                // «enter», а не «next»: на Android «next» переводить фокус на наступне поле
                enterKeyHint="enter"
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.keyCode === 13) {
                    e.preventDefault();
                    addSubtaskDraft();
                  }
                }}
                placeholder="Напр. Написати HTML"
                className="flex-1 rounded-lg border border-line px-3 py-2 text-sm text-ink outline-none focus:border-accent"
              />
              <button
                type="button"
                // Поле не втрачає фокус — клавіатура не ховається
                onPointerDown={(e) => e.preventDefault()}
                onClick={addSubtaskDraft}
                className="rounded-lg border border-line px-3 text-sm font-medium text-ink hover:bg-canvas"
              >
                +
              </button>
            </div>

            {subtasks.length > 0 && (
              <ul className="mt-2 space-y-1.5">
                {subtasks.map((s, i) => (
                  <li key={s.key} className="flex items-center gap-2">
                    {/* Галочку тут лише видно: ставлять її в розкладі, форма done не змінює */}
                    <Checkbox size="sm" checked={s.done} onChange={() => {}} />
                    <span className={`flex-1 text-sm ${s.done ? "text-muted line-through" : "text-ink"}`}>{s.title}</span>
                    <button
                      onClick={() => removeSubtask(i)}
                      className="text-muted hover:text-ink"
                      aria-label="Видалити підзадачу"
                    >
                      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none">
                        <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {subtasks.length === 0 && (
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">
                Деталі <span className="font-normal">(необов'язково, якщо без підзадач)</span>
              </label>
              <input
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Напр. Пообідати, відпочити"
                className="w-full rounded-lg border border-line px-3 py-2 text-sm text-ink outline-none focus:border-accent"
              />
            </div>
          )}
        </div>

        <footer className="flex justify-end gap-2 border-t border-line px-5 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-canvas"
          >
            Скасувати
          </button>
          {isSeries ? (
            <>
              <button
                onClick={() => handleSubmit("one")}
                disabled={!canSave}
                className="rounded-lg border border-accent px-3 py-2 text-sm font-medium text-accent hover:bg-accent-soft disabled:opacity-40"
              >
                Лише цю
              </button>
              <button
                onClick={() => handleSubmit("following")}
                disabled={!canSave || seriesPending}
                className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-40"
              >
                Цю й наступні
              </button>
            </>
          ) : (
            <button
              onClick={() => handleSubmit()}
              disabled={!canSave}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-40"
            >
              {editingTask ? "Зберегти зміни" : "Додати задачу"}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
