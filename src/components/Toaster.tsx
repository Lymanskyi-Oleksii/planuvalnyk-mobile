import { useEffect, useState } from "react";
import { dismissToast, subscribeToasts, type ToastItem, type ToastKind } from "@/lib/toast";

// Кольори з палітри (обидві теми): смужка й прогрес, значок, текст кнопки дії
const KIND_STYLE: Record<ToastKind, { bar: string; icon: string; text: string }> = {
  success: { bar: "bg-category-personal-fg", icon: "bg-category-personal-fg/10 text-category-personal-fg", text: "text-category-personal-fg" },
  error: { bar: "bg-danger", icon: "bg-danger/10 text-danger", text: "text-danger" },
  info: { bar: "bg-accent", icon: "bg-accent/10 text-accent", text: "text-accent" },
};

function KindIcon({ kind }: { kind: ToastKind }) {
  const common = {
    viewBox: "0 0 20 20",
    className: "h-[18px] w-[18px]",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (kind) {
    case "success":
      return (
        <svg {...common}>
          <path d="M4.5 10.5l3.5 3.5 7.5-8" />
        </svg>
      );
    case "error":
      return (
        <svg {...common}>
          <path d="M10 5.5v5.5M10 14.2v.3" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <path d="M10 9v5.5M10 5.6v.3" />
        </svg>
      );
  }
}

function ToastCard({ item }: { item: ToastItem }) {
  const style = KIND_STYLE[item.kind];

  useEffect(() => {
    if (item.duration <= 0) return;
    const timer = window.setTimeout(() => dismissToast(item.id), item.duration);
    return () => window.clearTimeout(timer);
  }, [item.id, item.duration]);

  return (
    <div
      role={item.kind === "error" ? "alert" : "status"}
      className="toast-in pointer-events-auto relative w-full overflow-hidden rounded-xl2 border border-line bg-panel shadow-lg"
    >
      <span className={`absolute inset-y-0 left-0 w-1 ${style.bar}`} />

      <div className="flex items-start gap-3 py-3 pl-4 pr-2">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base ${style.icon}`}
          aria-hidden="true"
        >
          <KindIcon kind={item.kind} />
        </span>

        <div className="min-w-0 flex-1 py-0.5">
          <p className="text-sm font-semibold leading-snug text-ink">{item.title}</p>
          {item.message && (
            <p className="mt-0.5 whitespace-pre-line text-xs leading-snug text-muted">{item.message}</p>
          )}
          {item.action && (
            <button
              type="button"
              onClick={() => {
                item.action?.onClick();
                dismissToast(item.id);
              }}
              className={`mt-1.5 text-xs font-semibold ${style.text}`}
            >
              {item.action.label}
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => dismissToast(item.id)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-canvas"
          aria-label="Закрити сповіщення"
        >
          <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none">
            <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {item.duration > 0 && (
        <span
          className={`toast-progress absolute inset-x-0 bottom-0 h-0.5 origin-left opacity-[0.35] ${style.bar}`}
          style={{ animationDuration: `${item.duration}ms` }}
        />
      )}
    </div>
  );
}

// Стос сповіщень застосунку. Стоїть один раз у корені, поверх усіх екранів.
export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => subscribeToasts(setItems), []);

  if (items.length === 0) return null;

  return (
    <div
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 8px)" }}
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 px-3 font-sans"
    >
      <div className="flex w-full max-w-sm flex-col gap-2">
        {items.map((item) => (
          <ToastCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}
