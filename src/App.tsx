import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabaseClient";
import { setCurrentUserId } from "./lib/session";
import { TitleBar } from "./components/TitleBar";
import { AuthScreen } from "./components/AuthScreen";
import { TodaySchedule } from "./components/TodaySchedule";
import { CalendarView } from "./components/CalendarView";
import { useView } from "./hooks/useView";
import { saveView } from "./lib/settings";
import { NotesPanel } from "./components/NotesPanel";
import { DailyTasksPanel } from "./components/DailyTasksPanel";
import { WeekSidebar } from "./components/WeekSidebar";
import { WeekStrip } from "./components/WeekStrip";
import { MobileTabs, type MobileTab } from "./components/MobileTabs";
import { AddTaskModal, type TaskFormValues } from "./components/AddTaskModal";
import { useDayData } from "./hooks/useDayData";
import { useWeekSummaries } from "./hooks/useWeekSummaries";
import { addDays, daysBetween, toISODate } from "./lib/date";
import { planSeriesMove } from "./lib/overlap";
import type { DropTarget } from "./hooks/useCalendarDrag";
import { startOfWeekISO, weekDates } from "./lib/week";
import { useHorizontalSwipe } from "./lib/useSwipe";
import {
  ackDone,
  pendingDone,
  rescheduleReminders,
  syncNativeAuth,
  takeOpenDate,
} from "./lib/reminders";
import { onAppResume } from "./lib/appResume";
import { initBackButton, setRootBackHandler } from "./lib/backButton";
import {
  clearOfflineCache,
  flushOfflineQueue,
  getSeriesTasksFrom,
  getTasksOnDates,
  isOffline,
  moveScheduledTasks,
  subscribeOffline,
  toggleScheduledTask as setScheduledTaskDone,
  toggleSubtask as setSubtaskDone,
} from "./db/database";
import { subscribeSettings } from "./lib/settings";
import { SettingsScreen } from "./components/SettingsScreen";
import { Toaster } from "./components/Toaster";
import { toast } from "./lib/toast";
import type { ScheduledTask, SeriesScope } from "./types";

const TODAY = toISODate(new Date());

export default function App() {
  // undefined = ще перевіряємо сесію, null = не авторизований, Session = увійшли
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setCurrentUserId(data.session?.user.id ?? null);
      setSession(data.session);
      void syncNativeAuth(data.session);
    });
    // Також TOKEN_REFRESHED: телефону потрібен свіжий токен для кнопки «Виконано»
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setCurrentUserId(next?.user.id ?? null);
      setSession(next);
      void syncNativeAuth(next);
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

// Помилка збереження з форми: текст лишається в полях, можна спробувати ще раз
const SAVE_FAILED_MESSAGE = "Перевірте з'єднання з інтернетом і спробуйте ще раз. Введений текст лишився у формі.";
const RETRY_MESSAGE = "Перевірте з'єднання з інтернетом і спробуйте ще раз.";

function PlannerApp() {
  const [activeDate, setActiveDate] = useState(TODAY);
  const [activeTab, setActiveTab] = useState<MobileTab>("day");
  const view = useView();
  // «Сьогодні» в календарі знову веде до першої задачі
  const [calendarJump, setCalendarJump] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<ScheduledTask | null>(null);
  // Задача з календаря може бути не з активного дня: тоді форма перевіряє накладки з її днем
  const [modalDay, setModalDay] = useState<{ date: string; tasks: ScheduledTask[] } | null>(null);
  // Початок і кінець нової задачі, створеної тапом по сітці календаря
  const [modalTimes, setModalTimes] = useState<{ start: string; end: string } | null>(null);
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
    multiDayTasks,
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
    reload: reloadDay,
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

  // Без мережі database.ts віддає збережене на пристрої — показуємо смужку
  const [offline, setOffline] = useState(isOffline);
  useEffect(() => subscribeOffline(setOffline), []);

  // Локальні нагадування на найближчі дні: перепланувати при відкритті,
  // після кожної зміни задач і коли застосунок повертається на передній план.
  useEffect(() => {
    void rescheduleReminders();
  }, [refreshKey]);

  // Натискання на сповіщення відкриває день, якого воно стосується
  useEffect(() => {
    const openFromNotification = async () => {
      const date = await takeOpenDate();
      if (!date) return;
      setActiveDate(date);
      setActiveTab("day");
    };
    void openFromNotification();
    return onAppResume(() => void openFromNotification());
  }, []);

  // Кнопка «Виконано» в сповіщенні лише ставить задачу в чергу на телефоні.
  // Тут позначаємо її в базі й лише після успіху прибираємо з черги.
  // reloadDay — у ref, щоб обробник повернення бачив поточний день.
  const reloadDayRef = useRef(reloadDay);
  reloadDayRef.current = reloadDay;

  useEffect(() => {
    let running: Promise<void> | null = null;

    const applyPendingDone = async () => {
      // Спершу офлайн-черга з застосунку (якщо вже йде — чекаємо ту саму),
      // щоб її галочки не перезаписали «Виконано» зі сповіщення
      await flushOfflineQueue().catch(() => 0);

      // Сесія: getSession оновлює прострочений токен до запису в базу
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;

      const ids = await pendingDone();
      if (ids.length === 0) return;
      const saved: string[] = [];
      for (const id of ids) {
        try {
          await setScheduledTaskDone(id, true);
          saved.push(id);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error("Не вдалося позначити задачу з сповіщення:", err);
        }
      }
      await ackDone(saved); // те, що не записалось, лишається в черзі до наступного разу
      if (saved.length > 0) {
        await reloadDayRef.current(); // галочки на екрані
        bump(); // тиждень і нагадування
      }
    };

    // Спершу виконані з сповіщень, потім перепланування: інакше план
    // поверне будильники задачі, яку щойно позначили.
    const sync = (reschedule: boolean) => {
      if (!running) {
        running = applyPendingDone()
          .catch((err) => {
            // eslint-disable-next-line no-console
            console.error("Черга «Виконано» не оброблена:", err);
          })
          .finally(() => {
            running = null;
          });
      }
      if (reschedule) void running.then(() => rescheduleReminders());
    };

    sync(false); // при старті перепланування й так запускає ефект refreshKey
    return onAppResume(() => sync(true));
  }, []);

  // Офлайн-черга (галочки й нотатка без мережі): надіслати, коли з'явиться
  // інтернет, і лише потім перечитати день і тиждень, щоб не показати старе.
  useEffect(() => {
    const refresh = async () => {
      await reloadDayRef.current();
      bump();
    };
    const flush = () => flushOfflineQueue().catch(() => 0);
    const onOnline = () => void flush().then(refresh);
    const flushIfQueued = () =>
      void flush().then((sent) => {
        // Після повернення в застосунок подія online могла не прийти — перевіряємо мережу читанням
        if (sent > 0 || isOffline()) void refresh();
      });

    window.addEventListener("online", onOnline);
    flushIfQueued();
    const offResume = onAppResume(flushIfQueued);
    return () => {
      window.removeEventListener("online", onOnline);
      offResume();
    };
  }, []);

  // «Назад» на Android: вікна й форми закриваються самі (useBackHandler);
  // з вкладок «Нотатки» і «Задачі» повертаємось на «День», а з «Дня» — вихід.
  useEffect(() => {
    void initBackButton();
  }, []);
  useEffect(() => {
    setRootBackHandler(() => {
      if (activeTab === "day") return false;
      setActiveTab("day");
      return true;
    });
    return () => setRootBackHandler(null);
  }, [activeTab]);

  // Без мережі можна лише ставити галочки й писати нотатку дня
  function blockedOffline(): boolean {
    if (!isOffline()) return false;
    toast.error("Немає мережі", {
      message: "Без інтернету можна лише ставити галочки й писати нотатку.",
    });
    return true;
  }

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

  // Календар на вкладці «День»: його шапка замінює смужку тижня, свайп гортає на весь діапазон
  const calendarOnScreen = view.mode === "calendar" && activeTab === "day";

  // Свайп по контенту (день/задачі/нотатки) перемикає день; у календарі — на 1, 3 або 7 днів.
  const swipeStep = calendarOnScreen ? view.range : 1;
  const daySwipe = useHorizontalSwipe(
    () => setActiveDate((d) => addDays(d, swipeStep)),
    () => setActiveDate((d) => addDays(d, -swipeStep)),
  );

  function goToday() {
    setActiveDate(TODAY);
    setWeekViewAnchor(weekDates(TODAY)[3]);
    setCalendarJump((n) => n + 1);
  }

  // Створення: на активний день або (тап по сітці) на день колонки з початком і кінцем
  function openCreateModal(slot?: { date: string; tasks: ScheduledTask[]; start: string; end: string }) {
    if (blockedOffline()) return;
    setEditingTask(null);
    setModalDay(slot ? { date: slot.date, tasks: slot.tasks } : null);
    setModalTimes(slot ? { start: slot.start, end: slot.end } : null);
    setModalOpen(true);
  }

  function openEditModal(task: ScheduledTask, dayTasks?: ScheduledTask[]) {
    if (blockedOffline()) return;
    setEditingTask(task);
    setModalDay(dayTasks ? { date: task.date, tasks: dayTasks } : null);
    setModalTimes(null);
    setModalOpen(true);
  }

  async function handleSaveTask(values: TaskFormValues, scope: SeriesScope): Promise<boolean> {
    const { repeatDates, skipIds, ...task } = values;
    try {
      if (editingTask) {
        const series =
          scope === "following" && editingTask.seriesId
            ? {
                seriesId: editingTask.seriesId,
                fromDate: editingTask.date,
                skipIds,
                baseSubtaskIds: editingTask.subtasks.map((s) => s.id),
              }
            : undefined;
        await updateScheduledTask(editingTask.id, task, series);
      } else {
        await addScheduledTask({ ...task, repeatDates, date: modalDay?.date });
      }
      bump();
      return true;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Не вдалося зберегти задачу:", err);
      toast.error("Не вдалося зберегти задачу", { message: SAVE_FAILED_MESSAGE });
      return false;
    }
  }

  // Запис із задач дня чи нотаток на кілька днів: true — записано.
  // При помилці текст лишається в полі, а помилку показує картка.
  async function writeWithToast(
    failTitle: string,
    write: () => Promise<void>,
    message = SAVE_FAILED_MESSAGE
  ): Promise<boolean> {
    if (blockedOffline()) return false;
    try {
      await write();
      return true;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`${failTitle}:`, err);
      toast.error(failTitle, { message });
      return false;
    }
  }

  async function handleDeleteTask(task: ScheduledTask, scope: SeriesScope) {
    if (blockedOffline()) return;
    try {
      await deleteScheduledTask(task, scope);
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

  // Підзадача з календаря: задача може бути з іншого дня, ніж активний,
  // тому правило «усі підзадачі виконані → задача виконана» рахуємо тут, як у useDayData.
  async function handleToggleSubtaskOf(task: ScheduledTask, id: string, done: boolean) {
    if (task.date === activeDate) return handleToggleSubtask(id, done);
    await setSubtaskDone(id, done);
    const subtasks = task.subtasks.map((s) => (s.id === id ? { ...s, done } : s));
    const allDone = subtasks.length > 0 && subtasks.every((s) => s.done);
    const nextDone = allDone ? true : done ? task.done : false;
    if (nextDone !== task.done) await setScheduledTaskDone(task.id, nextDone);
    bump();
  }

  // Перетягування в календарі: новий день і час. Для «цієї й наступних» кожна копія серії
  // зсувається на ту саму кількість днів; копії з накладками лишаються на місці.
  async function handleMoveTask(task: ScheduledTask, target: DropTarget, scope: SeriesScope): Promise<boolean> {
    if (blockedOffline()) return false;
    try {
      if (scope === "following" && task.seriesId) {
        const shift = daysBetween(task.date, target.date);
        const copies = await getSeriesTasksFrom(task.seriesId, task.date);
        const others = await getTasksOnDates([...new Set(copies.map((c) => addDays(c.date, shift)))]);
        const { moves } = planSeriesMove(copies, others, shift, target.startTime, target.endTime);
        await moveScheduledTasks(moves);
      } else {
        await moveScheduledTasks([{ id: task.id, ...target }]);
      }
      await reloadDay(); // «Список» і задачі активного дня
      bump();
      return true;
    } catch (err) {
      toast.error("Не вдалося перенести задачу", { message: errorText(err) });
      bump();
      return false;
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    clearOfflineCache();
  }

  // На телефоні показуємо лише активну вкладку, на планшеті/десктопі — все одразу.
  const onlyOnTab = (tab: MobileTab) => (activeTab === tab ? "" : "hidden sm:block");

  return (
    <div className="flex h-screen flex-col bg-canvas font-sans text-ink">
      <TitleBar
        onLogout={handleLogout}
        onOpenSettings={() => setSettingsOpen(true)}
        viewMode={view.mode}
        onToggleView={() => saveView({ mode: view.mode === "calendar" ? "list" : "calendar" })}
      />

      {offline && (
        <div role="status" className="border-b border-line bg-danger-soft px-4 py-1.5 text-center text-xs font-medium text-danger">
          Немає мережі. Показано збережене на цьому пристрої. Галочки й нотатку буде записано, коли
          з'явиться інтернет.
        </div>
      )}

      {!calendarOnScreen && (
        <div className="sm:hidden">
          <WeekStrip
            weekAnchor={weekViewAnchor}
            activeDate={activeDate}
            summaries={weekSummaries}
            onSelect={setActiveDate}
            onShiftWeek={(dir) => setWeekViewAnchor((d) => addDays(d, dir * 7))}
            onGoToday={goToday}
          />
        </div>
      )}

      <main className="flex flex-1 flex-col gap-5 overflow-y-auto p-4 sm:flex-row sm:overflow-hidden sm:p-5">
        <div
          className="flex flex-1 flex-col gap-5 sm:overflow-y-auto"
          style={{ touchAction: "pan-y" }}
          {...daySwipe}
        >
          <div className={onlyOnTab("day")}>
            {view.mode === "calendar" ? (
              <CalendarView
                date={activeDate}
                range={view.range}
                refreshKey={refreshKey}
                jumpToken={calendarJump}
                hourHeight={view.hourHeight}
                onToggleTask={handleToggleTask}
                onToggleSubtask={handleToggleSubtaskOf}
                onEditTask={openEditModal}
                onDeleteTask={handleDeleteTask}
                onCreateAt={openCreateModal}
                onRangeChange={(range) => saveView({ range })}
                onGoToday={goToday}
                onOpenDay={(d) => {
                  setActiveDate(d);
                  saveView({ range: 1 });
                }}
                canEdit={() => !blockedOffline()}
                onMoveTask={handleMoveTask}
              />
            ) : (
              <TodaySchedule
                date={activeDate}
                tasks={scheduledTasks}
                onPrevDay={() => setActiveDate((d) => addDays(d, -1))}
                onNextDay={() => setActiveDate((d) => addDays(d, 1))}
                onToggleTask={handleToggleTask}
                onToggleSubtask={handleToggleSubtask}
                onAddTask={() => openCreateModal()}
                onEditTask={openEditModal}
                onDeleteTask={handleDeleteTask}
              />
            )}
          </div>

          <div
            className={`grid grid-cols-1 gap-5 sm:grid-cols-2 ${
              activeTab === "day" ? "hidden sm:grid" : ""
            }`}
          >
            <div className={onlyOnTab("notes")}>
              {/* key: окремий стан поля для кожного дня, щоб текст не перейшов на інший */}
              <NotesPanel
                key={activeDate}
                date={activeDate}
                content={note.date === activeDate ? note.content : null}
                onSave={saveNote}
                multiDayNotes={multiDayNotes}
                onAddMultiDayNote={(input) =>
                  writeWithToast("Не вдалося зберегти нотатку", () => addMultiDayNote(input))
                }
                onDeleteMultiDayNote={(id) =>
                  void writeWithToast("Не вдалося видалити нотатку", () => deleteMultiDayNote(id), RETRY_MESSAGE)
                }
              />
            </div>
            <div className={onlyOnTab("tasks")}>
              {/* bump: задачі дня входять у ранковий план нагадувань */}
              <DailyTasksPanel
                date={activeDate}
                multiDayTasks={multiDayTasks}
                onToggleMultiDay={async (id, done) => {
                  await toggleMultiDayTask(id, done);
                  bump();
                }}
                onAddMultiDay={(input) =>
                  writeWithToast("Не вдалося зберегти задачу", async () => {
                    await addMultiDayTask(input);
                    bump();
                  })
                }
                onEditMultiDay={(id, title) =>
                  writeWithToast("Не вдалося зберегти задачу", async () => {
                    await editMultiDayTask(id, title);
                    bump();
                  })
                }
                onDeleteMultiDay={(id) =>
                  void writeWithToast("Не вдалося видалити задачу", async () => {
                    await deleteMultiDayTask(id);
                    bump();
                  }, RETRY_MESSAGE)
                }
                tasks={dailyTasks}
                onToggle={async (id, done) => {
                  await toggleDailyTask(id, done);
                  bump();
                }}
                onAdd={(title) =>
                  writeWithToast("Не вдалося зберегти задачу", async () => {
                    await addDailyTask(title);
                    bump();
                  })
                }
                onEdit={(id, title) =>
                  writeWithToast("Не вдалося зберегти задачу", async () => {
                    await editDailyTask(id, title);
                    bump();
                  })
                }
                onDelete={(id) =>
                  void writeWithToast("Не вдалося видалити задачу", async () => {
                    await deleteDailyTask(id);
                    bump();
                  }, RETRY_MESSAGE)
                }
              />
            </div>
          </div>
        </div>

        <div className="hidden shrink-0 sm:block">
          <WeekSidebar summaries={weekSummaries} activeDate={activeDate} onSelect={setActiveDate} />
        </div>
      </main>

      {calendarOnScreen && (
        <button
          type="button"
          onClick={() => openCreateModal()}
          aria-label="Нова задача"
          className="fixed bottom-20 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-card"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      )}

      <MobileTabs active={activeTab} onChange={setActiveTab} />

      <SettingsScreen open={settingsOpen} onClose={() => setSettingsOpen(false)} onLogout={handleLogout} />

      <AddTaskModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSaveTask}
        editingTask={editingTask}
        existingTasks={modalDay?.tasks ?? scheduledTasks}
        date={modalDay?.date ?? activeDate}
        initialStartTime={modalTimes?.start}
        initialEndTime={modalTimes?.end}
      />
    </div>
  );
}
