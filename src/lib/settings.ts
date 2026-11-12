import type { Category } from "@/types";

// Загальні налаштування нагадувань. Зберігаються на самому пристрої
// (localStorage): сповіщення належать конкретному телефону.

export interface ReminderSettings {
  enabled: boolean; // головний вимикач
  leadMinutes: number; // за скільки хвилин попереджати за замовчуванням
  categories: Category[]; // для яких категорій нагадувати за замовчуванням
  snack: boolean; // перекус за годину до вечірнього тренування
  afterWorkoutPulse: boolean; // нагадати виміряти пульс після тренування
}

export const DEFAULT_SETTINGS: ReminderSettings = {
  enabled: true,
  leadMinutes: 15,
  categories: ["sport", "health"],
  snack: true,
  afterWorkoutPulse: true,
};

const KEY = "planner.reminderSettings.v1";
const listeners = new Set<(s: ReminderSettings) => void>();

export function loadSettings(): ReminderSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const p = JSON.parse(raw);
    return {
      enabled: typeof p.enabled === "boolean" ? p.enabled : DEFAULT_SETTINGS.enabled,
      leadMinutes:
        typeof p.leadMinutes === "number" && p.leadMinutes >= 0 && p.leadMinutes <= 1440
          ? p.leadMinutes
          : DEFAULT_SETTINGS.leadMinutes,
      categories: Array.isArray(p.categories) ? p.categories : [...DEFAULT_SETTINGS.categories],
      snack: typeof p.snack === "boolean" ? p.snack : DEFAULT_SETTINGS.snack,
      afterWorkoutPulse:
        typeof p.afterWorkoutPulse === "boolean" ? p.afterWorkoutPulse : DEFAULT_SETTINGS.afterWorkoutPulse,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: ReminderSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // сховище недоступне: налаштування діятимуть до закриття застосунку
  }
  listeners.forEach((cb) => cb(s));
}

export function subscribeSettings(cb: (s: ReminderSettings) => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function leadLabel(min: number): string {
  if (min <= 0) return "у момент початку";
  if (min < 60) return `за ${min} хв`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `за ${h} год` : `за ${h} год ${m} хв`;
}
