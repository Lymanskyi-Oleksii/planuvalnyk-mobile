import { useEffect, useState } from "react";
import * as db from "@/db/database";
import type { ScheduledTask } from "@/types";

export interface RangeTasks {
  tasks: Record<string, ScheduledTask[]>;
  /** Задачі саме цих дат уже прочитано (з мережі чи з офлайн-кешу). */
  ready: boolean;
}

// Задачі з часом на кілька днів для календаря. Через getScheduledTasks (з офлайн-кешем),
// а не getTasksOnDates, яка кешу не має. Поки читаються нові дати, віддає попередні дані
// з ready = false — так сітка не блимає під час свайпу.
export function useRangeTasks(dates: string[], refreshKey: number): RangeTasks {
  const key = dates.join(",");
  const [loaded, setLoaded] = useState<{ key: string | null; tasks: Record<string, ScheduledTask[]> }>({
    key: null,
    tasks: {},
  });

  useEffect(() => {
    let cancelled = false;
    const list = key ? key.split(",") : [];
    (async () => {
      // Помилка одного дня не має назавжди лишити календар порожнім — показуємо день без задач.
      const results = await Promise.all(list.map((d) => db.getScheduledTasks(d).catch(() => [])));
      if (cancelled) return;
      const tasks: Record<string, ScheduledTask[]> = {};
      list.forEach((d, i) => {
        tasks[d] = results[i];
      });
      setLoaded({ key, tasks });
    })();
    return () => {
      cancelled = true;
    };
  }, [key, refreshKey]);

  return { tasks: loaded.tasks, ready: loaded.key === key };
}
