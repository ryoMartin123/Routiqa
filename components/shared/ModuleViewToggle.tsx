"use client";

import { LayoutList, LayoutGrid, BarChart3 } from "lucide-react";

// Page-level view switch shared by the record modules. List is the working
// default; Overview holds the analytics/summary cards that used to sit inline.
// An optional Cards view (opt-in via `withCards`) sits between them.
export type ModuleView = "list" | "cards" | "overview";

export default function ModuleViewToggle({
  view,
  onChange,
  centered = false,
  listLabel = "List",
  withCards = false,
  overviewFirst = false,
  accent = "#4f46e5",
}: {
  view: ModuleView;
  onChange: (v: ModuleView) => void;
  centered?: boolean;
  listLabel?: string;
  withCards?: boolean;
  overviewFirst?: boolean;   // put Overview on the left, List on the right
  accent?: string;           // active-tab color (per-app theming)
}) {
  const listTab     = { key: "list" as const,     icon: LayoutList, label: listLabel };
  const cardsTab    = { key: "cards" as const,     icon: LayoutGrid, label: "Cards" };
  const overviewTab = { key: "overview" as const,  icon: BarChart3,  label: "Overview" };
  const tabs = overviewFirst
    ? [overviewTab, ...(withCards ? [cardsTab] : []), listTab]
    : [listTab, ...(withCards ? [cardsTab] : []), overviewTab];
  return (
    <div className={centered ? "flex justify-center" : "flex"}>
      <div className="flex items-center rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        {tabs.map(t => {
          const active = view === t.key;
          return (
            <button key={t.key} onClick={() => onChange(t.key)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors"
              style={{ backgroundColor: active ? accent : "var(--bg-surface)", color: active ? "#fff" : "var(--text-secondary)" }}>
              <t.icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
