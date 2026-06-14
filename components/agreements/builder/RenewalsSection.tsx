"use client";

import UiSelect from "@/components/ui/Select";
import NumberStepper from "@/components/ui/NumberStepper";
import { RENEWAL_TYPE_LABELS, type RenewalType } from "@/lib/agreements/settings";
import type { UseAgreementDraft } from "./useAgreementDraft";
import { SectionHead, Field, Mini, ToggleRow, cardStyle } from "./ui";

const TYPE_OPTIONS = (Object.keys(RENEWAL_TYPE_LABELS) as RenewalType[]).map(k => ({ value: k, label: RENEWAL_TYPE_LABELS[k] }));
const INC_OPTIONS = [{ value: "pct", label: "Percentage" }, { value: "flat", label: "Flat amount" }];

export default function RenewalsSection({ d }: { d: UseAgreementDraft }) {
  const r = d.renewal;
  const showIncrease = r.renewalType === "auto_increase";

  return (
    <div>
      <SectionHead title="Renewals" subtitle="What happens when the agreement term ends." />

      <div className="space-y-4 max-w-xl">
        <Field label="Apply a renewal rule" hint="from your library">
          <UiSelect value="" placeholder="Choose a saved rule…" onChange={(id) => d.applyRenewalRule(id)}
            options={d.renewalLib.map(x => ({ value: x.id, label: x.name }))} />
        </Field>

        <Field label="Renewal Type">
          <UiSelect value={r.renewalType} onChange={k => d.setRenewal({ renewalType: k as RenewalType })} options={TYPE_OPTIONS} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Mini label="Term Length (months)"><NumberStepper size="sm" min={1} value={r.termMonths} onChange={v => { d.setRenewal({ termMonths: v }); d.setTermMonths(v); }} /></Mini>
          <Mini label="Renewal Reminder (days before)"><NumberStepper size="sm" min={0} value={r.reminderDays} onChange={v => d.setRenewal({ reminderDays: v })} /></Mini>
          <Mini label="Notice Required (days)"><NumberStepper size="sm" min={0} value={r.noticeDays} onChange={v => d.setRenewal({ noticeDays: v })} /></Mini>
        </div>

        <div className="rounded-xl p-3 space-y-3" style={cardStyle}>
          <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Price Increase Rule</p>
          <div className="grid grid-cols-2 gap-3">
            <Mini label="Type"><UiSelect size="sm" value={r.priceIncreaseType} onChange={k => d.setRenewal({ priceIncreaseType: k as "pct" | "flat" })} options={INC_OPTIONS} /></Mini>
            <Mini label={r.priceIncreaseType === "flat" ? "Amount ($)" : "Amount (%)"}>
              <NumberStepper size="sm" min={0} step={0.01} value={r.priceIncreasePct} onChange={v => d.setRenewal({ priceIncreasePct: v })} disabled={r.renewalType === "no_renewal"} />
            </Mini>
          </div>
          {!showIncrease && (parseFloat(r.priceIncreasePct) || 0) > 0 && (
            <p className="text-[11px]" style={{ color: "#b45309" }}>Heads up: a price increase is set but the renewal type isn&apos;t &ldquo;Auto-renew with price increase&rdquo;.</p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-2">
          <ToggleRow label="Approval required" hint="A manager must approve the renewal before it takes effect." on={r.approvalRequired} onChange={val => d.setRenewal({ approvalRequired: val })} />
          <ToggleRow label="Generate renewal task" hint="Create a follow-up task when renewal approaches." on={r.generateTask} onChange={val => d.setRenewal({ generateTask: val })} />
          <ToggleRow label="Generate renewal quote / agreement" hint="Draft a renewal quote for review." on={r.generateQuote} onChange={val => d.setRenewal({ generateQuote: val })} />
        </div>

        <p className="text-[11px] rounded-lg px-3 py-2" style={{ ...cardStyle, color: "var(--text-muted)" }}>
          Renews on <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>{d.renewalDate || "—"}</span>.
        </p>
      </div>
    </div>
  );
}
