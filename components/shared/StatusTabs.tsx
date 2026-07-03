"use client";

// Shared pill-style status tabs used across record list pages (Quotes, Jobs,
// Invoices, Work Orders, Projects, Agreements, Customers, Tasks). Replaces the
// older underline tab style. Active = accent-soft pill + count badge.

export interface StatusTab {
  key: string;
  label: string;
  count?: number;
  icon?: React.ComponentType<{ className?: string }>;
  dividerBefore?: boolean;   // render a vertical bar before this tab to group sections
}

export default function StatusTabs({ tabs, active, onChange, className = "", accent }: {
  tabs: StatusTab[];
  active: string;
  onChange: (key: string) => void;
  className?: string;
  accent?: string;        // override the accent (per-app theming); defaults to the global indigo
}) {
  // Recolor by overriding the accent tokens the buttons read.
  const accentVars = accent ? ({
    ["--accent-soft-bg" as string]: accent + "1f",
    ["--accent-soft-2-bg" as string]: accent + "33",
    ["--accent-soft-border" as string]: accent + "59",
    ["--accent-text" as string]: accent,
  } as React.CSSProperties) : undefined;

  return (
    <div className={`flex items-center gap-0.5 flex-wrap ${className}`} style={accentVars}>
      {tabs.map(t => {
        const on = active === t.key;
        return (
          <div key={t.key} className="flex items-center gap-0.5">
            {t.dividerBefore && <span className="w-px h-5 mx-1.5 shrink-0" style={{ backgroundColor: "var(--border)" }} />}
            <button onClick={() => onChange(t.key)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
              style={{
                backgroundColor: on ? "var(--accent-soft-bg)" : "transparent",
                color: on ? "var(--accent-text)" : "var(--text-muted)",
                border: `1px solid ${on ? "var(--accent-soft-border)" : "transparent"}`,
              }}>
              {t.icon && <t.icon className="w-3.5 h-3.5" />}
              {t.label}
              {/* Inline muted count (no bubble); hidden when zero. */}
              {t.count !== undefined && t.count > 0 && (
                <span className="text-xs tabular-nums" style={{ color: on ? "var(--accent-text)" : "var(--text-muted)", opacity: 0.7 }}>
                  {t.count}
                </span>
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}
