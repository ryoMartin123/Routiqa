"use client";

// ─── Plan & Usage ─────────────────────────────────────────
// The account's metered usage — storage, SMS, voice, email, AI — against the
// plan's included quotas, so the office sees what's left BEFORE running out.
// Read-only meters; plan changes and payment live in Platform Admin.

import { useEffect, useState } from "react";
import Link from "next/link";
import { HardDrive, MessageSquare, Phone, Mail, Sparkles, ExternalLink, AlertTriangle } from "lucide-react";
import { getUsageSummary, fmtUsage, type UsageSummary, type MetricUsage, type UsageMetricKey } from "@/lib/usage/data";

const METRIC_ICONS: Record<UsageMetricKey, React.ElementType> = {
  storage: HardDrive, sms: MessageSquare, voice: Phone, email: Mail, ai: Sparkles,
};

// Meter color by pressure: quiet indigo → amber at 75% → red at 90%.
function meterColor(pct: number): string {
  if (pct >= 90) return "#dc2626";
  if (pct >= 75) return "#f59e0b";
  return "#0f8578";
}

function MetricRow({ m, last }: { m: MetricUsage; last: boolean }) {
  const Icon = METRIC_ICONS[m.def.key];
  const color = meterColor(m.pct);
  const width = Math.min(100, m.pct);
  return (
    <div className="px-5 py-4" style={{ borderBottom: last ? "none" : "1px solid var(--border-subtle)" }}>
      <div className="flex items-start gap-3">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: "var(--bg-input)" }}>
          <Icon className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{m.def.label}</p>
            <p className="text-sm tabular-nums shrink-0" style={{ color: "var(--text-primary)" }}>
              <span className="font-semibold">{fmtUsage(m.used, m.def.unit)}</span>
              <span style={{ color: "var(--text-muted)" }}> / {fmtUsage(m.quota, m.def.unit)}{m.def.unit === "count" ? ` ${m.def.unitLabel}` : ""}</span>
            </p>
          </div>
          <div className="flex items-baseline justify-between gap-3 mt-0.5">
            <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>{m.def.description}</p>
            <p className="text-[11px] tabular-nums shrink-0 font-medium" style={{ color: m.pct >= 75 ? color : "var(--text-muted)" }}>{Math.round(m.pct)}%</p>
          </div>
          {/* Meter */}
          <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "var(--bg-input)" }}>
            <div className="h-full rounded-full" style={{ width: `${width}%`, backgroundColor: color }} />
          </div>
          <p className="text-[10px] mt-1.5" style={{ color: "var(--text-muted)" }}>
            {m.over > 0
              ? <span style={{ color: "#dc2626", fontWeight: 600 }}>Over by {fmtUsage(m.over, m.def.unit)} · +${m.overageCost.toFixed(2)} this cycle</span>
              : <>Then ${m.def.overageRate < 0.01 ? m.def.overageRate.toFixed(4).replace(/0+$/, "") : m.def.overageRate.toFixed(m.def.overageRate < 0.1 ? 3 : 2)} {m.def.overageUnit}</>}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function UsageSection() {
  // Usage reads localStorage-backed stores — load client-side.
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  useEffect(() => { setSummary(getUsageSummary()); }, []);
  if (!summary) return null;

  const { plan, cycle, metrics, totalOverage } = summary;
  const pressured = metrics.filter(m => m.pct >= 90);
  const warned = metrics.filter(m => m.pct >= 75 && m.pct < 90);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Plan &amp; Usage</h2>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
          What your account has used this cycle against what the plan includes — so nothing runs out by surprise.
        </p>
      </div>

      {/* Running-out warning — the whole reason this page exists. */}
      {(pressured.length > 0 || warned.length > 0) && (
        <div className="rounded-xl px-4 py-3 flex items-start gap-2.5"
          style={pressured.length > 0
            ? { backgroundColor: "#fef2f2", border: "1px solid #fecaca" }
            : { backgroundColor: "#fffbeb", border: "1px solid #fde68a" }}>
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: pressured.length > 0 ? "#dc2626" : "#d97706" }} />
          <p className="text-xs leading-relaxed" style={{ color: pressured.length > 0 ? "#991b1b" : "#92400e" }}>
            {[...pressured, ...warned].map(m => `${m.def.label} is at ${Math.round(m.pct)}%`).join(" · ")}.
            {" "}Anything past the included quota bills as overage at the end of the cycle.
          </p>
        </div>
      )}

      {/* Plan + cycle strip */}
      <div className="rounded-xl px-5 py-4 flex items-center gap-6 flex-wrap"
        style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Plan</p>
          <p className="text-sm font-semibold mt-0.5" style={{ color: "var(--text-primary)" }}>
            {plan.name} <span className="font-normal" style={{ color: "var(--text-muted)" }}>· ${plan.priceMonthly}/mo</span>
          </p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Billing cycle</p>
          <p className="text-sm mt-0.5 tabular-nums" style={{ color: "var(--text-primary)" }}>
            {cycle.startLabel} – {cycle.endLabel} <span style={{ color: "var(--text-muted)" }}>· resets {cycle.resetLabel} ({cycle.daysLeft}d)</span>
          </p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Est. overage</p>
          <p className="text-sm font-semibold mt-0.5 tabular-nums" style={{ color: totalOverage > 0 ? "#dc2626" : "#16a34a" }}>
            {totalOverage > 0 ? `$${totalOverage.toFixed(2)}` : "$0.00 · within plan"}
          </p>
        </div>
        <Link href="/admin" className="group ml-auto inline-flex items-center gap-1 text-[11px] font-medium shrink-0 hover:underline" style={{ color: "var(--accent-text)" }}>
          Manage plan &amp; billing <ExternalLink className="w-3 h-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </Link>
      </div>

      {/* Meters */}
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
        {metrics.map((m, i) => <MetricRow key={m.def.key} m={m} last={i === metrics.length - 1} />)}
      </div>

      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        Usage resets on the 1st of each month. Overages bill at the end of the cycle to the payment method on file — they never interrupt service mid-job.
      </p>
    </div>
  );
}
