import { CATEGORY_LABELS, type Category } from "@/types";
import { addDays, fromISODate, toISODate } from "./date";
import { durationLabel, inQuietHours, type ReminderSettings } from "./settings";

// План нагадувань: чиста функція «задачі + налаштування → список сповіщень».
// Тут немає ні мережі, ні телефону, тому цей самий план показується
// і в системних сповіщеннях, і на екрані налаштувань, і всередині застосунку.

export type ReminderKind = "pre" | "start" | "snack" | "pulse" | "morning" | "evening";

export interface PlanTask {
  id: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  title: string;
  category: Category;
  details: string | null;
  done: boolean;
  remind: boolean | null;
  remindBeforeMin: number | null;
}

// Задача дня без часу (таблиця daily_tasks) — лише для ранкового плану
export interface PlanDailyTask {
  date: string; // YYYY-MM-DD
  title: string;
  done: boolean;
}

// Задача на кілька днів (таблиця multi_day_tasks) — у ранковому плані кожного дня діапазону
export interface PlanMultiDayTask {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  title: string;
  done: boolean;
}

export interface PlannedReminder {
  key: string; // стабільний ключ: з нього рахується числовий id сповіщення
  kind: ReminderKind;
  when: Date;
  title: string; // починається з emoji
  body: string;
  lines?: string[]; // список рядків для підсумків дня
  emoji: string; // для кружка у власному макеті Android
  details: string; // деталі під заголовком у розгорнутому макеті Android
  color: string; // колір акценту сповіщення
  silent: boolean; // без звуку: тихі години або режим «Без звуку»
  date: string; // день, якого стосується нагадування
  taskId?: string; // задача, яку позначає кнопка «Виконано»; у підсумків дня й перекусу немає
}

// Ті самі кольори, що й у бейджів категорій світлої теми (src/index.css → --c-*-fg)
export const CATEGORY_COLORS: Record<Category, string> = {
  study: "#2563EB",
  university: "#4F46E5",
  work: "#9333EA",
  sport: "#F97316",
  food: "#CA8A04",
  health: "#E11D6B",
  personal: "#16A34A",
  errands: "#0891B2",
  other: "#64748B",
};

export const CATEGORY_EMOJI: Record<Category, string> = {
  study: "📚",
  university: "🎓",
  work: "💼",
  sport: "🏃",
  food: "🍽️",
  health: "❤️",
  personal: "🌿",
  errands: "🧾",
  other: "📌",
};

const ACCENT = "#2F6FED";
const SNACK_BEFORE_MIN = 60; // перекус за годину до вечірнього тренування
const SNACK_FROM_HOUR = 17; // «вечірнє» тренування: початок о 17:00 або пізніше
const POST_MIN = 3; // пульс через 3 хв після заняття
const DIGEST_LINES = 6;
const MULTI_DAY_AHEAD = 7; // на скільки днів наперед розгортати задачі на кілька днів (як DAYS_AHEAD у reminders.ts)

export function toCategory(value: string): Category {
  return value in CATEGORY_LABELS ? (value as Category) : "other";
}

function at(date: string, time: string, shiftMin = 0): Date {
  const d = fromISODate(date);
  const [h, m] = time.split(":").map(Number);
  d.setHours(h, m + shiftMin, 0, 0);
  return d;
}

/** 1 задача, 2 задачі, 5 задач */
export function pluralTasks(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} задача`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} задачі`;
  return `${n} задач`;
}

// Спершу задачі з часом, потім задачі дня без часу
function digestLines(tasks: PlanTask[], daily: PlanDailyTask[] = []): string[] {
  const all = [...tasks.map((t) => `${t.startTime}  ${t.title}`), ...daily.map((t) => `•  ${t.title}`)];
  const lines = all.slice(0, DIGEST_LINES);
  if (all.length > DIGEST_LINES) lines.push(`і ще ${all.length - DIGEST_LINES}`);
  return lines;
}

/** Чи нагадувати про задачу: власне поле задачі важливіше за загальні категорії. */
export function wantsReminder(task: Pick<PlanTask, "remind" | "category">, s: ReminderSettings): boolean {
  return task.remind ?? s.categories.includes(task.category);
}

export function buildPlan(
  tasks: PlanTask[],
  s: ReminderSettings,
  now: Date,
  dailyTasks: PlanDailyTask[] = [],
  multiDayTasks: PlanMultiDayTask[] = []
): PlannedReminder[] {
  if (!s.enabled) return [];

  const plan: PlannedReminder[] = [];
  const push = (r: Omit<PlannedReminder, "silent">) => {
    plan.push({ ...r, silent: s.alertMode === "silent" || inQuietHours(r.when, s) });
  };

  const open = tasks
    .filter((t) => !t.done)
    .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));

  for (const t of open) {
    if (!wantsReminder(t, s)) continue;

    const lead = Math.max(0, t.remindBeforeMin ?? s.leadMinutes);
    const emoji = CATEGORY_EMOJI[t.category];
    const color = CATEGORY_COLORS[t.category];
    const range = `${t.startTime}–${t.endTime}`;
    const details = (t.details ?? "").trim();

    const preBody = lead > 0 ? `Через ${durationLabel(lead)} · ${range}` : `Починається зараз · ${range}`;
    push({
      key: `${t.id}:pre`,
      kind: "pre",
      when: at(t.date, t.startTime, -lead),
      title: `${emoji} ${t.title}`,
      body: preBody,
      emoji,
      details,
      color,
      date: t.date,
      taskId: t.id,
    });

    if (s.atStart && lead > 0) {
      const startBody = `Починається зараз · до ${t.endTime}`;
      push({
        key: `${t.id}:start`,
        kind: "start",
        when: at(t.date, t.startTime),
        title: `${emoji} ${t.title}`,
        body: startBody,
        emoji,
        details,
        color,
        date: t.date,
        taskId: t.id,
      });
    }

    if (t.category === "sport") {
      if (s.snack && Number(t.startTime.slice(0, 2)) >= SNACK_FROM_HOUR) {
        const snackBody = `${t.title} о ${t.startTime}. Яблуко або нежирний йогурт.`;
        const snackDetails = "Нічого важкого за 45–60 хв до заняття.";
        push({
          key: `${t.id}:snack`,
          kind: "snack",
          when: at(t.date, t.startTime, -SNACK_BEFORE_MIN),
          title: "🍎 Перекус перед тренуванням",
          body: snackBody,
          emoji: "🍎",
          details: snackDetails,
          color: CATEGORY_COLORS.food,
          date: t.date,
          // Без taskId: «Виконано» на перекусі позначило б виконаним саме тренування
        });
      }
      if (s.afterWorkoutPulse) {
        const pulseBody = "Через 3 хв після заняття пульс має бути нижче 100.";
        const pulseDetails = "Відмітьте виконане в застосунку.";
        push({
          key: `${t.id}:post`,
          kind: "pulse",
          when: at(t.date, t.endTime, POST_MIN),
          title: "❤️ Виміряйте пульс",
          body: pulseBody,
          emoji: "❤️",
          details: pulseDetails,
          color: CATEGORY_COLORS.health,
          date: t.date,
          taskId: t.id,
        });
      }
    }
  }

  // Підсумки дня рахуються за всіма невиконаними задачами дня, а не лише тими,
  // про які є окремі нагадування.
  if (s.morningDigest || s.eveningReview) {
    const byDate = new Map<string, PlanTask[]>();
    for (const t of open) {
      const list = byDate.get(t.date);
      if (list) list.push(t);
      else byDate.set(t.date, [t]);
    }

    // Невиконані задачі дня без часу — лише в ранковому плані.
    // Задачі на кілька днів — копією на кожен день діапазону, перед задачами дня.
    const today = toISODate(now);
    const lastDay = addDays(today, MULTI_DAY_AHEAD);
    const spanDaily: PlanDailyTask[] = [];
    for (const t of multiDayTasks) {
      if (t.done) continue;
      const end = t.endDate < lastDay ? t.endDate : lastDay;
      for (let d = t.startDate > today ? t.startDate : today; d <= end; d = addDays(d, 1)) {
        spanDaily.push({ date: d, title: t.title, done: false });
      }
    }
    const dailyByDate = new Map<string, PlanDailyTask[]>();
    for (const t of [...spanDaily, ...dailyTasks]) {
      if (t.done) continue;
      const list = dailyByDate.get(t.date);
      if (list) list.push(t);
      else dailyByDate.set(t.date, [t]);
    }
    const dates = new Set([...byDate.keys(), ...(s.morningDigest ? dailyByDate.keys() : [])]);

    for (const date of dates) {
      const list = byDate.get(date) ?? [];
      const daily = dailyByDate.get(date) ?? [];
      // Вранці показуємо те, що ще попереду; ввечері — те, що вже мало початися.
      const ahead = list.filter((t) => t.endTime > s.morningTime);
      const due = list.filter((t) => t.startTime < s.eveningTime);

      if (s.morningDigest && ahead.length + daily.length > 0) {
        const first = ahead[0];
        const lines = digestLines(ahead, daily);
        push({
          key: `${date}:morning`,
          kind: "morning",
          when: at(date, s.morningTime),
          title: `☀️ План на сьогодні: ${pluralTasks(ahead.length + daily.length)}`,
          body: first
            ? `Перша о ${first.startTime}: ${first.title}`
            : `Задачі дня: ${daily.map((t) => t.title).join(", ")}`,
          lines,
          emoji: "☀️",
          details: lines.join("\n"),
          color: ACCENT,
          date,
        });
      }
      if (s.eveningReview && due.length > 0) {
        const lines = digestLines(due);
        push({
          key: `${date}:evening`,
          kind: "evening",
          when: at(date, s.eveningTime),
          title: `🌙 Невиконаного за день: ${pluralTasks(due.length)}`,
          body: due.map((t) => t.title).join(", "),
          lines,
          emoji: "🌙",
          details: lines.join("\n"),
          color: ACCENT,
          date,
        });
      }
    }
  }

  const from = now.getTime() + 5_000;
  return plan.filter((p) => p.when.getTime() > from).sort((a, b) => a.when.getTime() - b.when.getTime());
}
