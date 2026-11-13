import { useEffect, useState } from "react";
import * as db from "@/db/database";
import { centeredDays } from "@/lib/date";
import type { DaySummary } from "@/types";

// Показує тиждень із сьогоднішнім днем по центру: 3 дні до, сьогодні, 3 дні після
export function useWeekSummaries(todayIso: string, refreshKey: number, before = 3, after = 3, enabled = true) {
  const [summaries, setSummaries] = useState<DaySummary[]>([]);

  useEffect(() => {
    // Смужку тижня не показано (календар) — запити не потрібні
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      const dates = centeredDays(todayIso, before, after);
      const results = await Promise.all(dates.map((d) => db.getDaySummary(d)));
      if (!cancelled) setSummaries(results);
    })();
    return () => {
      cancelled = true;
    };
  }, [todayIso, before, after, refreshKey, enabled]);

  return summaries;
}
