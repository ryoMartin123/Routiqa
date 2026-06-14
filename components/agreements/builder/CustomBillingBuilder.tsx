"use client";

// Guided rule builder shown when a billing rule's frequency is "Custom". Pick a
// rule type (card/radio), then only the fields for that type appear. Writes a
// structured CustomBillingConfig (never free text) and shows a plain-English
// summary. Mock only — no invoice generation or payment collection here.

import UiSelect from "@/components/ui/Select";
import NumberStepper from "@/components/ui/NumberStepper";
import DatePicker from "@/components/ui/DatePicker";
import { Plus, Trash2 } from "lucide-react";
import {
  CUSTOM_BILLING_RULE_TYPES, RECURRING_FREQ_OPTIONS,
  defaultCustomBilling, newBillingItem, summarizeCustomBilling,
  type CustomBillingConfig, type CustomBillingItem,
} from "@/lib/agreements/custom-rules";
import { Mini, TextInput, RuleCard, RuleSummary, cardStyle } from "./ui";

export default function CustomBillingBuilder({ config, onChange }: { config?: CustomBillingConfig; onChange: (c: CustomBillingConfig) => void }) {
  const c = config;
  const set = (patch: Partial<CustomBillingConfig>) => { if (c) onChange({ ...c, ...patch }); };

  return (
    <div className="rounded-xl p-3 space-y-3" style={cardStyle}>
      <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
        What kind of custom billing rule do you need?
      </p>
      <div className="grid grid-cols-2 gap-2">
        {CUSTOM_BILLING_RULE_TYPES.map(rt => (
          <RuleCard key={rt.type} selected={c?.ruleType === rt.type} title={rt.title} desc={rt.desc}
            onClick={() => onChange(defaultCustomBilling(rt.type))} />
        ))}
      </div>

      {c && (
        <div className="space-y-3 pt-1">
          {c.ruleType === "fixed_recurring" && (
            <div className="grid grid-cols-2 gap-3">
              <Mini label="Amount"><NumberStepper size="sm" min={0} step={1} value={String(c.amount ?? 0)} onChange={v => set({ amount: parseFloat(v) || 0 })} /></Mini>
              <Mini label="Frequency"><UiSelect size="sm" value={c.recurringFrequencyKey ?? "monthly"} onChange={k => set({ recurringFrequencyKey: k })} options={RECURRING_FREQ_OPTIONS} /></Mini>
              <Mini label="Billing start"><DatePicker value={c.startDate ?? ""} onChange={v => set({ startDate: v })} placeholder="On agreement start" /></Mini>
            </div>
          )}

          {c.ruleType === "deposit_recurring" && (
            <div className="grid grid-cols-2 gap-3">
              <Mini label="Deposit"><NumberStepper size="sm" min={0} step={1} value={String(c.deposit ?? 0)} onChange={v => set({ deposit: parseFloat(v) || 0 })} /></Mini>
              <Mini label="Recurring amount"><NumberStepper size="sm" min={0} step={1} value={String(c.amount ?? 0)} onChange={v => set({ amount: parseFloat(v) || 0 })} /></Mini>
              <Mini label="Frequency"><UiSelect size="sm" value={c.recurringFrequencyKey ?? "monthly"} onChange={k => set({ recurringFrequencyKey: k })} options={RECURRING_FREQ_OPTIONS} /></Mini>
              <Mini label="Billing start"><DatePicker value={c.startDate ?? ""} onChange={v => set({ startDate: v })} placeholder="On agreement start" /></Mini>
            </div>
          )}

          {c.ruleType === "per_visit" && (
            <div className="grid grid-cols-2 gap-3">
              <Mini label="Amount per completed visit"><NumberStepper size="sm" min={0} step={1} value={String(c.amount ?? 0)} onChange={v => set({ amount: parseFloat(v) || 0 })} /></Mini>
            </div>
          )}

          {(c.ruleType === "payment_schedule" || c.ruleType === "milestone") && (
            <ItemEditor mode={c.ruleType} items={c.items ?? []} onChange={items => set({ items })} />
          )}

          <RuleSummary text={summarizeCustomBilling(c)} />
          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            Invoices aren&apos;t generated yet — this rule defines the schedule and amounts for later billing.
          </p>
        </div>
      )}
    </div>
  );
}

// Repeatable amount rows — dated payments (payment_schedule) or named milestones.
function ItemEditor({ mode, items, onChange }: { mode: "payment_schedule" | "milestone"; items: CustomBillingItem[]; onChange: (i: CustomBillingItem[]) => void }) {
  const upd = (id: string, patch: Partial<CustomBillingItem>) => onChange(items.map(it => it.id === id ? { ...it, ...patch } : it));
  const isMilestone = mode === "milestone";
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{isMilestone ? "Milestones" : "Payments"}</span>
        <button type="button" onClick={() => onChange([...items, newBillingItem(isMilestone ? `Milestone ${items.length + 1}` : "", 0)])}
          className="flex items-center gap-1 text-xs font-medium" style={{ color: "var(--accent-text)" }}><Plus className="w-3.5 h-3.5" /> Add {isMilestone ? "milestone" : "payment"}</button>
      </div>
      {items.length === 0 && <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>None added yet.</p>}
      {items.map(it => (
        <div key={it.id} className="flex items-end gap-2">
          <div className="flex-1 min-w-0"><Mini label={isMilestone ? "Milestone" : "Label"}><TextInput value={it.label} onChange={e => upd(it.id, { label: e.target.value })} placeholder={isMilestone ? "e.g. At completion" : "e.g. At signing"} /></Mini></div>
          <div className="w-28 shrink-0"><Mini label="Amount"><NumberStepper size="sm" min={0} step={1} value={String(it.amount ?? 0)} onChange={v => upd(it.id, { amount: parseFloat(v) || 0 })} /></Mini></div>
          {!isMilestone && <div className="w-36 shrink-0"><Mini label="Due date"><DatePicker value={it.dueDate ?? ""} onChange={v => upd(it.id, { dueDate: v })} placeholder="Optional" /></Mini></div>}
          <button type="button" onClick={() => onChange(items.filter(x => x.id !== it.id))} className="p-1.5 mb-0.5 rounded-lg hover:bg-red-50 shrink-0" style={{ color: "#9ca3af" }} title="Remove"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      ))}
    </div>
  );
}
