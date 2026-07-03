"use client";

// Sub-tabs shown inside a single record — a specific customer, project, job,
// quote, invoice, lead, or agreement. Minimal text tabs using the indigo/purple
// CRM accent. The active tab is marked by a single small custom glyph ABOVE it —
// a rounded diamond echoing the Routiqa square/diamond motif — plus the accent
// text color. Styling lives in `.detail-tab-marker` (globals.css).
function ActiveMark() {
  return (
    <svg viewBox="0 0 12 12" className="w-2 h-2 shrink-0" fill="currentColor" aria-hidden>
      <rect x="2.6" y="2.6" width="6.8" height="6.8" rx="2.2" transform="rotate(45 6 6)" />
    </svg>
  );
}

export default function DetailTabs({ tabs, active, onChange, className = "" }: {
  tabs: readonly string[];
  active: string;
  onChange: (key: string) => void;
  className?: string;
}) {
  return (
    <div className={`flex items-start gap-x-7 overflow-x-auto ${className}`}>
      {tabs.map((t) => {
        const on = active === t;
        return (
          <button
            key={t}
            onClick={() => onChange(t)}
            data-active={on}
            className="detail-tab-marker flex flex-col items-center gap-0.5 text-sm font-medium whitespace-nowrap shrink-0"
          >
            {/* Reserved-height slot keeps the row from shifting as the mark moves. */}
            <span className="h-2 flex items-center justify-center">{on && <ActiveMark />}</span>
            <span>{t}</span>
          </button>
        );
      })}
    </div>
  );
}
