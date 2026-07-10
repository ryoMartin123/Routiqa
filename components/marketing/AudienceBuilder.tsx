"use client";

// ─── Audience builder — full-screen workflow composer ─────
// Modeled on the Automation builder: a connected build rail on the left
// (Start from → Narrow down → Exclude → Name it) and a sticky live-summary
// panel on the right that narrates the audience in plain English and shows
// the REAL people it resolves to right now, re-computed on every edit.

import { useMemo, useState } from "react";
import { ArrowLeft, X, Users, Filter, MinusCircle, Tag, Trash2, Briefcase, FilePen, Flame, Check, Receipt, FileSignature } from "lucide-react";
import { RuleComposer, MemberPreview, previewMembers } from "@/components/marketing/AudienceComposer";
import {
  createSavedAudience, updateSavedAudience, deleteSavedAudience, customAudienceLabel, CUSTOM_BASES,
  type SavedAudience, type CustomAudience, type CustomBase,
} from "@/lib/marketing/data";

const ROSE = "#e11d48";
const BASE_ICON: Record<CustomBase, typeof Users> = { customers: Users, leads: Flame, quotes: FilePen, jobs: Briefcase, invoices: Receipt, agreements: FileSignature };

export default function AudienceBuilder({ audience, initialCustom, onClose, onSaved }: {
  audience: SavedAudience | null;              // editing an existing one
  initialCustom?: CustomAudience;              // prefill ("save as audience" from the wizard)
  onClose: () => void;
  onSaved: (a: SavedAudience) => void;
}) {
  const [name, setName] = useState(audience?.name ?? "");
  const [description, setDescription] = useState(audience?.description ?? "");
  const [custom, setCustom] = useState<CustomAudience>(
    audience?.custom ?? initialCustom ?? { base: "customers", rules: [], match: "all", exclude: [] },
  );
  const members = useMemo(() => previewMembers(custom), [custom]);
  // Live totals per base, so the Start-from tiles show real reach.
  const baseTotals = useMemo(() => Object.fromEntries(
    CUSTOM_BASES.map(b => [b.key, previewMembers({ base: b.key, rules: [] }).length]),
  ) as Record<CustomBase, number>, []);

  function save() {
    if (!name.trim()) return;
    const saved = audience
      ? updateSavedAudience(audience.id, { name: name.trim(), description: description.trim() || undefined, custom })
      : createSavedAudience({ name, description, custom });
    if (saved) onSaved(saved);
  }

  return (
    <div className="fixed inset-0 z-[80] flex flex-col" style={{ backgroundColor: "var(--bg-page)" }}>
      {/* ── Header ── */}
      <header className="flex items-center gap-3 px-4 h-14 shrink-0" style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--bg-surface)" }}>
        <button onClick={onClose} className="flex items-center gap-1.5 text-sm font-medium shrink-0" style={{ color: "var(--text-secondary)" }}><ArrowLeft className="w-4 h-4" /> Audiences</button>
        <div className="h-5 w-px shrink-0" style={{ backgroundColor: "var(--border)" }} />
        <p className="text-base font-semibold truncate" style={{ color: "var(--text-primary)" }}>{name.trim() || (audience ? "Edit Audience" : "New Audience")}</p>
        <div className="flex items-center gap-2 ml-auto shrink-0">
          {audience && (
            <button onClick={() => { if (confirm(`Delete audience "${audience.name}"? Campaigns that used it keep their own copy of the rules.`)) { deleteSavedAudience(audience.id); onSaved(audience); } }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm" style={{ color: "#dc2626", border: "1px solid #fecaca" }}>
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          )}
          <button onClick={save} disabled={!name.trim()}
            className="px-4 py-1.5 rounded-lg text-sm font-medium text-white disabled:opacity-40" style={{ backgroundColor: ROSE }}>
            {audience ? "Save changes" : "Save audience"}
          </button>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-[var(--bg-surface-2)]" style={{ color: "var(--text-muted)" }}><X className="w-4 h-4" /></button>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        {/* ── Build rail ── */}
        <div className="flex-1 min-w-0 overflow-y-auto thin-scroll-y">
          <div className="max-w-2xl mx-auto px-6 py-8">

            <RailStep eyebrow="Start from" title="Which records?" desc="The audience is built live from one record type." icon={Users}>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {CUSTOM_BASES.map(b => {
                  const BI = BASE_ICON[b.key];
                  const on = custom.base === b.key;
                  return (
                    <button key={b.key} onClick={() => setCustom({ base: b.key, rules: [], match: custom.match ?? "all", exclude: [] })}
                      className="rounded-xl p-3 text-left transition-all hover:-translate-y-0.5"
                      style={{ backgroundColor: "var(--bg-surface)", border: `1.5px solid ${on ? ROSE : "var(--border)"}`, boxShadow: on ? `0 0 0 3px ${ROSE}22` : "var(--shadow-card)" }}>
                      <BI className="w-4 h-4 mb-1.5" style={{ color: on ? ROSE : "var(--text-muted)" }} />
                      <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{b.label}</p>
                      <p className="text-[11px] tabular-nums" style={{ color: "var(--text-muted)" }}>{baseTotals[b.key]} unique</p>
                    </button>
                  );
                })}
              </div>
            </RailStep>

            <RailStep eyebrow="Narrow down" title="Who's included?" desc="Stack rules — joined with and (must match every rule) or or (any rule is enough)." icon={Filter}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>Join rules with</span>
                <div className="flex items-center rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                  {(["all", "any"] as const).map(m => (
                    <button key={m} onClick={() => setCustom({ ...custom, match: m })}
                      className="px-3 py-1 text-xs font-medium transition-colors"
                      style={{ backgroundColor: (custom.match ?? "all") === m ? ROSE : "var(--bg-surface)", color: (custom.match ?? "all") === m ? "#fff" : "var(--text-secondary)" }}>
                      {m === "all" ? "and" : "or"}
                    </button>
                  ))}
                </div>
              </div>
              <RuleComposer custom={custom} onChange={setCustom}
                conjunction={(custom.match ?? "all") === "any" ? "or" : "and"} />
            </RailStep>

            <RailStep eyebrow="Exclude" title="Who's left out?" desc="Anyone matching any of these is dropped — even if included above." icon={MinusCircle}>
              <RuleComposer
                custom={{ base: custom.base, rules: custom.exclude ?? [] }}
                onChange={c => setCustom({ ...custom, exclude: c.rules })}
                conjunction="or" firstWord="Drop"
                emptyHint="No exclusions — everyone who matches above stays in." />
            </RailStep>

            <RailStep eyebrow="Name it" title="Save for reuse" desc="Shows up in Audiences and the Campaign Studio with a live count." icon={Tag} last>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-medium mb-1" style={{ color: "var(--text-muted)" }}>Name *</label>
                  <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Commercial — no agreement"
                    className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
                </div>
                <div>
                  <label className="block text-[10px] font-medium mb-1" style={{ color: "var(--text-muted)" }}>Description <span style={{ color: "var(--text-muted)" }}>(optional)</span></label>
                  <input value={description} onChange={e => setDescription(e.target.value)} placeholder={customAudienceLabel(custom)}
                    className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
                </div>
              </div>
            </RailStep>
          </div>
        </div>

        {/* ── Sticky live summary ── */}
        <aside className="w-[22rem] shrink-0 flex flex-col min-h-0" style={{ backgroundColor: "var(--bg-surface)", borderLeft: "1px solid var(--border)" }}>
          <div className="p-5 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
            <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>Live audience</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>{members.length}</span>
              <span className="text-sm" style={{ color: "var(--text-muted)" }}>unique {members.length === 1 ? "person" : "people"} right now</span>
            </div>
            {/* The audience, narrated */}
            <p className="text-xs mt-2 leading-relaxed rounded-lg px-3 py-2" style={{ backgroundColor: ROSE + "0d", border: `1px solid ${ROSE}33`, color: "var(--text-secondary)" }}>
              {customAudienceLabel(custom)}
            </p>
            {name.trim() && (
              <p className="flex items-center gap-1.5 text-[11px] mt-2" style={{ color: "#059669" }}>
                <Check className="w-3.5 h-3.5" /> Ready to save as “{name.trim()}”
              </p>
            )}
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto thin-scroll-y p-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>Everyone in it</p>
            <MemberPreview members={members} max={100} />
          </div>
        </aside>
      </div>
    </div>
  );
}

// ─── Connected rail step (Automation-builder language) ────
function RailStep({ eyebrow, title, desc, icon: Icon, last, children }: {
  eyebrow: string; title: string; desc: string; icon: typeof Users; last?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center shrink-0">
        <span className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: ROSE + "14" }}>
          <Icon className="w-4 h-4" style={{ color: ROSE }} />
        </span>
        {!last && <span className="flex-1 w-px my-1.5" style={{ backgroundColor: "var(--border)" }} />}
      </div>
      <div className={`min-w-0 flex-1 ${last ? "" : "pb-7"}`}>
        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: ROSE }}>{eyebrow}</p>
        <p className="text-sm font-semibold mt-0.5" style={{ color: "var(--text-primary)" }}>{title}</p>
        <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>{desc}</p>
        <div className="rounded-xl p-4" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
          {children}
        </div>
      </div>
    </div>
  );
}
