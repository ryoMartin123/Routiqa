"use client";

// ─── CRM Project · Budget ─────────────────────────────────
// Project costing & billing at a glance, rolled up from the linked records:
// committed PO cost (Inventory), subcontractor commitments (Inventory), and
// invoiced / paid (Accounting). Quoted value from the project / estimates.
// Placeholder for labor + real accounting reconciliation. Mock/local.

import { DollarSign, ShoppingCart, HardHat, Wrench, FileText, Receipt, Wallet, TrendingUp } from "lucide-react";
import { getProject } from "@/lib/projects/data";
import { posForProject, assignmentsForProject, poSubtotal } from "@/lib/inventory/data";
import { getQuotesForProject, getInvoicesForProject } from "@/lib/quotes/data";

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;
const parse = (s?: string) => { if (!s) return 0; const n = parseFloat(s.replace(/[^0-9.]/g, "")); return isNaN(n) ? 0 : n; };

export default function ProjectBudget({ projectId }: { projectId: string }) {
  const project = getProject(projectId);
  const pos = posForProject(projectId);
  const assignments = assignmentsForProject(projectId);
  const quotes = getQuotesForProject(projectId);
  const invoices = getInvoicesForProject(projectId);

  // Quoted value: latest approved/any quote total, else the project estimate.
  const quoteTotal = quotes.reduce((m, q) => Math.max(m, q.total ?? 0), 0);
  const quoted = quoteTotal > 0 ? quoteTotal : parse(project?.estimatedValue);

  const materialCost = pos.reduce((s, p) => s + poSubtotal(p), 0);
  const subCost = assignments.reduce((s, a) => s + (a.contractAmount ?? 0), 0);
  const laborCost = 0; // placeholder — real labor cost lands with Accounting
  const committed = materialCost + subCost + laborCost;

  const invoiced = invoices.reduce((s, i) => s + (i.total ?? 0), 0);
  const balance = invoices.reduce((s, i) => s + (i.balanceDue ?? 0), 0);
  const paid = invoiced - balance;
  const remainingToBill = Math.max(0, quoted - invoiced);

  const margin = quoted - committed;
  const marginPct = quoted > 0 ? Math.round((margin / quoted) * 100) : 0;

  return (
    <div className="space-y-5 w-full">
      {/* Top stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat icon={DollarSign} label="Quoted Value" value={money(quoted)} sub={quotes.length ? `${quotes.length} estimate${quotes.length === 1 ? "" : "s"}` : "Project estimate"} />
        <Stat icon={TrendingUp} label="Committed Cost" value={money(committed)} accent="#f59e0b" sub="Materials · subs · labor" />
        <Stat icon={Receipt} label="Invoiced" value={money(invoiced)} accent="#6366f1" sub={`${invoices.length} invoice${invoices.length === 1 ? "" : "s"}`} />
        <Stat icon={Wallet} label="Paid" value={money(paid)} accent="#10b981" sub={balance > 0 ? `${money(balance)} balance` : "Paid in full"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Committed costs */}
        <Card title="Committed Costs" icon={TrendingUp}>
          <CostRow icon={ShoppingCart} label="Materials (purchase orders)" value={money(materialCost)} hint={`${pos.length} PO${pos.length === 1 ? "" : "s"}`} />
          <CostRow icon={HardHat} label="Subcontractors" value={money(subCost)} hint={`${assignments.length} assignment${assignments.length === 1 ? "" : "s"}`} />
          <CostRow icon={Wrench} label="Labor" value="—" hint="Placeholder" muted />
          <Total label="Total committed" value={money(committed)} />
          <div className="flex items-center justify-between mt-2 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>Est. margin vs quoted</span>
            <span className="text-sm font-semibold" style={{ color: margin >= 0 ? "#10b981" : "#dc2626" }}>{money(margin)} · {marginPct}%</span>
          </div>
        </Card>

        {/* Billing */}
        <Card title="Billing" icon={Receipt}>
          <CostRow icon={DollarSign} label="Quoted value" value={money(quoted)} />
          <CostRow icon={Receipt} label="Invoiced" value={money(invoiced)} hint={`${invoices.length} invoice${invoices.length === 1 ? "" : "s"}`} />
          <CostRow icon={Wallet} label="Paid" value={money(paid)} />
          <CostRow icon={FileText} label="Open balance" value={money(balance)} hint={balance > 0 ? "Awaiting payment" : "—"} />
          <Total label="Remaining to bill" value={money(remainingToBill)} />
        </Card>
      </div>

      <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
        Costs roll up from the project's purchase orders & subcontractor commitments (Inventory &amp; Procurement) and invoices (Accounting). Real labor cost, payments, and cost reports arrive with the Accounting integration.
      </p>
    </div>
  );
}

function Stat({ icon: Icon, label, value, sub, accent }: { icon: typeof DollarSign; label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="rounded-xl p-3.5" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center gap-1.5 mb-1.5"><Icon className="w-3.5 h-3.5" style={{ color: accent ?? "var(--text-muted)" }} /><p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>{label}</p></div>
      <p className="text-lg font-bold leading-tight truncate" style={{ color: accent ?? "var(--text-primary)" }}>{value}</p>
      {sub && <p className="text-[11px] mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>{sub}</p>}
    </div>
  );
}
function Card({ title, icon: Icon, children }: { title: string; icon: typeof DollarSign; children: React.ReactNode }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)" }}>
        <Icon className="w-4 h-4" style={{ color: "var(--text-muted)" }} /><p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{title}</p>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}
function CostRow({ icon: Icon, label, value, hint, muted }: { icon: typeof DollarSign; label: string; value: string; hint?: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2" style={{ borderBottom: "1px solid var(--border)" }}>
      <span className="flex items-center gap-2 min-w-0"><Icon className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} /><span className="text-sm truncate" style={{ color: muted ? "var(--text-muted)" : "var(--text-primary)" }}>{label}</span></span>
      <div className="text-right shrink-0"><span className="text-sm font-medium tabular-nums" style={{ color: muted ? "var(--text-muted)" : "var(--text-primary)" }}>{value}</span>{hint && <span className="block text-[10px]" style={{ color: "var(--text-muted)" }}>{hint}</span>}</div>
    </div>
  );
}
function Total({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 pt-2.5">
      <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{label}</span>
      <span className="text-base font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>{value}</span>
    </div>
  );
}
