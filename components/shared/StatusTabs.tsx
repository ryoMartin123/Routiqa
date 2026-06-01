"use client";

// Shared pill-style status tabs used across record list pages (Quotes, Jobs,
// Invoices, Work Orders, Projects, Agreements, Customers, Tasks). Replaces the
// older underline tab style. Active = accent-soft pill + count badge.

export interface StatusTab {
  key: string;
  label: string;
  count?: number;
  icon?: React.ComponentType<{ className?: string }>;
}

export default function StatusTabs({ tabs, active, onChange, className = "" }: {
  tabs: StatusTab[];
  active: string;
  onChange: (key: string) => void;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-0.5 flex-wrap ${className}`}>
      {tabs.map(t => {
        const on = active === t.key;
        return (
          <button key={t.key} onClick={() => onChange(t.key)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
            style={{
              backgroundColor: on ? "var(--accent-soft-bg)" : "transparent",
              color: on ? "var(--accent-text)" : "var(--text-muted)",
              border: `1px solid ${on ? "var(--accent-soft-border)" : "transparent"}`,
            }}>
            {t.icon && <t.icon className="w-3.5 h-3.5" />}
            {t.label}
            {t.count !== undefined && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ backgroundColor: on ? "var(--accent-soft-2-bg)" : "var(--bg-input)", color: on ? "var(--accent-text)" : "var(--text-muted)" }}>
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
