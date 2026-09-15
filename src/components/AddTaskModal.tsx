import { useEffect, useState } from "react";
import { Checkbox } from "./Checkbox";
import { CATEGORY_LABELS, type Category, type ScheduledTask } from "@/types";

export interface TaskFormValues {
  startTime: string;
  endTime: string;
  title: string;
  category: Category;
  details?: string;
  subtasks: string[];
}

interface AddTaskModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (values: TaskFormValues) => void;
  editingTask?: ScheduledTask | null;
  existingTasks: ScheduledTask[]; // задачі того ж дня, для перевірки накладок
}

const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABELS) as [Category, string][];

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function findOverlap(
  start: string,
  end: string,
  tasks: ScheduledTask[],
  excludeId?: string
): ScheduledTask | null {
  const s = toMinutes(start);
  const e = toMinutes(end);
  if (e <= s) return null;
  for (const t of tasks) {
    if (t.id === excludeId) continue;
    const ts = toMinutes(t.startTime);
    const te = toMinutes(t.endTime);
    if (s < te && ts < e) return t;
  }
  return null;
}

export function AddTaskModal({ open, onClose, onSave, editingTask, existingTasks }: AddTaskModalProps) {
  const [title, setTitle] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [category, setCategory] = useState<Category>("other");
  const [details, setDetails] = useState("");
  const [subtasks, setSubtasks] = useState<string[]>([]);
  const [subtaskDraft, setSubtaskDraft] = useState("");

  useEffect(() => {
    if (!open) return;
    if (editingTask) {
      setTitle(editingTask.title);
      setStartTime(editingTask.startTime);
      setEndTime(editingTask.endTime);
      setCategory(editingTask.category);
      setDetails(editingTask.details ?? "");
      setSubtasks(editingTask.subtasks.map((s) => s.title));
    } else {
      setTitle("");
      setStartTime("09:00");
      setEndTime("10:00");
      setCategory("other");
      setDetails("");
      setSubtasks([]);
    }
    setSubtaskDraft("");
  }, [open, editingTask]);

  if (!open) return null;

  const overlap = findOverlap(startTime, endTime, existingTasks, editingTask?.id);
  const invalidRange = toMinutes(endTime) <= toMinutes(startTime);

  function addSubtaskDraft() {
    if (subtaskDraft.trim()) {
      setSubtasks((s) => [...s, subtaskDraft.trim()]);
      setSubtaskDraft("");
    }
  }

  function removeSubtask(i: number) {
    setSubtasks((s) => s.filter((_, idx) => idx !== i));
  }

  function handleSubmit() {
    if (!title.trim() || invalidRange || overlap) return;
    onSave({
      startTime,
      endTime,
      title: title.trim(),
      category,
      details: details.trim() || undefined,
      subtasks,
    });
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-6"
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
            <p className="text-xs font-medium text-red-600">Час завершення має бути пізніше за початок.</p>
          )}
          {!invalidRange && overlap && (
            <p className="text-xs font-medium text-red-600">
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

          <div>
            <label className="mb-1 block text-xs font-medium text-muted">
              Підзадачі <span className="font-normal">(необов'язково)</span>
            </label>
            <div className="flex gap-2">
              <input
                value={subtaskDraft}
                onChange={(e) => setSubtaskDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addSubtaskDraft();
                  }
                }}
                placeholder="Напр. Написати HTML"
                className="flex-1 rounded-lg border border-line px-3 py-2 text-sm text-ink outline-none focus:border-accent"
              />
              <button
                onClick={addSubtaskDraft}
                className="rounded-lg border border-line px-3 text-sm font-medium text-ink hover:bg-canvas"
              >
                +
              </button>
            </div>

            {subtasks.length > 0 && (
              <ul className="mt-2 space-y-1.5">
                {subtasks.map((s, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <Checkbox size="sm" checked={false} onChange={() => {}} />
                    <span className="flex-1 text-sm text-ink">{s}</span>
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
          <button
            onClick={handleSubmit}
            disabled={!title.trim() || invalidRange || !!overlap}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-40"
          >
            {editingTask ? "Зберегти зміни" : "Додати задачу"}
          </button>
        </footer>
      </div>
    </div>
  );
}
