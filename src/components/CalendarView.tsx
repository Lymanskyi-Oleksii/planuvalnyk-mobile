import type { CalendarRange } from "@/lib/settings";

interface CalendarViewProps {
  date: string;
  range: CalendarRange;
}

// Заглушка: сітку буде додано на наступних етапах.
export function CalendarView({ date, range }: CalendarViewProps) {
  return (
    <section
      data-date={date}
      data-range={range}
      className="rounded-xl2 border border-line bg-panel p-6 text-center text-sm text-muted shadow-card"
    >
      Календар — незабаром
    </section>
  );
}
