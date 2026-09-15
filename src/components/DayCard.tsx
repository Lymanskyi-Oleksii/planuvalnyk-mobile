import { formatDayName, formatShortDate, fromISODate } from "@/lib/date";
import type { DaySummary } from "@/types";

interface DayCardProps {
  summary: DaySummary;
  index: number;
  active: boolean;
  isToday: boolean;
  onSelect: (date: string) => void;
}

// Фірмовий колір для кожного дня тижня (0 = неділя ... 6 = субота) —
// стабільний, не залежить від позиції картки у списку
const WEEKDAY_ACCENT = [
  { text: "text-category-health-fg", bg: "bg-category-health-bg" },
  { text: "text-category-study-fg", bg: "bg-category-study-bg" },
  { text: "text-category-work-fg", bg: "bg-category-work-bg" },
  { text: "text-category-sport-fg", bg: "bg-category-sport-bg" },
  { text: "text-category-food-fg", bg: "bg-category-food-bg" },
  { text: "text-category-university-fg", bg: "bg-category-university-bg" },
  { text: "text-category-personal-fg", bg: "bg-category-personal-bg" },
];

const DOT_COLORS: Record<string, string> = {
  study: "bg-category-study-fg",
  university: "bg-category-university-fg",
  work: "bg-category-work-fg",
  sport: "bg-category-sport-fg",
  food: "bg-category-food-fg",
  health: "bg-category-health-fg",
  personal: "bg-category-personal-fg",
  errands: "bg-category-errands-fg",
  other: "bg-category-other-fg",
};

export function DayCard({ summary, active, isToday, onSelect }: DayCardProps) {
  const preview = summary.scheduledTasks.slice(0, 4);
  const accent = WEEKDAY_ACCENT[fromISODate(summary.date).getDay()];

  return (
    <button
      onClick={() => onSelect(summary.date)}
      className={`relative w-full overflow-hidden rounded-xl2 border bg-panel px-4 py-3.5 text-left shadow-sm transition-all hover:shadow-md ${
        active ? "border-2 border-accent shadow-md" : "border-line hover:border-accent/30"
      }`}
    >
      {isToday && <span className="absolute inset-x-0 top-0 h-[3px] bg-accent" />}

      <div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm font-semibold text-ink">
            <span className={`rounded-md px-1.5 py-0.5 ${accent.bg} ${accent.text}`}>
              {formatShortDate(summary.date)}
            </span>
            <span className="font-normal text-muted">{formatDayName(summary.date)}</span>
            {isToday && (
              <span className="rounded-md border border-accent/40 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-accent">
                Сьогодні
              </span>
            )}
          </span>
          {summary.totalCount > 0 && (
            <span className="rounded-md bg-canvas px-2 py-0.5 text-xs font-medium text-muted">
              {summary.totalCount} {summary.totalCount === 1 ? "задача" : "задачі"}
            </span>
          )}
        </div>

        {preview.length > 0 ? (
          <ul className="mt-2 space-y-1">
            {preview.map((t) => (
              <li key={t.id} className="flex items-center gap-2 text-xs text-muted">
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT_COLORS[t.category]}`} />
                <span className="w-10 shrink-0 tabular-nums text-ink/70">{t.startTime}</span>
                <span className={t.done ? "line-through" : ""}>{t.title}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-muted">Задач ще немає</p>
        )}

        {summary.totalCount > 0 && (
          <p className="mt-2 text-xs font-medium text-accent">
            {summary.doneCount}/{summary.totalCount}
          </p>
        )}
      </div>
    </button>
  );
}
