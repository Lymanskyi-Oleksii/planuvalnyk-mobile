import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabaseClient";
import { setCurrentUserId } from "./lib/session";
import { TitleBar } from "./components/TitleBar";
import { AuthScreen } from "./components/AuthScreen";
import { TodaySchedule } from "./components/TodaySchedule";
import { NotesPanel } from "./components/NotesPanel";
import { DailyTasksPanel } from "./components/DailyTasksPanel";
import { WeekSidebar } from "./components/WeekSidebar";
import { WeekStrip } from "./components/WeekStrip";
import { MobileTabs, type MobileTab } from "./components/MobileTabs";
import { AddTaskModal } from "./components/AddTaskModal";
import { useDayData } from "./hooks/useDayData";
import { useWeekSummaries } from "./hooks/useWeekSummaries";
import { addDays, toISODate } from "./lib/date";
import { startOfWeekISO, weekDates } from "./lib/week";
import { useHorizontalSwipe } from "./lib/useSwipe";
import { keepPendingDone, rescheduleReminders, takePendingDone } from "./lib/reminders";
import { toggleScheduledTask as setScheduledTaskDone } from "./db/database";
import { subscribeSettings } from "./lib/settings";
import { SettingsScreen } from "./components/SettingsScreen";
import { Toaster } from "./components/Toaster";
import { toast } from "./lib/toast";
import type { ScheduledTask } from "./types";

const TODAY = toISODate(new Date());

export default function App() {
  // undefined = ще перевіряємо сесію, null = не авторизований, Session = увійшли
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setCurrentUserId(data.session?.user.id ?? null);
      setSession(data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setCurrentUserId(next?.user.id ?? null);
      setSession(next);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  let screen: React.ReactNode;
  if (session === undefined) {
    screen = (
      <div className="flex h-screen items-center justify-center bg-canvas text-sm text-muted">
        Завантаження...
      </div>
    );
  } else if (!session) {
    screen = <AuthScreen onAuthenticated={() => {}} />;
  } else {
    screen = <PlannerApp />;
  }

  return (
    <>
      {screen}
      <Toaster />
    </>
  );
}

function errorText(err: unknown): string {
  const message = (err as { message?: unknown } | null)?.message;
  return typeof message === "string" && message ? message : "Перевірте з'єднання з інтернетом і спробуйте ще раз.";
}

function PlannerApp() {
  const [activeDate, setActiveDate] = useState(TODAY);
  const [activeTab, setActiveTab] = useState<MobileTab>("day");
  const [modalOpen, setModalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<ScheduledTask | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const bump = () => setRefreshKey((k) => k + 1);

  const {
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
  } = useDayData(activeDate);

  // Тиждень, який показано в смужці зверху. Навмисно ОКРЕМИЙ від activeDate:
  // гортання тижня не повинно саме по собі переставляти обраний день.
  const [weekViewAnchor, setWeekViewAnchor] = useState(() => weekDates(activeDate)[3]);

  useEffect(() => {
    // Синхронізуємо смужку з обраним днем, лише якщо день "вистрибнув"
    // в інший тиждень (напр. через свайп днів). Саму зміну тижня (гортання
    // смужки) цей ефект не чіпає, бо activeDate тоді не змінюється.
    if (startOfWeekISO(activeDate) !== startOfWeekISO(weekViewAnchor)) {
      setWeekViewAnchor(weekDates(activeDate)[3]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDate]);

  const weekSummaries = useWeekSummaries(weekViewAnchor, refreshKey, 3, 3);

  // Локальні нагадування на найближчі дні: перепланувати при відкритті,
  // після кожної зміни задач і коли застосунок повертається на передній план.
  useEffect(() => {
    void rescheduleReminders();
  }, [refreshKey]);

  // Кнопка «Виконано» в сповіщенні лише ставить задачу в чергу на телефоні;
  // позначаємо її тут — при старті й коли застосунок повертається на передній план.
  useEffect(() => {
    let running = false;
    const applyPendingDone = async () => {
      if (running) return;
      running = true;
      try {
        const ids = await takePendingDone();
        if (ids.length === 0) return;
        const failed: string[] = [];
        for (const id of ids) {
          try {
            await setScheduledTaskDone(id, true);
          } catch {
            failed.push(id);
          }
        }
        keepPendingDone(failed); // спробуємо ще раз наступного разу
        if (failed.length < ids.length) bump();
      } finally {
        running = false;
      }
    };

    void applyPendingDone();
    const onVisible = () => {
      if (document.visibilityState === "visible") void applyPendingDone();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void rescheduleReminders();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  // Зміна налаштувань нагадувань: перепланувати з невеликою затримкою,
  // щоб не робити це на кожен рух повзунка.
  useEffect(() => {
    let timer: number | undefined;
    const unsubscribe = subscribeSettings(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void rescheduleReminders(), 600);
    });
    return () => {
      unsubscribe();
      window.clearTimeout(timer);
    };
  }, []);

  // Свайп по контенту (день/задачі/нотатки) перемикає день.
  const daySwipe = useHorizontalSwipe(
    () => setActiveDate((d) => addDays(d, 1)),
    () => setActiveDate((d) => addDays(d, -1)),
  );

  function openCreateModal() {
    setEditingTask(null);
    setModalOpen(true);
  }

  function openEditModal(task: ScheduledTask) {
    setEditingTask(task);
    setModalOpen(true);
  }

  async function handleSaveTask(values: {
    startTime: string;
    endTime: string;
    title: string;
    category: ScheduledTask["category"];
    details?: string;
    subtasks: string[];
    remind: boolean | null;
    remindBeforeMin: number | null;
  }) {
    try {
      if (editingTask) {
        await updateScheduledTask(editingTask.id, values);
      } else {
        await addScheduledTask(values);
      }
      bump();
    } catch (err) {
      toast.error("Не вдалося зберегти задачу", { message: errorText(err) });
    }
  }

  async function handleDeleteTask(id: string) {
    try {
      await deleteScheduledTask(id);
      bump();
    } catch (err) {
      toast.error("Не вдалося видалити задачу", { message: errorText(err) });
    }
  }

  async function handleToggleTask(id: string, done: boolean) {
    await toggleScheduledTask(id, done);
    bump();
  }

  async function handleToggleSubtask(id: string, done: boolean) {
    await toggleSubtask(id, done);
    bump();
  }

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  // На телефоні показуємо лише активну вкладку, на планшеті/десктопі — все одразу.
  const onlyOnTab = (tab: MobileTab) => (activeTab === tab ? "" : "hidden sm:block");

  return (
    <div className="flex h-screen flex-col bg-canvas font-sans text-ink">
      <TitleBar onLogout={handleLogout} onOpenSettings={() => setSettingsOpen(true)} />

      <div className="sm:hidden">
        <WeekStrip
          weekAnchor={weekViewAnchor}
          activeDate={activeDate}
          summaries={weekSummaries}
          onSelect={setActiveDate}
          onShiftWeek={(dir) => setWeekViewAnchor((d) => addDays(d, dir * 7))}
          onGoToday={() => {
            setActiveDate(TODAY);
            setWeekViewAnchor(weekDates(TODAY)[3]);
          }}
        />
      </div>

      <main className="flex flex-1 flex-col gap-5 overflow-y-auto p-4 sm:flex-row sm:overflow-hidden sm:p-5">
        <div
          className="flex flex-1 flex-col gap-5 sm:overflow-y-auto"
          style={{ touchAction: "pan-y" }}
          {...daySwipe}
        >
          <div className={onlyOnTab("day")}>
            <TodaySchedule
              date={activeDate}
              tasks={scheduledTasks}
              onPrevDay={() => setActiveDate((d) => addDays(d, -1))}
              onNextDay={() => setActiveDate((d) => addDays(d, 1))}
              onToggleTask={handleToggleTask}
              onToggleSubtask={handleToggleSubtask}
              onAddTask={openCreateModal}
              onEditTask={openEditModal}
              onDeleteTask={handleDeleteTask}
            />
          </div>

          <div
            className={`grid grid-cols-1 gap-5 sm:grid-cols-2 ${
              activeTab === "day" ? "hidden sm:grid" : ""
            }`}
          >
            <div className={onlyOnTab("notes")}>
              <NotesPanel
                date={activeDate}
                content={note.content}
                onSave={saveNote}
                multiDayNotes={multiDayNotes}
                onAddMultiDayNote={addMultiDayNote}
                onDeleteMultiDayNote={deleteMultiDayNote}
              />
            </div>
            <div className={onlyOnTab("tasks")}>
              <DailyTasksPanel
                tasks={dailyTasks}
                onToggle={toggleDailyTask}
                onAdd={addDailyTask}
                onEdit={editDailyTask}
                onDelete={deleteDailyTask}
              />
            </div>
          </div>
        </div>

        <div className="hidden shrink-0 sm:block">
          <WeekSidebar summaries={weekSummaries} activeDate={activeDate} onSelect={setActiveDate} />
        </div>
      </main>

      <MobileTabs active={activeTab} onChange={setActiveTab} />

      <SettingsScreen open={settingsOpen} onClose={() => setSettingsOpen(false)} onLogout={handleLogout} />

      <AddTaskModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSaveTask}
        editingTask={editingTask}
        existingTasks={scheduledTasks}
      />
    </div>
  );
}
