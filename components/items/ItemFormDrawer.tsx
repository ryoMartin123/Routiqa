"use client";

import { useMemo, useState } from "react";
import { X, Plus, Trash2, Boxes, AlertTriangle } from "lucide-react";
import UiSelect from "@/components/ui/Select";
import NumberStepper from "@/components/ui/NumberStepper";
import { useHierarchy } from "@/components/providers/HierarchyProvider";
import {
  createItem, updateItem, getActiveCategoryNames, addItemCategory, getItemDefaults,
  getAllItems, fmt,
  type Item,
} from "@/lib/items/data";
import { ITEM_TYPES, ITEM_TYPE_CONFIG, type ItemType, type BundleComponent } from "@/lib/items/types";
import { getInventoryItem } from "@/lib/inventory/data";

// Prefill for "New item from inventory" (Items page picker) — carries the
// inventoryItemId link so cost/price drift can be surfaced later.
export interface ItemPreset {
  name?: string; sku?: string; type?: ItemType; category?: string;
  unitPrice?: number; unitCost?: number; inventoryItemId?: string;
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!on)} role="switch" aria-checked={on} type="button"
      className="relative w-9 h-5 rounded-full transition-colors shrink-0"
      style={{ backgroundColor: on ? "#0f8578" : "var(--bg-input)", border: "1px solid var(--border)" }}>
      <span className="absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-transform"
        style={{ transform: on ? "translateX(16px)" : "translateX(0)" }} />
    </button>
  );
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>{label}</label>
      {children}
      {hint && <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>{hint}</p>}
    </div>
  );
}

const inputCls = "w-full rounded-lg px-3 py-2 text-sm outline-none";
const inputStyle = { border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" } as const;

export default function ItemFormDrawer({ item, preset, onClose, onSaved }: {
  item?: Item;
  preset?: ItemPreset;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { effectiveCompanyId } = useHierarchy();
  const defaults = getItemDefaults();
  const editing = Boolean(item);

  const [name, setName] = useState(item?.name ?? preset?.name ?? "");
  const [sku, setSku] = useState(item?.sku ?? preset?.sku ?? "");
  const [type, setType] = useState<ItemType>(item?.type ?? preset?.type ?? "service");
  const [categories] = useState<string[]>(() => {
    const cats = getActiveCategoryNames();
    // A preset category (e.g. from inventory) joins the list even if it's new.
    return preset?.category && !cats.includes(preset.category) ? [...cats, preset.category] : cats;
  });
  const [category, setCategory] = useState(item?.category ?? preset?.category ?? categories[0] ?? "Other");
  const [addingCat, setAddingCat] = useState(false);
  const [newCat, setNewCat] = useState("");
  const [description, setDescription] = useState(item?.description ?? "");
  const [unitPrice, setUnitPrice] = useState(String(item?.unitPrice ?? preset?.unitPrice ?? 0));
  const [unitCost, setUnitCost] = useState(item?.unitCost != null ? String(item.unitCost) : preset?.unitCost != null ? String(preset.unitCost) : "");
  const [defaultQuantity, setDefaultQuantity] = useState(String(item?.defaultQuantity ?? defaults.defaultQuantity));
  const [taxable, setTaxable] = useState(item?.taxable ?? defaults.defaultTaxable);
  const [active, setActive] = useState(item?.active ?? true);

  // ── Bundle (type "package") ──
  const [components, setComponents] = useState<BundleComponent[]>(item?.components ?? []);
  const [bundlePricing, setBundlePricing] = useState<"sum" | "fixed">(item?.bundlePricing ?? "sum");
  const [expandOnAdd, setExpandOnAdd] = useState(item?.expandOnAdd ?? false);
  // Candidates: active, not a bundle (no nesting), not the item being edited.
  const candidates = useMemo(() => getAllItems().filter(i => i.active && i.type !== "package" && i.id !== item?.id), [item?.id]);
  const isBundleForm = type === "package" && components.length > 0;
  const compSum = useMemo(() => {
    let price = 0, cost = 0;
    for (const c of components) {
      const comp = candidates.find(i => i.id === c.itemId);
      if (!comp) continue;
      price += comp.unitPrice * c.quantity;
      cost += (comp.unitCost ?? 0) * c.quantity;
    }
    return { price: Math.round(price * 100) / 100, cost: Math.round(cost * 100) / 100 };
  }, [components, candidates]);

  // ── Inventory link — surface drift, never auto-sync ──
  const inventoryItemId = item?.inventoryItemId ?? preset?.inventoryItemId;
  const inv = inventoryItemId ? getInventoryItem(inventoryItemId) : undefined;
  const invDrift = !!inv && !!item && inv.cost != null && inv.sellPrice != null && (
    (item.unitCost != null && Math.abs(inv.cost - item.unitCost) >= 0.01) ||
    Math.abs(inv.sellPrice - item.unitPrice) >= 0.01
  );

  const canSave = Boolean(name.trim() && category && !isNaN(parseFloat(unitPrice)));

  function commitNewCategory() {
    const n = newCat.trim();
    if (!n) { setAddingCat(false); return; }
    addItemCategory(n);
    setCategory(n);
    setNewCat(""); setAddingCat(false);
  }

  function handleSave() {
    if (!canSave) return;
    const payload = {
      name, description: description || undefined, type, category,
      // Sum-priced bundles store the computed sum (kept fresh on every save);
      // cost always sums from components so margin stays honest.
      unitPrice: isBundleForm && bundlePricing === "sum" ? compSum.price : (parseFloat(unitPrice) || 0),
      unitCost: isBundleForm ? compSum.cost : (unitCost.trim() === "" ? undefined : parseFloat(unitCost)),
      taxable, defaultQuantity: parseFloat(defaultQuantity) || 1,
      sku: sku || undefined, active,
      components: type === "package" && components.length ? components : undefined,
      bundlePricing: type === "package" && components.length ? bundlePricing : undefined,
      expandOnAdd: type === "package" && components.length ? expandOnAdd : undefined,
      inventoryItemId,
    };
    if (editing && item) updateItem(item.id, payload);
    else createItem({ ...payload, companyId: effectiveCompanyId || undefined });
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[92vh] flex flex-col rounded-2xl overflow-hidden" onClick={e => e.stopPropagation()}
        style={{ backgroundColor: "var(--bg-surface)", boxShadow: "0 16px 48px rgba(0,0,0,0.24)" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <p className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>{editing ? "Edit Item" : "New Item"}</p>
          <button onClick={onClose} style={{ color: "var(--text-muted)" }}><X className="w-4 h-4" /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto thin-scroll-y px-5 py-4 space-y-4">
          <Field label="Name *">
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. 3 Ton Heat Pump System"
              className={inputCls} style={inputStyle} />
          </Field>

          {inv && (
            <div className="rounded-lg px-3 py-2 flex items-start gap-2" style={{ backgroundColor: invDrift ? "var(--warning-soft-bg)" : "var(--bg-surface-2)", border: `1px solid ${invDrift ? "var(--warning-soft-border)" : "var(--border)"}` }}>
              {invDrift ? <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "var(--warning-icon)" }} /> : <Boxes className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "var(--text-muted)" }} />}
              <div className="min-w-0 flex-1">
                <p className="text-[11px] leading-snug" style={{ color: invDrift ? "var(--warning-text)" : "var(--text-muted)" }}>
                  Linked to inventory: <span className="font-semibold">{inv.name}</span> ({inv.sku}) — cost {fmt(inv.cost ?? 0)}, sells {fmt(inv.sellPrice ?? 0)}.
                  {invDrift ? " Inventory numbers have changed." : ""}
                </p>
                {invDrift && (
                  <button onClick={() => { setUnitCost(String(inv.cost ?? 0)); setUnitPrice(String(inv.sellPrice ?? 0)); }}
                    className="mt-0.5 text-[11px] font-semibold underline underline-offset-2" style={{ color: "var(--warning-text)" }}>
                    Use current inventory cost &amp; price
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Type *">
              <UiSelect value={type} onChange={v => setType(v as ItemType)}
                options={ITEM_TYPES.map(t => ({ value: t, label: ITEM_TYPE_CONFIG[t].label }))} />
            </Field>
            <Field label="Item Code / SKU">
              <input value={sku} onChange={e => setSku(e.target.value)} placeholder="Optional"
                className={`${inputCls} font-mono`} style={inputStyle} />
            </Field>
          </div>

          <Field label="Category *">
            {addingCat ? (
              <div className="flex items-center gap-2">
                <input autoFocus value={newCat} onChange={e => setNewCat(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") commitNewCategory(); }}
                  placeholder="New category name" className={inputCls} style={inputStyle} />
                <button onClick={commitNewCategory} className="px-3 py-2 rounded-lg text-xs font-medium text-white shrink-0" style={{ backgroundColor: "#0f8578" }}>Add</button>
                <button onClick={() => { setAddingCat(false); setNewCat(""); }} className="px-2 py-2 rounded-lg text-xs shrink-0" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex-1"><UiSelect value={category} onChange={setCategory}
                  options={categories.map(c => ({ value: c, label: c }))} /></div>
                <button onClick={() => setAddingCat(true)} className="px-3 py-2 rounded-lg text-xs font-medium shrink-0" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>+ New</button>
              </div>
            )}
          </Field>

          <Field label="Description">
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
              className={`${inputCls} resize-none thin-scroll-y`} style={inputStyle} placeholder="Shown on quotes and invoices" />
          </Field>

          {/* ── Bundle components (type "package") ── */}
          {type === "package" && (
            <div className="rounded-xl p-3 space-y-2" style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border)" }}>
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                  <Boxes className="w-3.5 h-3.5" style={{ color: "#0f8578" }} /> Bundle components
                </p>
                <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{components.length === 0 ? "optional" : `sums to ${fmt(compSum.price)}`}</span>
              </div>
              {components.map((c, i) => {
                const comp = candidates.find(x => x.id === c.itemId);
                return (
                  <div key={i} className="flex items-center gap-1.5">
                    <div className="flex-1 min-w-0">
                      <UiSelect size="sm" value={c.itemId} onChange={v => setComponents(prev => prev.map((x, j) => j === i ? { ...x, itemId: v } : x))}
                        options={candidates.map(ci => ({ value: ci.id, label: `${ci.name} — ${fmt(ci.unitPrice)}` }))} />
                    </div>
                    <NumberStepper size="sm" min={1} className="w-20" value={String(c.quantity)}
                      onChange={v => setComponents(prev => prev.map((x, j) => j === i ? { ...x, quantity: Math.max(1, parseInt(v) || 1) } : x))} />
                    <span className="text-xs w-16 text-right tabular-nums shrink-0" style={{ color: "var(--text-secondary)" }}>{comp ? fmt(comp.unitPrice * c.quantity) : "—"}</span>
                    <button onClick={() => setComponents(prev => prev.filter((_, j) => j !== i))} title="Remove" className="p-1 shrink-0" style={{ color: "var(--text-muted)" }}><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                );
              })}
              <button onClick={() => { const first = candidates[0]; if (first) setComponents(prev => [...prev, { itemId: first.id, quantity: 1 }]); }}
                className="flex items-center gap-1 text-xs font-medium" style={{ color: "#0f8578" }}>
                <Plus className="w-3.5 h-3.5" /> Add component
              </button>

              {components.length > 0 && (
                <>
                  <div className="flex items-center rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                    {([{ k: "sum", label: `Sum of components — ${fmt(compSum.price)}` }, { k: "fixed", label: "Fixed bundle price" }] as const).map(m => (
                      <button key={m.k} onClick={() => setBundlePricing(m.k)} className="flex-1 px-2 py-1.5 text-[11px] font-medium transition-colors"
                        style={{ backgroundColor: bundlePricing === m.k ? "#0f8578" : "var(--bg-surface)", color: bundlePricing === m.k ? "#fff" : "var(--text-muted)" }}>
                        {m.label}
                      </button>
                    ))}
                  </div>
                  {bundlePricing === "fixed" && (parseFloat(unitPrice) || 0) < compSum.price && (
                    <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                      Customer saves {fmt(compSum.price - (parseFloat(unitPrice) || 0))} vs. the {fmt(compSum.price)} component sum.
                    </p>
                  )}
                  <div className="flex items-center justify-between pt-1">
                    <div>
                      <span className="text-xs" style={{ color: "var(--text-primary)" }}>Add as separate lines</span>
                      <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Off = one line on the quote; components stay internal.</p>
                    </div>
                    <Toggle on={expandOnAdd} onChange={setExpandOnAdd} />
                  </div>
                  <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Component cost sums to {fmt(compSum.cost)} — used for margin either way.</p>
                </>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Unit Price *" hint={isBundleForm && bundlePricing === "sum" ? "Auto — sum of components" : undefined}>
              <input type="number" step="0.01" value={isBundleForm && bundlePricing === "sum" ? String(compSum.price) : unitPrice}
                onChange={e => setUnitPrice(e.target.value)} disabled={isBundleForm && bundlePricing === "sum"}
                className={`${inputCls} disabled:opacity-60`} style={inputStyle} />
            </Field>
            {defaults.showCostField && (
              <Field label="Unit Cost" hint="Internal — not shown to customers">
                <input type="number" step="0.01" value={unitCost} onChange={e => setUnitCost(e.target.value)} placeholder="Optional" className={inputCls} style={inputStyle} />
              </Field>
            )}
          </div>

          <Field label="Default Quantity">
            <input type="number" min={0} step="1" value={defaultQuantity} onChange={e => setDefaultQuantity(e.target.value)} className={`${inputCls} w-28`} style={inputStyle} />
          </Field>

          <div className="flex items-center justify-between py-2" style={{ borderTop: "1px solid var(--border)" }}>
            <span className="text-sm" style={{ color: "var(--text-primary)" }}>Taxable</span>
            <Toggle on={taxable} onChange={setTaxable} />
          </div>
          <div className="flex items-center justify-between py-2" style={{ borderTop: "1px solid var(--border)" }}>
            <div>
              <span className="text-sm" style={{ color: "var(--text-primary)" }}>Active</span>
              <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Inactive items are hidden from quote pickers.</p>
            </div>
            <Toggle on={active} onChange={setActive} />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 flex justify-end gap-2 shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
          <button onClick={onClose} className="px-3 py-2 rounded-lg text-sm" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
          <button onClick={handleSave} disabled={!canSave}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40" style={{ backgroundColor: "#0f8578" }}>
            {editing ? "Save Changes" : "Create Item"}
          </button>
        </div>
      </div>
    </div>
  );
}
