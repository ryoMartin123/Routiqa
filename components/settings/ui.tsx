"use client";

import { Check, RotateCcw } from "lucide-react";

// Shared primitives for the Sales & Catalog settings sections. Module-level so
// inputs never remount mid-edit (avoids the focus-loss bug).

export function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!on)} role="switch" aria-checked={on} type="button"
      className="relative w-9 h-5 rounded-full transition-colors shrink-0"
      style={{ backgroundColor: on ? "#4f46e5" : "var(--bg-input)", border: "1px solid var(--border)" }}>
      <span className="absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-transform"
        style={{ transform: on ? "translateX(16px)" : "translateX(0)" }} />
    </button>
  );
}

export function SettingsCard({ icon: Icon, title, subtitle, action, children }: {
  icon?: typeof Check; title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl p-5" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-3">
          {Icon && (
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--bg-surface-2)" }}>
              <Icon className="w-4 h-4" style={{ color: "#4f46e5" }} />
            </div>
          )}
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{title}</p>
            {subtitle && <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{subtitle}</p>}
          </div>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

export function SectionHeader({ title, subtitle, right }: { title: string; subtitle: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between">
      <div>
        <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>{title}</h2>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>{subtitle}</p>
      </div>
      {right}
    </div>
  );
}

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>{children}</label>;
}

export function SaveButtons({ onSave, onReset, dirty, saved }: {
  onSave: () => void; onReset: () => void; dirty: boolean; saved: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <button onClick={onReset} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors"
        style={{ border: "1px solid var(--border)", color: "var(--text-secondary)", backgroundColor: "var(--bg-surface)" }}>
        <RotateCcw className="w-3.5 h-3.5" /> Reset Defaults
      </button>
      <button onClick={onSave} disabled={!dirty && !saved}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50"
        style={{ backgroundColor: saved ? "#10b981" : "#4f46e5" }}>
        <Check className="w-3.5 h-3.5" /> {saved ? "Saved" : "Save Changes"}
      </button>
    </div>
  );
}

export function ToggleRow({ label, description, on, onChange }: {
  label: string; description?: string; on: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3" style={{ borderTop: "1px solid var(--border)" }}>
      <div className="min-w-0">
        <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{label}</p>
        {description && <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{description}</p>}
      </div>
      <Toggle on={on} onChange={onChange} />
    </div>
  );
}

export const inputCls = "w-full rounded-lg px-3 py-2 text-sm outline-none";
export const inputStyle = { border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" } as const;
