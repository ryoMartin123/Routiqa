"use client";

import { useEffect, useMemo, useState } from "react";
import {
  X, Check, ChevronLeft, ChevronRight, Plus, Trash2, Star, FileText, Send,
} from "lucide-react";
import UiSelect from "@/components/ui/Select";
import DatePicker from "@/components/ui/DatePicker";
import AccountSearchSelect from "@/components/customers/AccountSearchSelect";
import AgreementDocumentPreview, { type AgreementDocData } from "@/components/agreements/AgreementDocumentPreview";
import { getAllCustomers, getProperties } from "@/lib/customers/data";
import { getJobTypes } from "@/lib/job-config/data";
import {
  getAgreementTypes, getVisitRules, getBillingRules, getBenefits,
} from "@/lib/agreements/settings";
import {
  getPlanTemplates, getPlanTemplate, ALL_SECTIONS,
  type SectionKey, type TemplateService, type TemplateVisit,
} from "@/lib/agreements/templates";
import {
  createAgreement, updateAgreement, type AgreementVisit, type CustomerAgreement, type Industry,
  type VisitFrequency, type BillingFrequency,
} from "@/lib/agreements/data";

// Create flow is intentionally short: pick the customer + a template (everything
// else is baked into the template). Customizing for one customer happens in EDIT
// mode, which exposes the full adjust steps against an existing agreement.
const STEPS_CREATE = ["Customer", "Template"];
const STEPS_EDIT   = ["Services", "Visits", "Billing", "Benefits", "Terms"];

let _seq = 0;
const uid = (p: string) => `${p}-${Date.now()}-${_seq++}`;

// ─── Editable draft shapes (string-backed numeric inputs) ──
interface DraftService { id: string; name: string; description: string; quantity: string; included: boolean; discountPct: string; }
interface DraftVisit { id: string; name: string; frequencyKey: string; preferredWindow: string; durationMin: string; jobTypeKey: string; }

// ─── Date helpers ─────────────────────────────────────────
function parseInput(s?: string): Date | null { if (!s) return null; const d = new Date(s + "T00:00:00"); return isNaN(d.getTime()) ? null : d; }
function fmtHuman(d: Date): string { return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
function addMonths(d: Date, n: number): Date { return new Date(d.getFullYear(), d.getMonth() + n, d.getDate()); }
function toInput(d: Date): string { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }

export interface AgreementBuilderPreset { customerId?: string; lockCustomer?: boolean; }

export default function AgreementBuilder({ preset, editAgreement, onClose, onCreated }: {
  preset?: AgreementBuilderPreset;
  editAgreement?: CustomerAgreement;   // when set → edit/customize an existing agreement
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const isEdit = Boolean(editAgreement);
  const STEPS = isEdit ? STEPS_EDIT : STEPS_CREATE;
  const firstStep = isEdit ? 3 : 1;    // edit jumps straight to the adjust steps
  const lastStep  = isEdit ? 7 : 2;
  const customers = getAllCustomers();
  const types = useMemo(() => getAgreementTypes().filter(t => t.active), []);
  const visitRules = useMemo(() => getVisitRules().filter(r => r.active), []);
  const billingRules = useMemo(() => getBillingRules().filter(r => r.active), []);
  const benefitLib = useMemo(() => getBenefits().filter(b => b.active), []);
  const planTemplates = useMemo(() => getPlanTemplates().filter(t => t.active), []);
  const jobTypes = useMemo(() => getJobTypes(), []);

  const [step, setStep] = useState(firstStep);

  // Step 1 — customer & coverage
  const [customerId, setCustomerId] = useState(preset?.customerId ?? customers[0]?.id ?? "");
  const [propertyId, setPropertyId] = useState("");
  const [contactName, setContactName] = useState("");
  const [coverage, setCoverage] = useState<string[]>([]);
  const [coverageInput, setCoverageInput] = useState("");
  const [startDate, setStartDate] = useState(toInput(new Date()));
  const [termMonths, setTermMonths] = useState("12");
  const [endDate, setEndDate] = useState("");

  // Step 2 — template & type
  const [typeKey, setTypeKey] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [planLevel, setPlanLevel] = useState("");

  // Steps 3-6 — seeded from template
  const [services, setServices] = useState<DraftService[]>([]);
  const [visits, setVisits] = useState<DraftVisit[]>([]);
  const [billingKey, setBillingKey] = useState("annual");
  const [billingAmount, setBillingAmount] = useState("0");
  const [billingTaxable, setBillingTaxable] = useState(false);
  const [firstBillingDate, setFirstBillingDate] = useState("");
  const [benefits, setBenefits] = useState<string[]>([]);
  const [benefitInput, setBenefitInput] = useState("");
  const [exclusions, setExclusions] = useState("");

  // Step 7 — terms & sections
  const [sections, setSections] = useState<SectionKey[]>(ALL_SECTIONS.map(s => s.key));
  const [terms, setTerms] = useState<{ title: string; body: string }[]>([]);
  const [title, setTitle] = useState("");

  const customer = customers.find(c => c.id === customerId);
  const properties = useMemo(() => (customerId ? getProperties(customerId) : []), [customerId]);
  const selProperty = properties.find(p => p.id === propertyId);
  const propertyLabel = selProperty
    ? `${selProperty.label ? selProperty.label + " — " : ""}${selProperty.address}, ${selProperty.city}`
    : undefined;

  // ── Template selection seeds the editable steps (snapshot copy) ──
  function chooseTemplate(id: string) {
    setTemplateId(id);
    const t = getPlanTemplate(id);
    if (!t) return;
    if (!typeKey) setTypeKey(t.typeKey);
    setPlanLevel(t.planLevel ?? "");
    setTitle(prev => prev || t.name);
    setServices(t.services.map(s => ({
      id: uid("s"), name: s.name, description: s.description ?? "",
      quantity: String(s.quantity), included: s.included, discountPct: String(s.discountPct ?? 0),
    })));
    setVisits(t.visits.map(v => ({
      id: uid("v"), name: v.name, frequencyKey: v.frequencyKey,
      preferredWindow: v.preferredWindow ?? "", durationMin: String(v.durationMin),
      jobTypeKey: v.jobTypeKey ?? "",
    })));
    setBillingKey(t.billing.frequencyKey);
    setBillingAmount(String(t.billing.amount));
    setBillingTaxable(t.billing.taxable);
    setBenefits([...t.benefits]);
    setExclusions(t.exclusions ?? "");
    setSections([...t.sections]);
    setTerms(t.terms.map(x => ({ ...x })));
  }

  // ── Service ops ──
  const addService = () => setServices(p => [...p, { id: uid("s"), name: "", description: "", quantity: "1", included: true, discountPct: "0" }]);
  const setService = (id: string, patch: Partial<DraftService>) => setServices(p => p.map(s => s.id === id ? { ...s, ...patch } : s));
  const removeService = (id: string) => setServices(p => p.filter(s => s.id !== id));

  // ── Visit ops ──
  const addVisit = () => setVisits(p => [...p, { id: uid("v"), name: "", frequencyKey: visitRules[0]?.key ?? "quarterly", preferredWindow: "", durationMin: "90", jobTypeKey: jobTypes[0]?.key ?? "" }]);
  const setVisit = (id: string, patch: Partial<DraftVisit>) => setVisits(p => p.map(v => v.id === id ? { ...v, ...patch } : v));
  const removeVisit = (id: string) => setVisits(p => p.filter(v => v.id !== id));

  // ── Benefit ops ──
  const toggleBenefit = (label: string) => setBenefits(p => p.includes(label) ? p.filter(b => b !== label) : [...p, label]);
  const addCustomBenefit = () => { const v = benefitInput.trim(); if (v && !benefits.includes(v)) setBenefits(p => [...p, v]); setBenefitInput(""); };

  const toggleSection = (k: SectionKey) => setSections(p => p.includes(k) ? p.filter(s => s !== k) : [...p, k]);

  // ── Derived: visits per year + computed billing ──
  const visitsPerYearOf = (key: string) => visitRules.find(r => r.key === key)?.visitsPerYear ?? 1;
  const billingRule = billingRules.find(r => r.key === billingKey);
  const billingLabel = billingRule?.name ?? "Annual";

  // Generate concrete visits across the first year from the visit plan.
  const generatedVisits = useMemo<AgreementVisit[]>(() => {
    const start = parseInput(startDate) ?? new Date();
    const plan = visits.filter(v => v.name.trim());
    if (plan.length === 0) return [];
    const perVisit = plan.map(v => { const vpy = visitsPerYearOf(v.frequencyKey); return vpy > 0 ? Math.max(1, Math.round(vpy / plan.length)) : 1; });
    const total = perVisit.reduce((a, b) => a + b, 0) || plan.length;
    const stepMonths = total > 0 ? 12 / total : 12;
    const tech = customer?.locationName ? "Unassigned" : "Unassigned";
    const out: AgreementVisit[] = [];
    let idx = 0;
    for (let pi = 0; pi < plan.length; pi++) {
      for (let k = 0; k < perVisit[pi]; k++) {
        const d = addMonths(start, Math.round(idx * stepMonths));
        const occ = perVisit[pi] > 1 ? ` ${k + 1}` : "";
        out.push({ id: uid("av"), label: `${plan[pi].name}${occ}`, scheduled: fmtHuman(d), status: "scheduled", tech });
        idx++;
      }
    }
    return out.sort((a, b) => new Date(a.scheduled).getTime() - new Date(b.scheduled).getTime());
  }, [visits, startDate, visitRules, customer]);

  const totalVisitsPerYear = generatedVisits.length;
  const periodsPerYear = billingRule?.periodsPerYear ?? 1;
  const annualValue = useMemo(() => {
    const amt = parseFloat(billingAmount) || 0;
    if (periodsPerYear > 0) return Math.round(amt * periodsPerYear);
    if (billingKey === "per_visit") return Math.round(amt * (totalVisitsPerYear || 1));
    return Math.round(amt); // upfront / custom → treat as annual figure
  }, [billingAmount, periodsPerYear, billingKey, totalVisitsPerYear]);

  // Legacy union mappers (keep list/detail/calendar happy)
  const visitFrequency: VisitFrequency =
    totalVisitsPerYear >= 12 ? "Monthly" :
    totalVisitsPerYear >= 4  ? "Quarterly" :
    totalVisitsPerYear === 2 ? "2x per year" :
    totalVisitsPerYear === 1 ? "1x per year" : "As needed";
  const billingFrequency: BillingFrequency =
    billingKey === "monthly"   ? "Monthly" :
    billingKey === "quarterly" ? "Quarterly" :
    billingKey === "annual"    ? "Annual" : "Annual";

  // Renewal date from end date or start + term.
  const renewalDate = useMemo(() => {
    if (endDate) { const d = parseInput(endDate); return d ? fmtHuman(d) : ""; }
    const start = parseInput(startDate); if (!start) return "";
    return fmtHuman(addMonths(start, parseInt(termMonths) || 12));
  }, [endDate, startDate, termMonths]);

  const tmpl = templateId ? getPlanTemplate(templateId) : undefined;
  const agreementType = types.find(t => t.key === typeKey);

  // Document data for the preview.
  const docData: AgreementDocData = {
    sections, title: title || tmpl?.name || "Service Agreement", planLevel: planLevel || undefined,
    customerName: customer?.name ?? "—", contactName: contactName || undefined,
    propertyLabel, locationName: customer?.locationName,
    startDate: parseInput(startDate) ? fmtHuman(parseInput(startDate)!) : undefined,
    endDate: endDate && parseInput(endDate) ? fmtHuman(parseInput(endDate)!) : undefined,
    renewalDate: renewalDate || undefined,
    coverage,
    services: services.filter(s => s.name.trim()).map<TemplateService>(s => ({
      id: s.id, name: s.name.trim(), description: s.description.trim() || undefined,
      quantity: parseFloat(s.quantity) || 1, included: s.included, discountPct: parseFloat(s.discountPct) || 0,
    })),
    visits: visits.filter(v => v.name.trim()).map<TemplateVisit>(v => ({
      id: v.id, name: v.name.trim(), frequencyKey: v.frequencyKey,
      preferredWindow: v.preferredWindow.trim() || undefined, durationMin: parseInt(v.durationMin) || 90, jobTypeKey: v.jobTypeKey || undefined,
    })),
    visitFrequencyLabel: visitFrequency,
    billingLabel, billingAmount: parseFloat(billingAmount) || 0, billingTaxable,
    firstBillingDate: firstBillingDate && parseInput(firstBillingDate) ? fmtHuman(parseInput(firstBillingDate)!) : undefined,
    benefits, exclusions: exclusions || undefined, terms,
    renewal: { autoRenew: tmpl?.renewal.autoRenew ?? true, termMonths: parseInt(termMonths) || 12, noticeDays: tmpl?.renewal.noticeDays ?? 30, priceIncreasePct: tmpl?.renewal.priceIncreasePct ?? 0 },
  };

  // ── Save ──
  function save(markActive: boolean) {
    if (!customer) return;
    const start = parseInput(startDate);
    // First visit due soon if within ~30 days → surfaces in the dispatch queue.
    const firstVisitDate = generatedVisits[0] ? new Date(generatedVisits[0].scheduled) : null;
    const daysOut = firstVisitDate ? (firstVisitDate.getTime() - Date.now()) / 86_400_000 : Infinity;
    const status = !markActive ? "active" : daysOut <= 30 && daysOut >= -3650 ? "due_soon" : "active";

    const created = createAgreement({
      customerId: customer.id,
      customer: customer.name, customerInitials: customer.initials,
      location: customer.locationName.replace(/ Branch$/, ""),
      assignedTo: "Unassigned",
      type: agreementType?.name ?? tmpl?.name ?? "Service Agreement",
      industry: (agreementType?.industry ?? tmpl?.industry ?? "General") as Industry,
      templateId, templateKey: tmpl?.key, planLevel: planLevel || undefined,
      startDate: start ? fmtHuman(start) : startDate,
      endDate: endDate && parseInput(endDate) ? fmtHuman(parseInput(endDate)!) : undefined,
      renewalDate,
      propertyLabel, contactName: contactName || undefined,
      coverage: coverage.length ? coverage : undefined,
      services: docData.services.map(s => s.name),
      servicesDetailed: docData.services,
      visitPlan: docData.visits,
      visits: generatedVisits,
      visitFrequency, billingFrequency,
      billingLabel, billingAmount: parseFloat(billingAmount) || 0, billingTaxable,
      firstBillingDate: docData.firstBillingDate,
      annualValue,
      benefits, terms, exclusions: exclusions || undefined, sections,
      renewal: docData.renewal,
      status,
    });
    onCreated(created.id);
  }

  // ── Edit mode: seed the adjust steps from the existing agreement ──
  useEffect(() => {
    const ea = editAgreement;
    if (!ea) return;
    setCustomerId(ea.customerId ?? customers.find(c => c.name === ea.customer)?.id ?? "");
    setTitle(ea.type ?? "");
    setPlanLevel(ea.planLevel ?? "");
    setTemplateId(ea.templateId ?? "");
    setCoverage(ea.coverage ?? []);
    setServices((ea.servicesDetailed ?? []).map(s => ({
      id: uid("s"), name: s.name, description: s.description ?? "",
      quantity: String(s.quantity), included: s.included, discountPct: String(s.discountPct ?? 0),
    })));
    setVisits((ea.visitPlan ?? []).map(v => ({
      id: uid("v"), name: v.name, frequencyKey: v.frequencyKey,
      preferredWindow: v.preferredWindow ?? "", durationMin: String(v.durationMin), jobTypeKey: v.jobTypeKey ?? "",
    })));
    const byLabel = billingRules.find(r => r.name === ea.billingLabel)?.key;
    const byFreq = ea.billingFrequency === "Monthly" ? "monthly" : ea.billingFrequency === "Quarterly" ? "quarterly" : "annual";
    setBillingKey(byLabel ?? byFreq);
    setBillingAmount(String(ea.billingAmount ?? 0));
    setBillingTaxable(!!ea.billingTaxable);
    setBenefits(ea.benefits ?? []);
    setExclusions(ea.exclusions ?? "");
    setSections(ea.sections ?? ALL_SECTIONS.map(s => s.key));
    setTerms((ea.terms ?? []).map(t => ({ ...t })));
    if (ea.planLevel) setPlanLevel(ea.planLevel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Save edits to an existing agreement (preserves scheduled visits) ──
  function saveEdit() {
    if (!editAgreement) return;
    updateAgreement(editAgreement.id, {
      type: title || editAgreement.type,
      planLevel: planLevel || undefined,
      services: docData.services.map(s => s.name),
      servicesDetailed: docData.services,
      visitPlan: docData.visits,
      visitFrequency, billingFrequency,
      billingLabel, billingAmount: parseFloat(billingAmount) || 0, billingTaxable,
      firstBillingDate: docData.firstBillingDate,
      annualValue,
      benefits, terms, exclusions: exclusions || undefined, sections,
      coverage: coverage.length ? coverage : undefined,
      renewal: docData.renewal,
    });
    onCreated(editAgreement.id);
  }

  // ── Step gating ──
  const canNext =
    step === 1 ? Boolean(customerId && startDate) :
    step === 2 ? Boolean(templateId && typeKey) :
    step === 5 ? Boolean(billingKey) :
    true;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-3xl max-h-[92vh] flex flex-col rounded-2xl overflow-hidden" onClick={e => e.stopPropagation()}
        style={{ backgroundColor: "var(--bg-surface)", boxShadow: "0 16px 48px rgba(0,0,0,0.24)" }}>

        {/* Header + stepper */}
        <div className="px-6 pt-4 pb-3 shrink-0" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>{isEdit ? "Customize Agreement" : "New Agreement"}</p>
            <button onClick={onClose} style={{ color: "var(--text-muted)" }}><X className="w-4 h-4" /></button>
          </div>
          <div className="flex items-center gap-1">
            {STEPS.map((label, i) => {
              const n = firstStep + i, done = n < step, current = n === step;
              return (
                <div key={label} className="flex items-center gap-1 flex-1 last:flex-none">
                  <div className="flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                      style={{ backgroundColor: done || current ? "#4f46e5" : "var(--bg-input)", color: done || current ? "#fff" : "var(--text-muted)" }}>
                      {done ? <Check className="w-3 h-3" /> : n}
                    </span>
                    <span className="text-[11px] font-medium whitespace-nowrap" style={{ color: current ? "var(--text-primary)" : "var(--text-muted)" }}>{label}</span>
                  </div>
                  {i < STEPS.length - 1 && <div className="flex-1 h-px mx-1" style={{ backgroundColor: "var(--border-subtle)" }} />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto thin-scroll-y px-6 py-5">
          {/* ── Step 1: Customer & Coverage ── */}
          {step === 1 && (
            <div className="space-y-4">
              <Field label="Customer / Account *">
                <AccountSearchSelect customers={customers} value={customerId}
                  onChange={v => { setCustomerId(v); setPropertyId(""); }} disabled={Boolean(preset?.lockCustomer)} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Service Location / Property" hint="optional">
                  <UiSelect value={propertyId} onChange={setPropertyId} placeholder="No specific property"
                    options={[{ value: "", label: "No specific property" }, ...properties.map(p => ({ value: p.id, label: `${p.label ? p.label + " — " : ""}${p.address}, ${p.city}` }))]} />
                </Field>
                <Field label="Contact Person" hint="optional">
                  <input value={contactName} onChange={e => setContactName(e.target.value)} placeholder="e.g. property manager"
                    className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle} />
                </Field>
              </div>
              <Field label="Covered Equipment / Systems" hint="optional">
                <div className="flex items-center gap-2">
                  <input value={coverageInput} onChange={e => setCoverageInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); const v = coverageInput.trim(); if (v) { setCoverage(p => [...p, v]); setCoverageInput(""); } } }}
                    placeholder="e.g. Carrier 3-ton AC — press Enter" className="flex-1 rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle} />
                </div>
                {coverage.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {coverage.map((c, i) => (
                      <span key={i} className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-secondary)" }}>
                        {c}<button onClick={() => setCoverage(p => p.filter((_, j) => j !== i))}><X className="w-2.5 h-2.5" /></button>
                      </span>
                    ))}
                  </div>
                )}
              </Field>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Start Date *"><DatePicker value={startDate} onChange={setStartDate} clearable={false} /></Field>
                <Field label="Term (months)">
                  <input type="number" min={1} value={termMonths} onChange={e => setTermMonths(e.target.value)} disabled={Boolean(endDate)}
                    className="w-full rounded-lg px-3 py-2 text-sm outline-none disabled:opacity-50" style={inputStyle} />
                </Field>
                <Field label="End Date" hint="optional"><DatePicker value={endDate} onChange={setEndDate} placeholder="By term" /></Field>
              </div>
            </div>
          )}

          {/* ── Step 2: Template & Type ── */}
          {step === 2 && (
            <div className="space-y-4">
              <Field label="Agreement Type *">
                <UiSelect value={typeKey} onChange={setTypeKey} placeholder="Select a type…"
                  options={types.map(t => ({ value: t.key, label: `${t.name} · ${t.industry}` }))} />
              </Field>
              <div>
                <p className="text-xs font-medium mb-2" style={{ color: "var(--text-secondary)" }}>Template *</p>
                <div className="grid grid-cols-2 gap-3">
                  {planTemplates.map(t => {
                    const active = templateId === t.id;
                    return (
                      <button key={t.id} onClick={() => chooseTemplate(t.id)} className="text-left rounded-xl p-4 transition-all"
                        style={{ border: `2px solid ${active ? "#4f46e5" : "var(--border)"}`, backgroundColor: active ? "var(--accent-soft-bg)" : "var(--bg-surface-2)" }}>
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-semibold" style={{ color: active ? "var(--accent-text-strong)" : "var(--text-primary)" }}>{t.name}</p>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>{t.industry}</span>
                        </div>
                        <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>{t.description}</p>
                        <p className="text-[10px] mt-2" style={{ color: "var(--text-muted)" }}>{t.services.length} services · {t.visits.length} visit type(s)</p>
                      </button>
                    );
                  })}
                </div>
              </div>
              <Field label="Plan Level" hint="optional">
                <input value={planLevel} onChange={e => setPlanLevel(e.target.value)} placeholder="e.g. Silver, Gold"
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle} />
              </Field>

              {/* Create directly from the template — everything is built in. */}
              {templateId && (
                <div className="rounded-xl p-4 space-y-3" style={cardStyle}>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    This creates the agreement from the template ({tmpl?.services.length ?? 0} services · {tmpl?.visits.length ?? 0} visit type(s) · ${tmpl?.billing.amount ?? 0} {tmpl?.billing.frequencyKey}). You can customize it for this customer afterward from the agreement page.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => save(false)} className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium"
                      style={{ border: "1px solid var(--border)", color: "var(--text-secondary)", backgroundColor: "var(--bg-surface)" }}>
                      <FileText className="w-4 h-4" /> Save as Draft
                    </button>
                    <button onClick={() => save(true)} className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-white" style={{ backgroundColor: "#4f46e5" }}>
                      <Send className="w-4 h-4" /> Activate Agreement
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Step 3: Included Services ── */}
          {step === 3 && (
            <div className="space-y-3">
              <Header label="Included Services" onAdd={addService} addLabel="Add service" />
              {services.length === 0 && <Empty>No services yet. Add the work this plan includes.</Empty>}
              {services.map(s => (
                <div key={s.id} className="rounded-xl p-3 space-y-2" style={cardStyle}>
                  <div className="flex items-center gap-2">
                    <input value={s.name} onChange={e => setService(s.id, { name: e.target.value })} placeholder="Service name"
                      className="flex-1 rounded-lg px-2.5 py-1.5 text-sm outline-none" style={inputStyle} />
                    <div className="flex items-center gap-1"><span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Qty</span>
                      <input type="number" min={1} value={s.quantity} onChange={e => setService(s.id, { quantity: e.target.value })}
                        className="w-14 rounded-lg px-2 py-1 text-xs outline-none" style={inputStyle} /></div>
                    <button onClick={() => removeService(s.id)} className="p-1.5 rounded-lg shrink-0" style={{ color: "var(--text-muted)" }}><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                  <input value={s.description} onChange={e => setService(s.id, { description: e.target.value })} placeholder="Description (optional)"
                    className="w-full rounded-lg px-2.5 py-1.5 text-xs outline-none" style={inputStyle} />
                  <div className="flex items-center gap-3">
                    <Seg options={[{ k: "inc", label: "Included" }, { k: "disc", label: "Discounted" }]} value={s.included ? "inc" : "disc"} onChange={k => setService(s.id, { included: k === "inc" })} />
                    {!s.included && (
                      <div className="flex items-center gap-1"><span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Discount</span>
                        <input type="number" min={0} max={100} value={s.discountPct} onChange={e => setService(s.id, { discountPct: e.target.value })}
                          className="w-14 rounded-lg px-2 py-1 text-xs outline-none" style={inputStyle} /><span className="text-[10px]" style={{ color: "var(--text-muted)" }}>%</span></div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Step 4: Visit Schedule ── */}
          {step === 4 && (
            <div className="space-y-3">
              <Header label="Visit Schedule" onAdd={addVisit} addLabel="Add visit" />
              <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>This plan generates <span style={{ color: "var(--accent-text)", fontWeight: 600 }}>{totalVisitsPerYear}</span> visit{totalVisitsPerYear === 1 ? "" : "s"} in the first year.</p>
              {visits.length === 0 && <Empty>No visits yet. Add the recurring visits this plan schedules.</Empty>}
              {visits.map(v => (
                <div key={v.id} className="rounded-xl p-3 space-y-2" style={cardStyle}>
                  <div className="flex items-center gap-2">
                    <input value={v.name} onChange={e => setVisit(v.id, { name: e.target.value })} placeholder="Visit name (e.g. Spring Tune-up)"
                      className="flex-1 rounded-lg px-2.5 py-1.5 text-sm outline-none" style={inputStyle} />
                    <button onClick={() => removeVisit(v.id)} className="p-1.5 rounded-lg shrink-0" style={{ color: "var(--text-muted)" }}><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <LabeledMini label="Frequency">
                      <UiSelect size="sm" value={v.frequencyKey} onChange={k => setVisit(v.id, { frequencyKey: k })} options={visitRules.map(r => ({ value: r.key, label: r.name }))} />
                    </LabeledMini>
                    <LabeledMini label="Job Type Created">
                      <UiSelect size="sm" value={v.jobTypeKey} onChange={k => setVisit(v.id, { jobTypeKey: k })} placeholder="None"
                        options={[{ value: "", label: "None" }, ...jobTypes.map(j => ({ value: j.key, label: j.name }))]} />
                    </LabeledMini>
                    <LabeledMini label="Preferred Window">
                      <input value={v.preferredWindow} onChange={e => setVisit(v.id, { preferredWindow: e.target.value })} placeholder="e.g. Spring"
                        className="w-full rounded-lg px-2.5 py-1.5 text-xs outline-none" style={inputStyle} />
                    </LabeledMini>
                    <LabeledMini label="Duration (min)">
                      <input type="number" min={15} step={15} value={v.durationMin} onChange={e => setVisit(v.id, { durationMin: e.target.value })}
                        className="w-full rounded-lg px-2.5 py-1.5 text-xs outline-none" style={inputStyle} />
                    </LabeledMini>
                  </div>
                </div>
              ))}
              <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>When due, generated visits appear in the dispatch Unscheduled Queue. Scheduling one creates/links a Job — work is never duplicated.</p>
            </div>
          )}

          {/* ── Step 5: Billing ── */}
          {step === 5 && (
            <div className="space-y-4 max-w-lg">
              <Field label="Billing Frequency *">
                <UiSelect value={billingKey} onChange={setBillingKey} options={billingRules.map(r => ({ value: r.key, label: r.name }))} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={`Amount ${periodsPerYear > 0 ? "per period" : billingKey === "per_visit" ? "per visit" : ""}`}>
                  <input type="number" min={0} step="0.01" value={billingAmount} onChange={e => setBillingAmount(e.target.value)}
                    className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle} />
                </Field>
                <Field label="First Billing Date" hint="optional"><DatePicker value={firstBillingDate} onChange={setFirstBillingDate} placeholder="On start" /></Field>
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: "var(--text-secondary)" }}>
                <input type="checkbox" checked={billingTaxable} onChange={e => setBillingTaxable(e.target.checked)} className="accent-indigo-600" /> Taxable
              </label>
              <div className="rounded-xl p-4 flex items-center justify-between" style={cardStyle}>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>Estimated annual value</span>
                <span className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>${annualValue.toLocaleString()}/yr</span>
              </div>
            </div>
          )}

          {/* ── Step 6: Benefits & Discounts ── */}
          {step === 6 && (
            <div className="space-y-4">
              <Field label="Member Benefits">
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
              </Field>
              <Field label="Add Custom Benefit">
                <div className="flex items-center gap-2">
                  <input value={benefitInput} onChange={e => setBenefitInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCustomBenefit(); } }}
                    placeholder="e.g. Annual filter shipment" className="flex-1 rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle} />
                  <button onClick={addCustomBenefit} className="px-3 py-2 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: "#4f46e5" }}>Add</button>
                </div>
              </Field>
              {benefits.filter(b => !benefitLib.some(x => x.label === b)).length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {benefits.filter(b => !benefitLib.some(x => x.label === b)).map((b, i) => (
                    <span key={i} className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: "var(--accent-soft-bg)", color: "var(--accent-text-strong)" }}>
                      {b}<button onClick={() => toggleBenefit(b)}><X className="w-2.5 h-2.5" /></button>
                    </span>
                  ))}
                </div>
              )}
              <Field label="Exclusions" hint="shown on the agreement">
                <textarea value={exclusions} onChange={e => setExclusions(e.target.value)} rows={3}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none thin-scroll-y" style={inputStyle} />
              </Field>
            </div>
          )}

          {/* ── Step 7: Terms & Approval ── */}
          {step === 7 && (
            <div className="space-y-4">
              <Field label="Agreement Title">
                <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. HVAC Residential Maintenance"
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle} />
              </Field>
              <Field label="Document Sections" hint="toggle what the customer sees">
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
              </Field>
              <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Customer-Facing Preview</p>
              <AgreementDocumentPreview data={docData} />
              {isEdit ? (
                <button onClick={saveEdit} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium text-white" style={{ backgroundColor: "#4f46e5" }}>
                  <Check className="w-4 h-4" /> Save Changes
                </button>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => save(false)} className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium"
                    style={{ border: "1px solid var(--border)", color: "var(--text-secondary)", backgroundColor: "var(--bg-surface)" }}>
                    <FileText className="w-4 h-4" /> Save as Draft
                  </button>
                  <button onClick={() => save(true)} className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium text-white" style={{ backgroundColor: "#4f46e5" }}>
                    <Send className="w-4 h-4" /> Activate Agreement
                  </button>
                </div>
              )}
              {!isEdit && <p className="text-[11px] text-center" style={{ color: "var(--text-muted)" }}>No e-signature is sent — “Activate” sets the agreement live and schedules its visits.</p>}
            </div>
          )}
        </div>

        {/* Footer nav */}
        <div className="px-6 py-4 flex items-center justify-between shrink-0" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          <button onClick={() => (step === firstStep ? onClose() : setStep(s => s - 1))}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
            <ChevronLeft className="w-4 h-4" /> {step === firstStep ? "Cancel" : "Back"}
          </button>
          {step < lastStep && (
            <button onClick={() => canNext && setStep(s => s + 1)} disabled={!canNext}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40" style={{ backgroundColor: "#4f46e5" }}>
              Next <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Small shared UI bits ─────────────────────────────────
const inputStyle: React.CSSProperties = { border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" };
const cardStyle: React.CSSProperties = { backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border-subtle)" };

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
        {label}{hint && <span style={{ color: "var(--text-muted)" }}> ({hint})</span>}
      </label>
      {children}
    </div>
  );
}
function LabeledMini({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>{label}</label>{children}</div>;
}
function Header({ label, onAdd, addLabel }: { label: string; onAdd: () => void; addLabel: string }) {
  return (
    <div className="flex items-center justify-between">
      <label className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>{label}</label>
      <button onClick={onAdd} className="flex items-center gap-1 text-xs font-medium" style={{ color: "#4f46e5" }}><Plus className="w-3 h-3" /> {addLabel}</button>
    </div>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-center py-6" style={{ color: "var(--text-muted)" }}>{children}</p>;
}
function Seg({ options, value, onChange }: { options: { k: string; label: string }[]; value: string; onChange: (k: string) => void }) {
  return (
    <div className="flex items-center rounded-lg overflow-hidden w-fit" style={{ border: "1px solid var(--border)" }}>
      {options.map(o => {
        const active = value === o.k;
        return (
          <button key={o.k} onClick={() => onChange(o.k)} className="px-3 py-1 text-xs font-medium transition-colors"
            style={{ backgroundColor: active ? "#4f46e5" : "var(--bg-surface)", color: active ? "#fff" : "var(--text-secondary)" }}>{o.label}</button>
        );
      })}
    </div>
  );
}
