import type { ReactNode } from "react";

export type MobileTab = "day" | "tasks" | "notes";

interface MobileTabsProps {
  active: MobileTab;
  onChange: (tab: MobileTab) => void;
}

const TABS: { id: MobileTab; label: string; icon: ReactNode }[] = [
  {
    id: "day",
    label: "День",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
        <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
        <path d="M3 9.5H21" stroke="currentColor" strokeWidth="1.6" />
        <path d="M8 3V6.5M16 3V6.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "tasks",
    label: "Задачі",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
        <path d="M4 7l2 2 3.5-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M4 17l2 2 3.5-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M13 7.5h7M13 17.5h7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "notes",
    label: "Нотатки",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
        <path
          d="M5 4.5h14v15H5z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path d="M8.5 9h7M8.5 12.5h7M8.5 16h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
];

export function MobileTabs({ active, onChange }: MobileTabsProps) {
  return (
    <nav
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      className="shrink-0 border-t border-line bg-panel sm:hidden"
    >
      <div className="flex">
        {TABS.map((tab) => {
          const isActive = tab.id === active;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              aria-current={isActive ? "page" : undefined}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 transition-colors ${
                isActive ? "text-accent" : "text-muted"
              }`}
            >
              {tab.icon}
              <span className="text-[11px] font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
