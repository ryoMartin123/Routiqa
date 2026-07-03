"use client";

// ─── Inventory & Procurement — shared UI primitives ───────
// Small building blocks reused by Vendors, Subcontractors, and Purchase Orders:
// the orange app accent, a right slide-over shell, field helpers, compliance &
// linked-record chips. Keeps each section file focused.

import { X } from "lucide-react";
import StatusBadge from "@/components/shared/StatusBadge";
import { COMPLIANCE_STYLE, type ComplianceLevel } from "@/lib/inventory/data";

export const ACCENT = "#f97316";          // Inventory & Procurement app accent
export const money = (n?: number) => (n != null ? `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "—");

// Right slide-over panel shell (header + scrollable body + optional footer).
export function Slideover({ title, subtitle, onClose, children, footer, width = 560 }: {
  title: string; subtitle?: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; width?: number;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative h-full flex flex-col" style={{ width: "100%", maxWidth: width, backgroundColor: "var(--bg-surface)", borderLeft: "1px solid var(--border)", boxShadow: "-16px 0 48px -12px rgba(0,0,0,0.3)" }}>
        <div className="px-5 py-4 flex items-start justify-between gap-3 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="min-w-0">
            <p className="text-base font-semibold truncate" style={{ color: "var(--text-primary)" }}>{title}</p>
            {subtitle && <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>{subtitle}</p>}
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors hover:bg-[var(--bg-surface-2)]" style={{ color: "var(--text-secondary)" }}><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
        {footer && <div className="px-5 py-3 flex items-center justify-end gap-2 shrink-0" style={{ borderTop: "1px solid var(--border)" }}>{footer}</div>}
      </div>
    </div>
  );
}

// Horizontal tab strip for the slide-over body.
export function DrawerTabs<T extends string>({ tabs, active, onChange }: { tabs: { key: T; label: string }[]; active: T; onChange: (k: T) => void }) {
  return (
    <div className="flex items-center gap-1 px-3 overflow-x-auto thin-scroll-x" style={{ borderBottom: "1px solid var(--border)" }}>
      {tabs.map(t => {
        const on = active === t.key;
        return (
          <button key={t.key} onClick={() => onChange(t.key)}
            className="px-2.5 py-2.5 text-xs font-medium whitespace-nowrap transition-colors relative"
            style={{ color: on ? ACCENT : "var(--text-muted)" }}>
            {t.label}
            {on && <span className="absolute bottom-0 left-1 right-1 h-0.5 rounded-t" style={{ backgroundColor: ACCENT }} />}
          </button>
        );
      })}
    </div>
  );
}

// A label/value row for overview panels.
export function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2" style={{ borderBottom: "1px solid var(--border)" }}>
      <span className="text-xs shrink-0" style={{ color: "var(--text-muted)" }}>{label}</span>
      <div className="text-sm text-right min-w-0" style={{ color: "var(--text-primary)" }}>{children}</div>
    </div>
  );
}

export function ComplianceBadge({ level }: { level: ComplianceLevel }) {
  const s = COMPLIANCE_STYLE[level];
  return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ backgroundColor: s.bg, color: s.color }}>{s.label}</span>;
}

// Linked CRM/job/project chip (placeholder link styling).
export function LinkedChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md max-w-full" style={{ backgroundColor: ACCENT + "14", color: ACCENT }}>
      <span className="truncate">{label}</span>
    </span>
  );
}

export function Dot({ style }: { style: { label: string; dot: string } }) {
  return <StatusBadge label={style.label} color={style.dot} size="sm" />;
}

// Form field + inputs (shared modal styling).
export const inp = "w-full rounded-lg px-3 py-2 text-sm outline-none";
export const inpStyle: React.CSSProperties = { border: "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)", color: "var(--text-primary)" };
export function Field({ label, hint, className, children }: { label: string; hint?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <label className="flex items-center gap-1.5 text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
        {label}{hint && <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>· {hint}</span>}
      </label>
      {children}
    </div>
  );
}

// A subtle section heading inside drawers.
export function DrawerBlockTitle({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>{children}</p>;
}
