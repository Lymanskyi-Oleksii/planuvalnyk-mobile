import {
  Importance,
  Schedule,
  cancelAll,
  createChannel,
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { platform } from "@tauri-apps/plugin-os";
import { supabase } from "./supabaseClient";
import { requireUserId } from "./session";
import { addDays, fromISODate, toISODate } from "./date";
import { loadSettings } from "./settings";

// Нагадування — локальні сповіщення телефону, заплановані наперед на найближчі
// дні. Вони спрацьовують і без інтернету та без відкритого застосунку.
// Перепланування відбувається при відкритті застосунку, зміні задач і налаштувань.
//
// Що саме нагадувати, вирішують налаштування (екран «Налаштування») і поля
// самої задачі: remind (так/ні) та remind_before_min (за скільки хвилин).
// Якщо поле задачі порожнє (null), береться загальне налаштування.

const CHANNEL_ID = "planner-reminders";
const DAYS_AHEAD = 7;
const MAX_NOTIFICATIONS = 60; // iOS тримає не більше 64 запланованих
const SNACK_BEFORE_MIN = 60; // перекус за годину до вечірнього тренування
const POST_MIN = 3; // пульс через 3 хв після заняття

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

function at(date: string, time: string, shiftMin = 0): Date {
  const d = fromISODate(date);
  const [h, m] = time.split(":").map(Number);
  d.setHours(h, m + shiftMin, 0, 0);
  return d;
}

// Стабільне число-ідентифікатор для сповіщення (Android/iOS приймають int32).
function notificationId(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) & 0x7fffffff;
}

function firstLine(details: string | null): string {
  return (details ?? "").split("\n")[0].trim();
}

async function isMobile(): Promise<boolean> {
  try {
    const p = platform();
    return p === "android" || p === "ios";
  } catch {
    return false; // не Tauri (наприклад, відкрито у звичайному браузері)
  }
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

async function ensureChannel(): Promise<void> {
  await createChannel({
    id: CHANNEL_ID,
    name: "Нагадування планувальника",
    importance: Importance.High,
    vibration: true,
  });
}

/** Тестове сповіщення, яке прийде через 10 секунд. Повертає false, якщо не вдалося. */
export async function sendTestNotification(): Promise<boolean> {
  try {
    if (!(await requestNotificationPermission())) return false;
    await ensureChannel();
    sendNotification({
      id: notificationId("test"),
      channelId: CHANNEL_ID,
      title: "Тестове нагадування",
      body: "Якщо ви це бачите, нагадування працюють.",
      schedule: Schedule.at(new Date(Date.now() + 10_000), false, true),
    });
    return true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Тестове сповіщення не вдалося:", err);
    return false;
  }
}

const FULL_COLUMNS = "id, date, start_time, end_time, title, category, details, done, remind, remind_before_min";
const BASE_COLUMNS = "id, date, start_time, end_time, title, category, details, done";

async function fetchRows(userId: string, from: string, to: string): Promise<Row[]> {
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
  return (res.data ?? []) as unknown as Row[];
}

async function doReschedule(): Promise<void> {
  try {
    if (!(await isMobile())) return;

    const settings = loadSettings();
    if (!settings.enabled) {
      await cancelAll(); // головний вимикач: прибираємо всі заплановані
      return;
    }
    if (!(await requestNotificationPermission())) return;

    const userId = requireUserId();
    const today = toISODate(new Date());
    const rows = await fetchRows(userId, today, addDays(today, DAYS_AHEAD));

    await ensureChannel();

    // Спершу прибираємо старі, потім ставимо актуальні: так видалені
    // або перенесені задачі не залишають «привидів».
    await cancelAll();

    const now = Date.now();
    const planned: { id: number; when: Date; title: string; body: string }[] = [];

    for (const t of rows) {
      if (t.done) continue;

      const wanted = t.remind ?? settings.categories.includes(t.category as never);
      if (!wanted) continue;

      const lead = t.remind_before_min ?? settings.leadMinutes;
      const start = t.start_time.slice(0, 5);
      const end = t.end_time.slice(0, 5);
      const hint = firstLine(t.details);

      planned.push({
        id: notificationId(`${t.id}:pre`),
        when: at(t.date, start, -lead),
        title: lead <= 0 ? `Зараз: ${t.title}` : `Через ${lead} хв: ${t.title}`,
        body: `${start}–${end}. ${hint}`.trim(),
      });

      if (t.category === "sport") {
        if (settings.snack && Number(start.slice(0, 2)) >= 17) {
          planned.push({
            id: notificationId(`${t.id}:snack`),
            when: at(t.date, start, -SNACK_BEFORE_MIN),
            title: "Перекус перед тренуванням",
            body: "Яблуко або нежирний йогурт. Нічого важкого за 45–60 хв до заняття.",
          });
        }
        if (settings.afterWorkoutPulse) {
          planned.push({
            id: notificationId(`${t.id}:post`),
            when: at(t.date, end, POST_MIN),
            title: "Виміряйте пульс",
            body: "Через 3 хв після заняття пульс має бути нижче 100. Відмітьте виконане в застосунку.",
          });
        }
      }
    }

    const upcoming = planned
      .filter((p) => p.when.getTime() > now + 5_000)
      .sort((a, b) => a.when.getTime() - b.when.getTime())
      .slice(0, MAX_NOTIFICATIONS);

    for (const p of upcoming) {
      sendNotification({
        id: p.id,
        channelId: CHANNEL_ID,
        title: p.title,
        body: p.body,
        schedule: Schedule.at(p.when, false, true),
      });
    }
  } catch (err) {
    // Нагадування не мають ламати застосунок
    // eslint-disable-next-line no-console
    console.error("Не вдалося запланувати нагадування:", err);
  }
}

// Виклики йдуть по черзі, щоб два перепланування одночасно не скасували
// одне одного і не створили дублікатів.
let queue: Promise<void> = Promise.resolve();

export function rescheduleReminders(): Promise<void> {
  queue = queue.then(doReschedule, doReschedule);
  return queue;
}
