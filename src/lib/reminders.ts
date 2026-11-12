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
import { buildPlan, toCategory, type PlanTask, type PlannedReminder } from "./reminderPlan";
import { toast } from "./toast";

// Нагадування — локальні сповіщення телефону, заплановані наперед на найближчі
// дні. Вони спрацьовують і без інтернету та без відкритого застосунку.
// Перепланування відбувається при відкритті застосунку, зміні задач і налаштувань.
//
// Що саме нагадувати, вирішує план (lib/reminderPlan.ts) за налаштуваннями
// й полями самої задачі. Цей файл лише доставляє план:
//   • на Android — власним плагіном reminders (сповіщення з нашим макетом);
//   • на iOS — системними сповіщеннями плагіна notification;
//   • на комп'ютері — картками всередині застосунку, поки він відкритий.
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
  | "inapp" // пристрій без системних сповіщень: нагадуємо всередині застосунку
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
    // Android показує або розгорнутий текст, або список рядків
    largeBody: p.largeBody,
    inboxLines: p.largeBody ? undefined : p.lines,
    icon: SMALL_ICON,
    iconColor: p.color,
    silent: p.silent,
    autoCancel: true,
    schedule: Schedule.at(when, false, true),
  });
}

export type TestResult = "scheduled" | "inapp" | "denied" | "failed";

const TEST_REMINDER: PlannedReminder = {
  key: "test",
  kind: "pre",
  when: new Date(0),
  title: "🏃 Тренування",
  body: "Через 15 хв · 18:00–19:00",
  largeBody: "Через 15 хв · 18:00–19:00\nТак виглядатимуть нагадування про ваші задачі.",
  emoji: "🏃",
  details: "Так виглядатимуть нагадування про ваші задачі.",
  color: "#F97316",
  silent: false,
  date: "",
};

/** Тестове сповіщення: на телефоні прийде через 5 секунд, на комп'ютері з'явиться одразу в застосунку. */
export async function sendTestNotification(): Promise<TestResult> {
  try {
    if (!(await isMobile())) {
      showInApp(TEST_REMINDER, 8000);
      return "inapp";
    }
    if (!(await requestNotificationPermission())) return "denied";
    await ensureChannels();
    const settings = loadSettings();
    const test = { ...TEST_REMINDER, silent: settings.alertMode === "silent" };
    const when = new Date(Date.now() + 5_000);
    if (isAndroid()) {
      // План на Android замінюється цілком, тож тест додаємо до чинного плану
      await enqueue(() =>
        scheduleAndroid([
          ...status.plan.map((p) => toNative(p, settings.alertMode)),
          toNative(test, settings.alertMode, when),
        ])
      );
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

// ── Нагадування всередині застосунку (комп'ютер) ─────────────────────────────

const MAX_TIMEOUT = 2_000_000_000; // setTimeout не приймає більше ~24 діб
let inAppTimer: number | undefined;

function showInApp(p: PlannedReminder, duration = 0): void {
  toast.reminder(p.title, { message: p.largeBody ?? p.body, color: p.color, duration });
}

function armInApp(plan: PlannedReminder[]): void {
  window.clearTimeout(inAppTimer);
  inAppTimer = undefined;
  const next = plan[0];
  if (!next) return;

  const wait = next.when.getTime() - Date.now();
  inAppTimer = window.setTimeout(
    () => {
      if (Date.now() < next.when.getTime() - 1_000) {
        armInApp(plan); // таймер спрацював раніше (дуже довге очікування): чекаємо далі
        return;
      }
      showInApp(next);
      armInApp(plan.slice(1));
    },
    Math.min(Math.max(wait, 0), MAX_TIMEOUT)
  );
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

async function doReschedule(): Promise<void> {
  try {
    const mobile = await isMobile();
    const settings = loadSettings();

    if (!settings.enabled) {
      armInApp([]);
      // головний вимикач: прибираємо всі заплановані
      if (isAndroid()) await cancelAndroid();
      else if (mobile) await cancelAll();
      publish("off", []);
      return;
    }

    const userId = requireUserId();
    const today = toISODate(new Date());
    const tasks = await fetchTasks(userId, today, addDays(today, DAYS_AHEAD));
    const plan = buildPlan(tasks, settings, new Date()).slice(0, MAX_NOTIFICATIONS);

    if (!mobile) {
      armInApp(plan);
      publish("inapp", plan);
      return;
    }

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
