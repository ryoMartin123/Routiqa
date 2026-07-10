"use client";

// ─── Audience composer — shared rule builder + live preview ──
// Used by the Audiences section (saved audiences) and the Campaign Studio
// (ad-hoc custom audiences). The live member preview is the whole point:
// every rule edit re-resolves REAL records, so you sculpt a list you can see.

import { X, Plus } from "lucide-react";
import UiSelect from "@/components/ui/Select";
import NumberStepper from "@/components/ui/NumberStepper";
import {
  CUSTOM_BASES, customAudienceMembers,
  type CustomAudience, type CustomRule, type AudienceMember,
} from "@/lib/marketing/data";

const ROSE = "#e11d48";

export function RuleComposer({ custom, onChange, conjunction = "and", firstWord = "Where", emptyHint }: {
  custom: CustomAudience; onChange: (c: CustomAudience) => void;
  conjunction?: "and" | "or"; firstWord?: string; emptyHint?: string;
}) {
  const base = CUSTOM_BASES.find(b => b.key === custom.base)!;
  const patchRule = (i: number, p: Partial<CustomRule>) =>
    onChange({ ...custom, rules: custom.rules.map((r, j) => (j === i ? { ...r, ...p } : r)) });
  const addRule = () => {
    const f = base.fields[0];
    onChange({ ...custom, rules: [...custom.rules, { field: f.key, op: f.kind === "number" ? "gte" : "is", value: f.options?.[0]?.value ?? "" }] });
  };
  return (
    <div className="space-y-2">
      {custom.rules.length === 0 && (
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>{emptyHint ?? `No rules yet — this matches every ${base.label.toLowerCase().replace(/s$/, "")}. Add rules to narrow it down.`}</p>
      )}
      {custom.rules.map((r, i) => {
        const field = base.fields.find(f => f.key === r.field) ?? base.fields[0];
        const isNum = field.kind === "number";
        return (
          <div key={i} className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-medium w-12" style={{ color: "var(--text-muted)" }}>{i === 0 ? firstWord : conjunction}</span>
            <div className="w-40"><UiSelect size="sm" value={r.field}
              onChange={v => { const nf = base.fields.find(f => f.key === v)!; patchRule(i, { field: v, op: nf.kind === "number" ? "gte" : "is", value: nf.options?.[0]?.value ?? "" }); }}
              options={base.fields.map(f => ({ value: f.key, label: f.label }))} /></div>
            <div className="w-24"><UiSelect size="sm" value={r.op}
              onChange={v => patchRule(i, { op: v as CustomRule["op"] })}
              options={isNum ? [{ value: "gte", label: "≥" }, { value: "lte", label: "≤" }] : [{ value: "is", label: "is" }, { value: "is_not", label: "is not" }]} /></div>
            {isNum ? (
              <div className="w-28"><NumberStepper size="sm" min={0} value={r.value} placeholder="0" onChange={v => patchRule(i, { value: v })} /></div>
            ) : (
              <div className="w-40"><UiSelect size="sm" value={r.value} onChange={v => patchRule(i, { value: v })}
                options={(field.options ?? []).map(o => ({ value: o.value, label: o.label }))} /></div>
            )}
            <button onClick={() => onChange({ ...custom, rules: custom.rules.filter((_, j) => j !== i) })} className="p-1 rounded" style={{ color: "var(--text-muted)" }}><X className="w-3.5 h-3.5" /></button>
          </div>
        );
      })}
      <button onClick={addRule} className="flex items-center gap-1 text-xs font-medium" style={{ color: ROSE }}><Plus className="w-3.5 h-3.5" /> Add rule</button>
    </div>
  );
}

export function BaseChips({ custom, onChange }: { custom: CustomAudience; onChange: (c: CustomAudience) => void }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <p className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>Start from</p>
      {CUSTOM_BASES.map(b => (
        <button key={b.key} onClick={() => onChange({ base: b.key, rules: [] })}
          className="text-xs font-medium px-2.5 py-1 rounded-full transition-colors"
          style={{ backgroundColor: custom.base === b.key ? ROSE + "14" : "var(--bg-input)", color: custom.base === b.key ? ROSE : "var(--text-muted)", border: `1px solid ${custom.base === b.key ? ROSE + "55" : "transparent"}` }}>
          {b.label}
        </button>
      ))}
    </div>
  );
}

// Deduped live members for a rule set (same dedupe the send uses).
export function previewMembers(custom: CustomAudience): AudienceMember[] {
  const seen = new Set<string>();
  return customAudienceMembers(custom).filter(m => {
    const k = m.name.trim().toLowerCase();
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function MemberPreview({ members, max = 8 }: { members: AudienceMember[]; max?: number }) {
  if (members.length === 0) {
    return <p className="text-sm py-2" style={{ color: "var(--text-muted)" }}>Nobody matches right now — loosen the rules.</p>;
  }
  return (
    <>
      <div className="grid gap-x-4 gap-y-0.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
        {members.slice(0, max).map(r => (
          <div key={r.id} className="flex items-center gap-2 py-1 min-w-0">
            <span className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0" style={{ backgroundColor: ROSE + "1a", color: ROSE }}>
              {r.name.split(/\s+/).map(p => p[0]).slice(0, 2).join("").toUpperCase()}
            </span>
            <span className="text-sm truncate" style={{ color: "var(--text-primary)" }}>{r.name}</span>
            {r.detail && <span className="text-[11px] truncate shrink-0" style={{ color: "var(--text-muted)" }}>{r.detail}</span>}
          </div>
        ))}
      </div>
      {members.length > max && <p className="text-[11px] mt-1.5" style={{ color: "var(--text-muted)" }}>+ {members.length - max} more</p>}
    </>
  );
}
