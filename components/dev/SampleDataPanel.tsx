"use client";

// ─── Sample data panel ────────────────────────────────────
// A top-bar tool for populating the CRM with realistic test data fast. Each type
// can be added (choose how many) or removed. Removal is dependency-aware: if a
// removal would cascade into other types (e.g. removing customers also removes
// their jobs/invoices), the panel confirms first and shows the full impact.
// Generated records are indistinguishable from hand-entered ones — a hidden
// manifest tracks them so they can be cleanly removed later.

import { useEffect, useRef, useState } from "react";
import { FlaskConical, X, Plus, Trash2, AlertTriangle, Minus } from "lucide-react";
import { useHierarchy } from "@/components/providers/HierarchyProvider";
import { SAMPLE_TYPES, type SampleType } from "@/lib/sample-data/types";
import {
  resolveCtx, loadSamples, removeSamples, removeAllSamples, removalImpact, sampleSummary,
} from "@/lib/sample-data/manager";
import { clearAllRecords } from "@/lib/dev/resetData";

export default function SampleDataPanel() {
  const { effectiveCompanyId, effectiveLocationId } = useHierarchy();
  const [open, setOpen] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [total, setTotal] = useState(0);
  const [inputs, setInputs] = useState<Record<string, number>>(() =>
    Object.fromEntries(SAMPLE_TYPES.map(t => [t.type, 3])));
  const [confirm, setConfirm] = useState<{ type: SampleType | "all"; impact: Record<string, number> } | null>(null);
  const [wipe, setWipe] = useState(false);
  const [dirty, setDirty] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  function refresh() { const s = sampleSummary(); setCounts(s.counts); setTotal(s.total); }
  useEffect(() => { if (open) refresh(); }, [open]);

  // Reload once when closing after changes, so every module page reflects the new
  // data (some list pages mirror their store into React state on mount).
  function close() {
    setOpen(false); setConfirm(null);
    if (dirty) { setDirty(false); setTimeout(() => window.location.reload(), 50); }
  }

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) close(); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dirty]);

  function setInput(type: string, v: number) {
    setInputs(prev => ({ ...prev, [type]: Math.max(1, Math.min(200, v || 1)) }));
  }

  function add(type: SampleType) {
    loadSamples(type, inputs[type] ?? 3, resolveCtx(effectiveCompanyId, effectiveLocationId));
    setDirty(true); refresh();
  }

  function requestRemove(type: SampleType) {
    const impact = removalImpact(type);
    const cascades = Object.entries(impact).some(([k, n]) => k !== type && n > 0);
    if (cascades) setConfirm({ type, impact });   // cascade → confirm
    else { removeSamples(type); setDirty(true); refresh(); }
  }

  function confirmRemove() {
    if (!confirm) return;
    if (confirm.type === "all") removeAllSamples();
    else removeSamples(confirm.type);
    setConfirm(null); setDirty(true); refresh();
  }

  function requestRemoveAll() {
    if (total === 0) return;
    setConfirm({ type: "all", impact: counts });
  }

  // Full wipe of ALL business records (not just sample-tracked ones), keeping
  // users, templates, items, and settings/hierarchy. Reloads after.
  function doWipe() {
    clearAllRecords();
    window.location.reload();
  }

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => (open ? close() : setOpen(true))}
        title="Sample data — load or remove test records"
        className="relative p-2 rounded-lg transition-colors hover:bg-[var(--bg-surface-2)]"
        style={{ color: open ? "var(--accent-text)" : "var(--text-secondary)", backgroundColor: open ? "var(--accent-soft-bg)" : "transparent" }}>
        <FlaskConical className="w-5 h-5" />
        {total > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full text-white text-[9px] font-bold flex items-center justify-center" style={{ backgroundColor: "var(--accent-text)" }}>
            {total > 99 ? "99+" : total}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[24rem] rounded-xl overflow-hidden z-50"
          style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 16px 40px rgba(0,0,0,0.22)" }}>

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
            <div className="flex items-center gap-2">
              <FlaskConical className="w-4 h-4" style={{ color: "var(--accent-text)" }} />
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Sample Data</p>
              {total > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>{total} loaded</span>}
            </div>
            <button onClick={close} style={{ color: "var(--text-muted)" }}><X className="w-4 h-4" /></button>
          </div>

          {/* Cascade confirm banner */}
          {confirm && (
            <div className="px-4 py-3" style={{ backgroundColor: "#fffbeb", borderBottom: "1px solid #fde68a" }}>
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "#b45309" }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold" style={{ color: "#92400e" }}>
                    {confirm.type === "all" ? "Remove all sample data?" : "This removal cascades"}
                  </p>
                  <p className="text-[11px] mt-0.5" style={{ color: "#92400e" }}>
                    Removes:{" "}
                    {Object.entries(confirm.impact).filter(([, n]) => n > 0)
                      .map(([t, n]) => `${n} ${SAMPLE_TYPES.find(s => s.type === t)?.label.toLowerCase() ?? t}`)
                      .join(", ")}.
                  </p>
                  <div className="flex gap-2 mt-2">
                    <button onClick={confirmRemove} className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-white" style={{ backgroundColor: "#dc2626" }}>Remove</button>
                    <button onClick={() => setConfirm(null)} className="px-2.5 py-1 rounded-lg text-[11px] font-medium" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Full-wipe confirm banner */}
          {wipe && (
            <div className="px-4 py-3" style={{ backgroundColor: "#fef2f2", borderBottom: "1px solid #fecaca" }}>
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "#dc2626" }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold" style={{ color: "#991b1b" }}>Clear ALL CRM records?</p>
                  <p className="text-[11px] mt-0.5" style={{ color: "#991b1b" }}>
                    Permanently deletes every customer, lead, job, project, quote, invoice, agreement, task,
                    work order, file, comment &amp; notification. Keeps users, templates, items, and your settings.
                    This can&apos;t be undone.
                  </p>
                  <div className="flex gap-2 mt-2">
                    <button onClick={doWipe} className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-white" style={{ backgroundColor: "#dc2626" }}>Clear everything</button>
                    <button onClick={() => setWipe(false)} className="px-2.5 py-1 rounded-lg text-[11px] font-medium" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Type rows */}
          <div className="max-h-[26rem] overflow-y-auto py-1">
            {SAMPLE_TYPES.map(t => {
              const loaded = counts[t.type] ?? 0;
              return (
                <div key={t.type} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-[var(--bg-surface-2)]"
                  style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{t.label}</p>
                      {loaded > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "var(--accent-soft-bg)", color: "var(--accent-text)" }}>{loaded}</span>}
                    </div>
                    <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>{t.description}</p>
                  </div>

                  {/* Count stepper */}
                  <div className="flex items-center rounded-lg shrink-0" style={{ border: "1px solid var(--border)" }}>
                    <button onClick={() => setInput(t.type, (inputs[t.type] ?? 3) - 1)} className="px-1.5 py-1" style={{ color: "var(--text-muted)" }}><Minus className="w-3 h-3" /></button>
                    <input type="number" min={1} max={200} value={inputs[t.type] ?? 3}
                      onChange={e => setInput(t.type, parseInt(e.target.value, 10))}
                      className="w-9 text-center text-xs outline-none bg-transparent" style={{ color: "var(--text-primary)" }} />
                    <button onClick={() => setInput(t.type, (inputs[t.type] ?? 3) + 1)} className="px-1.5 py-1" style={{ color: "var(--text-muted)" }}><Plus className="w-3 h-3" /></button>
                  </div>

                  {/* Add */}
                  <button onClick={() => add(t.type)} title={`Add ${inputs[t.type] ?? 3} ${t.label.toLowerCase()}`}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-white shrink-0" style={{ backgroundColor: "var(--accent-text)" }}>
                    Add
                  </button>

                  {/* Remove */}
                  <button onClick={() => requestRemove(t.type)} disabled={loaded === 0} title={`Remove sample ${t.label.toLowerCase()}`}
                    className="p-1.5 rounded-lg shrink-0 disabled:opacity-30 hover:bg-red-50"
                    style={{ color: loaded === 0 ? "var(--text-muted)" : "#dc2626" }}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-2.5" style={{ borderTop: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-surface-2)" }}>
            <button onClick={() => { setWipe(true); setConfirm(null); }}
              className="text-[11px] font-semibold hover:underline" style={{ color: "#dc2626" }}>
              Clear all records
            </button>
            <button onClick={requestRemoveAll} disabled={total === 0}
              title="Removes only sample-generated records"
              className="text-[11px] font-medium hover:underline disabled:opacity-40" style={{ color: "var(--text-secondary)" }}>
              Remove sample data
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
