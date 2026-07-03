"use client";

import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, ChevronUp, ChevronDown, FileText } from "lucide-react";
import { SectionHeader, SaveButtons, Toggle, inputCls, inputStyle } from "@/components/settings/ui";
import { getTermsBlocks, saveTermsBlocks, resetTermsBlocks, newTermsId, type TermsBlock } from "@/lib/quotes/terms";

export default function TermsConditionsSection() {
  const [blocks, setBlocks] = useState<TermsBlock[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { setBlocks(getTermsBlocks()); }, []);
  const mark = () => { setDirty(true); setSaved(false); };

  function patch(id: string, p: Partial<TermsBlock>) { setBlocks(prev => prev.map(b => b.id === id ? { ...b, ...p } : b)); mark(); }
  function move(id: string, dir: -1 | 1) {
    const sorted = [...blocks].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex(b => b.id === id);
    const swap = idx + dir;
    if (swap < 0 || swap >= sorted.length) return;
    const o = sorted[idx].order; sorted[idx].order = sorted[swap].order; sorted[swap].order = o;
    setBlocks([...sorted]); mark();
  }
  function addBlock() {
    const id = newTermsId();
    setBlocks(prev => [...prev, { id, name: "New Terms Block", body: "", active: true, order: prev.length }]);
    setEditingId(id); mark();
  }
  function remove(id: string) { setBlocks(prev => prev.filter(b => b.id !== id)); if (editingId === id) setEditingId(null); mark(); }

  function save() { saveTermsBlocks(blocks); setDirty(false); setSaved(true); setTimeout(() => setSaved(false), 2000); }
  function reset() { setBlocks(resetTermsBlocks()); setEditingId(null); setDirty(false); setSaved(false); }

  const sorted = [...blocks].sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-5">
      <SectionHeader title="Terms & Conditions" subtitle="Reusable terms blocks for quotes and invoices."
        right={<SaveButtons onSave={save} onReset={reset} dirty={dirty} saved={saved} />} />

      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)" }}>
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Terms Blocks <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>{blocks.length}</span></p>
          <button onClick={addBlock} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: "#4f46e5" }}>
            <Plus className="w-3.5 h-3.5" /> Add Block
          </button>
        </div>

        {sorted.map((b, i) => (
          <div key={b.id} style={{ borderBottom: i < sorted.length - 1 ? "1px solid var(--border)" : "none", opacity: b.active ? 1 : 0.55 }}>
            {editingId === b.id ? (
              <div className="p-4 space-y-3">
                <input value={b.name} onChange={e => patch(b.id, { name: e.target.value })} placeholder="Block name" className={inputCls} style={inputStyle} />
                <textarea value={b.body} onChange={e => patch(b.id, { body: e.target.value })} rows={4} placeholder="Terms text…" className={`${inputCls} resize-none thin-scroll-y`} style={inputStyle} />
                <div className="flex justify-end">
                  <button onClick={() => setEditingId(null)} className="px-4 py-1.5 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: "#4f46e5" }}>Done</button>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3 px-4 py-3">
                <div className="flex flex-col pt-0.5">
                  <button onClick={() => move(b.id, -1)} disabled={i === 0} className="disabled:opacity-20" style={{ color: "var(--text-muted)" }}><ChevronUp className="w-3.5 h-3.5" /></button>
                  <button onClick={() => move(b.id, 1)} disabled={i === sorted.length - 1} className="disabled:opacity-20" style={{ color: "var(--text-muted)" }}><ChevronDown className="w-3.5 h-3.5" /></button>
                </div>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--bg-surface-2)" }}>
                  <FileText className="w-3.5 h-3.5" style={{ color: "#4f46e5" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{b.name}</p>
                  <p className="text-xs mt-0.5 line-clamp-2" style={{ color: "var(--text-muted)" }}>{b.body || "No text yet."}</p>
                </div>
                <Toggle on={b.active} onChange={v => patch(b.id, { active: v })} />
                <button onClick={() => setEditingId(b.id)} className="p-1.5 rounded-lg hover:bg-[var(--bg-input)]" style={{ color: "var(--text-muted)" }}><Pencil className="w-3.5 h-3.5" /></button>
                <button onClick={() => remove(b.id)} className="p-1.5 rounded-lg hover:bg-red-50" style={{ color: "#9ca3af" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "#ef4444")} onMouseLeave={e => (e.currentTarget.style.color = "#9ca3af")}><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
