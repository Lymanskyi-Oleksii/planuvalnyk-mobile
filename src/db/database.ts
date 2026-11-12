import { supabase } from "@/lib/supabaseClient";
import { requireUserId } from "@/lib/session";
import type { Category, DailyTask, DayNote, MultiDayNote, ScheduledTask, Subtask } from "@/types";

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

// Оновлює поля кількох задач і перестворює їхні підзадачі
async function updateTaskRows(
  ids: string[],
  input: {
    startTime: string;
    endTime: string;
    title: string;
    category: Category;
    details?: string | null;
    subtasks: string[];
    remind?: boolean | null;
    remindBeforeMin?: number | null;
  }
): Promise<void> {
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

  // Найпростіший надійний спосіб синхронізувати підзадачі — перестворити їх
  const { error: delErr } = await supabase.from("subtasks").delete().in("task_id", ids);
  if (delErr) throw delErr;

  const rows = ids.flatMap((taskId) =>
    input.subtasks.map((title, i) => ({ task_id: taskId, title, sort_order: i }))
  );
  if (rows.length > 0) {
    const { error: insErr } = await supabase.from("subtasks").insert(rows);
    if (insErr) throw insErr;
  }
}

// ---------- Заплановані задачі (Тип 1) ----------

export async function getScheduledTasks(date: string): Promise<ScheduledTask[]> {
  const userId = requireUserId();
  const { data, error } = await supabase
    .from("scheduled_tasks")
    .select("*, subtasks(*)")
    .eq("user_id", userId)
    .eq("date", date)
    .order("start_time", { ascending: true })
    .order("sort_order", { referencedTable: "subtasks", ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapScheduledTask);
}

export async function createScheduledTask(input: {
  date: string;
  startTime: string;
  endTime: string;
  title: string;
  category: Category;
  details?: string | null;
  remind?: boolean | null;
  remindBeforeMin?: number | null;
}): Promise<string> {
  const [id] = await insertTaskRows([taskRow(requireUserId(), input.date, input)]);
  return id;
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
  seriesId?: string
): Record<string, unknown> {
  const row: Record<string, unknown> = {
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

// Повторювана задача: однакові копії на кожну з дат зі спільним series_id
export async function createScheduledTaskSeries(
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
  const seriesId = crypto.randomUUID();
  const ids = await insertTaskRows(dates.map((d) => taskRow(userId, d, input, seriesId)));
  const rows = ids.flatMap((taskId) =>
    input.subtasks.map((title, i) => ({ task_id: taskId, title, sort_order: i }))
  );
  if (rows.length > 0) {
    const { error } = await supabase.from("subtasks").insert(rows);
    if (error) throw error;
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
    .select("*")
    .eq("user_id", userId)
    .eq("series_id", seriesId)
    .gte("date", fromDate);
  if (error) throw error;
  return (data ?? []).map(mapScheduledTask);
}

export async function updateScheduledTaskSeries(
  seriesId: string,
  fromDate: string,
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
  skipIds: string[] = []
): Promise<void> {
  const tasks = await getSeriesTasksFrom(seriesId, fromDate);
  const ids = tasks.map((t) => t.id).filter((id) => !skipIds.includes(id));
  await updateTaskRows(ids, input);
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
  const { error } = await supabase.from("scheduled_tasks").update({ done }).eq("id", id);
  if (error) throw error;
}

export async function updateScheduledTask(
  id: string,
  input: {
    startTime: string;
    endTime: string;
    title: string;
    category: Category;
    details?: string | null;
    subtasks: string[];
    remind?: boolean | null;
    remindBeforeMin?: number | null;
  }
): Promise<void> {
  await updateTaskRows([id], input);
}

export async function deleteScheduledTask(id: string): Promise<void> {
  const { error } = await supabase.from("scheduled_tasks").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Підзадачі ----------

export async function addSubtask(taskId: string, title: string): Promise<string> {
  const { data, error } = await supabase
    .from("subtasks")
    .insert({ task_id: taskId, title })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function toggleSubtask(id: string, done: boolean): Promise<void> {
  const { error } = await supabase.from("subtasks").update({ done }).eq("id", id);
  if (error) throw error;
}

// ---------- Задачі дня (Тип 2) ----------

export async function getDailyTasks(date: string): Promise<DailyTask[]> {
  const userId = requireUserId();
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
  const { error } = await supabase.from("daily_tasks").update({ done }).eq("id", id);
  if (error) throw error;
}

export async function updateDailyTask(id: string, title: string): Promise<void> {
  const { error } = await supabase.from("daily_tasks").update({ title }).eq("id", id);
  if (error) throw error;
}

export async function deleteDailyTask(id: string): Promise<void> {
  const { error } = await supabase.from("daily_tasks").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Нотатки (Тип 3) ----------

export async function getNote(date: string): Promise<DayNote> {
  const userId = requireUserId();
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .eq("user_id", userId)
    .eq("date", date)
    .maybeSingle();
  if (error) throw error;
  return { date, content: data?.content ?? "" };
}

export async function saveNote(date: string, content: string): Promise<void> {
  const userId = requireUserId();
  const { error } = await supabase
    .from("notes")
    .upsert({ user_id: userId, date, content }, { onConflict: "user_id,date" });
  if (error) throw error;
}

// ---------- Багатоденні нотатки (Тип 3б) ----------

export async function getMultiDayNotes(date: string): Promise<MultiDayNote[]> {
  const userId = requireUserId();
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
