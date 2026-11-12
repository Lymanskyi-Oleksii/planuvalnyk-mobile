import { useEffect, useState } from "react";

async function isMobilePlatform() {
  try {
    const { platform } = await import("@tauri-apps/plugin-os");
    const p = await platform();
    return p === "android" || p === "ios";
  } catch {
    return false;
  }
}

async function getWindow() {
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    return getCurrentWindow();
  } catch {
    return null;
  }
}

async function minimize() {
  const w = await getWindow();
  await w?.minimize();
}

async function toggleMaximize() {
  const w = await getWindow();
  await w?.toggleMaximize();
}

async function closeWindow() {
  const w = await getWindow();
  await w?.close();
}

export function TitleBar({
  onLogout,
  onOpenSettings,
}: {
  onLogout?: () => void;
  onOpenSettings?: () => void;
}) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    isMobilePlatform().then(setIsMobile);
  }, []);

  const dragProps = isMobile ? {} : { "data-tauri-drag-region": true };

  return (
    <div
      {...dragProps}
      style={{ paddingTop: "env(safe-area-inset-top)" }}
      className="flex min-h-11 shrink-0 items-center justify-between border-b border-line bg-panel px-4 select-none"
    >
      <div {...dragProps} className="flex items-center gap-2">
        <svg viewBox="0 0 24 24" className="h-4 w-4 text-accent" fill="none">
          <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
          <path d="M3 9.5H21" stroke="currentColor" strokeWidth="1.6" />
          <path d="M8 3V6.5M16 3V6.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <span className="text-sm font-semibold text-ink">Планувальник</span>
      </div>

      <div className="flex items-center gap-1">
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
        {!isMobile && (
          <>
            <button
              onClick={minimize}
              className="flex h-7 w-9 items-center justify-center rounded text-muted hover:bg-canvas"
              aria-label="Згорнути"
            >
              <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none">
                <path d="M2 6h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </button>
            <button
              onClick={toggleMaximize}
              className="flex h-7 w-9 items-center justify-center rounded text-muted hover:bg-canvas"
              aria-label="Розгорнути"
            >
              <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none">
                <rect x="2.5" y="2.5" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.3" />
              </svg>
            </button>
            <button
              onClick={closeWindow}
              className="flex h-7 w-9 items-center justify-center rounded text-muted hover:bg-danger-soft hover:text-danger"
              aria-label="Закрити"
            >
              <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none">
                <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
