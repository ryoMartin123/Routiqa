"use client";

// The six at-a-glance cards atop the Overview tab: Status · Term · Billing ·
// Visits · Next Visit · Renewal. Reads only from the agreement snapshot + helpers.

import { Activity, CalendarRange, DollarSign, CalendarCheck, CalendarClock, RefreshCw } from "lucide-react";
import {
  formatValue, nextBillingDate, agreementVisitProgress, type CustomerAgreement,
} from "@/lib/agreements/data";
import { AGREEMENT_STATUS } from "./shared";

function fmtDate(d: Date | null): string {
  return d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";
}

function Stat({ icon: Icon, label, value, sub, accent }: {
  icon: typeof Activity; label: string; value: React.ReactNode; sub?: string; accent?: string;
}) {
  return (
    <div className="rounded-xl p-3.5" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className="w-3.5 h-3.5" style={{ color: accent ?? "var(--text-muted)" }} />
        <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>{label}</p>
      </div>
      <p className="text-base font-bold leading-tight truncate" style={{ color: accent ?? "var(--text-primary)" }}>{value}</p>
      {sub && <p className="text-[11px] mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>{sub}</p>}
    </div>
  );
}

export default function SummaryCards({ agreement }: { agreement: CustomerAgreement }) {
  const s = AGREEMENT_STATUS[agreement.status];
  const progress = agreementVisitProgress(agreement);
  const nextBill = nextBillingDate(agreement);
  const termMonths = agreement.renewal?.termMonths ?? 12;
  const termLabel = termMonths === 12 ? "1 year" : `${termMonths} months`;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      <Stat icon={Activity}     label="Status"    value={s.label} accent={s.color === "var(--text-muted)" ? undefined : s.color} sub={agreement.industry} />
      <Stat icon={CalendarRange}label="Term"      value={termLabel} sub={agreement.endDate ? `Ends ${agreement.endDate}` : `Start ${agreement.startDate}`} />
      <Stat icon={DollarSign}   label="Billing"   value={formatValue(agreement)} sub={agreement.billingLabel ?? agreement.billingFrequency} />
      <Stat icon={CalendarCheck}label="Visits"    value={`${progress.done}/${progress.total}`} sub={agreement.visitFrequency} />
      <Stat icon={CalendarClock}label="Next Visit"value={agreement.nextVisit ?? "None"} sub={agreement.nextVisit ? "scheduled" : "nothing planned"} />
      <Stat icon={RefreshCw}    label="Renewal"   value={agreement.renewalDate || "—"} sub={agreement.renewal?.autoRenew ? "Auto-renew" : "Manual"} />
    </div>
  );
}
