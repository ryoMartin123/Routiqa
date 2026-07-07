// ─── Mobile UI primitives ─────────────────────────────────
// The SAME Routiqa visual system (tokens, cards, chips, buttons) adapted for
// thumbs: bigger touch targets, stacked layouts, card-first lists. Desktop and
// mobile share this language so the product feels like one thing.

import Link from "next/link";
import { ChevronRight, MapPin } from "lucide-react";
import type { Job, JobStatus } from "@/lib/jobs/data";
import { STATUS_META } from "@/lib/mobile/data";

export const ACCENT = "#0f8578";
export const prettyType = (t: string) => t.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
export const areaOf = (address?: string) => address?.split(",")[1]?.trim() || "";

export function StatusChip({ status, size = "sm" }: { status: JobStatus; size?: "sm" | "md" }) {
  const m = STATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${size === "md" ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-[11px]"}`}
      style={{ backgroundColor: m.color + "22", color: m.color }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: m.color }} />{m.label}
    </span>
  );
}

export function PriorityFlag({ priority }: { priority: string }) {
  if (priority !== "urgent" && priority !== "high") return null;
  const c = priority === "urgent" ? "#dc2626" : "#f59e0b";
  return <span className="inline-flex items-center gap-1 text-[11px] font-semibold capitalize" style={{ color: c }}>
    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: c }} />{priority}
  </span>;
}

// The core list unit on mobile — a tappable job card.
export function JobCard({ job }: { job: Job }) {
  const area = areaOf(job.propertyAddress);
  return (
    <Link href={`/mobile/jobs/${job.id}`} className="block rounded-2xl p-3.5 active:scale-[0.99] transition-transform"
      style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold tabular-nums" style={{ color: "var(--text-secondary)" }}>{job.scheduledTime || "Unscheduled"}</span>
        <StatusChip status={job.status} />
      </div>
      <p className="mt-1.5 text-[17px] font-semibold leading-tight truncate" style={{ color: "var(--text-primary)" }}>{job.customerName}</p>
      <p className="text-sm truncate" style={{ color: "var(--text-muted)" }}>{prettyType(job.type)}{job.title ? ` · ${job.title}` : ""}</p>
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1 text-xs truncate" style={{ color: "var(--text-muted)" }}>
          <MapPin className="w-3.5 h-3.5 shrink-0" />{area || job.propertyAddress || "No address"}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          <PriorityFlag priority={job.priority} />
          <ChevronRight className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
        </div>
      </div>
    </Link>
  );
}

// Stacked content section with a small caption — the mobile answer to desktop tabs.
export function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-center justify-between px-1 mb-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Card({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`rounded-2xl ${className}`} style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", boxShadow: "var(--shadow-card)", ...style }}>
      {children}
    </div>
  );
}

export function DetailRow({ icon: Icon, label, value }: { icon?: React.ElementType; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3" style={{ borderTop: "1px solid var(--border)" }}>
      {Icon && <Icon className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "var(--text-muted)" }} />}
      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{label}</p>
        <div className="text-sm mt-0.5" style={{ color: "var(--text-primary)" }}>{value}</div>
      </div>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, hint }: { icon: React.ElementType; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-8">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3" style={{ backgroundColor: "var(--bg-surface-2)" }}>
        <Icon className="w-6 h-6" style={{ color: "var(--text-muted)" }} />
      </div>
      <p className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>{title}</p>
      {hint && <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>{hint}</p>}
    </div>
  );
}

// Full-width thumb button. tone drives the look; href OR onClick.
export function BigButton({ label, icon: Icon, tone = "primary", href, onClick }: {
  label: string; icon?: React.ElementType; tone?: "primary" | "neutral" | "warn"; href?: string; onClick?: () => void;
}) {
  const styles = {
    primary: { backgroundColor: ACCENT, color: "#fff", border: "1px solid transparent" },
    neutral: { backgroundColor: "var(--bg-surface)", color: "var(--text-primary)", border: "1px solid var(--border)" },
    warn:    { backgroundColor: "var(--bg-surface)", color: "#b45309", border: "1px solid #f59e0b55" },
  }[tone];
  const cls = "w-full min-h-[52px] rounded-2xl flex items-center justify-center gap-2 text-base font-semibold active:scale-[0.99] transition-transform";
  const inner = <>{Icon && <Icon className="w-5 h-5" />}{label}</>;
  return href
    ? <Link href={href} className={cls} style={styles}>{inner}</Link>
    : <button onClick={onClick} className={cls} style={styles}>{inner}</button>;
}

// Compact icon action (call / message / directions row).
export function QuickAction({ icon: Icon, label, href, onClick }: { icon: React.ElementType; label: string; href?: string; onClick?: () => void }) {
  const cls = "flex-1 flex flex-col items-center gap-1.5 py-3 rounded-2xl active:scale-[0.97] transition-transform";
  const style = { border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", boxShadow: "var(--shadow-card)" } as React.CSSProperties;
  const inner = <>
    <Icon className="w-5 h-5" style={{ color: ACCENT }} />
    <span className="text-[11px] font-medium" style={{ color: "var(--text-secondary)" }}>{label}</span>
  </>;
  return href ? <a href={href} className={cls} style={style}>{inner}</a> : <button onClick={onClick} className={cls} style={style}>{inner}</button>;
}
