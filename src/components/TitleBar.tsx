import type { ViewMode } from "@/lib/settings";

export function TitleBar({
  onLogout,
  onOpenSettings,
  viewMode,
  onToggleView,
}: {
  onLogout?: () => void;
  onOpenSettings?: () => void;
  viewMode?: ViewMode;
  onToggleView?: () => void;
}) {
  return (
    <div
      style={{ paddingTop: "env(safe-area-inset-top)" }}
      className="flex min-h-11 shrink-0 items-center justify-between border-b border-line bg-panel px-4 select-none"
    >
      <div className="flex items-center gap-2">
        <svg viewBox="0 0 24 24" className="h-4 w-4 text-accent" fill="none">
          <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
          <path d="M3 9.5H21" stroke="currentColor" strokeWidth="1.6" />
          <path d="M8 3V6.5M16 3V6.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <span className="text-sm font-semibold text-ink">Планувальник</span>
      </div>

      <div className="flex items-center gap-1">
        {onToggleView && (
          <button
            onClick={onToggleView}
            className="flex h-8 w-8 items-center justify-center rounded text-muted hover:bg-canvas hover:text-ink"
            aria-label={viewMode === "calendar" ? "Показати списком" : "Показати календарем"}
          >
            {viewMode === "calendar" ? (
              <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" fill="none">
                <path d="M7 5h10M7 10h10M7 15h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                <circle cx="3.5" cy="5" r="1" fill="currentColor" />
                <circle cx="3.5" cy="10" r="1" fill="currentColor" />
                <circle cx="3.5" cy="15" r="1" fill="currentColor" />
              </svg>
            ) : (
              <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" fill="none">
                <rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
                <path d="M3 8h14M8 8v9M12.5 8v9" stroke="currentColor" strokeWidth="1.6" />
              </svg>
            )}
          </button>
        )}
        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className="flex h-8 w-8 items-center justify-center rounded text-muted hover:bg-canvas hover:text-ink"
            aria-label="Налаштування"
          >
            <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" fill="none">
              <path d="M3 6h8M15 6h2M3 14h2M9 14h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              <circle cx="13" cy="6" r="2" stroke="currentColor" strokeWidth="1.6" />
              <circle cx="7" cy="14" r="2" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </button>
        )}
        {onLogout && (
          <button
            onClick={onLogout}
            className="mr-1 rounded px-2 py-1 text-xs font-medium text-muted hover:bg-canvas hover:text-ink"
          >
            Вийти
          </button>
        )}
      </div>
    </div>
  );
}
