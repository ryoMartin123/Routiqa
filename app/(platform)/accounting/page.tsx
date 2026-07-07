"use client";

// ─── Accounting — placeholder dashboard ───────────────────
// Financial app connected to the CRM (invoices/payments/expenses/reports).
// Layout + access wired; functionality lands later.

import { Receipt, CreditCard, Wallet, BarChart3 } from "lucide-react";
import { PageHeader, StatCard } from "@/components/platform/ui";

export default function AccountingDashboard() {
  return (
    <div className="p-6 space-y-4">
      <PageHeader title="Accounting Dashboard" subtitle="Invoices, payments, expenses, and financial activity." accent="#10b981" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Outstanding A/R" value="$48,250" hint="12 open invoices" icon={Receipt} accent="#10b981" />
        <StatCard label="Collected (MTD)" value="$112,400" hint="+8% vs last month" icon={CreditCard} accent="#0ea5e9" />
        <StatCard label="Expenses (MTD)" value="$34,900" hint="Across 3 locations" icon={Wallet} accent="#f59e0b" />
        <StatCard label="Net (MTD)" value="$77,500" hint="Cash basis" icon={BarChart3} accent="#239c8d" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Past-Due Invoices" icon={Receipt} accent="#ef4444" lines={["#1042 — Wilson HVAC · $4,200 · 21d", "#1038 — Maple Roofing · $7,800 · 35d"]} />
        <Panel title="Recent Payments" icon={CreditCard} accent="#10b981" lines={["#1051 — $2,400 · Card", "#1049 — $1,150 · ACH", "#1047 — $980 · Check"]} />
      </div>
    </div>
  );
}

function Panel({ title, icon: Icon, accent, lines }: { title: string; icon: typeof Receipt; accent: string; lines: string[] }) {
  return (
    <div className="rounded-xl p-5" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
      <div className="flex items-center gap-2.5 mb-3">
        <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: accent + "22" }}>
          <Icon className="w-4 h-4" style={{ color: accent }} />
        </span>
        <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{title}</h2>
      </div>
      <ul className="space-y-2">
        {lines.map((l, i) => (
          <li key={i} className="text-sm flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: accent }} />
            <span className="truncate">{l}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
