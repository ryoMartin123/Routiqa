"use client";

import { useState } from "react";
import UiSelect from "@/components/ui/Select";
import DatePicker from "@/components/ui/DatePicker";
import NumberStepper from "@/components/ui/NumberStepper";
import { summarizeCustomBilling, representativeBillingAmount } from "@/lib/agreements/custom-rules";
import type { UseAgreementDraft } from "./useAgreementDraft";
import CustomBillingBuilder from "./CustomBillingBuilder";
import { SectionHead, AddButton, SummaryCard, Field, Mini, ToggleRow, cardStyle } from "./ui";

export default function BillingRulesSection({ d }: { d: UseAgreementDraft }) {
  const [open, setOpen] = useState<string | null>(d.billings[0]?.id ?? null);
  const ruleName = (key: string) => d.billingRules.find(r => r.key === key)?.name ?? key;
  const money = (s: string) => `$${(parseFloat(s) || 0).toLocaleString()}`;

  return (
    <div>
      <SectionHead title="Billing Rules" subtitle="How the customer pays — one or more billing rules for this agreement."
        action={<AddButton onClick={() => d.addBilling()} label="Add rule" />} />

      <div className="rounded-lg px-3 py-2 mb-3 inline-flex items-center gap-2 text-sm font-medium" style={{ backgroundColor: "var(--accent-soft-bg)", color: "var(--accent-text-strong)" }}>
        Estimated annual value: ${d.annualValue.toLocaleString()}/yr
      </div>

      <div className="space-y-2.5">
        {d.billings.map((b, i) => (
          <SummaryCard key={b.id} title={`${ruleName(b.frequencyKey)}${i === 0 ? " (primary)" : ""}`}
            meta={b.frequencyKey === "custom" && b.customBilling ? summarizeCustomBilling(b.customBilling) : `${money(b.amount)}${b.taxable ? " · taxable" : ""}${b.deposit ? ` · deposit ${money(b.deposit)}` : ""}`}
            badges={d.paymentTerms.find(p => p.key === b.paymentTermsKey) ? [{ label: d.paymentTerms.find(p => p.key === b.paymentTermsKey)!.label, tone: "muted" }] : []}
            expanded={open === b.id} onToggle={() => setOpen(open === b.id ? null : b.id)}
            onRemove={d.billings.length > 1 ? () => { d.removeBilling(b.id); if (open === b.id) setOpen(null); } : undefined}>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Mini label="Billing Frequency"><UiSelect size="sm" value={b.frequencyKey} onChange={k => d.setBilling(b.id, { frequencyKey: k })} options={d.billingRules.map(r => ({ value: r.key, label: r.name }))} /></Mini>
                {b.frequencyKey !== "custom" && <Mini label="Amount per period"><NumberStepper size="sm" min={0} step={0.01} value={b.amount} onChange={v => d.setBilling(b.id, { amount: v })} /></Mini>}
                {b.frequencyKey !== "custom" && <Field label="Billing Start" hint="optional"><DatePicker value={b.startDate} onChange={v => d.setBilling(b.id, { startDate: v })} placeholder="On agreement start" /></Field>}
                <Field label="Billing End" hint="optional"><DatePicker value={b.endDate} onChange={v => d.setBilling(b.id, { endDate: v })} placeholder="None" /></Field>
                <Mini label="Payment Terms"><UiSelect size="sm" value={b.paymentTermsKey} onChange={k => d.setBilling(b.id, { paymentTermsKey: k })} options={d.paymentTerms.map(p => ({ value: p.key, label: p.label }))} /></Mini>
                {b.frequencyKey !== "custom" && <Mini label="Deposit (optional)"><NumberStepper size="sm" min={0} step={0.01} value={b.deposit} onChange={v => d.setBilling(b.id, { deposit: v })} placeholder="None" /></Mini>}
              </div>
              {b.frequencyKey === "custom" && (
                <CustomBillingBuilder config={b.customBilling} onChange={cfg => d.setBilling(b.id, { customBilling: cfg, amount: String(representativeBillingAmount(cfg)) })} />
              )}
              <div className="grid grid-cols-1 gap-2">
                <ToggleRow label="Taxable" on={b.taxable} onChange={val => d.setBilling(b.id, { taxable: val })} />
                <ToggleRow label="Auto-renew billing" hint="Continue billing into renewal terms." on={b.autoRenew} onChange={val => d.setBilling(b.id, { autoRenew: val })} />
              </div>
            </div>
          </SummaryCard>
        ))}
      </div>

      <p className="text-[11px] mt-3 rounded-lg px-3 py-2" style={{ ...cardStyle, color: "var(--text-muted)" }}>
        Invoices aren&apos;t generated yet — these rules define the cadence and amounts for later billing.
      </p>
    </div>
  );
}
