"use client";

// Shared primitives for the Agreement Builder sections — keeps each engine
// section focused on its own fields rather than re-declaring inputs/cards.

import { Plus, Pencil, Trash2, Check } from "lucide-react";

export const inputStyle: React.CSSProperties = { border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" };
export const cardStyle: React.CSSProperties = { backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border-subtle)" };

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
        {label}{hint && <span style={{ color: "var(--text-muted)" }}> ({hint})</span>}
      </label>
      {children}
    </div>
  );
}

export function Mini({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>{label}</label>{children}</div>;
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`w-full rounded-lg px-3 py-2 text-sm outline-none ${props.className ?? ""}`} style={{ ...inputStyle, ...(props.style ?? {}) }} />;
}

export function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!on)} role="switch" aria-checked={on}
      className="relative w-8 h-4 rounded-full transition-colors shrink-0"
      style={{ backgroundColor: on ? "#4f46e5" : "var(--bg-input)", border: "1px solid var(--border)" }}>
      <span className="absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform"
        style={{ transform: on ? "translateX(16px)" : "translateX(0)" }} />
    </button>
  );
}

export function ToggleRow({ label, hint, on, onChange }: { label: string; hint?: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 cursor-pointer rounded-lg px-3 py-2" style={cardStyle}>
      <div className="min-w-0">
        <p className="text-sm" style={{ color: "var(--text-primary)" }}>{label}</p>
        {hint && <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{hint}</p>}
      </div>
      <Toggle on={on} onChange={onChange} />
    </label>
  );
}

// Section header with a title, subtitle, and an optional "Add" affordance.
export function SectionHead({ title, subtitle, action }: { title: string; subtitle: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-4">
      <div>
        <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>{title}</h2>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

export function AddButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white shrink-0" style={{ backgroundColor: "#4f46e5" }}>
      <Plus className="w-4 h-4" /> {label}
    </button>
  );
}

// A summary card: title + meta chips, with edit (expand) / remove controls.
// `expanded` swaps the body for the editor passed as children.
export function SummaryCard({ title, meta, badges, expanded, onToggle, onRemove, children }: {
  title: string;
  meta?: string;
  badges?: { label: string; tone?: "default" | "accent" | "warn" | "muted" }[];
  expanded: boolean;
  onToggle: () => void;
  onRemove?: () => void;
  children?: React.ReactNode;     // editor body (shown when expanded)
}) {
  const toneStyle = (tone?: string): React.CSSProperties =>
    tone === "accent" ? { backgroundColor: "var(--accent-soft-bg)", color: "var(--accent-text-strong)" }
    : tone === "warn" ? { backgroundColor: "#fef3c7", color: "#92400e" }
    : tone === "muted" ? { backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }
    : { backgroundColor: "var(--bg-input)", color: "var(--text-secondary)" };

  return (
    <div className="rounded-xl overflow-hidden transition-colors" style={{ border: `1px solid ${expanded ? "var(--accent-soft-border)" : "var(--border-subtle)"}`, backgroundColor: "var(--bg-surface)" }}>
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{title || "Untitled"}</p>
          <div className="flex items-center gap-2 flex-wrap mt-0.5">
            {meta && <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{meta}</span>}
            {badges?.map((b, i) => (
              <span key={i} className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={toneStyle(b.tone)}>{b.label}</span>
            ))}
          </div>
        </div>
        <button onClick={onToggle} className="p-1.5 rounded-lg hover:bg-[var(--bg-input)]" style={{ color: expanded ? "var(--accent-text)" : "var(--text-muted)" }} title={expanded ? "Done" : "Edit"}>
          {expanded ? <Check className="w-4 h-4" /> : <Pencil className="w-3.5 h-3.5" />}
        </button>
        {onRemove && (
          <button onClick={onRemove} className="p-1.5 rounded-lg hover:bg-red-50" style={{ color: "#9ca3af" }} title="Remove"><Trash2 className="w-3.5 h-3.5" /></button>
        )}
      </div>
      {expanded && children && (
        <div className="px-4 pb-4" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          <div className="pt-3">{children}</div>
        </div>
      )}
    </div>
  );
}

// Radio-style selectable card — used by the custom rule builders to pick a rule type.
export function RuleCard({ selected, title, desc, onClick }: { selected: boolean; title: string; desc: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="text-left rounded-lg px-3 py-2.5 transition-colors"
      style={{
        border: `1px solid ${selected ? "var(--accent-soft-border)" : "var(--border-subtle)"}`,
        backgroundColor: selected ? "var(--accent-soft-bg)" : "var(--bg-surface)",
      }}>
      <div className="flex items-center gap-2">
        <span className="w-3.5 h-3.5 rounded-full shrink-0 flex items-center justify-center"
          style={{ border: `1px solid ${selected ? "#4f46e5" : "var(--border)"}`, backgroundColor: selected ? "#4f46e5" : "transparent" }}>
          {selected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
        </span>
        <span className="text-sm font-medium" style={{ color: selected ? "var(--accent-text-strong)" : "var(--text-primary)" }}>{title}</span>
      </div>
      <p className="text-[11px] mt-1 ml-5" style={{ color: "var(--text-muted)" }}>{desc}</p>
    </button>
  );
}

// Plain-English summary line shown after a custom rule is configured.
export function RuleSummary({ text }: { text: string }) {
  return (
    <div className="rounded-lg px-3 py-2 text-xs" style={{ backgroundColor: "var(--accent-soft-bg)", color: "var(--accent-text-strong)" }}>
      <span className="font-semibold">Summary: </span>{text}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl py-10 text-center" style={cardStyle}>
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>{children}</p>
    </div>
  );
}
