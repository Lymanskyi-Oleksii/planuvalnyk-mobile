import { getCurrentWindow } from "@tauri-apps/api/window";

// Повернення застосунку на передній план.
// На Android visibilitychange у WebView ненадійний, тому слухаємо ще й подію
// Tauri «tauri://resumed» (onResume активності; на першому запуску не приходить).
// Обидві можуть прийти разом — обробник має бути готовий до повторного виклику.
export function onAppResume(cb: () => void): () => void {
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
