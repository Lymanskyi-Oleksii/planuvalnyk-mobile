import { DayCard } from "./DayCard";
import { isToday } from "@/lib/date";
import type { DaySummary } from "@/types";

interface WeekSidebarProps {
  summaries: DaySummary[];
  activeDate: string;
  onSelect: (date: string) => void;
}

export function WeekSidebar({ summaries, activeDate, onSelect }: WeekSidebarProps) {
  return (
    <aside className="flex w-full shrink-0 flex-col rounded-xl2 border border-line bg-panel shadow-card sm:w-[320px]">
      <header className="flex items-center gap-2 border-b border-line px-5 py-5">
        <svg viewBox="0 0 24 24" className="h-5 w-5 text-accent" fill="none">
          <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
          <path d="M3 9.5H21" stroke="currentColor" strokeWidth="1.6" />
          <path d="M8 3V6.5M16 3V6.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <h2 className="text-base font-bold text-ink">Огляд тижня</h2>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {summaries.map((s, i) => (
          <DayCard
            key={s.date}
            summary={s}
            index={i}
            active={s.date === activeDate}
            isToday={isToday(s.date)}
            onSelect={onSelect}
          />
        ))}
      </div>
    </aside>
  );
}
