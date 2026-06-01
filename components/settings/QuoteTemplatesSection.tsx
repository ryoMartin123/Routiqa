"use client";

import { useState, useEffect } from "react";
import { Star, Pencil, FileStack } from "lucide-react";
import { SectionHeader, SettingsCard, FieldLabel, SaveButtons, Toggle, inputCls, inputStyle } from "@/components/settings/ui";
import UiSelect from "@/components/ui/Select";
import {
  getTemplateConfigs, saveTemplateConfigs, resetTemplateConfigs,
  TEMPLATE_SECTIONS, TEMPLATE_TYPE_LABELS,
  type QuoteTemplateConfig, type TemplateType,
} from "@/lib/quotes/templates";
import { getTermsBlocks } from "@/lib/quotes/terms";

const TYPE_OPTS = (Object.keys(TEMPLATE_TYPE_LABELS) as TemplateType[]).map(t => ({ value: t, label: TEMPLATE_TYPE_LABELS[t] }));

export default function QuoteTemplatesSection() {
  const [configs, setConfigs] = useState<QuoteTemplateConfig[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [terms, setTerms] = useState<{ value: string; label: string }[]>([]);

  useEffect(() => {
    setConfigs(getTemplateConfigs());
    setTerms([{ value: "", label: "None" }, ...getTermsBlocks().filter(t => t.active).map(t => ({ value: t.id, label: t.name }))]);
  }, []);
  const mark = () => { setDirty(true); setSaved(false); };

  function patch(key: string, p: Partial<QuoteTemplateConfig>) { setConfigs(prev => prev.map(c => c.key === key ? { ...c, ...p } : c)); mark(); }
  function toggleSection(key: string, sectionKey: string) {
    setConfigs(prev => prev.map(c => c.key === key ? { ...c, sections: { ...c.sections, [sectionKey]: !c.sections[sectionKey] } } : c)); mark();
  }
  function setDefault(key: string) { setConfigs(prev => prev.map(c => ({ ...c, isDefault: c.key === key }))); mark(); }

  function save() { saveTemplateConfigs(configs); setDirty(false); setSaved(true); setTimeout(() => setSaved(false), 2000); }
  function reset() { setConfigs(resetTemplateConfigs()); setEditing(null); setDirty(false); setSaved(false); }

  return (
    <div className="space-y-5">
      <SectionHeader title="Quote Templates" subtitle="Default quote structures and which sections each one shows."
        right={<SaveButtons onSave={save} onReset={reset} dirty={dirty} saved={saved} />} />

      <div className="space-y-3">
        {configs.map(c => (
          <SettingsCard key={c.key} icon={FileStack} title={c.name}
            subtitle={`${TEMPLATE_TYPE_LABELS[c.templateType]} · ${Object.values(c.sections).filter(Boolean).length} sections · expires in ${c.defaultExpirationDays}d`}
            action={
              <div className="flex items-center gap-2">
                {c.isDefault
                  ? <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: "#e0e7ff", color: "#3730a3" }}><Star className="w-2.5 h-2.5" /> Default</span>
                  : <button onClick={() => setDefault(c.key)} title="Set as default" className="p-1.5 rounded-lg hover:bg-[var(--bg-input)]" style={{ color: "var(--text-muted)" }}><Star className="w-3.5 h-3.5" /></button>}
                {!c.active && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>Inactive</span>}
                <Toggle on={c.active} onChange={v => patch(c.key, { active: v })} />
                <button onClick={() => setEditing(editing === c.key ? null : c.key)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                  <Pencil className="w-3 h-3" /> {editing === c.key ? "Close" : "Edit"}
                </button>
              </div>
            }>
            {editing === c.key && (
              <div className="space-y-4 pt-1">
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-1">
                    <FieldLabel>Template Name</FieldLabel>
                    <input value={c.name} onChange={e => patch(c.key, { name: e.target.value })} className={inputCls} style={inputStyle} />
                  </div>
                  <div>
                    <FieldLabel>Template Type</FieldLabel>
                    <UiSelect value={c.templateType} onChange={v => patch(c.key, { templateType: v as TemplateType })} options={TYPE_OPTS} />
                  </div>
                  <div>
                    <FieldLabel>Default Expiration (days)</FieldLabel>
                    <input type="number" min={0} value={c.defaultExpirationDays} onChange={e => patch(c.key, { defaultExpirationDays: parseInt(e.target.value) || 0 })} className={inputCls} style={inputStyle} />
                  </div>
                </div>
                <div>
                  <FieldLabel>Default Terms</FieldLabel>
                  <UiSelect value={c.defaultTerms} onChange={v => patch(c.key, { defaultTerms: v })} options={terms} />
                </div>
                <div>
                  <FieldLabel>Sections</FieldLabel>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1 rounded-lg p-3" style={{ border: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-surface-2)" }}>
                    {TEMPLATE_SECTIONS.map(s => (
                      <div key={s.key} className="flex items-center justify-between py-1.5">
                        <span className="text-sm" style={{ color: "var(--text-primary)" }}>{s.label}</span>
                        <Toggle on={Boolean(c.sections[s.key])} onChange={() => toggleSection(c.key, s.key)} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </SettingsCard>
        ))}
      </div>
    </div>
  );
}
