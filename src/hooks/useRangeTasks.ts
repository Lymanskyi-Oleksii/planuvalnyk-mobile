import { useEffect, useState } from "react";
import * as db from "@/db/database";
import type { ScheduledTask } from "@/types";

// Задачі з часом на кілька днів для календаря. Через getScheduledTasks (з офлайн-кешем),
// а не getTasksOnDates, яка кешу не має.
export function useRangeTasks(dates: string[], refreshKey: number): Record<string, ScheduledTask[]> {
  const [tasks, setTasks] = useState<Record<string, ScheduledTask[]>>({});
  const key = dates.join(",");

  useEffect(() => {
    let cancelled = false;
    const list = key ? key.split(",") : [];
    (async () => {
      const results = await Promise.all(list.map((d) => db.getScheduledTasks(d)));
      if (cancelled) return;
      const next: Record<string, ScheduledTask[]> = {};
      list.forEach((d, i) => {
        next[d] = results[i];
      });
      setTasks(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [key, refreshKey]);

  return tasks;
}
