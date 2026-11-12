import { useEffect, useState } from "react";
import * as db from "@/db/database";

// Кількість невиконаних задач дня без часу для кожної дати календаря.
// Через getDailyTasks (з офлайн-кешем). Поки читаються нові дати, віддає попередні числа:
// мітки в шапці не блимають під час свайпу. На сітку й її прокрутку не впливає.
export function useRangeDailyCounts(dates: string[], refreshKey: number): Record<string, number> {
  const key = dates.join(",");
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    const list = key ? key.split(",") : [];
    (async () => {
      // Помилка одного дня — просто без мітки
      const results = await Promise.all(list.map((d) => db.getDailyTasks(d).catch(() => [])));
      if (cancelled) return;
      const next: Record<string, number> = {};
      list.forEach((d, i) => {
        next[d] = results[i].filter((t) => !t.done).length;
      });
      setCounts(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [key, refreshKey]);

  return counts;
}
