"use client";

import { useEffect, useMemo, useState } from "react";
import { DollarSign, TrendingUp, FilePen, Receipt } from "lucide-react";
import { getAllQuotes, getAllInvoices, fmt, type QuoteRecord, type InvoiceRecord } from "@/lib/quotes/data";
import { getAllJobs, JOB_STATUS_CONFIG, type Job, type JobStatus } from "@/lib/jobs/data";
import { QUOTE_STATUS_STYLE, INVOICE_STATUS_STYLE, type QuoteStatus, type InvoiceStatus } from "@/lib/quotes/types";
import { useHierarchy } from "@/components/providers/HierarchyProvider";
import ModuleSummaryCards, { type SummaryCard } from "@/components/shared/ModuleSummaryCards";

// ─── Date helpers ─────────────────────────────────────────
const NOW = new Date();
function parse(d?: string): Date | null { if (!d) return null; const t = new Date(d); return isNaN(t.getTime()) ? null : t; }
function monthKey(d: Date): string { return `${d.getFullYear()}-${d.getMonth()}`; }
function lastMonths(n: number): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(NOW.getFullYear(), NOW.getMonth() - i, 1);
    out.push({ key: monthKey(d), label: d.toLocaleDateString("en-US", { month: "short" }) });
  }
  return out;
}
function daysBetween(a: Date, b: Date): number { return Math.floor((a.getTime() - b.getTime()) / 86_400_000); }

export default function ReportsPage() {
  const { effectiveCompanyId, effectiveLocationId, effectiveServiceAreaId } = useHierarchy();

  // Load (session-aware) data after mount to stay hydration-safe.
  const [quotes, setQuotes]     = useState<QuoteRecord[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [jobs, setJobs]         = useState<Job[]>([]);
  useEffect(() => { setQuotes(getAllQuotes()); setInvoices(getAllInvoices()); setJobs(getAllJobs()); }, []);

  const inCtx = useMemo(() => (r: { companyId?: string; locationId?: string; serviceAreaId?: string }) =>
    (!effectiveCompanyId || r.companyId === effectiveCompanyId) &&
    (!effectiveLocationId || r.locationId === effectiveLocationId) &&
    (!effectiveServiceAreaId || r.serviceAreaId === effectiveServiceAreaId),
    [effectiveCompanyId, effectiveLocationId, effectiveServiceAreaId]);

  const q = quotes.filter(inCtx);
  const inv = invoices.filter(inCtx);
  const jb = jobs.filter(inCtx);

  // ── KPIs ──
  const collected = inv.reduce((s, i) => s + (i.total - i.balanceDue), 0);
  const outstanding = inv.reduce((s, i) => s + i.balanceDue, 0);
  const openQuoteValue = q.filter(x => ["draft", "sent", "viewed"].includes(x.status)).reduce((s, x) => s + x.total, 0);
  const decided = q.filter(x => ["approved", "converted", "rejected", "expired"].includes(x.status)).length;
  const won = q.filter(x => ["approved", "converted"].includes(x.status)).length;
  const winRate = decided > 0 ? Math.round((won / decided) * 100) : 0;

  const cards: SummaryCard[] = [
    { icon: DollarSign, label: "Revenue Collected", value: fmt(collected),       sub: "Paid to date",                 iconColor: "#10b981" },
    { icon: Receipt,    label: "Outstanding AR",     value: fmt(outstanding),     sub: `${inv.filter(i => i.balanceDue > 0).length} open invoices`, iconColor: "#dc2626" },
    { icon: FilePen,    label: "Open Quote Value",   value: fmt(openQuoteValue),  sub: `${q.filter(x => ["draft", "sent", "viewed"].includes(x.status)).length} open quotes`, iconColor: "#4f46e5" },
    { icon: TrendingUp, label: "Quote Win Rate",     value: `${winRate}%`,        sub: `${won} of ${decided} decided`, iconColor: "#f59e0b" },
  ];

  // ── Revenue by month (collected, by paid date) ──
  const months = lastMonths(6);
  const revByMonth: Record<string, number> = {};
  months.forEach(m => { revByMonth[m.key] = 0; });
  inv.forEach(i => {
    const paid = i.total - i.balanceDue;
    if (paid <= 0) return;
    const d = parse(i.paidAt) ?? parse(i.updatedAt) ?? parse(i.createdAt);
    if (!d) return;
    const k = monthKey(d);
    if (k in revByMonth) revByMonth[k] += paid;
  });
  const revMax = Math.max(...months.map(m => revByMonth[m.key]), 1);

  // ── AR aging ──
  const aging = [
    { label: "Current",     color: "#10b981", amount: 0 },
    { label: "1–30 days",   color: "#f59e0b", amount: 0 },
    { label: "31–60 days",  color: "#f97316", amount: 0 },
    { label: "61–90 days",  color: "#ef4444", amount: 0 },
    { label: "90+ days",    color: "#991b1b", amount: 0 },
  ];
  inv.filter(i => i.balanceDue > 0).forEach(i => {
    const due = parse(i.dueDate);
    const od = due ? daysBetween(NOW, due) : 0;
    const bucket = od <= 0 ? 0 : od <= 30 ? 1 : od <= 60 ? 2 : od <= 90 ? 3 : 4;
    aging[bucket].amount += i.balanceDue;
  });
  const agingMax = Math.max(...aging.map(a => a.amount), 1);

  // ── Quote pipeline by status (value) ──
  const quoteStatuses: QuoteStatus[] = ["draft", "sent", "viewed", "approved", "converted", "rejected", "expired"];
  const pipeline = quoteStatuses.map(s => ({
    label: QUOTE_STATUS_STYLE[s].label, color: QUOTE_STATUS_STYLE[s].color,
    count: q.filter(x => x.status === s).length,
    value: q.filter(x => x.status === s).reduce((sum, x) => sum + x.total, 0),
  })).filter(r => r.count > 0);
  const pipeMax = Math.max(...pipeline.map(p => p.value), 1);

  // ── Invoices by status (value) ──
  const invStatuses: InvoiceStatus[] = ["draft", "sent", "partially_paid", "paid", "past_due", "void"];
  const invByStatus = invStatuses.map(s => ({
    label: INVOICE_STATUS_STYLE[s].label, color: INVOICE_STATUS_STYLE[s].color,
    count: inv.filter(x => x.status === s).length,
    value: inv.filter(x => x.status === s).reduce((sum, x) => sum + x.total, 0),
  })).filter(r => r.count > 0);
  const invMax = Math.max(...invByStatus.map(p => p.value), 1);

  // ── Jobs by status (count) ──
  const muted = (c: string) => (c === "var(--text-secondary)" || c === "var(--text-muted)" ? "#9ca3af" : c);
  const jobCounts = (Object.keys(JOB_STATUS_CONFIG) as JobStatus[]).map(s => ({
    label: JOB_STATUS_CONFIG[s].label, color: muted(JOB_STATUS_CONFIG[s].color),
    count: jb.filter(j => j.status === s).length,
  })).filter(r => r.count > 0);
  const jobMax = Math.max(...jobCounts.map(j => j.count), 1);

  // ── Top customers by revenue collected ──
  const byCustomer: Record<string, number> = {};
  inv.forEach(i => { const paid = i.total - i.balanceDue; if (paid > 0) byCustomer[i.customerName] = (byCustomer[i.customerName] ?? 0) + paid; });
  const topCustomers = Object.entries(byCustomer).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6);
  const custMax = Math.max(...topCustomers.map(c => c.value), 1);

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>Reports</h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>Revenue, receivables, pipeline, and operations — for the current scope</p>
      </div>

      <ModuleSummaryCards moduleKey="reports" cards={cards} />

      {/* Revenue by month */}
      <Section title="Revenue Collected — last 6 months" right={fmt(months.reduce((s, m) => s + revByMonth[m.key], 0))}>
        <div className="flex items-end gap-3 h-44 pt-2">
          {months.map((m, i) => {
            const v = revByMonth[m.key];
            return (
              <div key={m.key} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                <span className="text-[10px] font-medium" style={{ color: "var(--text-secondary)" }}>{v > 0 ? fmt(v) : ""}</span>
                <div className="w-full rounded-t-md transition-all" title={fmt(v)}
                  style={{ height: `${(v / revMax) * 100}%`, minHeight: v > 0 ? "4px" : "0", backgroundColor: i === months.length - 1 ? "#4f46e5" : "#c7d2fe" }} />
                <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{m.label}</span>
              </div>
            );
          })}
        </div>
      </Section>

      <div className="grid grid-cols-2 gap-5">
        {/* AR aging */}
        <Section title="Accounts Receivable Aging" right={fmt(outstanding)}>
          {outstanding === 0 ? <Empty label="No outstanding balances" /> : (
            <div className="space-y-2.5">
              {aging.map(a => <BarRow key={a.label} label={a.label} pct={(a.amount / agingMax) * 100} color={a.color} value={fmt(a.amount)} />)}
            </div>
          )}
        </Section>

        {/* Quote pipeline */}
        <Section title="Quote Pipeline" right={`${q.length} quotes`}>
          {pipeline.length === 0 ? <Empty label="No quotes in scope" /> : (
            <div className="space-y-2.5">
              {pipeline.map(p => <BarRow key={p.label} label={`${p.label} · ${p.count}`} pct={(p.value / pipeMax) * 100} color={p.color} value={fmt(p.value)} />)}
            </div>
          )}
        </Section>

        {/* Invoices by status */}
        <Section title="Invoices by Status" right={`${inv.length} invoices`}>
          {invByStatus.length === 0 ? <Empty label="No invoices in scope" /> : (
            <div className="space-y-2.5">
              {invByStatus.map(p => <BarRow key={p.label} label={`${p.label} · ${p.count}`} pct={(p.value / invMax) * 100} color={p.color} value={fmt(p.value)} />)}
            </div>
          )}
        </Section>

        {/* Jobs by status */}
        <Section title="Jobs by Status" right={`${jb.length} jobs`}>
          {jobCounts.length === 0 ? <Empty label="No jobs in scope" /> : (
            <div className="space-y-2.5">
              {jobCounts.map(j => <BarRow key={j.label} label={j.label} pct={(j.count / jobMax) * 100} color={j.color} value={String(j.count)} />)}
            </div>
          )}
        </Section>

        {/* Top customers */}
        <Section title="Top Customers by Revenue" right="Collected" className="col-span-2">
          {topCustomers.length === 0 ? <Empty label="No revenue collected yet" /> : (
            <div className="space-y-2.5">
              {topCustomers.map(c => <BarRow key={c.name} label={c.name} pct={(c.value / custMax) * 100} color="#4f46e5" value={fmt(c.value)} wide />)}
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}

// ─── Bits ─────────────────────────────────────────────────
function Section({ title, right, children, className }: { title: string; right?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl p-5 ${className ?? ""}`} style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{title}</p>
        {right && <span className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>{right}</span>}
      </div>
      {children}
    </div>
  );
}

function BarRow({ label, pct, color, value, wide }: { label: string; pct: number; color: string; value: string; wide?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className={`text-xs ${wide ? "w-40" : "w-28"} shrink-0 truncate`} style={{ color: "var(--text-secondary)" }}>{label}</span>
      <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: "var(--bg-input)" }}>
        <div className="h-2.5 rounded-full transition-all" style={{ width: `${Math.max(pct > 0 ? 3 : 0, pct)}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-semibold w-24 text-right shrink-0" style={{ color: "var(--text-primary)" }}>{value}</span>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return <p className="text-sm py-6 text-center" style={{ color: "var(--text-muted)" }}>{label}</p>;
}
