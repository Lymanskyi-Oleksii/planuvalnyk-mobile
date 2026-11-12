import { useEffect, useRef, useState, type RefObject } from "react";
import { Checkbox } from "./Checkbox";
import type { SubtaskDraft } from "@/types";

/** Підзадача у формі: key — лише для React (у нової підзадачі ще немає id). */
export type FormSubtask = SubtaskDraft & { key: string };

let nextKey = 0;
export function formSubtask(s: SubtaskDraft): FormSubtask {
  return { ...s, key: `s${nextKey++}` };
}

interface SubtaskListProps {
  items: FormSubtask[];
  onChange: (items: FormSubtask[]) => void;
  /** Прокрутка форми: на час перетягування вона зупиняється. */
  scrollRef: RefObject<HTMLElement>;
}

// Підзадачі у формі задачі: тап по тексту — редагування, ручка ≡ — зміна порядку пальцем.
export function SubtaskList({ items, onChange, scrollRef }: SubtaskListProps) {
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [dragKey, setDragKey] = useState<string | null>(null);
  const rows = useRef(new Map<string, HTMLLIElement>());

  // Свіжі значення для обробників на window
  const latest = useRef({ items, onChange, editingKey, editText });
  latest.current = { items, onChange, editingKey, editText };

  function startEdit(s: FormSubtask) {
    setEditingKey(s.key);
    setEditText(s.title);
  }

  // Enter або вихід з поля. Порожній текст — видалити підзадачу.
  // Читає з latest і одразу скидає ключ: blur після Enter нічого не повторить.
  function finishEdit() {
    const { items, onChange, editingKey, editText } = latest.current;
    if (!editingKey) return;
    latest.current.editingKey = null;
    setEditingKey(null);
    const title = editText.trim();
    onChange(title ? items.map((s) => (s.key === editingKey ? { ...s, title } : s)) : items.filter((s) => s.key !== editingKey));
  }

  // Перетягування. Ручка має touch-action: none — браузер не прокручує й не скасовує жест,
  // тож pointermove приходять до кінця. Слухаємо на window: рядок під час переставлення
  // переїжджає в DOM, і захоплення вказівника на ньому могло б загубитися.
  useEffect(() => {
    if (!dragKey) return;
    const scroller = scrollRef.current;
    if (scroller) scroller.style.overflowY = "hidden";

    function onMove(e: PointerEvent) {
      e.preventDefault();
      const { items, onChange } = latest.current;
      const from = items.findIndex((s) => s.key === dragKey);
      if (from < 0) return;
      // Перша підзадача, середина якої нижче пальця, — туди й ставимо
      let to = items.length - 1;
      for (let i = 0; i < items.length; i++) {
        const r = rows.current.get(items[i].key)?.getBoundingClientRect();
        if (r && e.clientY < r.top + r.height / 2) {
          to = i;
          break;
        }
      }
      if (to > from) to -= 1; // після вилучення з from індекси нижче зсуваються
      if (to === from) return;
      const next = [...items];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      onChange(next);
    }

    // Клік, який браузер може надіслати після жесту, не має закрити форму (тап по фону)
    function swallowClick(e: MouseEvent) {
      e.stopPropagation();
      e.preventDefault();
    }

    function onEnd() {
      setDragKey(null);
      window.addEventListener("click", swallowClick, true);
      window.setTimeout(() => window.removeEventListener("click", swallowClick, true), 400);
    }

    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onEnd);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onEnd);
      if (scroller) scroller.style.overflowY = "";
    };
  }, [dragKey, scrollRef]);

  if (items.length === 0) return null;

  return (
    <ul className="mt-2 space-y-1">
      {items.map((s) => {
        const dragging = dragKey === s.key;
        return (
          <li
            key={s.key}
            ref={(el) => {
              if (el) rows.current.set(s.key, el);
              else rows.current.delete(s.key);
            }}
            className={`flex items-center gap-2 rounded-lg py-0.5 pr-1 ${dragging ? "bg-canvas shadow-card" : ""}`}
          >
            <span
              role="button"
              aria-label="Перетягнути, щоб змінити порядок"
              className="flex h-8 w-7 shrink-0 cursor-grab touch-none select-none items-center justify-center text-muted [-webkit-touch-callout:none]"
              onPointerDown={(e) => {
                if (editingKey) finishEdit();
                e.preventDefault();
                e.stopPropagation();
                setDragKey(s.key);
              }}
              onClick={(e) => e.stopPropagation()}
              onContextMenu={(e) => e.preventDefault()}
            >
              <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none">
                <path d="M3 5h10M3 8h10M3 11h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </span>
            {/* Галочку тут лише видно: ставлять її в розкладі, форма done не змінює */}
            <Checkbox size="sm" checked={s.done} onChange={() => {}} />
            {editingKey === s.key ? (
              <input
                autoFocus
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onBlur={finishEdit}
                enterKeyHint="done"
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.keyCode === 13) {
                    e.preventDefault();
                    finishEdit();
                  }
                }}
                className="min-w-0 flex-1 rounded-md border border-accent px-2 py-1 text-sm text-ink outline-none"
              />
            ) : (
              <button
                type="button"
                onClick={() => startEdit(s)}
                className={`min-w-0 flex-1 break-words py-1 text-left text-sm ${
                  s.done ? "text-muted line-through" : "text-ink"
                }`}
              >
                {s.title}
              </button>
            )}
            <button
              type="button"
              onClick={() => onChange(items.filter((x) => x.key !== s.key))}
              className="flex h-8 w-6 shrink-0 items-center justify-center text-muted hover:text-ink"
              aria-label="Видалити підзадачу"
            >
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none">
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
