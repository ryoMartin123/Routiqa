"use client";

import { useState, useEffect } from "react";
import { Plus, Pencil, ChevronUp, ChevronDown, Trash2, RotateCcw } from "lucide-react";
import {
  getPhotoCategories, savePhotoCategories, resetPhotoCategories, pcId, pcSlug,
  APPLIES_TO_OPTIONS, PHOTO_CAT_COLORS,
  type PhotoCategory, type AppliesTo,
} from "@/lib/photo-categories/data";
import { pingSaved } from "@/components/shared/SavedPill";

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!on)} role="switch" aria-checked={on}
      className="relative w-8 h-4 rounded-full transition-colors shrink-0"
      style={{ backgroundColor: on ? "#4f46e5" : "var(--bg-input)", border: "1px solid var(--border)" }}>
      <span className="absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform"
        style={{ transform: on ? "translateX(16px)" : "translateX(0)" }} />
    </button>
  );
}

type FormState = { name: string; key: string; description: string; color: string; appliesTo: AppliesTo[]; requiredByDefault: boolean; active: boolean };
const EMPTY: FormState = { name: "", key: "", description: "", color: PHOTO_CAT_COLORS[0], appliesTo: ["Job"], requiredByDefault: false, active: true };

export default function PhotoCategoriesSection() {
  const [cats, setCats] = useState<PhotoCategory[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<FormState>({ ...EMPTY });
  const [dirty, setDirty] = useState(false);

  useEffect(() => { setCats(getPhotoCategories()); }, []);
  function mark() { setDirty(true); }
  // Auto-save: whenever the section is dirty, debounce then persist + flash the pill.
  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(() => { savePhotoCategories(cats); setDirty(false); pingSaved(); }, 500);
    return () => clearTimeout(t);
  }, [dirty, cats]);

  function move(id: string, dir: -1 | 1) {
    const sorted = [...cats].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex(s => s.id === id), swap = idx + dir;
    if (swap < 0 || swap >= sorted.length) return;
    [sorted[idx].order, sorted[swap].order] = [sorted[swap].order, sorted[idx].order];
    setCats([...sorted]); mark();
  }
  function startEdit(c: PhotoCategory) {
    setForm({ name: c.name, key: c.key, description: c.description, color: c.color, appliesTo: [...c.appliesTo], requiredByDefault: c.requiredByDefault, active: c.active });
    setEditingId(c.id); setShowAdd(false);
  }
  function startAdd() { setForm({ ...EMPTY }); setShowAdd(true); setEditingId(null); }
  function cancel() { setEditingId(null); setShowAdd(false); }
  function toggleApplies(a: AppliesTo) {
    setForm(f => ({ ...f, appliesTo: f.appliesTo.includes(a) ? f.appliesTo.filter(x => x !== a) : [...f.appliesTo, a] }));
  }
  function commit() {
    if (!form.name.trim()) return;
    if (editingId) {
      setCats(prev => prev.map(c => c.id === editingId ? { ...c, ...form, key: form.key || pcSlug(form.name) } : c));
    } else {
      const max = cats.length ? Math.max(...cats.map(c => c.order)) : 0;
      setCats(prev => [...prev, { id: pcId(), ...form, key: form.key || pcSlug(form.name), order: max + 1 }]);
    }
    cancel(); mark();
  }
  function toggleActive(id: string) { setCats(prev => prev.map(c => c.id === id ? { ...c, active: !c.active } : c)); mark(); }
  function toggleReq(id: string) { setCats(prev => prev.map(c => c.id === id ? { ...c, requiredByDefault: !c.requiredByDefault } : c)); mark(); }
  function remove(id: string) { setCats(prev => prev.filter(c => c.id !== id)); mark(); }
  function reset() { setCats(resetPhotoCategories()); setDirty(false); pingSaved(); }

  const sorted = [...cats].sort((a, b) => a.order - b.order);

  function Form() {
    return (
      <div className="rounded-xl p-4 space-y-3" style={{ backgroundColor: "var(--bg-surface)", border: "2px solid #c7d2fe", boxShadow: "var(--shadow-card)" }}>
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#4f46e5" }}>{editingId ? "Edit Category" : "New Category"}</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Name *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value, key: editingId ? f.key : pcSlug(e.target.value) }))}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Key</label>
            <input value={form.key} onChange={e => setForm(f => ({ ...f, key: pcSlug(e.target.value) }))}
              className="w-full rounded-lg px-3 py-2 text-sm font-mono outline-none" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-input)", color: "var(--text-primary)" }} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Description</label>
          <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Color</label>
          <div className="flex flex-wrap gap-1.5">
            {PHOTO_CAT_COLORS.map(c => (
              <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))} className="w-6 h-6 rounded-full"
                style={{ backgroundColor: c, outline: form.color === c ? "2px solid var(--text-primary)" : "none", outlineOffset: "1px" }} />
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Applies To</label>
          <div className="flex flex-wrap gap-1.5">
            {APPLIES_TO_OPTIONS.map(a => {
              const on = form.appliesTo.includes(a);
              return (
                <button key={a} onClick={() => toggleApplies(a)}
                  className="text-xs px-2.5 py-1 rounded-lg transition-colors"
                  style={{ backgroundColor: on ? "#4f46e5" : "var(--bg-surface-2)", color: on ? "#fff" : "var(--text-secondary)", border: `1px solid ${on ? "#4f46e5" : "var(--border-subtle)"}` }}>
                  {a}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-5">
            <label className="flex items-center gap-2 cursor-pointer"><Toggle on={form.requiredByDefault} onChange={v => setForm(f => ({ ...f, requiredByDefault: v }))} /><span className="text-sm" style={{ color: "var(--text-secondary)" }}>Required by default</span></label>
            <label className="flex items-center gap-2 cursor-pointer"><Toggle on={form.active} onChange={v => setForm(f => ({ ...f, active: v }))} /><span className="text-sm" style={{ color: "var(--text-secondary)" }}>Active</span></label>
          </div>
          <div className="flex gap-2">
            <button onClick={cancel} className="px-3 py-1.5 rounded-lg text-sm" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
            <button onClick={commit} disabled={!form.name.trim()} className="px-4 py-1.5 rounded-lg text-sm font-medium text-white disabled:opacity-40" style={{ backgroundColor: "#4f46e5" }}>{editingId ? "Update" : "Add Category"}</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Photo Categories</h2>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            Categories used to organize photos across jobs, work orders, properties, and customer records.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={reset} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors"
            style={{ border: "1px solid var(--border)", color: "var(--text-secondary)", backgroundColor: "var(--bg-surface)" }}>
            <RotateCcw className="w-3.5 h-3.5" /> Reset Defaults
          </button>
        </div>
      </div>

      {showAdd && <Form />}

      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)" }}>
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Photo Categories
            <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>{cats.length}</span></p>
          {!showAdd && <button onClick={startAdd} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: "#4f46e5" }}><Plus className="w-3.5 h-3.5" /> Add Category</button>}
        </div>
        <div className="grid px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider"
          style={{ gridTemplateColumns: "auto 1.6fr 2.2fr 0.8fr 0.8fr auto", gap: "0.75rem", color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>
          <span>Order</span><span>Category</span><span>Applies To</span><span className="text-center">Required</span><span className="text-center">Active</span><span />
        </div>
        {sorted.map((c, i) => editingId === c.id ? (
          <div key={c.id} className="p-4" style={{ borderBottom: i < sorted.length - 1 ? "1px solid var(--border)" : "none" }}><Form /></div>
        ) : (
          <div key={c.id} className="grid px-4 py-3 items-center hover:bg-[var(--bg-surface-2)] transition-colors"
            style={{ gridTemplateColumns: "auto 1.6fr 2.2fr 0.8fr 0.8fr auto", gap: "0.75rem", borderBottom: i < sorted.length - 1 ? "1px solid var(--border)" : "none", opacity: c.active ? 1 : 0.5 }}>
            <div className="flex flex-col">
              <button onClick={() => move(c.id, -1)} disabled={i === 0} className="disabled:opacity-20" style={{ color: "var(--text-muted)" }}><ChevronUp className="w-3.5 h-3.5" /></button>
              <button onClick={() => move(c.id, 1)} disabled={i === sorted.length - 1} className="disabled:opacity-20" style={{ color: "var(--text-muted)" }}><ChevronDown className="w-3.5 h-3.5" /></button>
            </div>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
              <div className="min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{c.name}</p>
                {c.description && <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>{c.description}</p>}
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              {c.appliesTo.map(a => (
                <span key={a} className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-secondary)" }}>{a}</span>
              ))}
            </div>
            <div className="flex justify-center"><Toggle on={c.requiredByDefault} onChange={() => toggleReq(c.id)} /></div>
            <div className="flex justify-center"><Toggle on={c.active} onChange={() => toggleActive(c.id)} /></div>
            <div className="flex items-center gap-1 justify-end">
              <button onClick={() => startEdit(c)} className="p-1.5 rounded-lg hover:bg-[var(--bg-input)]" style={{ color: "var(--text-muted)" }}><Pencil className="w-3.5 h-3.5" /></button>
              <button onClick={() => remove(c.id)} className="p-1.5 rounded-lg hover:bg-red-50" style={{ color: "#d1d5db" }}
                onMouseEnter={e => (e.currentTarget.style.color = "#ef4444")} onMouseLeave={e => (e.currentTarget.style.color = "#d1d5db")}><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        Photo categories will move to the Company layer. Work Order templates use them for required-photo
        rules, and the Photos &amp; Files module uses them for filtering and customer-facing reports.
      </p>
    </div>
  );
}
