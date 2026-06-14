"use client";

// ─── AgreementContentEditor ───────────────────────────────
// The reusable body-editor for the building blocks an agreement and a template
// share: included services, the visit plan, billing cadence, member benefits,
// terms/exclusions, and which document sections show to the customer.
//
// It's a controlled component over an AgreementContent value, so the same UI
// powers the template builder (Settings), new-agreement creation, and editing an
// existing agreement. Keep it presentation + block-CRUD only — persistence and
// snapshotting live with the caller.

import { useMemo } from "react";
import { Plus, Trash2, Star, X } from "lucide-react";
import UiSelect from "@/components/ui/Select";
import { getVisitRules, getBillingRules, getBenefits, getTermsBlocks, agrId } from "@/lib/agreements/settings";
import { getServiceScopeTemplates } from "@/lib/agreements/template-library";
import { getJobTypes } from "@/lib/job-config/data";
import { ALL_SECTIONS, type TemplateService, type TemplateVisit, type TemplateBilling, type TemplateTerm, type SectionKey } from "@/lib/agreements/templates";

export interface AgreementContent {
  services: TemplateService[];
  visits: TemplateVisit[];
  billing: TemplateBilling;
  benefits: string[];
  terms: TemplateTerm[];
  exclusions?: string;
  sections: SectionKey[];
}

export default function AgreementContentEditor({ value, onChange }: {
  value: AgreementContent;
  onChange: (patch: Partial<AgreementContent>) => void;
}) {
  const serviceScopes = useMemo(() => getServiceScopeTemplates().filter(t => t.active), []);
  const visitRules  = useMemo(() => getVisitRules().filter(r => r.active), []);
  const billingRules = useMemo(() => getBillingRules().filter(r => r.active), []);
  const benefitLib  = useMemo(() => getBenefits().filter(b => b.active), []);
  const termsLib    = useMemo(() => getTermsBlocks().filter(t => t.active), []);
  const jobTypes    = useMemo(() => getJobTypes(), []);

  const { services, visits, billing, benefits, terms, exclusions, sections } = value;

  // ── Services (loaded from a Service Scope Template) ──
  const loadServiceScope = (id: string) => {
    const t = serviceScopes.find(x => x.id === id);
    if (!t) return;
    onChange({ services: [...services, ...t.services.map(s => ({
      id: agrId("ts"), name: s.name, description: s.description, quantity: s.quantity ?? 1,
      included: s.included ?? true, discountPct: s.discountPct, scopeType: s.scopeType, applies: s.applies,
      limit: s.limit, itemId: s.itemId, workOrderTemplateId: s.workOrderTemplateId,
    }))] });
  };
  const setService = (id: string, patch: Partial<TemplateService>) => onChange({ services: services.map(s => s.id === id ? { ...s, ...patch } : s) });
  const removeService = (id: string) => onChange({ services: services.filter(s => s.id !== id) });

  // ── Visits ──
  const addVisit = () => onChange({ visits: [...visits, { id: agrId("tv"), name: "", frequencyKey: visitRules[0]?.key ?? "quarterly", preferredWindow: "", durationMin: 90, jobTypeKey: jobTypes[0]?.key ?? "" }] });
  const setVisit = (id: string, patch: Partial<TemplateVisit>) => onChange({ visits: visits.map(v => v.id === id ? { ...v, ...patch } : v) });
  const removeVisit = (id: string) => onChange({ visits: visits.filter(v => v.id !== id) });

  // ── Benefits ──
  const toggleBenefit = (label: string) => onChange({ benefits: benefits.includes(label) ? benefits.filter(b => b !== label) : [...benefits, label] });

  // ── Terms ──
  const addTerm = (title = "", body = "") => onChange({ terms: [...terms, { title, body }] });
  const setTerm = (i: number, patch: Partial<TemplateTerm>) => onChange({ terms: terms.map((t, idx) => idx === i ? { ...t, ...patch } : t) });
  const removeTerm = (i: number) => onChange({ terms: terms.filter((_, idx) => idx !== i) });

  // ── Sections ──
  const toggleSection = (k: SectionKey) => onChange({ sections: sections.includes(k) ? sections.filter(s => s !== k) : [...sections, k] });

  // ── Derived: visits/year + annual value (mirrors the builder) ──
  const vpyOf = (key: string) => visitRules.find(r => r.key === key)?.visitsPerYear ?? 1;
  const totalVisitsPerYear = useMemo(() => {
    const plan = visits.filter(v => v.name.trim());
    if (!plan.length) return 0;
    return plan.reduce((sum, v) => { const vpy = vpyOf(v.frequencyKey); return sum + (vpy > 0 ? Math.max(1, Math.round(vpy / plan.length)) : 1); }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visits, visitRules]);
  const billingRule = billingRules.find(r => r.key === billing.frequencyKey);
  const periodsPerYear = billingRule?.periodsPerYear ?? 1;
  const annualValue = useMemo(() => {
    const amt = billing.amount || 0;
    if (periodsPerYear > 0) return Math.round(amt * periodsPerYear);
    if (billing.frequencyKey === "per_visit") return Math.round(amt * (totalVisitsPerYear || 1));
    return Math.round(amt);
  }, [billing.amount, periodsPerYear, billing.frequencyKey, totalVisitsPerYear]);

  const customBenefits = benefits.filter(b => !benefitLib.some(x => x.label === b));

  return (
    <div className="space-y-6">
      {/* ── Services (loaded from a Service Scope Template) ── */}
      <div className="space-y-2.5">
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Included Services</p>
        {serviceScopes.length === 0 ? (
          <div className="rounded-xl p-4 text-center" style={cardStyle}>
            <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>No service scopes yet</p>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              Create reusable service groups under <span style={{ color: "var(--accent-text)", fontWeight: 600 }}>Settings → Agreements → Service Scope Templates</span>, then load them here.
            </p>
          </div>
        ) : (
          <div className="max-w-xs">
            <UiSelect size="sm" value="" placeholder="+ Load a service scope…" onChange={loadServiceScope}
              options={serviceScopes.map(t => ({ value: t.id, label: t.name }))} />
          </div>
        )}
        {services.length === 0 && serviceScopes.length > 0 && <Empty>No services added yet. Load a service scope above.</Empty>}
        {services.map(s => (
          <div key={s.id} className="rounded-xl p-3 flex items-center gap-3" style={cardStyle}>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{s.name}</p>
              {s.description && <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>{s.description}</p>}
            </div>
            <div className="flex items-center gap-1 shrink-0"><span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Qty</span>
              <input type="number" min={1} value={s.quantity} onChange={e => setService(s.id, { quantity: parseInt(e.target.value) || 1 })}
                className="w-14 rounded-lg px-2 py-1 text-xs outline-none" style={inputStyle} /></div>
            <button onClick={() => removeService(s.id)} className="p-1.5 rounded-lg shrink-0" style={{ color: "var(--text-muted)" }}><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        ))}
      </div>

      {/* ── Visit plan ── */}
      <Section title="Visit Schedule" onAdd={addVisit} addLabel="Add visit">
        <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
          This plan generates <span style={{ color: "var(--accent-text)", fontWeight: 600 }}>{totalVisitsPerYear}</span> visit{totalVisitsPerYear === 1 ? "" : "s"} per year.
        </p>
        {visits.length === 0 && <Empty>No visits yet. Add the recurring visits this plan schedules.</Empty>}
        {visits.map(v => (
          <div key={v.id} className="rounded-xl p-3 space-y-2" style={cardStyle}>
            <div className="flex items-center gap-2">
              <input value={v.name} onChange={e => setVisit(v.id, { name: e.target.value })} placeholder="Visit name (e.g. Spring Tune-up)"
                className="flex-1 rounded-lg px-2.5 py-1.5 text-sm outline-none" style={inputStyle} />
              <button onClick={() => removeVisit(v.id)} className="p-1.5 rounded-lg shrink-0" style={{ color: "var(--text-muted)" }}><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Mini label="Frequency">
                <UiSelect size="sm" value={v.frequencyKey} onChange={k => setVisit(v.id, { frequencyKey: k })} options={visitRules.map(r => ({ value: r.key, label: r.name }))} />
              </Mini>
              <Mini label="Job Type Created">
                <UiSelect size="sm" value={v.jobTypeKey ?? ""} onChange={k => setVisit(v.id, { jobTypeKey: k })} placeholder="None"
                  options={[{ value: "", label: "None" }, ...jobTypes.map(j => ({ value: j.key, label: j.name }))]} />
              </Mini>
              <Mini label="Preferred Window">
                <input value={v.preferredWindow ?? ""} onChange={e => setVisit(v.id, { preferredWindow: e.target.value })} placeholder="e.g. Spring"
                  className="w-full rounded-lg px-2.5 py-1.5 text-xs outline-none" style={inputStyle} />
              </Mini>
              <Mini label="Duration (min)">
                <input type="number" min={15} step={15} value={v.durationMin} onChange={e => setVisit(v.id, { durationMin: parseInt(e.target.value) || 90 })}
                  className="w-full rounded-lg px-2.5 py-1.5 text-xs outline-none" style={inputStyle} />
              </Mini>
            </div>
          </div>
        ))}
      </Section>

      {/* ── Billing ── */}
      <Section title="Billing">
        <div className="grid grid-cols-2 gap-3 max-w-lg">
          <Mini label="Billing Frequency">
            <UiSelect size="sm" value={billing.frequencyKey} onChange={k => onChange({ billing: { ...billing, frequencyKey: k } })} options={billingRules.map(r => ({ value: r.key, label: r.name }))} />
          </Mini>
          <Mini label={`Amount ${periodsPerYear > 0 ? "per period" : billing.frequencyKey === "per_visit" ? "per visit" : ""}`}>
            <input type="number" min={0} step="0.01" value={billing.amount} onChange={e => onChange({ billing: { ...billing, amount: parseFloat(e.target.value) || 0 } })}
              className="w-full rounded-lg px-2.5 py-1.5 text-sm outline-none" style={inputStyle} />
          </Mini>
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: "var(--text-secondary)" }}>
          <input type="checkbox" checked={billing.taxable} onChange={e => onChange({ billing: { ...billing, taxable: e.target.checked } })} className="accent-indigo-600" /> Taxable
        </label>
        <div className="rounded-xl p-3 flex items-center justify-between max-w-lg" style={cardStyle}>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>Estimated annual value</span>
          <span className="text-base font-bold" style={{ color: "var(--text-primary)" }}>${annualValue.toLocaleString()}/yr</span>
        </div>
      </Section>

      {/* ── Benefits ── */}
      <Section title="Member Benefits">
        <div className="flex flex-wrap gap-2">
          {benefitLib.map(b => {
            const on = benefits.includes(b.label);
            return (
              <button key={b.id} onClick={() => toggleBenefit(b.label)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
                style={{ border: `1px solid ${on ? "var(--accent-soft-border)" : "var(--border)"}`, backgroundColor: on ? "var(--accent-soft-bg)" : "var(--bg-surface)", color: on ? "var(--accent-text-strong)" : "var(--text-secondary)" }}>
                <Star className="w-3 h-3" /> {b.label}{b.value ? ` · ${b.value}` : ""}
              </button>
            );
          })}
        </div>
        <BenefitAdder onAdd={label => { if (label && !benefits.includes(label)) onChange({ benefits: [...benefits, label] }); }} />
        {customBenefits.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {customBenefits.map((b, i) => (
              <span key={i} className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: "var(--accent-soft-bg)", color: "var(--accent-text-strong)" }}>
                {b}<button onClick={() => toggleBenefit(b)}><X className="w-2.5 h-2.5" /></button>
              </span>
            ))}
          </div>
        )}
      </Section>

      {/* ── Terms & exclusions ── */}
      <Section title="Terms" onAdd={() => addTerm()} addLabel="Add term">
        {termsLib.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>Insert from library:</span>
            <div className="w-56">
              <UiSelect size="sm" value="" placeholder="Choose a terms block…"
                onChange={key => { const b = termsLib.find(t => t.id === key); if (b) addTerm(b.title, b.body); }}
                options={termsLib.map(t => ({ value: t.id, label: t.title }))} />
            </div>
          </div>
        )}
        {terms.length === 0 && <Empty>No terms yet. Add clauses or insert from your library.</Empty>}
        {terms.map((t, i) => (
          <div key={i} className="rounded-xl p-3 space-y-2" style={cardStyle}>
            <div className="flex items-center gap-2">
              <input value={t.title} onChange={e => setTerm(i, { title: e.target.value })} placeholder="Clause title"
                className="flex-1 rounded-lg px-2.5 py-1.5 text-sm font-medium outline-none" style={inputStyle} />
              <button onClick={() => removeTerm(i)} className="p-1.5 rounded-lg shrink-0" style={{ color: "var(--text-muted)" }}><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
            <textarea value={t.body} onChange={e => setTerm(i, { body: e.target.value })} rows={2} placeholder="Clause text"
              className="w-full rounded-lg px-2.5 py-1.5 text-xs outline-none resize-none thin-scroll-y" style={inputStyle} />
          </div>
        ))}
        <Mini label="Exclusions (shown on the agreement)">
          <textarea value={exclusions ?? ""} onChange={e => onChange({ exclusions: e.target.value })} rows={3}
            className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none thin-scroll-y" style={inputStyle} />
        </Mini>
      </Section>

      {/* ── Document sections ── */}
      <Section title="Document Sections">
        <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Toggle which sections appear on the customer-facing agreement.</p>
        <div className="flex flex-wrap gap-1.5">
          {ALL_SECTIONS.map(s => {
            const on = sections.includes(s.key);
            return (
              <button key={s.key} onClick={() => toggleSection(s.key)}
                className="px-2.5 py-1 rounded-full text-xs font-medium transition-colors"
                style={{ border: `1px solid ${on ? "var(--accent-soft-border)" : "var(--border)"}`, backgroundColor: on ? "var(--accent-soft-bg)" : "var(--bg-surface)", color: on ? "var(--accent-text-strong)" : "var(--text-muted)" }}>
                {s.label}
              </button>
            );
          })}
        </div>
      </Section>
    </div>
  );
}

// ─── Local UI bits ────────────────────────────────────────
const inputStyle: React.CSSProperties = { border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" };
const cardStyle: React.CSSProperties = { backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border-subtle)" };

function Section({ title, onAdd, addLabel, children }: { title: string; onAdd?: () => void; addLabel?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>{title}</p>
        {onAdd && (
          <button onClick={onAdd} className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg transition-colors hover:bg-[var(--bg-surface-2)]"
            style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
            <Plus className="w-3 h-3" /> {addLabel}
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-xs py-2" style={{ color: "var(--text-muted)" }}>{children}</p>;
}

function Mini({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-medium mb-1" style={{ color: "var(--text-muted)" }}>{label}</label>
      {children}
    </div>
  );
}

// Small controlled-by-parent input for adding a custom benefit (keeps its own text).
function BenefitAdder({ onAdd }: { onAdd: (label: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <input
        placeholder="Add a custom benefit…"
        onKeyDown={e => {
          if (e.key === "Enter") { e.preventDefault(); const v = (e.target as HTMLInputElement).value.trim(); if (v) { onAdd(v); (e.target as HTMLInputElement).value = ""; } }
        }}
        className="flex-1 max-w-xs rounded-lg px-3 py-1.5 text-sm outline-none" style={inputStyle} />
      <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>press Enter</span>
    </div>
  );
}
