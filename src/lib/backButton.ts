import { useEffect, useRef } from "react";
import { exit, onBackButtonPress } from "@tauri-apps/api/app";
import { platform } from "@tauri-apps/plugin-os";

// Системна кнопка «Назад» на Android.
// Відкриті вікна й форми реєструють, як їх закрити (useBackHandler), і «Назад»
// закриває останнє відкрите. Коли нічого не відкрито — головний екран може
// щось зробити сам (setRootBackHandler, напр. повернутися на вкладку «День»),
// а інакше застосунок закривається. На комп'ютері й у браузері нічого не робить.

const stack: { id: number; close: () => void }[] = [];
let nextId = 1;
let rootHandler: (() => boolean) | null = null;
const beforeExit = new Set<() => unknown>();

/** Поки active, «Назад» викликає close замість виходу із застосунку. */
export function useBackHandler(active: boolean, close: () => void) {
  const closeRef = useRef(close);
  closeRef.current = close;

  useEffect(() => {
    if (!active) return;
    const id = nextId++;
    stack.push({ id, close: () => closeRef.current() });
    return () => {
      const i = stack.findIndex((e) => e.id === id);
      if (i >= 0) stack.splice(i, 1);
    };
  }, [active]);
}

/** Що робити на головному екрані; повертає true, якщо «Назад» оброблено. */
export function setRootBackHandler(fn: (() => boolean) | null) {
  rootHandler = fn;
}

/** Дія перед виходом (напр. дописати нотатку, яка ще чекає збереження). */
export function onBeforeExit(fn: () => unknown): () => void {
  beforeExit.add(fn);
  return () => {
    beforeExit.delete(fn);
  };
}

async function handleBack() {
  const top = stack[stack.length - 1];
  if (top) {
    top.close();
    return;
  }
  if (rootHandler?.()) return;
  await Promise.allSettled([...beforeExit].map((fn) => Promise.resolve().then(fn)));
  await exit(0);
}

let started = false;

/** Підписатися на «Назад» один раз при старті застосунку. */
export async function initBackButton(): Promise<void> {
  if (started) return;
  started = true;
  try {
    if (platform() !== "android") return;
  } catch {
    return; // не Tauri (наприклад, звичайний браузер)
  }
  try {
    await onBackButtonPress(() => {
      void handleBack().catch((err) => {
        // eslint-disable-next-line no-console
        console.error("Кнопку «Назад» не оброблено:", err);
      });
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Не вдалося підписатися на кнопку «Назад»:", err);
  }
}
