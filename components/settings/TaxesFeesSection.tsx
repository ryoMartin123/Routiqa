"use client";

import { useState, useEffect } from "react";
import { Percent } from "lucide-react";
import { SectionHeader, SettingsCard, FieldLabel, SaveButtons, ToggleRow, inputCls, inputStyle } from "@/components/settings/ui";
import { getTaxFeeSettings, saveTaxFeeSettings, resetTaxFeeSettings, type TaxFeeSettings } from "@/lib/quotes/taxes";
import { ITEM_TYPES, ITEM_TYPE_CONFIG, type ItemType } from "@/lib/items/types";

export default function TaxesFeesSection() {
  const [s, setS] = useState<TaxFeeSettings | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { setS(getTaxFeeSettings()); }, []);
  if (!s) return <div className="p-6 text-sm" style={{ color: "var(--text-muted)" }}>Loading…</div>;

  function update(mut: (d: TaxFeeSettings) => void) {
    setS(prev => { if (!prev) return prev; const next = structuredClone(prev); mut(next); return next; });
    setDirty(true); setSaved(false);
  }
  function save() { if (s) saveTaxFeeSettings(s); setDirty(false); setSaved(true); setTimeout(() => setSaved(false), 2000); }
  function reset() { setS(resetTaxFeeSettings()); setDirty(false); setSaved(false); }

  function toggleType(t: ItemType) {
    update(d => { d.taxableTypes = d.taxableTypes.includes(t) ? d.taxableTypes.filter(x => x !== t) : [...d.taxableTypes, t]; });
  }

  return (
    <div className="space-y-5">
      <SectionHeader title="Taxes & Fees" subtitle="Default tax rate, taxable item types, and optional standard fees."
        right={<SaveButtons onSave={save} onReset={reset} dirty={dirty} saved={saved} />} />

      <SettingsCard icon={Percent} title="Default Tax" subtitle="Applied to taxable line items unless overridden on a quote.">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <FieldLabel>Default Tax Rate (%)</FieldLabel>
            <input type="number" min={0} step="0.1" value={s.defaultTaxRate}
              onChange={e => update(d => { d.defaultTaxRate = parseFloat(e.target.value) || 0; })}
              className={`${inputCls} w-32`} style={inputStyle} />
          </div>
        </div>
        <div className="mt-4">
          <FieldLabel>Taxable Item Types</FieldLabel>
          <div className="flex flex-wrap gap-1.5">
            {ITEM_TYPES.map(t => {
              const on = s.taxableTypes.includes(t);
              return (
                <button key={t} onClick={() => toggleType(t)}
                  className="px-2.5 py-1 rounded-full text-xs font-medium transition-colors"
                  style={on ? { backgroundColor: "#d3ebe6", color: "#0a5c53", border: "1px solid #b9dfd8" } : { backgroundColor: "var(--bg-surface-2)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
                  {ITEM_TYPE_CONFIG[t].label}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] mt-2" style={{ color: "var(--text-muted)" }}>New items of these types default to taxable.</p>
        </div>
      </SettingsCard>

      <SettingsCard title="Standard Fees" subtitle="Optional fees you can quickly add to quotes.">
        <ToggleRow label="Default Permit Fee" description="Offer a standard permit & inspection fee."
          on={s.permitFeeEnabled} onChange={v => update(d => { d.permitFeeEnabled = v; })} />
        {s.permitFeeEnabled && (
          <div className="pl-1 pb-3"><FieldLabel>Permit Fee ($)</FieldLabel>
            <input type="number" min={0} step="0.01" value={s.permitFee} onChange={e => update(d => { d.permitFee = parseFloat(e.target.value) || 0; })} className={`${inputCls} w-32`} style={inputStyle} />
          </div>
        )}
        <ToggleRow label="Default Trip Charge" description="Offer a standard dispatch / trip charge."
          on={s.tripChargeEnabled} onChange={v => update(d => { d.tripChargeEnabled = v; })} />
        {s.tripChargeEnabled && (
          <div className="pl-1 pb-1"><FieldLabel>Trip Charge ($)</FieldLabel>
            <input type="number" min={0} step="0.01" value={s.tripCharge} onChange={e => update(d => { d.tripCharge = parseFloat(e.target.value) || 0; })} className={`${inputCls} w-32`} style={inputStyle} />
          </div>
        )}
      </SettingsCard>
    </div>
  );
}
