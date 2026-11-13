import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useBackHandler } from "@/lib/backButton";
import type { TouchEvent as ReactTouchEvent } from "react";
import { Checkbox } from "./Checkbox";
import { addDays, formatDayRange } from "@/lib/date";
import type { DailyTask, MultiDayTask } from "@/types";

interface DailyTasksPanelProps {
  date: string;
  tasks: DailyTask[];
  onToggle: (id: string, done: boolean) => void;
  // Збереження повертає true, якщо записано; інакше текст лишається в полі
  onAdd: (title: string) => Promise<boolean>;
  onEdit: (id: string, title: string) => Promise<boolean>;
  onDelete: (id: string) => void;
  multiDayTasks: MultiDayTask[];
  onToggleMultiDay: (id: string, done: boolean) => void;
  onAddMultiDay: (input: { title: string; startDate: string; endDate: string }) => Promise<boolean>;
  onEditMultiDay: (id: string, title: string) => Promise<boolean>;
  onDeleteMultiDay: (id: string) => void;
}

interface DragState {
  id: string;
  startIndex: number;
  startY: number;
  itemHeight: number;
  translateY: number;
}

export function DailyTasksPanel({
  date,
  tasks,
  onToggle,
  onAdd,
  onEdit,
  onDelete,
  multiDayTasks,
  onToggleMultiDay,
  onAddMultiDay,
  onEditMultiDay,
  onDeleteMultiDay,
}: DailyTasksPanelProps) {
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");

  // Задача на кілька днів: форма з датами, редагування назви, підтвердження видалення
  const [addingSpan, setAddingSpan] = useState(false);
  const [spanTitle, setSpanTitle] = useState("");
  const [spanStart, setSpanStart] = useState(date);
  const [spanEnd, setSpanEnd] = useState(() => addDays(date, 1));
  const [editingSpanId, setEditingSpanId] = useState<string | null>(null);
  const [spanEditDraft, setSpanEditDraft] = useState("");
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const spanButtonRef = useRef<HTMLButtonElement>(null);
  const switchingToSpanRef = useRef(false);

  useEffect(() => {
    setSpanStart(date);
    setSpanEnd(addDays(date, 1));
  }, [date]);

  // Невиконані — зверху, виконані — під ними
  const spanTasks = [...multiDayTasks.filter((t) => !t.done), ...multiDayTasks.filter((t) => t.done)];

  // Перехід з рядка «Нова задача...» у форму на кілька днів; набраний текст переноситься
  function openSpanForm() {
    // Поле «Нова задача...» зникне; його blur не має зберегти текст як задачу дня
    switchingToSpanRef.current = true;
    requestAnimationFrame(() => (switchingToSpanRef.current = false));
    setSpanTitle(draft.trim());
    setDraft("");
    setAdding(false);
    setSpanStart(date);
    setSpanEnd(addDays(date, 1));
    setAddingSpan(true);
  }

  // Одне збереження за раз: Enter, а слідом blur того ж поля не мають записати двічі
  const savingRef = useRef(false);
  async function saveOnce(save: () => Promise<boolean>): Promise<boolean> {
    if (savingRef.current) return false;
    savingRef.current = true;
    try {
      return await save();
    } finally {
      savingRef.current = false;
    }
  }

  // Поля очищаються лише після успішного збереження; при помилці текст лишається
  async function submitSpan() {
    if (!spanTitle.trim() || !spanStart || !spanEnd) return;
    const saved = await saveOnce(() =>
      onAddMultiDay({
        title: spanTitle.trim(),
        startDate: spanStart <= spanEnd ? spanStart : spanEnd,
        endDate: spanStart <= spanEnd ? spanEnd : spanStart,
      })
    );
    if (!saved) return;
    setSpanTitle("");
    setAddingSpan(false);
  }

  async function submitSpanEdit() {
    const id = editingSpanId;
    if (!id) return;
    if (await saveOnce(() => onEditMultiDay(id, spanEditDraft))) {
      setEditingSpanId((cur) => (cur === id ? null : cur));
    }
  }

  useBackHandler(addingSpan, () => setAddingSpan(false), "tasks");
  useBackHandler(editingSpanId !== null, () => setEditingSpanId(null), "tasks");
  useBackHandler(confirmingDeleteId !== null, () => setConfirmingDeleteId(null), "tasks");
  const [reordering, setReordering] = useState(false);
  const [drag, setDrag] = useState<DragState | null>(null);
  const itemRefs = useRef(new Map<string, HTMLLIElement>());

  // FLIP: перед тим як застосувати новий порядок, запам'ятовуємо, де кожен
  // рядок був на екрані (піксельно). Після перерендеру з новим порядком —
  // миттєво відкидаємо назад на стільки ж пікселів (непомітно для ока), а тоді
  // плавно анімуємо до нуля. Так елемент "переїжджає" зі старого місця на нове
  // без стрибка, замість миттєвого телепорту.
  const flipFromRef = useRef<Map<string, number> | null>(null);
  const [flipTick, setFlipTick] = useState(0);

  // Ручний порядок задач (за id). Зберігається локально в компоненті:
  // переставлені задачі лишаються на місці, поки список не перезавантажиться
  // з нуля (наприклад, після перезапуску застосунку) — це не пише в базу.
  const [orderIds, setOrderIds] = useState<string[]>(() => tasks.map((t) => t.id));

  useEffect(() => {
    setOrderIds((prev) => {
      const stillHere = prev.filter((id) => tasks.some((t) => t.id === id));
      const freshIds = tasks.filter((t) => !stillHere.includes(t.id)).map((t) => t.id);
      return [...stillHere, ...freshIds];
    });
  }, [tasks]);

  const byId = new Map(tasks.map((t) => [t.id, t]));
  const ordered = orderIds.map((id) => byId.get(id)).filter((t): t is DailyTask => Boolean(t));
  const activeTasks = ordered.filter((t) => !t.done);
  const doneTasks = ordered.filter((t) => t.done);
  // Невиконані — у своєму порядку зверху, виконані — у своєму порядку знизу.
  const displayTasks = [...activeTasks, ...doneTasks];

  // Знімає поточні екранні позиції всіх видимих рядків — викликається
  // прямо перед будь-якою зміною, яка може змінити порядок списку
  // (drag і зараз також відмітка "виконано"), щоб FLIP-ефект нижче
  // знав, звідки анімувати кожен рядок.
  function captureFlipSnapshot() {
    const prevTops = new Map<string, number>();
    displayTasks.forEach((t) => {
      const el = itemRefs.current.get(t.id);
      if (el) prevTops.set(t.id, el.getBoundingClientRect().top);
    });
    flipFromRef.current = prevTops;
  }

  // Відмітка виконання переміщує задачу в кінець (чи назад нагору) списку —
  // знімаємо позиції "до" і програємо той самий FLIP, що й при drag.
  function handleToggle(id: string, v: boolean) {
    captureFlipSnapshot();
    onToggle(id, v);
    setFlipTick((n) => n + 1);
  }

  async function submit() {
    if (!draft.trim()) {
      setAdding(false);
      return;
    }
    if (!(await saveOnce(() => onAdd(draft)))) return;
    setDraft("");
    setAdding(false);
  }

  function startEdit(task: DailyTask) {
    setEditingId(task.id);
    setEditDraft(task.title);
  }

  async function submitEdit() {
    const id = editingId;
    if (!id) return;
    if (await saveOnce(() => onEdit(id, editDraft))) {
      setEditingId((cur) => (cur === id ? null : cur));
    }
  }

  function exitReordering() {
    setReordering(false);
    setDrag(null);
  }

  // «Назад» скасовує додавання чи редагування задачі дня і виходить з режиму перестановки
  useBackHandler(adding, () => {
    setAdding(false);
    setDraft("");
  }, "tasks");
  useBackHandler(editingId !== null, () => setEditingId(null), "tasks");
  useBackHandler(reordering, exitReordering, "tasks");

  // Куди зараз "потрапляє" задача, яку тягнуть, за поточним зсувом.
  const liveIndex = drag
    ? Math.min(Math.max(drag.startIndex + Math.round(drag.translateY / drag.itemHeight), 0), activeTasks.length - 1)
    : null;

  function handleHandleTouchStart(id: string, e: ReactTouchEvent<HTMLSpanElement>) {
    const idx = activeTasks.findIndex((t) => t.id === id);
    const el = itemRefs.current.get(id);
    const height = el?.getBoundingClientRect().height ?? 44;
    setDrag({ id, startIndex: idx, startY: e.touches[0].clientY, itemHeight: height, translateY: 0 });
  }

  function handleHandleTouchMove(e: ReactTouchEvent<HTMLSpanElement>) {
    setDrag((prev) => (prev ? { ...prev, translateY: e.touches[0].clientY - prev.startY } : prev));
  }

  function handleHandleTouchEnd() {
    if (!drag) return;
    const targetIndex = liveIndex ?? drag.startIndex;

    if (targetIndex !== drag.startIndex) {
      // "First": де кожен рядок фізично зараз на екрані (включно з тим, що
      // частина з них зсунута через drag).
      captureFlipSnapshot();

      setOrderIds(() => {
        const activeIds = activeTasks.map((t) => t.id);
        const [moved] = activeIds.splice(drag.startIndex, 1);
        activeIds.splice(targetIndex, 0, moved);
        return [...activeIds, ...doneTasks.map((t) => t.id)];
      });
      setFlipTick((n) => n + 1);
    }
    setDrag(null);
  }

  // "Invert" + "Play": виконується одразу після того, як новий порядок уже
  // застосувався до DOM, але ще до того, як браузер намалює кадр.
  useLayoutEffect(() => {
    const prevTops = flipFromRef.current;
    if (!prevTops) return;
    flipFromRef.current = null;

    const moved: HTMLLIElement[] = [];
    prevTops.forEach((prevTop, id) => {
      const el = itemRefs.current.get(id);
      if (!el) return;
      const delta = prevTop - el.getBoundingClientRect().top;
      if (!delta) return;
      el.style.transition = "none";
      el.style.transform = `translateY(${delta}px)`;
      moved.push(el);
    });

    if (moved.length === 0) return;

    // Примусовий reflow, щоб браузер "зафіксував" стартову позицію
    // до того, як ми увімкнемо анімацію до нуля.
    void moved[0].getBoundingClientRect();

    requestAnimationFrame(() => {
      moved.forEach((el) => {
        el.style.transition = "transform 400ms cubic-bezier(0.22, 1, 0.36, 1)";
        el.style.transform = "";
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flipTick]);

  const dragHandle = (id: string) => (
    <span
      onTouchStart={(e) => handleHandleTouchStart(id, e)}
      onTouchMove={handleHandleTouchMove}
      onTouchEnd={handleHandleTouchEnd}
      style={{ touchAction: "none" }}
      className="flex h-9 w-9 shrink-0 cursor-grab items-center justify-center text-muted active:cursor-grabbing active:text-ink"
      aria-label="Перетягнути, щоб змінити порядок"
    >
      <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor">
        <circle cx="5" cy="4" r="1.2" />
        <circle cx="5" cy="8" r="1.2" />
        <circle cx="5" cy="12" r="1.2" />
        <circle cx="10" cy="4" r="1.2" />
        <circle cx="10" cy="8" r="1.2" />
        <circle cx="10" cy="12" r="1.2" />
      </svg>
    </span>
  );

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
        <div className="flex items-center gap-2">
          <button
            onClick={() => (reordering ? exitReordering() : setReordering(true))}
            disabled={activeTasks.length < 2}
            className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium disabled:opacity-40 ${
              reordering ? "border-accent bg-accent-soft text-accent" : "border-line text-ink"
            }`}
          >
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none">
              <path d="M5 3v10M11 3v10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              <path d="M3 5.5L5 3l2 2.5M14 10.5L11 13l-2-2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {reordering ? "Готово" : "Порядок"}
          </button>
          {!reordering && (
            <button
              onClick={() => setAdding(true)}
              className="flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-ink"
            >
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none">
                <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              Додати
            </button>
          )}
        </div>
      </header>

      {addingSpan && (
        <div className="space-y-2.5 border-b border-line px-5 py-4">
          <input
            autoFocus
            value={spanTitle}
            onChange={(e) => setSpanTitle(e.target.value)}
            placeholder="Задача на кілька днів"
            className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm text-ink outline-none focus:border-accent"
          />
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={spanStart}
              onChange={(e) => setSpanStart(e.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-line bg-panel px-3 py-2 text-sm text-ink outline-none focus:border-accent"
            />
            <span className="text-xs text-muted">до</span>
            <input
              type="date"
              value={spanEnd}
              onChange={(e) => setSpanEnd(e.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-line bg-panel px-3 py-2 text-sm text-ink outline-none focus:border-accent"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={() => setAddingSpan(false)}
              className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink"
            >
              Скасувати
            </button>
            <button
              onClick={submitSpan}
              disabled={!spanTitle.trim() || !spanStart || !spanEnd}
              className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/90 disabled:opacity-40"
            >
              Додати
            </button>
          </div>
        </div>
      )}

      {spanTasks.length > 0 && (
        <ul className="space-y-1 border-b border-line bg-accent-soft/30 p-3">
          {spanTasks.map((task) => {
            const range = formatDayRange(task.startDate, task.endDate);
            if (editingSpanId === task.id) {
              return (
                <li key={task.id} className="flex items-center gap-3 rounded-lg px-2 py-2">
                  <Checkbox checked={task.done} onChange={(v) => onToggleMultiDay(task.id, v)} />
                  <input
                    autoFocus
                    value={spanEditDraft}
                    onChange={(e) => setSpanEditDraft(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submitSpanEdit()}
                    onBlur={submitSpanEdit}
                    className="min-w-0 flex-1 border-0 bg-transparent text-sm text-ink outline-none"
                  />
                  <span className="shrink-0 text-[11px] text-muted">{range}</span>
                </li>
              );
            }
            const confirming = confirmingDeleteId === task.id;
            return (
              <li key={task.id} className="flex items-center gap-3 rounded-lg px-2 py-2">
                <Checkbox checked={task.done} onChange={(v) => onToggleMultiDay(task.id, v)} />
                <span
                  onDoubleClick={() => {
                    if (reordering) return;
                    setEditingSpanId(task.id);
                    setSpanEditDraft(task.title);
                  }}
                  className={`min-w-0 flex-1 text-sm transition-colors ${task.done ? "text-muted line-through" : "text-ink"}`}
                >
                  {task.title}
                </span>
                <span className="shrink-0 text-[11px] text-muted">{range}</span>
                {!reordering && (
                  <>
                    <button
                      onClick={() => {
                        setEditingSpanId(task.id);
                        setSpanEditDraft(task.title);
                      }}
                      className={`p-1.5 text-muted ${confirming ? "hidden" : ""}`}
                      aria-label="Редагувати задачу"
                    >
                      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none">
                        <path d="M11 2l3 3-8 8H3v-3l8-8Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                      </svg>
                    </button>
                    <button
                      onClick={() => (confirming ? onDeleteMultiDay(task.id) : setConfirmingDeleteId(task.id))}
                      onBlur={() => setConfirmingDeleteId((id) => (id === task.id ? null : id))}
                      className={
                        confirming
                          ? "rounded-lg bg-danger-soft px-2 py-1 text-xs font-medium text-danger"
                          : "p-1.5 text-muted"
                      }
                      aria-label="Видалити задачу"
                    >
                      {confirming ? (
                        "Так?"
                      ) : (
                        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none">
                          <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                        </svg>
                      )}
                    </button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <ul className="flex-1 space-y-1 p-3">
        {displayTasks.map((task, i) => {
          if (editingId === task.id) {
            return (
              <li key={task.id} className="flex items-center gap-3 rounded-lg px-2 py-2">
                <Checkbox checked={task.done} onChange={(v) => handleToggle(task.id, v)} />
                <input
                  autoFocus
                  value={editDraft}
                  onChange={(e) => setEditDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitEdit()}
                  onBlur={submitEdit}
                  className="flex-1 border-0 bg-transparent text-sm text-ink outline-none"
                />
              </li>
            );
          }

          // Режим перетягування — лише для невиконаних (displayTasks починається саме з них).
          if (reordering && !task.done) {
            const isDragged = drag?.id === task.id;
            let shift = 0;
            if (drag && liveIndex !== null && !isDragged) {
              const from = drag.startIndex;
              const to = liveIndex;
              if (from > to && i >= to && i < from) shift = drag.itemHeight; // звільняємо місце зверху
              if (from < to && i <= to && i > from) shift = -drag.itemHeight; // звільняємо місце знизу
            }
            const translateY = isDragged ? drag.translateY : shift;

            return (
              <li
                key={task.id}
                ref={(el) => {
                  if (el) itemRefs.current.set(task.id, el);
                  else itemRefs.current.delete(task.id);
                }}
                style={{
                  transform: translateY ? `translateY(${translateY}px)` : undefined,
                  transition: isDragged ? "none" : "transform 150ms ease",
                  position: isDragged ? "relative" : undefined,
                  zIndex: isDragged ? 10 : undefined,
                }}
                className={`flex items-center gap-3 rounded-lg px-2 py-2 ${isDragged ? "bg-canvas shadow-card" : ""}`}
              >
                <span className="flex-1 text-sm text-ink">{task.title}</span>
                {dragHandle(task.id)}
              </li>
            );
          }

          return (
            <li
              key={task.id}
              ref={(el) => {
                if (el) itemRefs.current.set(task.id, el);
                else itemRefs.current.delete(task.id);
              }}
              className="flex items-center gap-3 rounded-lg px-2 py-2"
            >
              <Checkbox checked={task.done} onChange={(v) => handleToggle(task.id, v)} />
              <span
                onDoubleClick={() => !reordering && startEdit(task)}
                className={`flex-1 text-sm transition-colors ${task.done ? "text-muted line-through" : "text-ink"}`}
              >
                {task.title}
              </span>
              {!reordering && (
                <>
                  <button
                    onClick={() => startEdit(task)}
                    className={`p-1.5 text-muted ${confirmingDeleteId === task.id ? "hidden" : ""}`}
                    aria-label="Редагувати задачу"
                  >
                    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none">
                      <path d="M11 2l3 3-8 8H3v-3l8-8Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <button
                    onClick={() => {
                      if (confirmingDeleteId === task.id) onDelete(task.id);
                      else setConfirmingDeleteId(task.id);
                    }}
                    onBlur={() => setConfirmingDeleteId((id) => (id === task.id ? null : id))}
                    className={
                      confirmingDeleteId === task.id
                        ? "rounded-lg bg-danger-soft px-2 py-1 text-xs font-medium text-danger"
                        : "p-1.5 text-muted"
                    }
                    aria-label="Видалити задачу"
                  >
                    {confirmingDeleteId === task.id ? (
                      "Так?"
                    ) : (
                      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none">
                        <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                      </svg>
                    )}
                  </button>
                </>
              )}
            </li>
          );
        })}

        {adding && !reordering && (
          <li className="flex items-center gap-3 px-2 py-2">
            <span className="h-5 w-5 shrink-0 rounded-md border border-line" />
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              onBlur={(e) => {
                // Перехід до форми «На кілька днів» — не зберігати як звичайну задачу
                if (e.relatedTarget === spanButtonRef.current || switchingToSpanRef.current) return;
                submit();
              }}
              placeholder="Нова задача..."
              className="min-w-0 flex-1 border-0 bg-transparent text-sm text-ink placeholder:text-muted focus:outline-none"
            />
            <button
              ref={spanButtonRef}
              // Не забирати фокус у поля, щоб onBlur не зберіг текст як задачу дня
              onMouseDown={(e) => e.preventDefault()}
              onClick={openSpanForm}
              className="shrink-0 rounded-lg border border-line px-2 py-1 text-xs font-medium text-ink"
            >
              На кілька днів
            </button>
          </li>
        )}

        {tasks.length === 0 && spanTasks.length === 0 && !adding && !addingSpan && (
          <li className="px-2 py-6 text-center text-sm text-muted">Задач на сьогодні ще немає.</li>
        )}
      </ul>
    </section>
  );
}