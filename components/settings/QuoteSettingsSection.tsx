"use client";

import { useState, useEffect } from "react";
import { Hash, ShieldCheck } from "lucide-react";
import { SectionHeader, SettingsCard, FieldLabel, SaveButtons, ToggleRow, inputCls, inputStyle } from "@/components/settings/ui";
import { getQuoteSettings, saveQuoteSettings, resetQuoteSettings, previewQuoteNumber, type QuoteSettings } from "@/lib/quotes/settings";
import { QUOTE_STATUS_STYLE, type QuoteStatus } from "@/lib/quotes/types";

const STATUS_ORDER: QuoteStatus[] = ["draft", "sent", "viewed", "approved", "rejected", "expired", "converted"];

export default function QuoteSettingsSection() {
  const [s, setS] = useState<QuoteSettings | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { setS(getQuoteSettings()); }, []);
  if (!s) return <div className="p-6 text-sm" style={{ color: "var(--text-muted)" }}>Loading…</div>;

  function update(mut: (d: QuoteSettings) => void) {
    setS(prev => { if (!prev) return prev; const next = structuredClone(prev); mut(next); return next; });
    setDirty(true); setSaved(false);
  }
  function save() { if (s) saveQuoteSettings(s); setDirty(false); setSaved(true); setTimeout(() => setSaved(false), 2000); }
  function reset() { setS(resetQuoteSettings()); setDirty(false); setSaved(false); }

  return (
    <div className="space-y-5">
      <SectionHeader title="Quote Settings" subtitle="Default quote numbering, expiration, and workflow rules."
        right={<SaveButtons onSave={save} onReset={reset} dirty={dirty} saved={saved} />} />

      <SettingsCard icon={Hash} title="Numbering & Expiration" subtitle="How new quotes are numbered and when they expire.">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <FieldLabel>Number Prefix</FieldLabel>
            <input value={s.numberPrefix} onChange={e => update(d => { d.numberPrefix = e.target.value; })} className={inputCls} style={inputStyle} />
          </div>
          <div className="col-span-2">
            <FieldLabel>Number Format</FieldLabel>
            <input value={s.numberFormat} onChange={e => update(d => { d.numberFormat = e.target.value; })} className={`${inputCls} font-mono`} style={inputStyle} />
          </div>
        </div>
        <div className="flex items-center justify-between mt-3">
          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Tokens: <span className="font-mono">{"{prefix} {year} {seq}"}</span></p>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Preview: <span className="font-mono font-medium" style={{ color: "var(--text-primary)" }}>{previewQuoteNumber(s)}</span></p>
        </div>
        <div className="mt-4">
          <FieldLabel>Default Expiration (days)</FieldLabel>
          <input type="number" min={0} value={s.defaultExpirationDays} onChange={e => update(d => { d.defaultExpirationDays = parseInt(e.target.value) || 0; })} className={`${inputCls} w-32`} style={inputStyle} />
        </div>
      </SettingsCard>

      <SettingsCard icon={ShieldCheck} title="Workflow Rules" subtitle="Requirements and allowed actions for quotes.">
        <ToggleRow label="Require customer before creating" on={s.requireCustomer} onChange={v => update(d => { d.requireCustomer = v; })} />
        <ToggleRow label="Require property before sending" on={s.requireProperty} onChange={v => update(d => { d.requireProperty = v; })} />
        <ToggleRow label="Require at least one line item before sending" on={s.requireLineItem} onChange={v => update(d => { d.requireLineItem = v; })} />
        <ToggleRow label="Allow quote approval" on={s.allowApproval} onChange={v => update(d => { d.allowApproval = v; })} />
        <ToggleRow label="Allow duplicate quote" on={s.allowDuplicate} onChange={v => update(d => { d.allowDuplicate = v; })} />
        <ToggleRow label="Allow convert quote to job / project" on={s.allowConvert} onChange={v => update(d => { d.allowConvert = v; })} />
      </SettingsCard>

      <SettingsCard title="Quote Statuses" subtitle="The default status flow (fixed for now).">
        <div className="flex flex-wrap items-center gap-2">
          {STATUS_ORDER.map((st, i) => {
            const c = QUOTE_STATUS_STYLE[st];
            return (
              <div key={st} className="flex items-center gap-2">
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: c.bg, color: c.color }}>{c.label}</span>
                {i < STATUS_ORDER.length - 1 && <span style={{ color: "var(--text-muted)" }}>→</span>}
              </div>
            );
          })}
        </div>
      </SettingsCard>
    </div>
  );
}
