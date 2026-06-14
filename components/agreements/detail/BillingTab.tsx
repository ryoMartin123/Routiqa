"use client";

// Billing: the agreement's billing setup + (placeholder) invoices/payments.
// Reads real cadence/amount/terms from the snapshot; invoices & payments are
// not built yet, so they show an empty state with inert placeholder actions.

import { useState } from "react";
import { Receipt, DollarSign, Calendar, Percent, User, FileText, Plus, PauseCircle, Pencil } from "lucide-react";
import {
  formatValue, billingAmountPerPeriod, nextBillingDate, type CustomerAgreement,
} from "@/lib/agreements/data";
import { PAYMENT_TERMS } from "@/lib/agreements/settings";
import { Card, SectionLabel, InfoRow } from "./shared";

function fmtDate(d: Date | null): string {
  return d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";
}

export default function BillingTab({ agreement }: { agreement: CustomerAgreement }) {
  const [soon, setSoon] = useState<string | null>(null);
  const rule = agreement.billingRules?.[0];
  const paymentTerm = PAYMENT_TERMS.find(t => t.key === rule?.paymentTermsKey)?.label ?? "Due on receipt";
  const perPeriod = billingAmountPerPeriod(agreement);

  const placeholder = (label: string) => () => { setSoon(`${label} isn't available yet.`); };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Billing setup */}
      <Card className="p-4 lg:col-span-2">
        <SectionLabel>Billing Setup</SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 mt-3">
          <InfoRow icon={Receipt}    label="Billing Rule" value={agreement.billingLabel ?? agreement.billingFrequency} />
          <InfoRow icon={Calendar}   label="Frequency" value={agreement.billingFrequency} />
          <InfoRow icon={DollarSign} label="Agreement Price" value={`${formatValue(agreement)} · $${agreement.annualValue.toLocaleString()}/yr`} />
          <InfoRow icon={DollarSign} label="Per Period" value={`$${perPeriod.toLocaleString()}`} />
          <InfoRow icon={Percent}    label="Taxable" value={agreement.billingTaxable ? "Yes" : "No"} />
          <InfoRow icon={Calendar}   label="Next Billing Date" value={fmtDate(nextBillingDate(agreement))} />
          <InfoRow icon={FileText}   label="Payment Terms" value={paymentTerm} />
          <InfoRow icon={User}       label="Billing Contact" value={agreement.contactName ?? "—"} />
        </div>
      </Card>

      {/* Actions + invoices */}
      <div className="space-y-4">
        <Card className="p-4">
          <SectionLabel>Actions</SectionLabel>
          <div className="space-y-2 mt-3">
            {[
              { label: "Create invoice", icon: Plus },
              { label: "View invoices", icon: FileText },
              { label: "Pause billing", icon: PauseCircle },
              { label: "Edit billing", icon: Pencil },
            ].map(({ label, icon: Icon }) => (
              <button key={label} onClick={placeholder(label)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors hover:bg-[var(--bg-surface-2)]"
                style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                <Icon className="w-3.5 h-3.5" /> {label}
              </button>
            ))}
          </div>
          {soon && <p className="text-[11px] mt-2" style={{ color: "var(--text-muted)" }}>{soon}</p>}
        </Card>

        <Card className="p-4">
          <SectionLabel>Invoices &amp; Payments</SectionLabel>
          <div className="py-6 text-center">
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>No invoices yet.</p>
            <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>Balance due: <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>$0</span></p>
          </div>
        </Card>
      </div>
    </div>
  );
}
