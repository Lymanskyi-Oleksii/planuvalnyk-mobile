// Сповіщення всередині застосунку («тости»): короткі картки зверху екрана.
// Будь-який код може викликати toast.success(...) без доступу до React.

export type ToastKind = "success" | "error" | "info" | "reminder";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  message?: string;
  duration?: number; // мс; 0 = не зникає саме
  action?: ToastAction;
  color?: string; // колір акценту (для нагадувань: колір категорії)
  emoji?: string; // замість стандартної іконки
}

export interface ToastItem extends ToastOptions {
  id: number;
  kind: ToastKind;
  title: string;
  duration: number;
}

const DEFAULT_DURATION: Record<ToastKind, number> = {
  success: 3500,
  info: 4500,
  error: 6000,
  reminder: 10000,
};

const MAX_VISIBLE = 3;

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<(items: ToastItem[]) => void>();

function emit() {
  listeners.forEach((cb) => cb(items));
}

export function subscribeToasts(cb: (items: ToastItem[]) => void): () => void {
  listeners.add(cb);
  cb(items);
  return () => {
    listeners.delete(cb);
  };
}

export function dismissToast(id: number): void {
  if (!items.some((t) => t.id === id)) return;
  items = items.filter((t) => t.id !== id);
  emit();
}

function show(kind: ToastKind, title: string, options: ToastOptions = {}): number {
  const item: ToastItem = {
    ...options,
    id: nextId++,
    kind,
    title,
    duration: options.duration ?? DEFAULT_DURATION[kind],
  };
  // однакове повідомлення не дублюємо: нове замінює старе
  items = [...items.filter((t) => !(t.kind === kind && t.title === title)), item].slice(-MAX_VISIBLE);
  emit();
  return item.id;
}

export const toast = {
  success: (title: string, options?: ToastOptions) => show("success", title, options),
  error: (title: string, options?: ToastOptions) => show("error", title, options),
  info: (title: string, options?: ToastOptions) => show("info", title, options),
  reminder: (title: string, options?: ToastOptions) => show("reminder", title, options),
  dismiss: dismissToast,
};
