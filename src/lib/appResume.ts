import { getCurrentWindow } from "@tauri-apps/api/window";

// Повернення застосунку на передній план.
// На Android visibilitychange у WebView ненадійний, тому слухаємо ще й подію
// Tauri «tauri://resumed» (onResume активності; на першому запуску не приходить).
// Обидві приходять разом (видно в Logcat: подвійне перепланування), тому друга
// в межах секунди ігнорується.
const DEDUPE_MS = 1_000;

export function onAppResume(callback: () => void): () => void {
  let last = 0;
  const cb = () => {
    const now = Date.now();
    if (now - last < DEDUPE_MS) return;
    last = now;
    callback();
  };
  const onVisible = () => {
    if (document.visibilityState === "visible") cb();
  };
  document.addEventListener("visibilitychange", onVisible);

  let unlisten: (() => void) | undefined;
  let disposed = false;
  try {
    getCurrentWindow()
      .listen("tauri://resumed", () => cb())
      .then((fn) => {
        if (disposed) fn();
        else unlisten = fn;
      })
      .catch(() => {});
  } catch {
    // не Tauri (звичайний браузер) — вистачить visibilitychange
  }

  return () => {
    disposed = true;
    document.removeEventListener("visibilitychange", onVisible);
    unlisten?.();
  };
}
