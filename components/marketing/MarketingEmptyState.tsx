"use client";

// ─── Marketing empty state ────────────────────────────────
// Shared, deliberately light empty state for the Marketing app's not-yet-built
// sections (Automations, Lead Sources, Performance) and any future "no data yet"
// view. Clean and centered with a single clear call-to-action — no fake bulky
// previews. `suggestions` renders a quiet row of example ideas to convey what the
// section is for without faking real records.

import type { LucideIcon } from "lucide-react";

const ACCENT = "#e11d48";

export default function MarketingEmptyState({
  icon: Icon,
  title,
  description,
  ctaLabel,
  onCta,
  suggestions,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  ctaLabel?: string;
  onCta?: () => void;
  suggestions?: string[];
}) {
  return (
    <div className="rounded-xl flex flex-col items-center text-center px-6 py-14"
      style={{ backgroundColor: "var(--bg-surface)", border: "1px dashed var(--border)" }}>
      <span className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 shrink-0"
        style={{ backgroundColor: ACCENT + "1a" }}>
        <Icon className="w-5 h-5" style={{ color: ACCENT }} />
      </span>
      <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>{title}</h2>
      <p className="text-sm mt-1.5 max-w-md" style={{ color: "var(--text-muted)" }}>{description}</p>

      {ctaLabel && (
        <button onClick={onCta}
          className="mt-5 text-sm font-medium text-white px-4 py-2 rounded-lg transition-colors"
          style={{ backgroundColor: ACCENT }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#be123c")}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = ACCENT)}>
          {ctaLabel}
        </button>
      )}

      {suggestions && suggestions.length > 0 && (
        <div className="mt-7 w-full max-w-lg">
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
            Examples
          </p>
          <div className="flex flex-wrap justify-center gap-1.5">
            {suggestions.map(s => (
              <span key={s} className="text-xs px-2.5 py-1 rounded-full"
                style={{ backgroundColor: "var(--bg-surface-2)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                {s}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
