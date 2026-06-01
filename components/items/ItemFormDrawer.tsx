"use client";

import { useState } from "react";
import { X } from "lucide-react";
import UiSelect from "@/components/ui/Select";
import { useHierarchy } from "@/components/providers/HierarchyProvider";
import {
  createItem, updateItem, getActiveCategoryNames, addItemCategory, getItemDefaults,
  type Item,
} from "@/lib/items/data";
import { ITEM_TYPES, ITEM_TYPE_CONFIG, type ItemType } from "@/lib/items/types";

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!on)} role="switch" aria-checked={on} type="button"
      className="relative w-9 h-5 rounded-full transition-colors shrink-0"
      style={{ backgroundColor: on ? "#4f46e5" : "var(--bg-input)", border: "1px solid var(--border)" }}>
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

export default function ItemFormDrawer({ item, onClose, onSaved }: {
  item?: Item;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { effectiveCompanyId } = useHierarchy();
  const defaults = getItemDefaults();
  const editing = Boolean(item);

  const [name, setName] = useState(item?.name ?? "");
  const [sku, setSku] = useState(item?.sku ?? "");
  const [type, setType] = useState<ItemType>(item?.type ?? "service");
  const [categories] = useState<string[]>(() => getActiveCategoryNames());
  const [category, setCategory] = useState(item?.category ?? categories[0] ?? "Other");
  const [addingCat, setAddingCat] = useState(false);
  const [newCat, setNewCat] = useState("");
  const [description, setDescription] = useState(item?.description ?? "");
  const [unitPrice, setUnitPrice] = useState(String(item?.unitPrice ?? 0));
  const [unitCost, setUnitCost] = useState(item?.unitCost != null ? String(item.unitCost) : "");
  const [defaultQuantity, setDefaultQuantity] = useState(String(item?.defaultQuantity ?? defaults.defaultQuantity));
  const [taxable, setTaxable] = useState(item?.taxable ?? defaults.defaultTaxable);
  const [active, setActive] = useState(item?.active ?? true);

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
      unitPrice: parseFloat(unitPrice) || 0,
      unitCost: unitCost.trim() === "" ? undefined : parseFloat(unitCost),
      taxable, defaultQuantity: parseFloat(defaultQuantity) || 1,
      sku: sku || undefined, active,
    };
    if (editing && item) updateItem(item.id, payload);
    else createItem({ ...payload, companyId: effectiveCompanyId || undefined });
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div className="w-full max-w-md h-full flex flex-col" onClick={e => e.stopPropagation()}
        style={{ backgroundColor: "var(--bg-surface)", boxShadow: "-12px 0 40px rgba(0,0,0,0.2)" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <p className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>{editing ? "Edit Item" : "New Item"}</p>
          <button onClick={onClose} style={{ color: "var(--text-muted)" }}><X className="w-4 h-4" /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto thin-scroll-y px-5 py-4 space-y-4">
          <Field label="Name *">
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. 3 Ton Heat Pump System"
              className={inputCls} style={inputStyle} />
          </Field>

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
                <button onClick={commitNewCategory} className="px-3 py-2 rounded-lg text-xs font-medium text-white shrink-0" style={{ backgroundColor: "#4f46e5" }}>Add</button>
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

          <div className="grid grid-cols-2 gap-3">
            <Field label="Unit Price *">
              <input type="number" step="0.01" value={unitPrice} onChange={e => setUnitPrice(e.target.value)} className={inputCls} style={inputStyle} />
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

          <div className="flex items-center justify-between py-2" style={{ borderTop: "1px solid var(--border-subtle)" }}>
            <span className="text-sm" style={{ color: "var(--text-primary)" }}>Taxable</span>
            <Toggle on={taxable} onChange={setTaxable} />
          </div>
          <div className="flex items-center justify-between py-2" style={{ borderTop: "1px solid var(--border-subtle)" }}>
            <div>
              <span className="text-sm" style={{ color: "var(--text-primary)" }}>Active</span>
              <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Inactive items are hidden from quote pickers.</p>
            </div>
            <Toggle on={active} onChange={setActive} />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 flex justify-end gap-2 shrink-0" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          <button onClick={onClose} className="px-3 py-2 rounded-lg text-sm" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
          <button onClick={handleSave} disabled={!canSave}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40" style={{ backgroundColor: "#4f46e5" }}>
            {editing ? "Save Changes" : "Create Item"}
          </button>
        </div>
      </div>
    </div>
  );
}
