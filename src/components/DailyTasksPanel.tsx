import { useState } from "react";
import { Checkbox } from "./Checkbox";
import type { DailyTask } from "@/types";

interface DailyTasksPanelProps {
  tasks: DailyTask[];
  onToggle: (id: string, done: boolean) => void;
  onAdd: (title: string) => void;
  onEdit: (id: string, title: string) => void;
  onDelete: (id: string) => void;
}

export function DailyTasksPanel({ tasks, onToggle, onAdd, onEdit, onDelete }: DailyTasksPanelProps) {
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");

  function submit() {
    if (draft.trim()) {
      onAdd(draft);
      setDraft("");
    }
    setAdding(false);
  }

  function startEdit(task: DailyTask) {
    setEditingId(task.id);
    setEditDraft(task.title);
  }

  function submitEdit() {
    if (editingId) onEdit(editingId, editDraft);
    setEditingId(null);
  }

  return (
    <section className="flex flex-col rounded-xl2 border border-line bg-panel shadow-card">
      <header className="flex items-center justify-between border-b border-line px-5 py-4">
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 24 24" className="h-4 w-4 text-accent" fill="none">
            <rect x="3.5" y="3.5" width="17" height="17" rx="4" stroke="currentColor" strokeWidth="1.5" />
            <path d="M8 12l2.5 2.5L16 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <h2 className="text-sm font-semibold text-ink">Задачі на день</h2>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-canvas"
        >
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none">
            <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          Додати
        </button>
      </header>

      <ul className="flex-1 space-y-1 p-3">
        {tasks.map((task) =>
          editingId === task.id ? (
            <li key={task.id} className="flex items-center gap-3 rounded-lg px-2 py-2">
              <Checkbox checked={task.done} onChange={(v) => onToggle(task.id, v)} />
              <input
                autoFocus
                value={editDraft}
                onChange={(e) => setEditDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitEdit()}
                onBlur={submitEdit}
                className="flex-1 border-0 bg-transparent text-sm text-ink outline-none"
              />
            </li>
          ) : (
            <li
              key={task.id}
              className="group flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-canvas"
            >
              <Checkbox checked={task.done} onChange={(v) => onToggle(task.id, v)} />
              <span
                onDoubleClick={() => startEdit(task)}
                className={`flex-1 text-sm ${task.done ? "text-muted line-through" : "text-ink"}`}
              >
                {task.title}
              </span>
              <button
                onClick={() => startEdit(task)}
                className="hidden text-muted hover:text-ink group-hover:block"
                aria-label="Редагувати задачу"
              >
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none">
                  <path d="M11 2l3 3-8 8H3v-3l8-8Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                </svg>
              </button>
              <button
                onClick={() => onDelete(task.id)}
                className="hidden text-muted hover:text-ink group-hover:block"
                aria-label="Видалити задачу"
              >
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none">
                  <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
            </li>
          )
        )}

        {adding && (
          <li className="flex items-center gap-3 px-2 py-2">
            <span className="h-5 w-5 shrink-0 rounded-md border border-line" />
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              onBlur={submit}
              placeholder="Нова задача..."
              className="flex-1 border-0 bg-transparent text-sm text-ink placeholder:text-muted focus:outline-none"
            />
          </li>
        )}

        {tasks.length === 0 && !adding && (
          <li className="px-2 py-6 text-center text-sm text-muted">Задач на сьогодні ще немає.</li>
        )}
      </ul>
    </section>
  );
}
