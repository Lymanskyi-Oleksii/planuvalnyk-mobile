import { useCallback, useEffect, useState } from "react";
import * as db from "@/db/database";
import type { Category, DailyTask, DayNote, MultiDayNote, ScheduledTask } from "@/types";

export function useDayData(date: string) {
  const [scheduledTasks, setScheduledTasks] = useState<ScheduledTask[]>([]);
  const [dailyTasks, setDailyTasks] = useState<DailyTask[]>([]);
  const [note, setNote] = useState<DayNote>({ date, content: "" });
  const [multiDayNotes, setMultiDayNotes] = useState<MultiDayNote[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const [tasks, daily, dayNote, spanning] = await Promise.all([
      db.getScheduledTasks(date),
      db.getDailyTasks(date),
      db.getNote(date),
      db.getMultiDayNotes(date),
    ]);
    setScheduledTasks(tasks);
    setDailyTasks(daily);
    setNote(dayNote);
    setMultiDayNotes(spanning);
    setLoading(false);
  }, [date]);

  useEffect(() => {
    reload();
  }, [reload]);

  const toggleScheduledTask = useCallback(async (id: string, done: boolean) => {
    await db.toggleScheduledTask(id, done);
    setScheduledTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done } : t)));
  }, []);

  // Якщо всі підзадачі виконані — основна задача теж позначається виконаною,
  // і навпаки: зняття галочки з будь-якої підзадачі знімає й з основної.
  const toggleSubtask = useCallback(async (id: string, done: boolean) => {
    await db.toggleSubtask(id, done);
    setScheduledTasks((prev) =>
      prev.map((t) => {
        if (!t.subtasks.some((s) => s.id === id)) return t;
        const updatedSubtasks = t.subtasks.map((s) => (s.id === id ? { ...s, done } : s));
        const allDone = updatedSubtasks.length > 0 && updatedSubtasks.every((s) => s.done);
        const nextDone = allDone ? true : done ? t.done : false;
        if (nextDone !== t.done) {
          db.toggleScheduledTask(t.id, nextDone);
        }
        return { ...t, subtasks: updatedSubtasks, done: nextDone };
      })
    );
  }, []);

  const toggleDailyTask = useCallback(async (id: string, done: boolean) => {
    await db.toggleDailyTask(id, done);
    setDailyTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done } : t)));
  }, []);

  const editDailyTask = useCallback(async (id: string, title: string) => {
    if (!title.trim()) return;
    await db.updateDailyTask(id, title.trim());
    setDailyTasks((prev) => prev.map((t) => (t.id === id ? { ...t, title: title.trim() } : t)));
  }, []);

  const addDailyTask = useCallback(
    async (title: string) => {
      if (!title.trim()) return;
      await db.addDailyTask(date, title.trim());
      await reload();
    },
    [date, reload]
  );

  const deleteDailyTask = useCallback(async (id: string) => {
    await db.deleteDailyTask(id);
    setDailyTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addScheduledTask = useCallback(
    async (input: {
      startTime: string;
      endTime: string;
      title: string;
      category: Category;
      details?: string;
      subtasks?: string[];
    }) => {
      const { subtasks = [], ...rest } = input;
      const taskId = await db.createScheduledTask({ date, ...rest });
      for (const title of subtasks) {
        await db.addSubtask(taskId, title);
      }
      await reload();
    },
    [date, reload]
  );

  const updateScheduledTask = useCallback(
    async (
      id: string,
      input: {
        startTime: string;
        endTime: string;
        title: string;
        category: Category;
        details?: string;
        subtasks?: string[];
      }
    ) => {
      const { subtasks = [], ...rest } = input;
      await db.updateScheduledTask(id, { ...rest, subtasks });
      await reload();
    },
    [reload]
  );

  const deleteScheduledTask = useCallback(async (id: string) => {
    await db.deleteScheduledTask(id);
    setScheduledTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const saveNote = useCallback(
    async (content: string) => {
      setNote({ date, content });
      await db.saveNote(date, content);
    },
    [date]
  );

  const addMultiDayNote = useCallback(
    async (input: { title: string; content: string; startDate: string; endDate: string }) => {
      await db.createMultiDayNote(input);
      await reload();
    },
    [reload]
  );

  const deleteMultiDayNote = useCallback(async (id: string) => {
    await db.deleteMultiDayNote(id);
    setMultiDayNotes((prev) => prev.filter((n) => n.id !== id));
  }, []);

  return {
    loading,
    scheduledTasks,
    dailyTasks,
    note,
    multiDayNotes,
    toggleScheduledTask,
    toggleSubtask,
    toggleDailyTask,
    editDailyTask,
    addDailyTask,
    deleteDailyTask,
    addScheduledTask,
    updateScheduledTask,
    deleteScheduledTask,
    saveNote,
    addMultiDayNote,
    deleteMultiDayNote,
    reload,
  };
}
