// Дата завжди у форматі YYYY-MM-DD, час — HH:mm

export type Category =
  | "study"
  | "university"
  | "work"
  | "sport"
  | "food"
  | "health"
  | "personal"
  | "errands"
  | "other";

export const CATEGORY_LABELS: Record<Category, string> = {
  study: "Навчання",
  university: "Універ",
  work: "Робота",
  sport: "Спорт",
  food: "Прийом їжі",
  health: "Здоров'я",
  personal: "Особисте",
  errands: "Справи",
  other: "Інше",
};

export interface Subtask {
  id: string;
  taskId: string;
  title: string;
  done: boolean;
  sortOrder: number;
}

/** Підзадача у формі задачі: id — у наявної, done лише для показу (форма його не змінює). */
export interface SubtaskDraft {
  id?: string;
  title: string;
  done: boolean;
}

// Тип 1 — запланована задача: дата, час початку/кінця, назва, підзадачі, checkbox
export interface ScheduledTask {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  title: string;
  category: Category;
  details: string | null; // вільний текст, коли немає підзадач (напр. "Пообідати, відпочити")
  done: boolean;
  sortOrder: number;
  subtasks: Subtask[];
  remind: boolean | null; // null = за загальними налаштуваннями
  remindBeforeMin: number | null; // null = загальне значення
  seriesId: string | null; // спільний для копій повторюваної задачі; null = не повторюється
}

// Що змінювати в повторюваній задачі: лише цю копію чи цю й наступні
export type SeriesScope = "one" | "following";

// Тип 2 — звичайна задача дня: дата, назва, checkbox. Без часу.
export interface DailyTask {
  id: string;
  date: string;
  title: string;
  done: boolean;
  sortOrder: number;
}

// Тип 3 — нотатка одного дня: прив'язана до дати, без часу, без checkbox
export interface DayNote {
  date: string;
  content: string;
}

// Тип 3б — нотатка на кілька днів: показується на кожен день у діапазоні [startDate, endDate]
export interface MultiDayNote {
  id: string;
  title: string;
  content: string;
  startDate: string;
  endDate: string;
}

export interface DaySummary {
  date: string;
  scheduledTasks: ScheduledTask[];
  totalCount: number;
  doneCount: number;
}
