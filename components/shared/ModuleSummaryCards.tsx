"use client";

import { useEffect, useState } from "react";
import { ChevronUp, ChevronDown, BarChart3 } from "lucide-react";
import type { LucideIcon } from "lucide-react";

// Reusable KPI summary cards shown above a module's tabs/search/table.
// Mirrors the Agreements page pattern: small cards, icon tile, label, value, sub.
// Pages compute the metrics (already context-filtered) and pass them in.
//
// When a `moduleKey` is provided, a clean Show/Hide control is rendered and the
// preference is persisted per-module in localStorage so users/admins can collapse
// the analytics row on any page.

export interface SummaryCard {
  icon:      LucideIcon;
  label:     string;
  value:     string;
  sub:       string;
  iconColor: string;
}

export default function ModuleSummaryCards({
  cards,
  moduleKey,
}: {
  cards: SummaryCard[];
  moduleKey?: string;
}) {
  const [visible, setVisible] = useState(true);
  const [ready, setReady]     = useState(false);

  // Restore the saved preference (default: shown).
  useEffect(() => {
    if (!moduleKey) { setReady(true); return; }
    try {
      const saved = localStorage.getItem(`crm-analytics-${moduleKey}`);
      if (saved === "0") setVisible(false);
    } catch { /* ignore */ }
    setReady(true);
  }, [moduleKey]);

  function toggle() {
    setVisible(v => {
      const next = !v;
      if (moduleKey) {
        try { localStorage.setItem(`crm-analytics-${moduleKey}`, next ? "1" : "0"); } catch { /* ignore */ }
      }
      return next;
    });
  }

  if (cards.length === 0) return null;

  // No toggle when there's no moduleKey — render the plain grid (legacy behavior).
  if (!moduleKey) {
    return (
      <div className="grid grid-cols-4 gap-4">
        {cards.map(c => <Card key={c.label} card={c} />)}
      </div>
    );
  }

  // Avoid a flash of the wrong state before the preference loads.
  if (!ready) return null;

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <button
          onClick={toggle}
          className="flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-lg transition-colors"
          style={{ color: "var(--text-muted)" }}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          {visible ? "Hide analytics" : "Show analytics"}
          {visible ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>
      {visible && (
        <div className="grid grid-cols-4 gap-4">
          {cards.map(c => <Card key={c.label} card={c} />)}
        </div>
      )}
    </div>
  );
}

function Card({ card: c }: { card: SummaryCard }) {
  return (
    <div
      className="rounded-xl p-4 flex items-start gap-3"
      style={{
        backgroundColor: "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
        style={{ backgroundColor: "var(--bg-input)" }}
      >
        <c.icon className="w-4 h-4" style={{ color: c.iconColor }} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
          {c.label}
        </p>
        <p className="text-xl font-bold mt-0.5 truncate" style={{ color: "var(--text-primary)" }}>
          {c.value}
        </p>
        <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-secondary)" }}>
          {c.sub}
        </p>
      </div>
    </div>
  );
}
