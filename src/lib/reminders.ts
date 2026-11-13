import {
  Importance,
  Schedule,
  cancelAll,
  createChannel,
  isPermissionGranted,
  removeChannel,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { invoke } from "@tauri-apps/api/core";
import { platform } from "@tauri-apps/plugin-os";
import type { Session } from "@supabase/supabase-js";
import { supabase, url as supabaseUrl, anonKey as supabaseAnonKey } from "./supabaseClient";
import { requireUserId } from "./session";
import { addDays, toISODate } from "./date";
import { loadSettings, type AlertMode } from "./settings";
import {
  buildPlan,
  toCategory,
  type PlanDailyTask,
  type PlanMultiDayTask,
  type PlanTask,
  type PlannedReminder,
} from "./reminderPlan";

// Нагадування — локальні сповіщення телефону, заплановані наперед на найближчі
// дні. Вони спрацьовують і без інтернету та без відкритого застосунку.
// Перепланування відбувається при відкритті застосунку, зміні задач і налаштувань.
//
// Що саме нагадувати, вирішує план (lib/reminderPlan.ts) за налаштуваннями
// й полями самої задачі. Цей файл лише доставляє план:
//   • на Android — власним плагіном reminders (сповіщення з нашим макетом);
//   • на iOS — системними сповіщеннями плагіна notification.
// Дозвіл на сповіщення й канали Android — через плагін notification.

const DAYS_AHEAD = 7;
const MAX_NOTIFICATIONS = 60; // iOS тримає не більше 64 запланованих
const SMALL_ICON = "ic_notification"; // res/drawable/ic_notification.xml
const ACCENT = "#2F6FED";

// Канали Android. Звук і вібрацію каналу після створення змінити не можна,
// тому на кожен режим свій канал, а сповіщення просто обирає потрібний.
const LEGACY_CHANNEL_ID = "planner-reminders";
const CHANNEL_SILENT = "planner-v2-silent";
const CHANNEL_BY_MODE: Record<AlertMode, string> = {
  full: "planner-v2-full",
  sound: "planner-v2-sound",
  silent: CHANNEL_SILENT,
};

export type ReminderState =
  | "idle" // ще не планували
  | "scheduled" // системні сповіщення заплановано
  | "off" // вимкнено головним вимикачем
  | "denied" // немає дозволу на сповіщення
  | "error";

export interface ReminderStatus {
  state: ReminderState;
  plan: PlannedReminder[]; // найближчі нагадування, відсортовані за часом
  updatedAt: number | null;
}

let status: ReminderStatus = { state: "idle", plan: [], updatedAt: null };
const statusListeners = new Set<(s: ReminderStatus) => void>();

function publish(state: ReminderState, plan: PlannedReminder[]) {
  status = { state, plan, updatedAt: Date.now() };
  statusListeners.forEach((cb) => cb(status));
}

export function getReminderStatus(): ReminderStatus {
  return status;
}

export function subscribeReminderStatus(cb: (s: ReminderStatus) => void): () => void {
  statusListeners.add(cb);
  return () => {
    statusListeners.delete(cb);
  };
}

type Row = {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  title: string;
  category: string;
  details: string | null;
  done: boolean;
  remind?: boolean | null;
  remind_before_min?: number | null;
};

// Стабільне число-ідентифікатор для сповіщення (Android/iOS приймають int32).
function notificationId(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) & 0x7fffffff;
}

function currentPlatform(): string | null {
  try {
    return platform();
  } catch {
    return null; // не Tauri (наприклад, відкрито у звичайному браузері)
  }
}

async function isMobile(): Promise<boolean> {
  const p = currentPlatform();
  return p === "android" || p === "ios";
}

function isAndroid(): boolean {
  return currentPlatform() === "android";
}

/** true — дозволено, false — заборонено, null — на цьому пристрої сповіщення недоступні. */
export async function getNotificationPermission(): Promise<boolean | null> {
  try {
    if (!(await isMobile())) return null;
    return await isPermissionGranted();
  } catch {
    return null;
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  try {
    if (!(await isMobile())) return false;
    if (await isPermissionGranted()) return true;
    return (await requestPermission()) === "granted";
  } catch {
    return false;
  }
}

let channelsReady = false;

async function ensureChannels(): Promise<void> {
  if (channelsReady) return;
  await createChannel({
    id: CHANNEL_BY_MODE.full,
    name: "Нагадування: звук і вібрація",
    description: "Нагадування про задачі зі звуком і вібрацією",
    importance: Importance.High,
    vibration: true,
    lights: true,
    lightColor: ACCENT,
  });
  await createChannel({
    id: CHANNEL_BY_MODE.sound,
    name: "Нагадування: лише звук",
    description: "Нагадування про задачі зі звуком, без вібрації",
    importance: Importance.High,
    vibration: false,
  });
  await createChannel({
    id: CHANNEL_SILENT,
    name: "Нагадування: без звуку",
    description: "Тихі години та режим «Без звуку»",
    importance: Importance.Low,
    vibration: false,
  });
  // Канал попередньої версії більше не використовується
  await removeChannel(LEGACY_CHANNEL_ID).catch(() => {});
  channelsReady = true;
}

// Одне нагадування для плагіна reminders (поля — як у Reminder з ReminderAlarms.kt)
interface NativeReminder {
  id: number;
  whenMs: number;
  title: string;
  body: string;
  details: string;
  color: string;
  emoji: string;
  silent: boolean;
  channelId: string;
  date: string;
  taskId: string;
}

function toNative(p: PlannedReminder, mode: AlertMode, when: Date = p.when): NativeReminder {
  // Емодзі показує кружок макета, тож із заголовка його прибираємо
  const title = p.title.startsWith(p.emoji) ? p.title.slice(p.emoji.length).trimStart() : p.title;
  return {
    id: notificationId(p.key),
    whenMs: when.getTime(),
    title,
    body: p.body,
    details: p.details,
    color: p.color,
    emoji: p.emoji,
    silent: p.silent,
    channelId: p.silent ? CHANNEL_SILENT : CHANNEL_BY_MODE[mode],
    date: p.date,
    taskId: p.taskId ?? "",
  };
}

/** Android: увесь план одним викликом; він повністю замінює попередній. */
async function scheduleAndroid(reminders: NativeReminder[]): Promise<void> {
  // Прибираємо нагадування, які попередня версія ставила через плагін notification
  await cancelAll().catch(() => {});
  await invoke("plugin:reminders|schedule", { reminders });
}

async function cancelAndroid(): Promise<void> {
  await cancelAll().catch(() => {});
  await invoke("plugin:reminders|cancel_all");
}

/**
 * Вихід з акаунта: прибрати всі заплановані нагадування, чергу «Виконано»
 * й дані входу на телефоні. Після перезавантаження телефона план теж не повернеться.
 */
export function clearRemindersOnSignOut(): Promise<void> {
  // Через чергу: перепланування, що вже йде, не поставить план назад після очищення
  return enqueue(async () => {
    try {
      if (isAndroid()) {
        await cancelAll().catch(() => {});
        await invoke("plugin:reminders|sign_out");
      } else if (await isMobile()) {
        await cancelAll();
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Не вдалося прибрати нагадування після виходу:", err);
    }
    publish("idle", []);
  });
}

/**
 * Задачі, позначені кнопкою «Виконано» в сповіщенні (Android).
 * Черга на телефоні не очищається: після запису в базу викликати ackDone.
 */
export async function pendingDone(): Promise<string[]> {
  if (!isAndroid()) return [];
  const res = await invoke<{ taskIds: string[] }>("plugin:reminders|pending_done");
  return res.taskIds;
}

/**
 * Дані входу для кнопки «Виконано»: телефон пише в базу сам, не відкриваючи застосунок.
 * Викликати при вході, оновленні токена й виході (session = null).
 */
export async function syncNativeAuth(session: Session | null): Promise<void> {
  if (!isAndroid()) return;
  try {
    await invoke("plugin:reminders|set_auth", {
      url: supabaseUrl ?? "",
      anonKey: supabaseAnonKey ?? "",
      accessToken: session?.access_token ?? "",
      expiresAt: (session?.expires_at ?? 0) * 1000,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Не вдалося передати дані входу для сповіщень:", err);
  }
}

/** День (YYYY-MM-DD), який треба відкрити після натискання на сповіщення, або null. */
export async function takeOpenDate(): Promise<string | null> {
  if (!isAndroid()) return null;
  try {
    const res = await invoke<{ date: string | null }>("plugin:reminders|take_open_date");
    return res.date && /^\d{4}-\d{2}-\d{2}$/.test(res.date) ? res.date : null;
  } catch {
    return null;
  }
}

/** Прибирає з черги задачі, які вже позначено в базі. */
export async function ackDone(taskIds: string[]): Promise<void> {
  if (!isAndroid() || taskIds.length === 0) return;
  await invoke("plugin:reminders|ack_done", { taskIds });
}

// iOS: кожне нагадування окремим системним сповіщенням
function deliver(p: PlannedReminder, mode: AlertMode, when: Date = p.when): void {
  sendNotification({
    id: notificationId(p.key),
    channelId: p.silent ? CHANNEL_SILENT : CHANNEL_BY_MODE[mode],
    title: p.title,
    body: p.body,
    inboxLines: p.lines,
    icon: SMALL_ICON,
    iconColor: p.color,
    silent: p.silent,
    autoCancel: true,
    schedule: Schedule.at(when, false, true),
  });
}

export type TestResult = "scheduled" | "denied" | "failed";

const TEST_REMINDER: PlannedReminder = {
  key: "test",
  kind: "pre",
  when: new Date(0),
  title: "🏃 Тренування",
  body: "Через 15 хв · 18:00–19:00",
  emoji: "🏃",
  details: "Так виглядатимуть нагадування про ваші задачі.",
  color: "#F97316",
  silent: false,
  date: "",
};

/** Тестове сповіщення: прийде через 5 секунд. */
export async function sendTestNotification(): Promise<TestResult> {
  try {
    if (!(await isMobile())) return "failed"; // не телефон (наприклад, браузер)
    if (!(await requestNotificationPermission())) return "denied";
    await ensureChannels();
    const settings = loadSettings();
    const test = { ...TEST_REMINDER, silent: settings.alertMode === "silent" };
    const when = new Date(Date.now() + 5_000);
    if (isAndroid()) {
      // Лише додаємо тест до плану на телефоні. Не через schedule зі status.plan:
      // після старту без мережі він порожній, і тест стер би весь план.
      await enqueue(() => invoke("plugin:reminders|add", { reminder: toNative(test, settings.alertMode, when) }));
    } else {
      deliver(test, settings.alertMode, when);
    }
    return "scheduled";
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Тестове сповіщення не вдалося:", err);
    return "failed";
  }
}

// ── Планування ───────────────────────────────────────────────────────────────

const FULL_COLUMNS = "id, date, start_time, end_time, title, category, details, done, remind, remind_before_min";
const BASE_COLUMNS = "id, date, start_time, end_time, title, category, details, done";

async function fetchTasks(userId: string, from: string, to: string): Promise<PlanTask[]> {
  const run = (columns: string) =>
    supabase
      .from("scheduled_tasks")
      .select(columns)
      .eq("user_id", userId)
      .gte("date", from)
      .lte("date", to)
      .order("date", { ascending: true })
      .order("start_time", { ascending: true });

  let res = await run(FULL_COLUMNS);
  if (res.error && /remind/i.test(res.error.message ?? "")) {
    // міграцію migration_reminders.sql ще не запущено: працюємо без полів задачі
    res = await run(BASE_COLUMNS);
  }
  if (res.error) throw res.error;

  return ((res.data ?? []) as unknown as Row[]).map((r) => ({
    id: r.id,
    date: r.date,
    startTime: r.start_time.slice(0, 5),
    endTime: r.end_time.slice(0, 5),
    title: r.title,
    category: toCategory(r.category),
    details: r.details,
    done: r.done,
    remind: r.remind ?? null,
    remindBeforeMin: r.remind_before_min ?? null,
  }));
}

// Невиконані задачі дня без часу — для ранкового плану
async function fetchDailyTasks(userId: string, from: string, to: string): Promise<PlanDailyTask[]> {
  const { data, error } = await supabase
    .from("daily_tasks")
    .select("date, title, done")
    .eq("user_id", userId)
    .eq("done", false)
    .gte("date", from)
    .lte("date", to)
    .order("date", { ascending: true })
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => ({ date: r.date as string, title: r.title as string, done: r.done as boolean }));
}

// Невиконані задачі на кілька днів, що перетинають [from, to] — для ранкового плану
async function fetchMultiDayTasks(userId: string, from: string, to: string): Promise<PlanMultiDayTask[]> {
  const { data, error } = await supabase
    .from("multi_day_tasks")
    .select("start_date, end_date, title, done")
    .eq("user_id", userId)
    .eq("done", false)
    .lte("start_date", to)
    .gte("end_date", from)
    .order("sort_order", { ascending: true })
    .order("start_date", { ascending: true });
  // міграцію migration_multi_day_tasks.sql ще не запущено: працюємо без них
  const missing =
    error &&
    (error.code === "42P01" ||
      error.code === "PGRST205" ||
      /multi_day_tasks.*(does not exist|could not find)|(does not exist|could not find).*multi_day_tasks/i.test(
        error.message ?? ""
      ));
  if (missing) return [];
  if (error) throw error;
  return (data ?? []).map((r) => ({
    startDate: r.start_date as string,
    endDate: r.end_date as string,
    title: r.title as string,
    done: r.done as boolean,
  }));
}

async function doReschedule(): Promise<void> {
  try {
    const mobile = await isMobile();
    const settings = loadSettings();

    if (!settings.enabled) {
      // головний вимикач: прибираємо всі заплановані
      if (isAndroid()) await cancelAndroid();
      else if (mobile) await cancelAll();
      publish("off", []);
      return;
    }

    const userId = requireUserId();
    const today = toISODate(new Date());
    const until = addDays(today, DAYS_AHEAD);
    const [tasks, daily, spanning] = await Promise.all([
      fetchTasks(userId, today, until),
      settings.morningDigest ? fetchDailyTasks(userId, today, until) : Promise.resolve([]),
      settings.morningDigest ? fetchMultiDayTasks(userId, today, until) : Promise.resolve([]),
    ]);
    const plan = buildPlan(tasks, settings, new Date(), daily, spanning).slice(0, MAX_NOTIFICATIONS);

    if (!(await requestNotificationPermission())) {
      publish("denied", plan);
      return;
    }

    await ensureChannels();

    if (isAndroid()) {
      await scheduleAndroid(plan.map((p) => toNative(p, settings.alertMode)));
    } else {
      // Спершу прибираємо старі, потім ставимо актуальні: так видалені
      // або перенесені задачі не залишають «привидів».
      await cancelAll();
      for (const p of plan) deliver(p, settings.alertMode);
    }

    publish("scheduled", plan);
  } catch (err) {
    // Нагадування не мають ламати застосунок
    // eslint-disable-next-line no-console
    console.error("Не вдалося запланувати нагадування:", err);
    publish("error", status.plan);
  }
}

// Виклики йдуть по черзі, щоб два перепланування одночасно не скасували
// одне одного і не створили дублікатів.
let queue: Promise<void> = Promise.resolve();

function enqueue(job: () => Promise<void>): Promise<void> {
  const next = queue.then(job, job);
  queue = next.catch(() => {}); // помилка одного завдання не зупиняє чергу
  return next;
}

export function rescheduleReminders(): Promise<void> {
  return enqueue(doReschedule);
}
