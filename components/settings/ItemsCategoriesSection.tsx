"use client";

import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, ChevronUp, ChevronDown, Check, X, Tag, Package, Layers } from "lucide-react";
import { SectionHeader, SettingsCard, FieldLabel, SaveButtons, Toggle, ToggleRow, inputCls, inputStyle } from "@/components/settings/ui";
import {
  getItemCategories, saveItemCategories, resetItemCategories,
  getItemDefaults, saveItemDefaults, DEFAULT_ITEM_DEFAULTS,
  type ItemCategory, type ItemDefaults,
} from "@/lib/items/data";
import { ITEM_TYPES, ITEM_TYPE_CONFIG } from "@/lib/items/types";
import IndustryCatalogModal from "@/components/items/IndustryCatalogModal";

export default function ItemsCategoriesSection() {
  const [cats, setCats] = useState<ItemCategory[]>([]);
  const [defaults, setDefaults] = useState<ItemDefaults>(DEFAULT_ITEM_DEFAULTS);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);

  useEffect(() => { setCats(getItemCategories()); setDefaults(getItemDefaults()); }, []);
  const mark = () => { setDirty(true); setSaved(false); };

  // ── Categories ──
  function patch(id: string, p: Partial<ItemCategory>) { setCats(prev => prev.map(c => c.id === id ? { ...c, ...p } : c)); mark(); }
  function move(id: string, dir: -1 | 1) {
    const sorted = [...cats].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex(c => c.id === id);
    const swap = idx + dir;
    if (swap < 0 || swap >= sorted.length) return;
    const o = sorted[idx].order; sorted[idx].order = sorted[swap].order; sorted[swap].order = o;
    setCats([...sorted]); mark();
  }
  function commitAdd() {
    const n = draftName.trim();
    if (!n) { setAdding(false); return; }
    setCats(prev => [...prev, { id: `cat-${Date.now()}`, name: n, active: true, order: prev.length }]);
    setDraftName(""); setAdding(false); mark();
  }
  function remove(id: string) { setCats(prev => prev.filter(c => c.id !== id)); if (editingId === id) setEditingId(null); mark(); }

  // ── Defaults ──
  function setDef(p: Partial<ItemDefaults>) { setDefaults(prev => ({ ...prev, ...p })); mark(); }

  function save() { saveItemCategories(cats); saveItemDefaults(defaults); setDirty(false); setSaved(true); setTimeout(() => setSaved(false), 2000); }
  function reset() { setCats(resetItemCategories()); setDefaults(DEFAULT_ITEM_DEFAULTS); saveItemDefaults(DEFAULT_ITEM_DEFAULTS); setEditingId(null); setDirty(false); setSaved(false); }

  const sorted = [...cats].sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-5">
      <SectionHeader title="Items & Categories" subtitle="Catalog item types, categories, and default item settings."
        right={<SaveButtons onSave={save} onReset={reset} dirty={dirty} saved={saved} />} />

      {/* Industry starter catalog */}
      <SettingsCard icon={Layers} title="Industry Starter Catalog" subtitle="Preload a starter catalog for your industry, then edit freely."
        action={
          <button onClick={() => setCatalogOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: "#4f46e5" }}>
            <Layers className="w-3.5 h-3.5" /> Browse Catalogs
          </button>
        }>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Choose HVAC, Roofing, Plumbing, Electrical, Property Maintenance, or General Service. Items and categories are copied into your catalog — nothing is locked, so you can edit, disable, delete, or add your own afterward.
        </p>
      </SettingsCard>

      {/* Item types (fixed) */}
      <SettingsCard icon={Package} title="Item Types" subtitle="The catalog's built-in item types.">
        <div className="flex flex-wrap gap-1.5">
          {ITEM_TYPES.map(t => (
            <span key={t} className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: ITEM_TYPE_CONFIG[t].bg, color: ITEM_TYPE_CONFIG[t].color }}>
              {ITEM_TYPE_CONFIG[t].label}
            </span>
          ))}
        </div>
      </SettingsCard>

      {/* Categories */}
      <SettingsCard icon={Tag} title="Item Categories" subtitle="Customizable categories for organizing the catalog."
        action={!adding && (
          <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: "#4f46e5" }}>
            <Plus className="w-3.5 h-3.5" /> Add Category
          </button>
        )}>
        {adding && (
          <div className="flex items-center gap-2 mb-3">
            <input autoFocus value={draftName} onChange={e => setDraftName(e.target.value)} onKeyDown={e => { if (e.key === "Enter") commitAdd(); if (e.key === "Escape") { setAdding(false); setDraftName(""); } }}
              placeholder="Category name" className={inputCls} style={inputStyle} />
            <button onClick={commitAdd} className="p-2 rounded-lg text-white shrink-0" style={{ backgroundColor: "#4f46e5" }}><Check className="w-4 h-4" /></button>
            <button onClick={() => { setAdding(false); setDraftName(""); }} className="p-2 rounded-lg shrink-0" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}><X className="w-4 h-4" /></button>
          </div>
        )}
        <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border-subtle)" }}>
          {sorted.map((c, i) => (
            <div key={c.id} className="flex items-center gap-3 px-3 py-2.5" style={{ borderBottom: i < sorted.length - 1 ? "1px solid var(--border-subtle)" : "none", backgroundColor: "var(--bg-surface)", opacity: c.active ? 1 : 0.5 }}>
              <div className="flex flex-col">
                <button onClick={() => move(c.id, -1)} disabled={i === 0} className="disabled:opacity-20" style={{ color: "var(--text-muted)" }}><ChevronUp className="w-3.5 h-3.5" /></button>
                <button onClick={() => move(c.id, 1)} disabled={i === sorted.length - 1} className="disabled:opacity-20" style={{ color: "var(--text-muted)" }}><ChevronDown className="w-3.5 h-3.5" /></button>
              </div>
              {editingId === c.id ? (
                <input autoFocus value={c.name} onChange={e => patch(c.id, { name: e.target.value })} onBlur={() => setEditingId(null)} onKeyDown={e => { if (e.key === "Enter") setEditingId(null); }}
                  className={`${inputCls} flex-1`} style={inputStyle} />
              ) : (
                <span className="flex-1 text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{c.name}</span>
              )}
              {!c.active && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>Disabled</span>}
              <Toggle on={c.active} onChange={v => patch(c.id, { active: v })} />
              <button onClick={() => setEditingId(c.id)} className="p-1.5 rounded-lg hover:bg-[var(--bg-input)]" style={{ color: "var(--text-muted)" }}><Pencil className="w-3.5 h-3.5" /></button>
              <button onClick={() => remove(c.id)} className="p-1.5 rounded-lg hover:bg-red-50" style={{ color: "#9ca3af" }}
                onMouseEnter={e => (e.currentTarget.style.color = "#ef4444")} onMouseLeave={e => (e.currentTarget.style.color = "#9ca3af")}><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
        </div>
      </SettingsCard>

      {/* Default item settings */}
      <SettingsCard title="Default Item Settings" subtitle="Defaults applied when creating new items and quote lines.">
        <div className="grid grid-cols-2 gap-4 mb-2">
          <div>
            <FieldLabel>Default Quantity</FieldLabel>
            <input type="number" min={0} value={defaults.defaultQuantity} onChange={e => setDef({ defaultQuantity: parseFloat(e.target.value) || 1 })} className={`${inputCls} w-28`} style={inputStyle} />
          </div>
        </div>
        <ToggleRow label="Default taxable" description="New items are taxable by default." on={defaults.defaultTaxable} onChange={v => setDef({ defaultTaxable: v })} />
        <ToggleRow label="Show cost field" description="Display the internal unit-cost field on the item form." on={defaults.showCostField} onChange={v => setDef({ showCostField: v })} />
        <ToggleRow label="Allow custom quote line items" description="Let users add one-off lines not from the catalog." on={defaults.allowCustomQuoteLines} onChange={v => setDef({ allowCustomQuoteLines: v })} />
        <ToggleRow label="Allow saving a custom line as an item" description="Offer to save a one-off quote line back to the catalog." on={defaults.allowSavingCustomLineAsItem} onChange={v => setDef({ allowSavingCustomLineAsItem: v })} />
      </SettingsCard>

      {catalogOpen && (
        <IndustryCatalogModal onClose={() => setCatalogOpen(false)}
          onApplied={() => { setCatalogOpen(false); setCats(getItemCategories()); }} />
      )}
    </div>
  );
}
