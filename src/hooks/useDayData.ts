import { useCallback, useEffect, useRef, useState } from "react";
import * as db from "@/db/database";
import { toast } from "@/lib/toast";
import type { Category, DailyTask, DayNote, MultiDayNote, MultiDayTask, ScheduledTask, SeriesScope, SubtaskDraft } from "@/types";

export function useDayData(date: string) {
  const [scheduledTasks, setScheduledTasks] = useState<ScheduledTask[]>([]);
  const [dailyTasks, setDailyTasks] = useState<DailyTask[]>([]);
  const [multiDayTasks, setMultiDayTasks] = useState<MultiDayTask[]>([]);
  // date "" — нотатку ще не завантажено; поле на екрані чекає її
  const [note, setNote] = useState<DayNote>({ date: "", content: "" });
  const [multiDayNotes, setMultiDayNotes] = useState<MultiDayNote[]>([]);
  const [loading, setLoading] = useState(true);
  // Актуальні заплановані задачі: щоб рахувати зміни поза setState
  const scheduledTasksRef = useRef<ScheduledTask[]>([]);
  scheduledTasksRef.current = scheduledTasks;

  // Номер останнього читання: відповідь старішого (напр. попереднього дня при
  // швидкому гортанні на повільній мережі) не має лягти на екран поверх свіжого
  const requestRef = useRef(0);
  // День, чиї задачі зараз на екрані
  const shownDateRef = useRef<string | null>(null);
  // Записи нотаток за днями: скільки разів і що записано останнім. Читання, під час
  // якого нотатку зберегли, могло прочитати з бази старіший текст — його не показуємо.
  const noteWritesRef = useRef(new Map<string, { count: number; content: string }>());

  const reload = useCallback(async () => {
    const request = ++requestRef.current;
    const noteWritesBefore = noteWritesRef.current.get(date)?.count ?? 0;
    setLoading(true);
    try {
      const [tasks, daily, spanningTasks, dayNote, spanning] = await Promise.all([
        db.getScheduledTasks(date),
        db.getDailyTasks(date),
        db.getMultiDayTasks(date),
        db.getNote(date),
        db.getMultiDayNotes(date),
      ]);
      if (request !== requestRef.current) return;
      setScheduledTasks(tasks);
      setDailyTasks(daily);
      setMultiDayTasks(spanningTasks);
      const noteWrite = noteWritesRef.current.get(date);
      setNote(noteWrite && noteWrite.count !== noteWritesBefore ? { date, content: noteWrite.content } : dayNote);
      setMultiDayNotes(spanning);
      shownDateRef.current = date;
    } catch (err) {
      if (request !== requestRef.current) return;
      // eslint-disable-next-line no-console
      console.error("Не вдалося завантажити день:", err);
      // Під новою датою не лишаємо задач попереднього дня: галочка змінила б не той день
      if (shownDateRef.current !== date) {
        setScheduledTasks([]);
        setDailyTasks([]);
        setMultiDayTasks([]);
        setMultiDayNotes([]);
        shownDateRef.current = null;
      }
      toast.error("Не вдалося завантажити день", { message: "Спробуйте ще раз трохи згодом." });
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
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
    const parentChanges: { id: string; done: boolean }[] = [];
    const next = scheduledTasksRef.current.map((t) => {
      if (!t.subtasks.some((s) => s.id === id)) return t;
      const updatedSubtasks = t.subtasks.map((s) => (s.id === id ? { ...s, done } : s));
      const allDone = updatedSubtasks.length > 0 && updatedSubtasks.every((s) => s.done);
      const nextDone = allDone ? true : done ? t.done : false;
      if (nextDone !== t.done) parentChanges.push({ id: t.id, done: nextDone });
      return { ...t, subtasks: updatedSubtasks, done: nextDone };
    });
    scheduledTasksRef.current = next;
    setScheduledTasks(next);
    for (const change of parentChanges) db.toggleScheduledTask(change.id, change.done);
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

  // Галочка одна на весь діапазон: інші дні прочитають її з бази чи з кешу
  const toggleMultiDayTask = useCallback(async (id: string, done: boolean) => {
    await db.toggleMultiDayTask(id, done);
    setMultiDayTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done } : t)));
  }, []);

  const editMultiDayTask = useCallback(async (id: string, title: string) => {
    if (!title.trim()) return;
    await db.updateMultiDayTask(id, title.trim());
    setMultiDayTasks((prev) => prev.map((t) => (t.id === id ? { ...t, title: title.trim() } : t)));
  }, []);

  const addMultiDayTask = useCallback(
    async (input: { title: string; startDate: string; endDate: string }) => {
      if (!input.title.trim()) return;
      await db.createMultiDayTask({ ...input, title: input.title.trim() });
      await reload();
    },
    [reload]
  );

  const deleteMultiDayTask = useCallback(async (id: string) => {
    await db.deleteMultiDayTask(id);
    setMultiDayTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addScheduledTask = useCallback(
    async (input: {
      date?: string; // інший день, ніж відкритий (створення з календаря)
      startTime: string;
      endTime: string;
      title: string;
      category: Category;
      details?: string;
      subtasks?: SubtaskDraft[];
      remind?: boolean | null;
      remindBeforeMin?: number | null;
      repeatDates?: string[]; // інші дні повторюваної задачі, крім поточного
    }) => {
      const { subtasks = [], repeatDates = [], date: taskDate = date, ...rest } = input;
      await db.createScheduledTasks(
        { ...rest, subtasks: subtasks.map((s) => s.title) },
        [taskDate, ...repeatDates]
      );
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
        subtasks?: SubtaskDraft[];
        remind?: boolean | null;
        remindBeforeMin?: number | null;
      },
      // Підзадачі задачі на момент відкриття форми: видаляються лише ті з них,
      // які прибрали у формі
      baseSubtasks: { id: string; title: string }[],
      // Для «цієї й наступних»: серія, з якої дати, які копії не чіпати (накладки)
      series?: { seriesId: string; fromDate: string; skipIds: string[] }
    ) => {
      const { subtasks = [], ...rest } = input;
      if (series) {
        await db.updateScheduledTaskSeries(
          series.seriesId,
          series.fromDate,
          { ...rest, subtasks },
          series.skipIds,
          baseSubtasks.map(({ id, title }) => ({ id, title }))
        );
      } else {
        await db.updateScheduledTask(
          id,
          { ...rest, subtasks },
          baseSubtasks.map((s) => s.id)
        );
      }
      await reload();
    },
    [reload]
  );

  const deleteScheduledTask = useCallback(async (task: ScheduledTask, scope: SeriesScope = "one") => {
    if (scope === "following" && task.seriesId) {
      await db.deleteScheduledTaskSeries(task.seriesId, task.date);
    } else {
      await db.deleteScheduledTask(task.id);
    }
    setScheduledTasks((prev) => prev.filter((t) => t.id !== task.id));
  }, []);

  const saveNote = useCallback(
    async (content: string) => {
      // Таймер автозбереження міг спрацювати вже після переходу на інший день:
      // текст іде в базу свого дня, а на екрані лишається нотатка нового.
      setNote((prev) => (prev.date === date ? { date, content } : prev));
      const count = (noteWritesRef.current.get(date)?.count ?? 0) + 1;
      noteWritesRef.current.set(date, { count, content });
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
    multiDayTasks,
    note,
    multiDayNotes,
    toggleScheduledTask,
    toggleSubtask,
    toggleDailyTask,
    editDailyTask,
    addDailyTask,
    deleteDailyTask,
    toggleMultiDayTask,
    editMultiDayTask,
    addMultiDayTask,
    deleteMultiDayTask,
    addScheduledTask,
    updateScheduledTask,
    deleteScheduledTask,
    saveNote,
    addMultiDayNote,
    deleteMultiDayNote,
    reload,
  };
}
