"use client";

// ─── Lead Sources ─────────────────────────────────────────
// Where leads come from and which sources actually drive booked jobs + revenue.
// Summary KPIs, a revenue-by-source leaderboard, and a sortable performance
// table with add / activate / remove. Marketing crimson accent.

import { useMemo, useState } from "react";
import {
  Radio, Plus, X, TrendingUp, Users, Briefcase, DollarSign, Target, Trash2, ChevronUp, ChevronDown, Check,
} from "lucide-react";
import PageTitle from "@/components/shared/PageTitle";
import {
  getLeadSources, addLeadSource, toggleLeadSource, deleteLeadSource,
  conversion, cpl, roi, totals, CATEGORY_META,
  type LeadSource, type SourceCategory,
} from "@/lib/marketing/lead-sources";

const ACCENT = "#e11d48";
const money = (n: number) => n >= 1000 ? `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `$${n}`;
const moneyFull = (n: number) => `$${Math.round(n).toLocaleString()}`;
const pct = (x: number) => `${Math.round(x * 100)}%`;

type SortKey = "leads" | "bookedJobs" | "conversion" | "revenue" | "cpl" | "roi";

export default function LeadSourcesSection() {
  const [tick, setTick] = useState(0);
  const [adding, setAdding] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("revenue");
  const [showInactive, setShowInactive] = useState(true);
  const reload = () => setTick(t => t + 1);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const all = useMemo(() => getLeadSources(), [tick]);
  const active = all.filter(s => s.active);
  const t = totals(active);

  const metric = (s: LeadSource, k: SortKey) => k === "conversion" ? conversion(s) : k === "cpl" ? cpl(s) : k === "roi" ? (roi(s) ?? -1) : s[k];
  const rows = [...(showInactive ? all : active)].sort((a, b) => Number(metric(b, sortKey)) - Number(metric(a, sortKey)));
  const maxRev = Math.max(1, ...active.map(s => s.revenue));
  const topByRevenue = [...active].sort((a, b) => b.revenue - a.revenue).slice(0, 6);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <PageTitle title="Lead Sources" description="Track where leads come from and which sources drive booked jobs and revenue." />
        <button onClick={() => setAdding(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white active:scale-[0.99] transition-transform" style={{ backgroundColor: ACCENT }}>
          <Plus className="w-4 h-4" /> Add source
        </button>
      </div>

      {/* KPIs */}
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>
        <Kpi icon={Users} label="Leads (90d)" value={t.leads.toLocaleString()} color="#2563eb" />
        <Kpi icon={Briefcase} label="Booked jobs" value={t.bookedJobs.toLocaleString()} color="#16a34a" />
        <Kpi icon={DollarSign} label="Revenue attributed" value={money(t.revenue)} color={ACCENT} />
        <Kpi icon={Target} label="Avg cost / lead" value={t.cpl ? moneyFull(t.cpl) : "—"} color="#f59e0b" />
        <Kpi icon={TrendingUp} label="Conversion" value={pct(t.conversion)} color="#0891b2" />
        <Kpi icon={TrendingUp} label="Marketing ROI" value={t.cost ? `${Math.round(t.roi * 100)}%` : "—"} color="#a855f7" />
      </div>

      {/* Revenue leaderboard */}
      <div className="rounded-2xl p-4" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", boxShadow: "var(--shadow-card)" }}>
        <p className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>Revenue by source</p>
        <div className="space-y-2.5">
          {topByRevenue.map(s => (
            <div key={s.id} className="flex items-center gap-3">
              <span className="w-32 text-xs truncate shrink-0" style={{ color: "var(--text-secondary)" }}>{s.name}</span>
              <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: "var(--bg-input)" }}>
                <div className="h-full rounded-full" style={{ width: `${(s.revenue / maxRev) * 100}%`, backgroundColor: ACCENT }} />
              </div>
              <span className="w-14 text-right text-xs font-semibold tabular-nums shrink-0" style={{ color: "var(--text-primary)" }}>{money(s.revenue)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Performance table */}
      <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", boxShadow: "var(--shadow-card)" }}>
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>All sources</p>
          <button onClick={() => setShowInactive(v => !v)} className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>{showInactive ? "Hide inactive" : "Show inactive"}</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[680px]">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th className="text-left font-medium text-[11px] uppercase tracking-wider px-4 py-2.5" style={{ color: "var(--text-muted)" }}>Source</th>
                <SortTh label="Leads" k="leads" sortKey={sortKey} onSort={setSortKey} />
                <SortTh label="Booked" k="bookedJobs" sortKey={sortKey} onSort={setSortKey} />
                <SortTh label="Conv." k="conversion" sortKey={sortKey} onSort={setSortKey} />
                <SortTh label="Revenue" k="revenue" sortKey={sortKey} onSort={setSortKey} />
                <SortTh label="CPL" k="cpl" sortKey={sortKey} onSort={setSortKey} />
                <SortTh label="ROI" k="roi" sortKey={sortKey} onSort={setSortKey} />
                <th className="px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(s => {
                const cm = CATEGORY_META[s.category]; const r = roi(s); const c = cpl(s);
                return (
                  <tr key={s.id} className="group" style={{ borderBottom: "1px solid var(--border)", opacity: s.active ? 1 : 0.5 }}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium" style={{ color: "var(--text-primary)" }}>{s.name}</span>
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ backgroundColor: cm.color + "1a", color: cm.color }}>{cm.label}</span>
                      </div>
                    </td>
                    <Td>{s.leads}</Td>
                    <Td>{s.bookedJobs}</Td>
                    <Td>{pct(conversion(s))}</Td>
                    <Td strong>{money(s.revenue)}</Td>
                    <Td>{c ? moneyFull(c) : <span style={{ color: "var(--text-muted)" }}>—</span>}</Td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {r === null ? <span className="text-xs" style={{ color: "#16a34a" }}>Organic</span>
                        : <span className="font-semibold" style={{ color: r >= 0 ? "#16a34a" : "#dc2626" }}>{Math.round(r * 100)}%</span>}
                    </td>
                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { toggleLeadSource(s.id); reload(); }} title={s.active ? "Deactivate" : "Activate"} className="text-[11px] font-medium px-2 py-1 rounded-md" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>{s.active ? "Pause" : "Activate"}</button>
                        <button onClick={() => { deleteLeadSource(s.id); reload(); }} title="Remove" className="p-1.5 rounded-md"><Trash2 className="w-3.5 h-3.5" style={{ color: "#dc2626" }} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {adding && <AddSourceModal onClose={() => setAdding(false)} onAdd={(name, cat) => { addLeadSource(name, cat); setAdding(false); reload(); }} />}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl px-4 py-3.5" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center gap-1.5"><Icon className="w-3.5 h-3.5" style={{ color }} /><p className="text-[11px] font-medium truncate" style={{ color: "var(--text-muted)" }}>{label}</p></div>
      <p className="text-2xl font-bold mt-1 tabular-nums" style={{ color: "var(--text-primary)" }}>{value}</p>
    </div>
  );
}
function SortTh({ label, k, sortKey, onSort }: { label: string; k: SortKey; sortKey: SortKey; onSort: (k: SortKey) => void }) {
  const on = sortKey === k;
  return (
    <th className="px-3 py-2.5 text-right">
      <button onClick={() => onSort(k)} className="inline-flex items-center gap-0.5 text-[11px] font-medium uppercase tracking-wider" style={{ color: on ? "var(--text-primary)" : "var(--text-muted)" }}>
        {label}{on ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3 opacity-30" />}
      </button>
    </th>
  );
}
function Td({ children, strong }: { children: React.ReactNode; strong?: boolean }) {
  return <td className="px-3 py-3 text-right tabular-nums" style={{ color: "var(--text-primary)", fontWeight: strong ? 600 : 400 }}>{children}</td>;
}

function AddSourceModal({ onClose, onAdd }: { onClose: () => void; onAdd: (name: string, cat: SourceCategory) => void }) {
  const [name, setName] = useState("");
  const [cat, setCat] = useState<SourceCategory>("digital");
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl overflow-hidden" onClick={e => e.stopPropagation()} style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 20px 48px rgba(0,0,0,0.3)" }}>
        <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: "1px solid var(--border)" }}>
          <p className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Add lead source</p>
          <button onClick={onClose}><X className="w-4 h-4" style={{ color: "var(--text-muted)" }} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Name</label>
            <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Nextdoor, Billboard, Trade show" className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Category</label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(CATEGORY_META) as SourceCategory[]).map(c => {
                const on = cat === c; const cm = CATEGORY_META[c];
                return (
                  <button key={c} onClick={() => setCat(c)} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors"
                    style={{ border: `1px solid ${on ? cm.color : "var(--border)"}`, backgroundColor: on ? cm.color + "12" : "var(--bg-surface)", color: "var(--text-primary)" }}>
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cm.color }} />{cm.label}{on && <Check className="w-3.5 h-3.5 ml-auto" style={{ color: cm.color }} />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div className="px-5 py-3.5 flex justify-end gap-2" style={{ borderTop: "1px solid var(--border)" }}>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
          <button onClick={() => name.trim() && onAdd(name, cat)} disabled={!name.trim()} className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-40" style={{ backgroundColor: ACCENT }}>Add source</button>
        </div>
      </div>
    </div>
  );
}
