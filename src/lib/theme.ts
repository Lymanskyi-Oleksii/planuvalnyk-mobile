import { loadTheme, subscribeTheme, type ThemeMode } from "./settings";

// Ставить клас dark на <html> за налаштуванням теми. «Як у системі» стежить
// за prefers-color-scheme (Windows і Android перемикають його самі).

const media = typeof window !== "undefined" ? window.matchMedia?.("(prefers-color-scheme: dark)") : undefined;

let mode: ThemeMode = "system";

function apply(): void {
  const dark = mode === "dark" || (mode === "system" && !!media?.matches);
  document.documentElement.classList.toggle("dark", dark);
}

/** Викликати один раз до першого рендеру, щоб не блимала світла тема. */
export function initTheme(): void {
  mode = loadTheme();
  apply();
  media?.addEventListener?.("change", apply);
  subscribeTheme((t) => {
    mode = t;
    apply();
  });
}
