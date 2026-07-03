"use client";

// ─── Shared platform UI primitives ────────────────────────
// Small building blocks for the placeholder app dashboards so each app page
// stays a few lines. Purely presentational; no business logic yet.

import type { LucideIcon } from "lucide-react";

export function PageHeader({
  title,
  subtitle,
  accent,
  icon: Icon,
}: {
  title: string;
  subtitle?: string;
  accent?: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="flex items-center gap-3">
      {Icon && (
        <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: (accent ?? "#6366f1") + "22" }}>
          <Icon className="w-5 h-5" style={{ color: accent }} />
        </span>
      )}
      <div className="min-w-0">
        <h1 className="text-xl font-semibold truncate" style={{ color: "var(--text-primary)" }}>{title}</h1>
        {subtitle && <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>{subtitle}</p>}
      </div>
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  accent?: string;
}) {
  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>{label}</p>
        {Icon && <Icon className="w-4 h-4 shrink-0" style={{ color: accent ?? "var(--accent-icon)" }} />}
      </div>
      <p className="text-2xl font-semibold mt-2" style={{ color: "var(--text-primary)" }}>{value}</p>
      {hint && <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{hint}</p>}
    </div>
  );
}

// A titled placeholder that lists the capabilities a section will hold. Used by
// the Admin app's not-yet-built sections so the structure reads true to spec.
export function FeaturePlaceholder({
  title,
  subtitle,
  features,
}: {
  title: string;
  subtitle?: string;
  features: string[];
}) {
  return (
    <div className="rounded-xl p-5" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
      <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{title}</p>
      {subtitle && <p className="text-xs mt-0.5 mb-3" style={{ color: "var(--text-muted)" }}>{subtitle}</p>}
      <ul className={`space-y-1.5 ${subtitle ? "" : "mt-3"}`}>
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <span className="w-1 h-1 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: "var(--text-muted)" }} />
            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{f}</span>
          </li>
        ))}
      </ul>
      <p className="text-[11px] mt-4 pt-3" style={{ borderTop: "1px solid var(--border)", color: "var(--text-muted)" }}>
        Structure and access are wired now; full functionality lands in a later phase.
      </p>
    </div>
  );
}

// A neutral "this isn't built yet" panel for sidebar sections that are nav-only
// for now. Honest about the prototype state.
export function ComingSoon({ title, note }: { title: string; note?: string }) {
  return (
    <div className="p-8">
      <div
        className="rounded-xl p-10 text-center"
        style={{ backgroundColor: "var(--bg-surface)", border: "1px dashed var(--border)" }}
      >
        <h1 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>{title}</h1>
        <p className="text-sm mt-2 max-w-md mx-auto" style={{ color: "var(--text-muted)" }}>
          {note ?? "This section is part of the platform layout. Full functionality lands in a later phase — the navigation and access model are wired up now."}
        </p>
      </div>
    </div>
  );
}
