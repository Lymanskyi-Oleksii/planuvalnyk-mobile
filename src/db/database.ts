import { supabase } from "@/lib/supabaseClient";
import { getCurrentUserId, requireUserId } from "@/lib/session";
import { forgetTaskReminders } from "@/lib/reminders";
import type {
  Category,
  DailyTask,
  DayNote,
  MultiDayNote,
  MultiDayTask,
  ScheduledTask,
  Subtask,
  SubtaskDraft,
} from "@/types";

// ---------- Офлайн: збережені на пристрої дні ----------
// Кожне вдале читання дня запам'ятовуємо в localStorage. Коли мережі немає,
// віддаємо збережене і позначаємо, що на екрані дані з пристрою.

const CACHE_PREFIX = "planner-cache-v1:";
const CACHE_MAX_ENTRIES = 300;

interface CacheStore {
  [key: string]: { at: number; data: unknown };
}

function cacheKey(): string {
  return CACHE_PREFIX + requireUserId();
}

function readCacheStore(): CacheStore {
  try {
    return JSON.parse(localStorage.getItem(cacheKey()) ?? "{}") as CacheStore;
  } catch {
    return {};
  }
}

function writeCache(key: string, data: unknown) {
  try {
    const store = readCacheStore();
    store[key] = { at: Date.now(), data };
    // Найстаріші записи прибираємо, щоб не переповнити localStorage
    const keys = Object.keys(store);
    if (keys.length > CACHE_MAX_ENTRIES) {
      keys
        .sort((a, b) => store[a].at - store[b].at)
        .slice(0, keys.length - CACHE_MAX_ENTRIES)
        .forEach((k) => delete store[k]);
    }
    localStorage.setItem(cacheKey(), JSON.stringify(store));
  } catch {
    // Немає місця чи доступу — просто працюємо без збереження
  }
}

// Видалити збережені дні й чергу змін усіх користувачів (під час виходу з акаунта)
export function clearOfflineData() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(CACHE_PREFIX) || k.startsWith(QUEUE_PREFIX))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    // нічого
  }
}

function isNetworkError(err: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  const message = (err as { message?: string } | null)?.message ?? String(err);
  return /failed to fetch|fetcherror|networkerror|network request failed|load failed|fetch failed/i.test(message);
}

// Стан «показано збережене без мережі» для смужки в інтерфейсі
let offline = false;
const offlineListeners = new Set<(value: boolean) => void>();

function setOffline(value: boolean) {
  if (offline === value) return;
  offline = value;
  offlineListeners.forEach((fn) => fn(value));
}

export function isOffline(): boolean {
  return offline;
}

export function subscribeOffline(fn: (value: boolean) => void): () => void {
  offlineListeners.add(fn);
  return () => {
    offlineListeners.delete(fn);
  };
}

if (typeof window !== "undefined") {
  window.addEventListener("offline", () => setOffline(true));
}

// ---------- Офлайн: черга змін ----------
// Без мережі можна лише ставити галочки й писати нотатку дня. Такі зміни
// лягають у чергу в localStorage і надсилаються, коли з'явиться інтернет.

type OfflineOp =
  | { kind: "scheduledDone"; id: string; done: boolean }
  | { kind: "subtaskDone"; id: string; done: boolean }
  | { kind: "dailyDone"; id: string; done: boolean }
  | { kind: "multiDayTaskDone"; id: string; done: boolean }
  | { kind: "note"; date: string; content: string };

const QUEUE_PREFIX = "planner-queue-v1:";

function queueKey(): string {
  return QUEUE_PREFIX + requireUserId();
}

// Одна й та сама задача чи нотатка — у черзі лишається тільки остання зміна
function opTarget(op: OfflineOp): string {
  return op.kind === "note" ? `note:${op.date}` : `${op.kind}:${op.id}`;
}

function readQueue(): OfflineOp[] {
  try {
    return JSON.parse(localStorage.getItem(queueKey()) ?? "[]") as OfflineOp[];
  } catch {
    return [];
  }
}

function writeQueue(queue: OfflineOp[]) {
  try {
    if (queue.length === 0) localStorage.removeItem(queueKey());
    else localStorage.setItem(queueKey(), JSON.stringify(queue));
  } catch {
    // нічого
  }
}

function enqueue(op: OfflineOp) {
  writeQueue([...readQueue().filter((o) => opTarget(o) !== opTarget(op)), op]);
}

function dropQueuedTarget(op: OfflineOp) {
  const queue = readQueue();
  const rest = queue.filter((o) => opTarget(o) !== opTarget(op));
  if (rest.length !== queue.length) writeQueue(rest);
}

function dropQueuedExact(op: OfflineOp) {
  const text = JSON.stringify(op);
  writeQueue(readQueue().filter((o) => JSON.stringify(o) !== text));
}

export function pendingOfflineCount(): number {
  return getCurrentUserId() ? readQueue().length : 0;
}

// Накладає одну зміну на збережені дані дня (ключ — як у readWithCache)
function applyOp(key: string, data: unknown, op: OfflineOp): unknown {
  if (key.startsWith("scheduled:") && Array.isArray(data)) {
    const tasks = data as ScheduledTask[];
    if (op.kind === "scheduledDone") {
      return tasks.map((t) => (t.id === op.id ? { ...t, done: op.done } : t));
    }
    if (op.kind === "subtaskDone") {
      return tasks.map((t) =>
        t.subtasks.some((s) => s.id === op.id)
          ? { ...t, subtasks: t.subtasks.map((s) => (s.id === op.id ? { ...s, done: op.done } : s)) }
          : t
      );
    }
  }
  if (key.startsWith("daily:") && op.kind === "dailyDone" && Array.isArray(data)) {
    return (data as DailyTask[]).map((t) => (t.id === op.id ? { ...t, done: op.done } : t));
  }
  if (key.startsWith("multitask:") && op.kind === "multiDayTaskDone" && Array.isArray(data)) {
    return (data as MultiDayTask[]).map((t) => (t.id === op.id ? { ...t, done: op.done } : t));
  }
  if (op.kind === "note" && key === `note:${op.date}`) {
    return { date: op.date, content: op.content };
  }
  return data;
}

// Ще не надіслані зміни поверх даних (свіжих із бази чи збережених)
function overlayQueue<T>(key: string, data: T): T {
  return readQueue().reduce<unknown>((d, op) => applyOp(key, d, op), data) as T;
}

// Оновити збережені дні, щоб без мережі показувалось те, що користувач бачив
function patchCache(op: OfflineOp) {
  try {
    const store = readCacheStore();
    for (const key of Object.keys(store)) store[key].data = applyOp(key, store[key].data, op);
    localStorage.setItem(cacheKey(), JSON.stringify(store));
  } catch {
    // нічого
  }
}

const DONE_TABLES = {
  scheduledDone: "scheduled_tasks",
  subtaskDone: "subtasks",
  dailyDone: "daily_tasks",
  multiDayTaskDone: "multi_day_tasks",
} as const;

// Записує одну зміну. Для галочки повертає, скільки рядків змінено
// (0 — задачу видалено або сесії немає), для нотатки — null.
// Помилка несе HTTP-статус відповіді в полі status.
async function sendOp(op: OfflineOp): Promise<number | null> {
  if (op.kind === "note") {
    const { error, status } = await supabase
      .from("notes")
      .upsert({ user_id: requireUserId(), date: op.date, content: op.content }, { onConflict: "user_id,date" });
    if (error) throw Object.assign(error, { status });
    return null;
  }
  const { data, error, status } = await supabase
    .from(DONE_TABLES[op.kind])
    .update({ done: op.done })
    .eq("id", op.id)
    .select("id");
  if (error) throw Object.assign(error, { status });
  return data?.length ?? 0;
}

// Помилка, після якої зміну варто надіслати пізніше, а не викидати:
// токен прострочено чи його немає (401/403), сервер перевантажений або впав
function isRetryableError(err: unknown): boolean {
  const status = (err as { status?: unknown } | null)?.status;
  if (typeof status !== "number") return false;
  return status === 0 || status === 401 || status === 403 || status === 408 || status === 429 || status >= 500;
}

async function hasSession(): Promise<boolean> {
  // getSession оновлює прострочений токен; без мережі сесії може не бути — тоді чекаємо
  const { data } = await supabase.auth.getSession();
  return !!data.session;
}

// Відправка черги, яка йде зараз. Одночасно — лише одна.
let flushing: Promise<number> | null = null;

// Записати в базу; без мережі — поставити в чергу
async function writeOrQueue(op: OfflineOp): Promise<void> {
  patchCache(op);
  // Свіжа зміна йде в базу після черги: інакше старіша зміна з черги,
  // надіслана слідом, перезапише її (нотатка «abcd» → «abc»)
  if (flushing) await flushing.catch(() => 0);
  try {
    await sendOp(op);
    dropQueuedTarget(op); // старіша зміна з черги вже не актуальна
  } catch (err) {
    if (!isNetworkError(err)) throw err;
    enqueue(op);
    setOffline(true);
  }
}

// Надіслати чергу по порядку. Повертає, скільки змін записано.
// Якщо відправка вже йде, нова не починається — повертається та сама.
export function flushOfflineQueue(): Promise<number> {
  if (!flushing) {
    flushing = sendQueue().finally(() => {
      flushing = null;
    });
  }
  return flushing;
}

// Без мережі, без сесії, на 401 чи 5xx зупиняється й лишає решту до наступного разу.
// Інші помилки (напр. задачу вже видалено) пропускає.
async function sendQueue(): Promise<number> {
  if (!getCurrentUserId()) return 0;
  if (readQueue().length === 0) return 0;
  if (!(await hasSession())) return 0;
  let sent = 0;
  const tried = new Set<string>();
  for (;;) {
    // Чергу перечитуємо перед кожною відправкою: поки йшла попередня, зміну
    // могли замінити новішою — тоді стара вже не надсилається
    const op = readQueue().find((o) => !tried.has(JSON.stringify(o)));
    if (!op) break;
    tried.add(JSON.stringify(op));
    try {
      const changed = await sendOp(op);
      // 0 рядків без помилки: задачу видалено або сесія зникла дорогою — тоді лишаємо
      if (changed === 0 && !(await hasSession())) break;
      if (changed !== 0) sent++;
    } catch (err) {
      if (isNetworkError(err) || isRetryableError(err)) break;
      // eslint-disable-next-line no-console
      console.error("Зміну з офлайн-черги не записано:", err);
    }
    dropQueuedExact(op);
  }
  return sent;
}

// Читає з бази й запам'ятовує; без мережі віддає збережене (або порожнє значення)
async function readWithCache<T>(key: string, empty: T, fetcher: () => Promise<T>): Promise<T> {
  try {
    const data = overlayQueue(key, await fetcher());
    writeCache(key, data);
    setOffline(false);
    return data;
  } catch (err) {
    if (!isNetworkError(err)) throw err;
    setOffline(true);
    const saved = readCacheStore()[key];
    return overlayQueue(key, saved ? (saved.data as T) : empty);
  }
}

function mapSubtask(row: any): Subtask {
  return {
    id: row.id,
    taskId: row.task_id,
    title: row.title,
    done: row.done,
    sortOrder: row.sort_order,
  };
}

function mapScheduledTask(row: any): ScheduledTask {
  return {
    id: row.id,
    date: row.date,
    startTime: row.start_time?.slice(0, 5) ?? row.start_time,
    endTime: row.end_time?.slice(0, 5) ?? row.end_time,
    title: row.title,
    category: row.category as Category,
    details: row.details,
    done: row.done,
    sortOrder: row.sort_order,
    subtasks: (row.subtasks ?? []).map(mapSubtask),
    remind: row.remind ?? null,
    remindBeforeMin: row.remind_before_min ?? null,
    seriesId: row.series_id ?? null,
  };
}

// Помилка «немає такої колонки»: міграцію ще не запущено
function isMissingColumn(error: { message?: string } | null, name: string): boolean {
  return new RegExp(name, "i").test(error?.message ?? "");
}

function isMissingRemindColumn(error: { message?: string } | null): boolean {
  return isMissingColumn(error, "remind");
}

// Вставляє рядки задач і повертає їхні id. Якщо міграції для remind чи series_id
// ще не запущено, повторює вставку без цих полів.
async function insertTaskRows(rows: Record<string, unknown>[]): Promise<string[]> {
  let current = rows;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await supabase.from("scheduled_tasks").insert(current).select("id");
    if (!res.error) return (res.data ?? []).map((r: any) => r.id as string);
    if (isMissingRemindColumn(res.error)) {
      current = current.map(({ remind, remind_before_min, ...rest }) => rest);
    } else if (isMissingColumn(res.error, "series_id")) {
      current = current.map(({ series_id, ...rest }) => rest);
    } else {
      throw res.error;
    }
  }
  throw new Error("Не вдалося зберегти задачу");
}

// Поля задачі, які змінює форма редагування
interface TaskFieldsInput {
  startTime: string;
  endTime: string;
  title: string;
  category: Category;
  details?: string | null;
  remind?: boolean | null;
  remindBeforeMin?: number | null;
}

// Оновлює поля кількох задач (без підзадач)
async function updateTaskFields(ids: string[], input: TaskFieldsInput): Promise<void> {
  if (ids.length === 0) return;
  const base = {
    start_time: input.startTime,
    end_time: input.endTime,
    title: input.title,
    category: input.category,
    details: input.details ?? null,
  };
  let { error } = await supabase
    .from("scheduled_tasks")
    .update({
      ...base,
      remind: input.remind ?? null,
      remind_before_min: input.remindBeforeMin ?? null,
    })
    .in("id", ids);
  if (error && isMissingRemindColumn(error)) {
    ({ error } = await supabase.from("scheduled_tasks").update(base).in("id", ids));
  }
  if (error) throw error;
}

/**
 * Приводить підзадачі задачі до списку з форми, не чіпаючи done.
 * knownIds — підзадачі, які форма бачила, коли її відкрили:
 * з них ті, що є в списку, — нова назва й sort_order за позицією, решта видаляються.
 * Без id або з чужим id — нові. otherIds — підзадачі, яких форма не бачила
 * (додані на ПК після відкриття дня): лишаються як є, лише стають після списку з форми.
 */
async function syncTaskSubtasks(
  taskId: string,
  knownIds: string[],
  drafts: SubtaskDraft[],
  otherIds: string[] = []
): Promise<void> {
  const known = new Set(knownIds);
  const isKnown = (d: SubtaskDraft) => !!d.id && known.has(d.id);

  const removed = knownIds.filter((id) => !drafts.some((d) => d.id === id));
  if (removed.length > 0) {
    const { error } = await supabase.from("subtasks").delete().in("id", removed);
    if (error) throw error;
  }

  const updates = await Promise.all([
    ...drafts.flatMap((d, i) =>
      isKnown(d) ? [supabase.from("subtasks").update({ title: d.title, sort_order: i }).eq("id", d.id!)] : []
    ),
    ...otherIds.map((id, i) => supabase.from("subtasks").update({ sort_order: drafts.length + i }).eq("id", id)),
  ]);
  const failed = updates.find((r) => r.error);
  if (failed?.error) throw failed.error;

  const rows = drafts.flatMap((d, i) => (isKnown(d) ? [] : [{ task_id: taskId, title: d.title, sort_order: i }]));
  if (rows.length > 0) {
    const { error } = await supabase.from("subtasks").insert(rows);
    if (error) throw error;
  }
}

// ---------- Заплановані задачі (Тип 1) ----------

export async function getScheduledTasks(date: string): Promise<ScheduledTask[]> {
  const userId = requireUserId();
  return readWithCache(`scheduled:${date}`, [], async () => {
    const { data, error } = await supabase
      .from("scheduled_tasks")
      .select("*, subtasks(*)")
      .eq("user_id", userId)
      .eq("date", date)
      .order("start_time", { ascending: true })
      .order("sort_order", { referencedTable: "subtasks", ascending: true });
    if (error) throw error;
    return (data ?? []).map(mapScheduledTask);
  });
}

function taskRow(
  userId: string,
  date: string,
  input: {
    startTime: string;
    endTime: string;
    title: string;
    category: Category;
    details?: string | null;
    remind?: boolean | null;
    remindBeforeMin?: number | null;
  },
  id: string,
  seriesId?: string
): Record<string, unknown> {
  const row: Record<string, unknown> = {
    id,
    user_id: userId,
    date,
    start_time: input.startTime,
    end_time: input.endTime,
    title: input.title,
    category: input.category,
    details: input.details ?? null,
  };
  // Поля нагадування й серії надсилаємо лише коли вони задані. Якщо міграцій
  // ще не запущено, insertTaskRows збереже задачу без них.
  if (input.remind != null) row.remind = input.remind;
  if (input.remindBeforeMin != null) row.remind_before_min = input.remindBeforeMin;
  if (seriesId) row.series_id = seriesId;
  return row;
}

// Помилка «немає такої функції»: міграцію ще не запущено
function isMissingFunction(error: { code?: string; message?: string } | null, name: string): boolean {
  if (!error) return false;
  if (error.code === "PGRST202" || error.code === "42883") return true;
  return new RegExp(name, "i").test(error.message ?? "") && /could not find|does not exist/i.test(error.message ?? "");
}

/**
 * Нова задача з підзадачами; якщо дат кілька — повторювана: однакові копії на кожну
 * дату зі спільним series_id. Записує все однією транзакцією через функцію
 * create_scheduled_tasks (migration_create_tasks.sql). Поки її немає: задачі одним
 * запитом, підзадачі — другим, а якщо другий не вдався, задачі видаляються
 * (підзадачі з ними — каскадом), щоб не лишилося задачі без частини підзадач.
 * Id задач створюємо самі: так знаємо, що прибирати, навіть коли відповідь загубилася.
 */
export async function createScheduledTasks(
  input: {
    startTime: string;
    endTime: string;
    title: string;
    category: Category;
    details?: string | null;
    subtasks: string[];
    remind?: boolean | null;
    remindBeforeMin?: number | null;
  },
  dates: string[]
): Promise<void> {
  const userId = requireUserId();
  const seriesId = dates.length > 1 ? crypto.randomUUID() : undefined;
  const ids = dates.map(() => crypto.randomUUID());
  const taskRows = dates.map((d, i) => taskRow(userId, d, input, ids[i], seriesId));

  const rpc = await supabase.rpc("create_scheduled_tasks", {
    tasks: taskRows,
    subtask_titles: input.subtasks,
  });
  if (!rpc.error) return;
  if (!isMissingFunction(rpc.error, "create_scheduled_tasks")) throw rpc.error;

  try {
    await insertTaskRows(taskRows);
    const rows = ids.flatMap((taskId) =>
      input.subtasks.map((title, i) => ({ task_id: taskId, title, sort_order: i }))
    );
    if (rows.length > 0) {
      const { error } = await supabase.from("subtasks").insert(rows);
      if (error) throw error;
    }
  } catch (err) {
    // Задач могло й не бути в базі — тоді видалення нічого не змінить.
    // Його власна помилка не важлива: показуємо першу.
    try {
      await supabase.from("scheduled_tasks").delete().in("id", ids);
    } catch {
      // нічого
    }
    throw err;
  }
}

// Задачі на кілька дат одразу — для перевірки накладок у повторюваній задачі
export async function getTasksOnDates(dates: string[]): Promise<ScheduledTask[]> {
  if (dates.length === 0) return [];
  const userId = requireUserId();
  const { data, error } = await supabase
    .from("scheduled_tasks")
    .select("*")
    .eq("user_id", userId)
    .in("date", dates);
  if (error) throw error;
  return (data ?? []).map(mapScheduledTask);
}

// Копії серії, починаючи з дати fromDate (включно)
export async function getSeriesTasksFrom(seriesId: string, fromDate: string): Promise<ScheduledTask[]> {
  const userId = requireUserId();
  const { data, error } = await supabase
    .from("scheduled_tasks")
    .select("*, subtasks(*)")
    .eq("user_id", userId)
    .eq("series_id", seriesId)
    .gte("date", fromDate)
    .order("sort_order", { referencedTable: "subtasks", ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapScheduledTask);
}

/**
 * Пари «підзадача відредагованої задачі → підзадача копії». У самій задачі — за id.
 * У копії — за назвою до змін: k-та підзадача з назвою X ↔ k-та з тією ж назвою в копії.
 * Порядок у копії не важливий; підзадачі, яких у копії немає, лишаються без пари.
 */
function matchSubtasks(base: { id: string; title: string }[], copy: Subtask[]): Map<string, string> {
  const pairs = new Map<string, string>();
  const free = [...copy].sort((a, b) => a.sortOrder - b.sortOrder);
  const take = (i: number) => free.splice(i, 1)[0].id;
  for (const b of base) {
    const i = free.findIndex((s) => s.id === b.id);
    if (i >= 0) pairs.set(b.id, take(i));
  }
  for (const b of base) {
    if (pairs.has(b.id)) continue;
    const i = free.findIndex((s) => s.title === b.title);
    if (i >= 0) pairs.set(b.id, take(i));
  }
  return pairs;
}

/**
 * «Цю й наступні»: однакові поля для всіх копій серії від fromDate (крім skipIds).
 * baseSubtasks — підзадачі відредагованої задачі на момент відкриття форми; з ними
 * зіставляються підзадачі кожної копії (matchSubtasks). Пара отримує нову назву й місце
 * (done лишається), пара прибраної у формі підзадачі видаляється, нові додаються.
 * Підзадачі копії без пари (додані лише в ній чи на ПК) лишаються з галочками.
 * Якщо підзадачу раніше прибрали лише з копії, у копію вона не повертається.
 */
export async function updateScheduledTaskSeries(
  seriesId: string,
  fromDate: string,
  input: TaskFieldsInput & { subtasks: SubtaskDraft[] },
  skipIds: string[],
  baseSubtasks: { id: string; title: string }[]
): Promise<void> {
  const { subtasks, ...fields } = input;
  const tasks = (await getSeriesTasksFrom(seriesId, fromDate)).filter((t) => !skipIds.includes(t.id));
  await updateTaskFields(
    tasks.map((t) => t.id),
    fields
  );
  const baseIds = new Set(baseSubtasks.map((s) => s.id));
  // По черзі: у серії бувають десятки копій
  for (const copy of tasks) {
    const pairs = matchSubtasks(baseSubtasks, copy.subtasks);
    const drafts = subtasks.flatMap((d): SubtaskDraft[] => {
      if (!d.id || !baseIds.has(d.id)) return [{ ...d, id: undefined }];
      const id = pairs.get(d.id);
      return id ? [{ ...d, id }] : [];
    });
    const paired = new Set(pairs.values());
    await syncTaskSubtasks(
      copy.id,
      [...paired],
      drafts,
      [...copy.subtasks]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .filter((s) => !paired.has(s.id))
        .map((s) => s.id)
    );
  }
}

export async function deleteScheduledTaskSeries(seriesId: string, fromDate: string): Promise<void> {
  const userId = requireUserId();
  const { error } = await supabase
    .from("scheduled_tasks")
    .delete()
    .eq("user_id", userId)
    .eq("series_id", seriesId)
    .gte("date", fromDate);
  if (error) throw error;
}

export async function toggleScheduledTask(id: string, done: boolean): Promise<void> {
  await writeOrQueue({ kind: "scheduledDone", id, done });
  // Без мережі перепланування не вдасться, тож нагадування виконаної задачі
  // прибираємо з телефона одразу. Зняту галочку поверне наступне перепланування.
  if (done) void forgetTaskReminders(id);
}

/**
 * baseSubtaskIds — id підзадач задачі на момент відкриття форми. Видаляються лише ті
 * з них, які прибрали у формі. Підзадачі, додані на ПК тим часом, лишаються з галочками.
 */
export async function updateScheduledTask(
  id: string,
  input: TaskFieldsInput & { subtasks: SubtaskDraft[] },
  baseSubtaskIds: string[]
): Promise<void> {
  const { subtasks, ...fields } = input;
  await updateTaskFields([id], fields);
  const { data, error } = await supabase
    .from("subtasks")
    .select("id")
    .eq("task_id", id)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  const base = new Set(baseSubtaskIds);
  await syncTaskSubtasks(
    id,
    baseSubtaskIds,
    subtasks,
    (data ?? []).map((r) => r.id as string).filter((sid) => !base.has(sid))
  );
}

// Перетягування в календарі: новий день і час, решта полів і підзадачі не змінюються
export async function moveScheduledTasks(
  moves: { id: string; date: string; startTime: string; endTime: string }[]
): Promise<void> {
  const results = await Promise.all(
    moves.map((m) =>
      supabase
        .from("scheduled_tasks")
        .update({ date: m.date, start_time: m.startTime, end_time: m.endTime })
        .eq("id", m.id)
    )
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) throw failed.error;
}

export async function deleteScheduledTask(id: string): Promise<void> {
  const { error } = await supabase.from("scheduled_tasks").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Підзадачі ----------

export async function toggleSubtask(id: string, done: boolean): Promise<void> {
  await writeOrQueue({ kind: "subtaskDone", id, done });
}

// ---------- Задачі дня (Тип 2) ----------

export async function getDailyTasks(date: string): Promise<DailyTask[]> {
  const userId = requireUserId();
  return readWithCache(`daily:${date}`, [], async () => {
    const { data, error } = await supabase
      .from("daily_tasks")
      .select("*")
      .eq("user_id", userId)
      .eq("date", date)
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((row: any) => ({
      id: row.id,
      date: row.date,
      title: row.title,
      done: row.done,
      sortOrder: row.sort_order,
    }));
  });
}

export async function addDailyTask(date: string, title: string): Promise<string> {
  const userId = requireUserId();
  const { data, error } = await supabase
    .from("daily_tasks")
    .insert({ user_id: userId, date, title })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function toggleDailyTask(id: string, done: boolean): Promise<void> {
  await writeOrQueue({ kind: "dailyDone", id, done });
}

export async function updateDailyTask(id: string, title: string): Promise<void> {
  const { error } = await supabase.from("daily_tasks").update({ title }).eq("id", id);
  if (error) throw error;
}

export async function deleteDailyTask(id: string): Promise<void> {
  const { error } = await supabase.from("daily_tasks").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Задачі на кілька днів (Тип 2б) ----------

// Помилка «немає такої таблиці»: міграцію ще не запущено
export function isMissingTable(error: { code?: string; message?: string } | null, table: string): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  const message = error.message ?? "";
  return new RegExp(table, "i").test(message) && /does not exist|could not find/i.test(message);
}

export async function getMultiDayTasks(date: string): Promise<MultiDayTask[]> {
  const userId = requireUserId();
  return readWithCache(`multitask:${date}`, [], async () => {
    const { data, error } = await supabase
      .from("multi_day_tasks")
      .select("*")
      .eq("user_id", userId)
      .lte("start_date", date)
      .gte("end_date", date)
      .order("sort_order", { ascending: true })
      .order("start_date", { ascending: true });
    // Без міграції migration_multi_day_tasks.sql таких задач просто немає
    if (error && isMissingTable(error, "multi_day_tasks")) return [];
    if (error) throw error;
    return (data ?? []).map((row: any) => ({
      id: row.id,
      title: row.title,
      done: row.done,
      startDate: row.start_date,
      endDate: row.end_date,
      sortOrder: row.sort_order,
    }));
  });
}

export async function createMultiDayTask(input: { title: string; startDate: string; endDate: string }): Promise<string> {
  const userId = requireUserId();
  const { data, error } = await supabase
    .from("multi_day_tasks")
    .insert({ user_id: userId, title: input.title, start_date: input.startDate, end_date: input.endDate })
    .select("id")
    .single();
  if (error && isMissingTable(error, "multi_day_tasks")) {
    throw new Error("У базі ще немає таблиці multi_day_tasks: запустіть migration_multi_day_tasks.sql");
  }
  if (error) throw error;
  return data.id as string;
}

export async function toggleMultiDayTask(id: string, done: boolean): Promise<void> {
  await writeOrQueue({ kind: "multiDayTaskDone", id, done });
}

export async function updateMultiDayTask(id: string, title: string): Promise<void> {
  const { error } = await supabase.from("multi_day_tasks").update({ title }).eq("id", id);
  if (error) throw error;
}

export async function deleteMultiDayTask(id: string): Promise<void> {
  const { error } = await supabase.from("multi_day_tasks").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Нотатки (Тип 3) ----------

export async function getNote(date: string): Promise<DayNote> {
  const userId = requireUserId();
  return readWithCache(`note:${date}`, { date, content: "" }, async () => {
    const { data, error } = await supabase
      .from("notes")
      .select("*")
      .eq("user_id", userId)
      .eq("date", date)
      .maybeSingle();
    if (error) throw error;
    return { date, content: data?.content ?? "" };
  });
}

export async function saveNote(date: string, content: string): Promise<void> {
  await writeOrQueue({ kind: "note", date, content });
}

// ---------- Багатоденні нотатки (Тип 3б) ----------

export async function getMultiDayNotes(date: string): Promise<MultiDayNote[]> {
  const userId = requireUserId();
  return readWithCache(`multi:${date}`, [], async () => {
    const { data, error } = await supabase
      .from("multi_day_notes")
      .select("*")
      .eq("user_id", userId)
      .lte("start_date", date)
      .gte("end_date", date)
      .order("start_date", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((row: any) => ({
      id: row.id,
      title: row.title,
      content: row.content,
      startDate: row.start_date,
      endDate: row.end_date,
    }));
  });
}

export async function createMultiDayNote(input: {
  title: string;
  content: string;
  startDate: string;
  endDate: string;
}): Promise<string> {
  const userId = requireUserId();
  const { data, error } = await supabase
    .from("multi_day_notes")
    .insert({
      user_id: userId,
      title: input.title,
      content: input.content,
      start_date: input.startDate,
      end_date: input.endDate,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function deleteMultiDayNote(id: string): Promise<void> {
  const { error } = await supabase.from("multi_day_notes").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Зведення для картки дня в бічній панелі ----------

export async function getDaySummary(date: string) {
  const tasks = await getScheduledTasks(date);
  return {
    date,
    scheduledTasks: tasks,
    totalCount: tasks.length,
    doneCount: tasks.filter((t) => t.done).length,
  };
}
