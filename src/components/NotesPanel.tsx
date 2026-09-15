import { useEffect, useRef, useState } from "react";
import { formatShortDate } from "@/lib/date";
import type { MultiDayNote } from "@/types";

interface NotesPanelProps {
  date: string;
  content: string;
  onSave: (content: string) => void;
  multiDayNotes: MultiDayNote[];
  onAddMultiDayNote: (input: { title: string; content: string; startDate: string; endDate: string }) => void;
  onDeleteMultiDayNote: (id: string) => void;
}

export function NotesPanel({
  date,
  content,
  onSave,
  multiDayNotes,
  onAddMultiDayNote,
  onDeleteMultiDayNote,
}: NotesPanelProps) {
  const [value, setValue] = useState(content);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const [addingSpan, setAddingSpan] = useState(false);
  const [spanTitle, setSpanTitle] = useState("");
  const [spanContent, setSpanContent] = useState("");
  const [spanStart, setSpanStart] = useState(date);
  const [spanEnd, setSpanEnd] = useState(date);

  useEffect(() => setValue(content), [content]);
  useEffect(() => {
    setSpanStart(date);
    setSpanEnd(date);
  }, [date]);

  function handleChange(next: string) {
    setValue(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      onSave(next);
      setSavedAt(Date.now());
    }, 600);
  }

  function submitSpanNote() {
    if (!spanTitle.trim()) return;
    onAddMultiDayNote({
      title: spanTitle.trim(),
      content: spanContent.trim(),
      startDate: spanStart <= spanEnd ? spanStart : spanEnd,
      endDate: spanStart <= spanEnd ? spanEnd : spanStart,
    });
    setSpanTitle("");
    setSpanContent("");
    setAddingSpan(false);
  }

  return (
    <section className="flex flex-col rounded-xl2 border border-line bg-panel shadow-card">
      <header className="flex items-center justify-between border-b border-line px-5 py-4">
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 24 24" className="h-4 w-4 text-muted" fill="none">
            <path d="M4 19.5V6a2 2 0 0 1 2-2h9l5 5v10.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" stroke="currentColor" strokeWidth="1.5" />
            <path d="M15 4v5h5" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          <h2 className="text-sm font-semibold text-ink">Нотатки дня</h2>
        </div>
        <button
          onClick={() => setAddingSpan(true)}
          className="flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-canvas"
        >
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none">
            <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          На кілька днів
        </button>
      </header>

      {multiDayNotes.length > 0 && (
        <div className="space-y-2 border-b border-line bg-accent-soft/30 px-5 py-3">
          {multiDayNotes.map((n) => (
            <div key={n.id} className="group flex items-start justify-between gap-2 rounded-lg bg-white px-3 py-2 shadow-sm">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-ink">{n.title}</span>
                  <span className="text-[11px] text-muted">
                    {formatShortDate(n.startDate)} – {formatShortDate(n.endDate)}
                  </span>
                </div>
                {n.content && <p className="mt-0.5 text-xs text-muted">{n.content}</p>}
              </div>
              <button
                onClick={() => onDeleteMultiDayNote(n.id)}
                className="hidden text-muted hover:text-ink group-hover:block"
                aria-label="Видалити нотатку"
              >
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none">
                  <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {addingSpan && (
        <div className="space-y-2.5 border-b border-line px-5 py-4">
          <input
            autoFocus
            value={spanTitle}
            onChange={(e) => setSpanTitle(e.target.value)}
            placeholder="Назва (напр. Сесія, Відпустка)"
            className="w-full rounded-lg border border-line px-3 py-2 text-sm text-ink outline-none focus:border-accent"
          />
          <textarea
            value={spanContent}
            onChange={(e) => setSpanContent(e.target.value)}
            placeholder="Деталі (необов'язково)"
            className="h-16 w-full resize-none rounded-lg border border-line px-3 py-2 text-sm text-ink outline-none focus:border-accent"
          />
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={spanStart}
              onChange={(e) => setSpanStart(e.target.value)}
              className="flex-1 rounded-lg border border-line px-3 py-2 text-sm text-ink outline-none focus:border-accent"
            />
            <span className="text-xs text-muted">до</span>
            <input
              type="date"
              value={spanEnd}
              onChange={(e) => setSpanEnd(e.target.value)}
              className="flex-1 rounded-lg border border-line px-3 py-2 text-sm text-ink outline-none focus:border-accent"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={() => setAddingSpan(false)}
              className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink hover:bg-canvas"
            >
              Скасувати
            </button>
            <button
              onClick={submitSpanNote}
              disabled={!spanTitle.trim()}
              className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/90 disabled:opacity-40"
            >
              Додати
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 p-5">
        <textarea
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Запишіть сюди будь-що, що не є конкретною задачею..."
          className="h-40 w-full resize-none border-0 bg-transparent text-sm text-ink placeholder:text-muted focus:outline-none"
        />
      </div>

      <footer className="flex justify-end border-t border-line px-5 py-3">
        <span className="flex items-center gap-1.5 text-xs text-muted">
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none">
            <path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {savedAt ? "Автозбережено" : "Автозбереження"}
        </span>
      </footer>
    </section>
  );
}
