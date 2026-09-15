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
  };
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
}): Promise<string> {
  const userId = requireUserId();
  const { data, error } = await supabase
    .from("scheduled_tasks")
    .insert({
      user_id: userId,
      date: input.date,
      start_time: input.startTime,
      end_time: input.endTime,
      title: input.title,
      category: input.category,
      details: input.details ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
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
  }
): Promise<void> {
  const { error } = await supabase
    .from("scheduled_tasks")
    .update({
      start_time: input.startTime,
      end_time: input.endTime,
      title: input.title,
      category: input.category,
      details: input.details ?? null,
    })
    .eq("id", id);
  if (error) throw error;

  // Найпростіший надійний спосіб синхронізувати підзадачі — перестворити їх
  const { error: delErr } = await supabase.from("subtasks").delete().eq("task_id", id);
  if (delErr) throw delErr;

  if (input.subtasks.length > 0) {
    const rows = input.subtasks.map((title, i) => ({ task_id: id, title, sort_order: i }));
    const { error: insErr } = await supabase.from("subtasks").insert(rows);
    if (insErr) throw insErr;
  }
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
