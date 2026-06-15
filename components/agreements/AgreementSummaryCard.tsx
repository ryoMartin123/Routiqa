"use client";

// ─── Agreement summary card ───────────────────────────────
// The modern at-a-glance breakdown of a customer's agreement, shown on the
// customer profile. Status + visit progress + next visit / renewal / next charge
// tiles + included perks + quick actions. Billing is tracked/displayed only
// (no invoices yet). "Schedule next visit" materializes the next planned visit
// into a dispatchable job.

import Link from "next/link";
import { useState } from "react";
import { Calendar, RefreshCw, DollarSign, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import StatusBadge from "@/components/shared/StatusBadge";
import { useHierarchy } from "@/components/providers/HierarchyProvider";
import {
  formatValue, agreementVisitProgress, nextBillingDate, billingAmountPerPeriod,
  materializeVisitJob, AGREEMENT_STATUS_META, type CustomerAgreement,
} from "@/lib/agreements/data";

function fmtDate(d: Date | null): string {
  if (!d || isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function AgreementSummaryCard({ agreement }: { agreement: CustomerAgreement }) {
  const router = useRouter();
  const { effectiveCompanyId, effectiveLocationId, effectiveServiceAreaId } = useHierarchy();
  const [err, setErr] = useState<string | null>(null);

  const status = AGREEMENT_STATUS_META[agreement.status] ?? AGREEMENT_STATUS_META.active;
  const { done, total } = agreementVisitProgress(agreement);
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const nextBill = nextBillingDate(agreement);
  const perPeriod = billingAmountPerPeriod(agreement);

  const chips = [...(agreement.services ?? []), ...(agreement.benefits ?? [])].slice(0, 6);
  // Next visit awaiting scheduling (planned, no job yet).
  const nextPlanned = agreement.visits.find(v => v.status === "planned" && !v.jobId);

  function scheduleNext() {
    if (!nextPlanned) { router.push(`/agreements/${agreement.id}?tab=Visits`); return; }
    const res = materializeVisitJob(agreement.id, nextPlanned.id, {
      companyId: effectiveCompanyId ?? "co_hvac",
      locationId: effectiveLocationId ?? "loc_augusta",
      serviceAreaId: effectiveServiceAreaId ?? undefined,
    });
    if (res.job) router.push(`/jobs/${res.job.id}`);
    else setErr(res.error ?? "Could not schedule the next visit.");
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-5 py-4" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-base font-semibold truncate" style={{ color: "var(--text-primary)" }}>{agreement.type}</p>
            <StatusBadge label={status.label} color={status.color} />
          </div>
          <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
            {formatValue(agreement)} · {agreement.visitFrequency}{agreement.propertyLabel ? ` · ${agreement.propertyLabel}` : ""}
          </p>
        </div>
        <Link href={`/agreements/${agreement.id}`}
          className="shrink-0 flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors hover:bg-[var(--bg-surface-2)]"
          style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
          View <ChevronRight className="w-3 h-3" />
        </Link>
      </div>

      <div className="px-5 py-4 space-y-4">
        {/* Visit progress */}
        {total > 0 && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Visits</span>
              <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{done} of {total} done</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: "var(--bg-input)" }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: status.color }} />
            </div>
          </div>
        )}

        {/* Tiles */}
        <div className="grid grid-cols-3 gap-3">
          <Tile icon={Calendar}   label="Next visit"  value={agreement.nextVisit ?? "—"} />
          <Tile icon={RefreshCw}  label="Renews on"   value={agreement.renewalDate || "—"} />
          <Tile icon={DollarSign} label="Next charge" value={fmtDate(nextBill)} sub={nextBill ? `$${perPeriod.toLocaleString()}` : undefined} />
        </div>

        {/* Included */}
        {chips.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>Included</p>
            <div className="flex flex-wrap gap-1.5">
              {chips.map((c, i) => (
                <span key={i} className="text-[11px] px-2 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-secondary)" }}>{c}</span>
              ))}
            </div>
          </div>
        )}

        {err && <p className="text-[11px]" style={{ color: "#dc2626" }}>{err}</p>}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          <button onClick={scheduleNext}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 transition-colors">
            <Calendar className="w-3.5 h-3.5" /> Schedule next visit
          </button>
          <Link href={`/agreements/${agreement.id}?tab=Renewal`}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg transition-colors hover:bg-[var(--bg-surface-2)]"
            style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
            <RefreshCw className="w-3.5 h-3.5" /> Renew
          </Link>
        </div>
      </div>
    </div>
  );
}

function Tile({ icon: Icon, label, value, sub }: { icon: typeof Calendar; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl p-3" style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border-subtle)" }}>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="w-3 h-3 shrink-0" style={{ color: "var(--text-muted)" }} />
        <span className="text-[10px] font-semibold uppercase tracking-wider truncate" style={{ color: "var(--text-muted)" }}>{label}</span>
      </div>
      <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{value}</p>
      {sub && <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{sub}</p>}
    </div>
  );
}
