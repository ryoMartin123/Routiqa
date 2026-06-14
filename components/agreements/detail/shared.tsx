"use client";

// Shared bits for the Agreement Detail Page tabs: status maps, the visit
// display-status derivation, a reusable surface Card, and an adapter that maps a
// CustomerAgreement snapshot into the AgreementDocData the document preview wants.

import { Clock, Circle, CheckCircle, AlertCircle, CalendarClock, MinusCircle } from "lucide-react";
import type { CustomerAgreement, AgreementStatus, AgreementVisit } from "@/lib/agreements/data";
import { RENEWAL_TYPE_LABELS, type RenewalType } from "@/lib/agreements/settings";
import type { AgreementDocData } from "@/components/agreements/AgreementDocumentPreview";
import type { TemplateService, TemplateVisit } from "@/lib/agreements/templates";

// ─── Agreement status ─────────────────────────────────────
export const AGREEMENT_STATUS: Record<AgreementStatus, { label: string; bg: string; color: string }> = {
  active:       { label: "Active",       bg: "#d1fae5", color: "#065f46" },
  due_soon:     { label: "Due Soon",     bg: "#fef3c7", color: "#92400e" },
  overdue:      { label: "Overdue",      bg: "#fee2e2", color: "#991b1b" },
  renewal_due:  { label: "Renewal Due",  bg: "#ffedd5", color: "#9a3412" },
  canceled:     { label: "Canceled",     bg: "var(--bg-input)", color: "var(--text-muted)" },
};

// ─── Visit display status (derived) ───────────────────────
// The data model VisitStatus is planned/scheduled/completed/missed. For display
// we derive the richer set the operator expects; "skipped" is local-only UI.
export type VisitDisplay = "Upcoming" | "Due" | "Overdue" | "Scheduled" | "Completed" | "Skipped";

export const VISIT_DISPLAY: Record<VisitDisplay, { color: string; icon: typeof Circle }> = {
  Upcoming:  { color: "#6b7280", icon: Clock },
  Due:       { color: "#f59e0b", icon: CalendarClock },
  Overdue:   { color: "#ef4444", icon: AlertCircle },
  Scheduled: { color: "#6366f1", icon: Circle },
  Completed: { color: "#10b981", icon: CheckCircle },
  Skipped:   { color: "#9ca3af", icon: MinusCircle },
};

const DAY = 86_400_000;

export function deriveVisitDisplay(v: AgreementVisit, skipped = false): VisitDisplay {
  if (skipped) return "Skipped";
  if (v.status === "completed") return "Completed";
  if (v.status === "scheduled") return "Scheduled";
  if (v.status === "missed") return "Overdue";
  // planned → look at the target date
  const d = new Date(v.scheduled);
  if (isNaN(d.getTime())) return "Upcoming";
  const days = (d.getTime() - Date.now()) / DAY;
  if (days < 0) return "Overdue";
  if (days <= 14) return "Due";
  return "Upcoming";
}

export const RENEWAL_LABEL = (t?: RenewalType): string => (t ? RENEWAL_TYPE_LABELS[t] : "—");

// ─── Reusable surface card ────────────────────────────────
export function Card({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`rounded-xl ${className}`}
      style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)", ...style }}>
      {children}
    </div>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>{children}</p>;
}

// A labeled value row with an optional icon (used across Overview/Coverage/etc.).
export function InfoRow({ icon: Icon, label, value }: { icon?: typeof Circle; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      {Icon && <Icon className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "var(--text-muted)" }} />}
      <div className="min-w-0 flex-1">
        <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{label}</p>
        <p className="text-sm font-medium break-words" style={{ color: "var(--text-primary)" }}>{value || "—"}</p>
      </div>
    </div>
  );
}

// ─── CustomerAgreement → AgreementDocData (Documents tab preview) ──
export function docDataFromAgreement(a: CustomerAgreement): AgreementDocData {
  const services: TemplateService[] = a.servicesDetailed ?? (a.services ?? []).map((name, i) => ({
    id: `s-${i}`, name, quantity: 1, included: true,
  }));
  const visits: TemplateVisit[] = a.visitPlan ?? [];
  return {
    sections: a.sections ?? ["header", "customer", "coverage", "included_services", "visit_schedule", "billing_terms", "benefits", "exclusions", "cancellation", "renewal", "signature"],
    title: a.type || "Service Agreement",
    planLevel: a.planLevel,
    customerName: a.customer,
    contactName: a.contactName,
    propertyLabel: a.propertyLabel,
    locationName: a.location,
    startDate: a.startDate,
    endDate: a.endDate,
    renewalDate: a.renewalDate,
    coverage: a.coverage,
    services,
    visits,
    visitFrequencyLabel: a.visitFrequency,
    billingLabel: a.billingLabel ?? a.billingFrequency,
    billingAmount: a.billingAmount,
    billingTaxable: a.billingTaxable,
    firstBillingDate: a.firstBillingDate,
    benefits: a.benefits ?? [],
    exclusions: a.exclusions,
    terms: a.terms ?? [],
    renewal: a.renewal
      ? { autoRenew: a.renewal.autoRenew, termMonths: a.renewal.termMonths, noticeDays: a.renewal.noticeDays, priceIncreasePct: a.renewal.priceIncreasePct }
      : undefined,
  };
}
