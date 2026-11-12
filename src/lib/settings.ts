import { CATEGORY_LABELS, type Category } from "@/types";

// Загальні налаштування нагадувань. Зберігаються на самому пристрої
// (localStorage): сповіщення належать конкретному телефону.

/** Як сповіщення привертає увагу. */
export type AlertMode = "full" | "sound" | "silent";

export interface ReminderSettings {
  enabled: boolean; // головний вимикач
  leadMinutes: number; // за скільки хвилин попереджати за замовчуванням
  atStart: boolean; // додатково нагадати в момент початку задачі
  categories: Category[]; // для яких категорій нагадувати за замовчуванням

  alertMode: AlertMode; // звук і вібрація / лише звук / без звуку
  quietEnabled: boolean; // тихі години: сповіщення приходять без звуку
  quietFrom: string; // HH:mm
  quietTo: string; // HH:mm

  morningDigest: boolean; // ранковий план дня
  morningTime: string; // HH:mm
  eveningReview: boolean; // вечірній підсумок: що лишилось невиконаним
  eveningTime: string; // HH:mm

  snack: boolean; // перекус за годину до вечірнього тренування
  afterWorkoutPulse: boolean; // нагадати виміряти пульс після тренування
}

export const DEFAULT_SETTINGS: ReminderSettings = {
  enabled: true,
  leadMinutes: 15,
  atStart: false,
  categories: ["sport", "health"],

  alertMode: "full",
  quietEnabled: false,
  quietFrom: "22:00",
  quietTo: "07:00",

  morningDigest: false,
  morningTime: "08:00",
  eveningReview: false,
  eveningTime: "21:00",

  snack: true,
  afterWorkoutPulse: true,
};

export const ALERT_MODE_LABELS: Record<AlertMode, string> = {
  full: "Звук і вібрація",
  sound: "Лише звук",
  silent: "Без звуку",
};

const KEY = "planner.reminderSettings.v1";
const listeners = new Set<(s: ReminderSettings) => void>();

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidTime(value: unknown): value is string {
  return typeof value === "string" && TIME_RE.test(value);
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function time(value: unknown, fallback: string): string {
  return isValidTime(value) ? value : fallback;
}

// Старі збережені налаштування не мають нових полів: для них беруться стандартні
// значення, тож оновлення застосунку нічого не ламає.
export function loadSettings(): ReminderSettings {
  const d = DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...d, categories: [...d.categories] };
    const p = JSON.parse(raw) ?? {};
    return {
      enabled: bool(p.enabled, d.enabled),
      leadMinutes:
        typeof p.leadMinutes === "number" && p.leadMinutes >= 0 && p.leadMinutes <= 1440
          ? Math.round(p.leadMinutes)
          : d.leadMinutes,
      atStart: bool(p.atStart, d.atStart),
      categories: Array.isArray(p.categories)
        ? (p.categories.filter((c: unknown) => typeof c === "string" && c in CATEGORY_LABELS) as Category[])
        : [...d.categories],

      alertMode: p.alertMode === "full" || p.alertMode === "sound" || p.alertMode === "silent" ? p.alertMode : d.alertMode,
      quietEnabled: bool(p.quietEnabled, d.quietEnabled),
      quietFrom: time(p.quietFrom, d.quietFrom),
      quietTo: time(p.quietTo, d.quietTo),

      morningDigest: bool(p.morningDigest, d.morningDigest),
      morningTime: time(p.morningTime, d.morningTime),
      eveningReview: bool(p.eveningReview, d.eveningReview),
      eveningTime: time(p.eveningTime, d.eveningTime),

      snack: bool(p.snack, d.snack),
      afterWorkoutPulse: bool(p.afterWorkoutPulse, d.afterWorkoutPulse),
    };
  } catch {
    return { ...d, categories: [...d.categories] };
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

// ── Оформлення ───────────────────────────────────────────────────────────────
// Тема зберігається окремо від налаштувань нагадувань: її зміна не перепланує
// сповіщення, а «Скинути налаштування» її не чіпає.

export type ThemeMode = "system" | "light" | "dark";

export const THEME_LABELS: Record<ThemeMode, string> = {
  system: "Як у системі",
  light: "Світла",
  dark: "Темна",
};

const THEME_KEY = "planner.theme.v1";
const themeListeners = new Set<(t: ThemeMode) => void>();

export function loadTheme(): ThemeMode {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return t === "light" || t === "dark" || t === "system" ? t : "system";
  } catch {
    return "system";
  }
}

export function saveTheme(t: ThemeMode): void {
  try {
    localStorage.setItem(THEME_KEY, t);
  } catch {
    // сховище недоступне: тема діятиме до закриття застосунку
  }
  themeListeners.forEach((cb) => cb(t));
}

export function subscribeTheme(cb: (t: ThemeMode) => void): () => void {
  themeListeners.add(cb);
  return () => {
    themeListeners.delete(cb);
  };
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** Чи припадає момент на тихі години. Проміжок може переходити через північ (22:00–07:00). */
export function inQuietHours(when: Date, s: ReminderSettings): boolean {
  if (!s.quietEnabled) return false;
  const from = toMinutes(s.quietFrom);
  const to = toMinutes(s.quietTo);
  if (from === to) return false;
  const now = when.getHours() * 60 + when.getMinutes();
  return from < to ? now >= from && now < to : now >= from || now < to;
}

/** «15 хв», «1 год», «1 год 30 хв» */
export function durationLabel(min: number): string {
  if (min < 60) return `${min} хв`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} год` : `${h} год ${m} хв`;
}

export function leadLabel(min: number): string {
  if (min <= 0) return "у момент початку";
  return `за ${durationLabel(min)}`;
}
