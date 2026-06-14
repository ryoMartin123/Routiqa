"use client";

// Central draft state for the full-page Agreement Builder. Holds every section's
// editable data, derives the generated visit plan / annual value / preview doc,
// and persists via createAgreement / updateAgreement (snapshot-on-save). Seeds
// from a PlanTemplate (create) or an existing CustomerAgreement (edit).

import { useEffect, useMemo, useState, useCallback } from "react";
import { getAllCustomers, getProperties } from "@/lib/customers/data";
import { getJobTypes } from "@/lib/job-config/data";
import {
  getVisitRules, getBillingRules, getBenefits,
  getTermsBlocks, getRenewalRules, PAYMENT_TERMS,
  type ServiceScopeType, type ServiceApplies, type BenefitKind,
  type TermType, type RenewalType,
} from "@/lib/agreements/settings";
import {
  getVisitScheduleTemplates, getServiceScopeTemplates,
} from "@/lib/agreements/template-library";
import {
  getPlanTemplate, ALL_SECTIONS,
  type SectionKey, type TemplateService, type TemplateVisit,
  type TemplateBillingRule, type TemplateTerm, type TemplateRenewal,
} from "@/lib/agreements/templates";
import {
  createAgreement, updateAgreement, getAgreement,
  type AgreementVisit, type AgreementBenefit, type CustomerAgreement,
  type Industry, type VisitFrequency, type BillingFrequency,
} from "@/lib/agreements/data";
import type { AgreementDocData } from "@/components/agreements/AgreementDocumentPreview";
import {
  customVisitsPerYear, customBillingAnnualValue, representativeBillingAmount,
  type CustomVisitConfig, type CustomBillingConfig,
} from "@/lib/agreements/custom-rules";

// ─── Draft (string-backed numeric inputs) ─────────────────
export interface DraftVisit {
  id: string; name: string; frequencyKey: string; preferredWindow: string;
  dueWindowDays: string; durationMin: string; jobTypeKey: string;
  workOrderTemplateId: string; dispatchBoardId: string;
  requirePhotos: boolean; requireChecklist: boolean; autoGenerate: boolean;
  customVisit?: CustomVisitConfig;     // guided rule when frequencyKey === "custom"
}
export interface DraftService {
  id: string; name: string; description: string; scopeType: ServiceScopeType;
  applies: ServiceApplies; quantity: string; limit: string;
  itemId: string; workOrderTemplateId: string;
  visitId: string;             // assigned visit id; "" = applies to the whole agreement
}
export interface DraftBilling {
  id: string; frequencyKey: string; amount: string; taxable: boolean;
  startDate: string; endDate: string; paymentTermsKey: string;
  deposit: string; autoRenew: boolean;
  customBilling?: CustomBillingConfig; // guided rule when frequencyKey === "custom"
}
export interface DraftBenefit {
  id: string; label: string; kind: BenefitKind; description: string;
  value: string; appliesTo: string; limit: string;
}
export interface DraftTerm {
  id: string; title: string; body: string; termType: string;
  required: boolean; editable: boolean;
}
export interface DraftRenewal {
  renewalType: RenewalType; termMonths: string; noticeDays: string; reminderDays: string;
  priceIncreasePct: string; priceIncreaseType: "pct" | "flat";
  approvalRequired: boolean; generateTask: boolean; generateQuote: boolean;
}

let _seq = 0;
const uid = (p: string) => `${p}-${Date.now()}-${_seq++}`;

// ─── Date helpers ─────────────────────────────────────────
const parseInput = (s?: string): Date | null => { if (!s) return null; const d = new Date(s + "T00:00:00"); return isNaN(d.getTime()) ? null : d; };
const fmtHuman = (d: Date): string => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const addMonths = (d: Date, n: number): Date => new Date(d.getFullYear(), d.getMonth() + n, d.getDate());
const toInput = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Cadences that never pre-generate planned visits (created on demand instead).
const NO_GEN_CADENCE = new Set(["no_visits", "on_demand"]);

export type BuilderMode = "create" | "edit";

export interface UseAgreementDraft {
  mode: BuilderMode;
  // libraries
  customers: ReturnType<typeof getAllCustomers>;
  scheduleTemplates: ReturnType<typeof getVisitScheduleTemplates>;
  serviceScopeTemplates: ReturnType<typeof getServiceScopeTemplates>;
  visitRules: ReturnType<typeof getVisitRules>;
  billingRules: ReturnType<typeof getBillingRules>;
  benefitLib: ReturnType<typeof getBenefits>;
  termsLib: ReturnType<typeof getTermsBlocks>;
  renewalLib: ReturnType<typeof getRenewalRules>;
  jobTypes: ReturnType<typeof getJobTypes>;
  paymentTerms: typeof PAYMENT_TERMS;
  // basic info
  customerId: string; setCustomerId: (v: string) => void;
  propertyId: string; setPropertyId: (v: string) => void;
  contactName: string; setContactName: (v: string) => void;
  coverage: string[]; addCoverage: (v: string) => void; removeCoverage: (i: number) => void;
  startDate: string; setStartDate: (v: string) => void;
  termMonths: string; setTermMonths: (v: string) => void;
  endDate: string; setEndDate: (v: string) => void;
  title: string; setTitle: (v: string) => void;
  templateId: string; chooseTemplate: (id: string) => void;
  sections: SectionKey[]; toggleSection: (k: SectionKey) => void;
  // collections
  visits: DraftVisit[]; addVisit: () => void; setVisit: (id: string, p: Partial<DraftVisit>) => void; removeVisit: (id: string) => void; loadVisitSchedule: (templateId: string) => void;
  services: DraftService[]; loadServiceScope: (templateId: string) => void; addBlankService: () => void; setService: (id: string, p: Partial<DraftService>) => void; removeService: (id: string) => void;
  billings: DraftBilling[]; addBilling: () => void; setBilling: (id: string, p: Partial<DraftBilling>) => void; removeBilling: (id: string) => void;
  benefits: DraftBenefit[]; addBenefitFromLib: (libId: string) => void; addCustomBenefit: (label: string) => void; setBenefit: (id: string, p: Partial<DraftBenefit>) => void; removeBenefit: (id: string) => void;
  terms: DraftTerm[]; addTermFromLib: (libId: string) => void; addBlankTerm: () => void; setTerm: (id: string, p: Partial<DraftTerm>) => void; removeTerm: (id: string) => void;
  renewal: DraftRenewal; setRenewal: (p: Partial<DraftRenewal>) => void; applyRenewalRule: (id: string) => void;
  exclusions: string; setExclusions: (v: string) => void;
  // derived
  customer: ReturnType<typeof getAllCustomers>[number] | undefined;
  properties: ReturnType<typeof getProperties>;
  generatedVisits: AgreementVisit[];
  annualValue: number;
  renewalDate: string;
  docData: AgreementDocData;
  completeness: Record<string, boolean>;
  // persistence
  save: (activate: boolean) => string | undefined;
}

export function useAgreementDraft(opts: { mode: BuilderMode; agreementId?: string; initialTemplateId?: string; initialCustomerId?: string }): UseAgreementDraft {
  const customers = getAllCustomers();
  const scheduleTemplates = useMemo(() => getVisitScheduleTemplates().filter(t => t.active), []);
  const serviceScopeTemplates = useMemo(() => getServiceScopeTemplates().filter(t => t.active), []);
  const visitRules = useMemo(() => getVisitRules().filter(r => r.active), []);
  const billingRules = useMemo(() => getBillingRules().filter(r => r.active), []);
  const benefitLib = useMemo(() => getBenefits().filter(b => b.active), []);
  const termsLib = useMemo(() => getTermsBlocks().filter(t => t.active), []);
  const renewalLib = useMemo(() => getRenewalRules().filter(r => r.active), []);
  const jobTypes = useMemo(() => getJobTypes(), []);

  // ── Basic info ──
  const [customerId, setCustomerId] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [contactName, setContactName] = useState("");
  const [coverage, setCoverage] = useState<string[]>([]);
  const [startDate, setStartDate] = useState(toInput(new Date()));
  const [termMonths, setTermMonths] = useState("12");
  const [endDate, setEndDate] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [title, setTitle] = useState("");
  const [planLevel, setPlanLevel] = useState<string | undefined>(undefined);
  const [industry, setIndustry] = useState<Industry>("General");
  const [templateKey, setTemplateKey] = useState<string | undefined>(undefined);
  const [sections, setSections] = useState<SectionKey[]>(ALL_SECTIONS.map(s => s.key));

  // ── Engine collections ──
  const [visits, setVisits] = useState<DraftVisit[]>([]);
  const [services, setServices] = useState<DraftService[]>([]);
  const [billings, setBillings] = useState<DraftBilling[]>([{ id: uid("b"), frequencyKey: "annual", amount: "0", taxable: false, startDate: "", endDate: "", paymentTermsKey: "due_on_receipt", deposit: "", autoRenew: true }]);
  const [benefits, setBenefits] = useState<DraftBenefit[]>([]);
  const [terms, setTerms] = useState<DraftTerm[]>([]);
  const [exclusions, setExclusions] = useState("");
  const [renewal, setRenewalState] = useState<DraftRenewal>({
    renewalType: "auto_same", termMonths: "12", noticeDays: "30", reminderDays: "45",
    priceIncreasePct: "0", priceIncreaseType: "pct", approvalRequired: false, generateTask: true, generateQuote: false,
  });

  const editId = opts.mode === "edit" ? opts.agreementId : undefined;

  // ── Seed from template (create) ──
  const chooseTemplate = useCallback((id: string) => {
    setTemplateId(id);
    const t = getPlanTemplate(id);
    if (!t) return;
    setTitle(prev => prev || t.name);
    setIndustry(t.industry);
    setTemplateKey(t.key);
    setPlanLevel(t.planLevel);
    setServices(t.services.map(s => ({
      id: uid("s"), name: s.name, description: s.description ?? "",
      scopeType: s.scopeType ?? (s.included ? "included" : "discounted"),
      applies: s.applies ?? "per_visit", quantity: String(s.quantity ?? 1),
      limit: s.limit != null ? String(s.limit) : "",
      itemId: s.itemId ?? "", workOrderTemplateId: s.workOrderTemplateId ?? "",
      visitId: s.visitId ?? "",
    })));
    setVisits(t.visits.map(v => ({
      id: uid("v"), name: v.name, frequencyKey: v.frequencyKey, preferredWindow: v.preferredWindow ?? "",
      dueWindowDays: v.dueWindowDays != null ? String(v.dueWindowDays) : "",
      durationMin: String(v.durationMin), jobTypeKey: v.jobTypeKey ?? "",
      workOrderTemplateId: v.workOrderTemplateId ?? "", dispatchBoardId: v.dispatchBoardId ?? "",
      requirePhotos: !!v.requirePhotos, requireChecklist: !!v.requireChecklist,
      autoGenerate: v.autoGenerate ?? true, customVisit: v.customVisit,
    })));
    const rules = t.billingRules?.length ? t.billingRules : [{ frequencyKey: t.billing.frequencyKey, amount: t.billing.amount, taxable: t.billing.taxable }];
    setBillings(rules.map(r => ({
      id: uid("b"), frequencyKey: r.frequencyKey, amount: String(r.amount), taxable: r.taxable,
      startDate: r.startDate ?? "", endDate: r.endDate ?? "", paymentTermsKey: r.paymentTermsKey ?? "due_on_receipt",
      deposit: r.deposit != null ? String(r.deposit) : "", autoRenew: r.autoRenew ?? true, customBilling: r.customBilling,
    })));
    setBenefits(t.benefits.map(label => {
      const lib = benefitLib.find(b => b.label === label);
      return { id: uid("bn"), label, kind: lib?.kind ?? "custom", description: lib?.description ?? "", value: lib?.value ?? "", appliesTo: lib?.appliesTo ?? "", limit: lib?.limit ?? "" };
    }));
    setTerms(t.terms.map(x => ({ id: uid("t"), title: x.title, body: x.body, termType: x.termType ?? "custom", required: !!x.required, editable: x.editable ?? true })));
    setExclusions(t.exclusions ?? "");
    setSections([...t.sections]);
    setRenewalState({
      renewalType: t.renewal.renewalType ?? (t.renewal.autoRenew ? "auto_same" : "manual"),
      termMonths: String(t.renewal.termMonths), noticeDays: String(t.renewal.noticeDays),
      reminderDays: t.renewal.reminderDays != null ? String(t.renewal.reminderDays) : "45",
      priceIncreasePct: String(t.renewal.priceIncreasePct), priceIncreaseType: t.renewal.priceIncreaseType ?? "pct",
      approvalRequired: !!t.renewal.approvalRequired, generateTask: t.renewal.generateTask ?? true, generateQuote: !!t.renewal.generateQuote,
    });
    setTermMonths(String(t.renewal.termMonths));
  }, [benefitLib]);

  // Initial seed: template on create, existing agreement on edit. Runs once.
  useEffect(() => {
    if (editId) {
      const ea = getAgreement(editId);
      if (!ea) return;
      setCustomerId(ea.customerId ?? customers.find(c => c.name === ea.customer)?.id ?? "");
      setPropertyId(ea.propertyId ?? "");
      setContactName(ea.contactName ?? "");
      setCoverage(ea.coverage ?? []);
      setStartDate(ea.startDate && parseInput(ea.startDate) ? toInput(parseInput(ea.startDate)!) : startDate);
      setTitle(ea.type ?? "");
      setTemplateId(ea.templateId ?? "");
      setTemplateKey(ea.templateKey);
      setIndustry((ea.industry ?? "General") as Industry);
      setPlanLevel(ea.planLevel);
      setSections(ea.sections ?? ALL_SECTIONS.map(s => s.key));
      setServices((ea.servicesDetailed ?? []).map(s => ({
        id: uid("s"), name: s.name, description: s.description ?? "",
        scopeType: s.scopeType ?? (s.included ? "included" : "discounted"),
        applies: s.applies ?? "per_visit", quantity: String(s.quantity ?? 1),
        limit: s.limit != null ? String(s.limit) : "", itemId: s.itemId ?? "", workOrderTemplateId: s.workOrderTemplateId ?? "",
        visitId: s.visitId ?? "",
      })));
      setVisits((ea.visitPlan ?? []).map(v => ({
        id: uid("v"), name: v.name, frequencyKey: v.frequencyKey, preferredWindow: v.preferredWindow ?? "",
        dueWindowDays: v.dueWindowDays != null ? String(v.dueWindowDays) : "",
        durationMin: String(v.durationMin), jobTypeKey: v.jobTypeKey ?? "",
        workOrderTemplateId: v.workOrderTemplateId ?? "", dispatchBoardId: v.dispatchBoardId ?? "",
        requirePhotos: !!v.requirePhotos, requireChecklist: !!v.requireChecklist, autoGenerate: v.autoGenerate ?? true,
        customVisit: v.customVisit,
      })));
      const rules = ea.billingRules?.length ? ea.billingRules
        : [{ frequencyKey: billingKeyFromLegacy(ea), amount: ea.billingAmount ?? 0, taxable: !!ea.billingTaxable }];
      setBillings(rules.map(r => ({
        id: uid("b"), frequencyKey: r.frequencyKey, amount: String(r.amount), taxable: r.taxable,
        startDate: r.startDate ?? "", endDate: r.endDate ?? "", paymentTermsKey: r.paymentTermsKey ?? "due_on_receipt",
        deposit: r.deposit != null ? String(r.deposit) : "", autoRenew: r.autoRenew ?? true, customBilling: r.customBilling,
      })));
      const det = ea.benefitsDetailed;
      setBenefits((det && det.length ? det.map(b => ({ id: uid("bn"), label: b.label, kind: (b.kind as BenefitKind) ?? "custom", description: b.description ?? "", value: b.value ?? "", appliesTo: b.appliesTo ?? "", limit: b.limit ?? "" }))
        : (ea.benefits ?? []).map(label => ({ id: uid("bn"), label, kind: "custom" as BenefitKind, description: "", value: "", appliesTo: "", limit: "" }))));
      setTerms((ea.terms ?? []).map(x => ({ id: uid("t"), title: x.title, body: x.body, termType: x.termType ?? "custom", required: !!x.required, editable: x.editable ?? true })));
      setExclusions(ea.exclusions ?? "");
      if (ea.renewal) setRenewalState({
        renewalType: ea.renewal.renewalType ?? (ea.renewal.autoRenew ? "auto_same" : "manual"),
        termMonths: String(ea.renewal.termMonths), noticeDays: String(ea.renewal.noticeDays),
        reminderDays: ea.renewal.reminderDays != null ? String(ea.renewal.reminderDays) : "45",
        priceIncreasePct: String(ea.renewal.priceIncreasePct), priceIncreaseType: ea.renewal.priceIncreaseType ?? "pct",
        approvalRequired: !!ea.renewal.approvalRequired, generateTask: ea.renewal.generateTask ?? true, generateQuote: !!ea.renewal.generateQuote,
      });
    } else {
      if (opts.initialCustomerId) setCustomerId(opts.initialCustomerId);
      if (opts.initialTemplateId) chooseTemplate(opts.initialTemplateId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Basic info derived ──
  const customer = customers.find(c => c.id === customerId);
  const properties = useMemo(() => (customerId ? getProperties(customerId) : []), [customerId]);
  const selProperty = properties.find(p => p.id === propertyId);
  const propertyLabel = selProperty ? `${selProperty.label ? selProperty.label + " — " : ""}${selProperty.address}, ${selProperty.city}` : undefined;

  // Auto-select primary property when the customer changes.
  useEffect(() => {
    if (properties.length && !properties.some(p => p.id === propertyId)) {
      setPropertyId((properties.find(p => p.isPrimary) ?? properties[0]).id);
    }
  }, [properties, propertyId]);

  // ── Coverage ops ──
  const addCoverage = (v: string) => { const t = v.trim(); if (t) setCoverage(p => [...p, t]); };
  const removeCoverage = (i: number) => setCoverage(p => p.filter((_, j) => j !== i));

  // ── Visit ops ──
  const addVisit = () => setVisits(p => [...p, { id: uid("v"), name: "", frequencyKey: visitRules[0]?.key ?? "quarterly", preferredWindow: "", dueWindowDays: "", durationMin: "90", jobTypeKey: jobTypes[0]?.key ?? "", workOrderTemplateId: "", dispatchBoardId: "", requirePhotos: false, requireChecklist: false, autoGenerate: true }]);
  const setVisit = (id: string, patch: Partial<DraftVisit>) => setVisits(p => p.map(v => v.id === id ? { ...v, ...patch } : v));
  const removeVisit = (id: string) => setVisits(p => p.filter(v => v.id !== id));
  // Load a Visit Schedule Template — append its visits ("when we go").
  const loadVisitSchedule = (templateId: string) => {
    const t = scheduleTemplates.find(x => x.id === templateId); if (!t) return;
    setVisits(p => [...p, ...t.visits.map(v => ({
      id: uid("v"), name: v.name, frequencyKey: v.frequencyKey, preferredWindow: v.preferredWindow ?? "",
      dueWindowDays: v.dueWindowDays != null ? String(v.dueWindowDays) : "", durationMin: String(v.durationMin),
      jobTypeKey: v.jobTypeKey ?? "", workOrderTemplateId: v.workOrderTemplateId ?? "", dispatchBoardId: v.dispatchBoardId ?? "",
      requirePhotos: !!v.requirePhotos, requireChecklist: !!v.requireChecklist, autoGenerate: v.autoGenerate ?? true,
      customVisit: v.customVisit,
    }))]);
  };

  // ── Service ops ──
  // Load a Service Scope Template — append its services ("what we do").
  const loadServiceScope = (templateId: string) => {
    const t = serviceScopeTemplates.find(x => x.id === templateId); if (!t) return;
    setServices(p => [...p, ...t.services.map(s => ({
      id: uid("s"), name: s.name, description: s.description ?? "", scopeType: s.scopeType ?? "included",
      applies: s.applies ?? "per_visit", quantity: String(s.quantity ?? 1), limit: s.limit != null ? String(s.limit) : "",
      itemId: s.itemId ?? "", workOrderTemplateId: s.workOrderTemplateId ?? "", visitId: s.visitId ?? "",
    }))]);
  };
  const addBlankService = () => setServices(p => [...p, { id: uid("s"), name: "", description: "", scopeType: "included", applies: "per_visit", quantity: "1", limit: "", itemId: "", workOrderTemplateId: "", visitId: "" }]);
  const setService = (id: string, patch: Partial<DraftService>) => setServices(p => p.map(s => s.id === id ? { ...s, ...patch } : s));
  const removeService = (id: string) => setServices(p => p.filter(s => s.id !== id));

  // ── Billing ops ──
  const addBilling = () => setBillings(p => [...p, { id: uid("b"), frequencyKey: billingRules[0]?.key ?? "annual", amount: "0", taxable: false, startDate: "", endDate: "", paymentTermsKey: "due_on_receipt", deposit: "", autoRenew: true }]);
  const setBilling = (id: string, patch: Partial<DraftBilling>) => setBillings(p => p.map(b => b.id === id ? { ...b, ...patch } : b));
  const removeBilling = (id: string) => setBillings(p => (p.length > 1 ? p.filter(b => b.id !== id) : p));

  // ── Benefit ops ──
  const addBenefitFromLib = (libId: string) => {
    const lib = benefitLib.find(b => b.id === libId); if (!lib || benefits.some(b => b.label === lib.label)) return;
    setBenefits(p => [...p, { id: uid("bn"), label: lib.label, kind: lib.kind, description: lib.description ?? "", value: lib.value ?? "", appliesTo: lib.appliesTo ?? "", limit: lib.limit ?? "" }]);
  };
  const addCustomBenefit = (label: string) => { const t = label.trim(); if (t && !benefits.some(b => b.label === t)) setBenefits(p => [...p, { id: uid("bn"), label: t, kind: "custom", description: "", value: "", appliesTo: "", limit: "" }]); };
  const setBenefit = (id: string, patch: Partial<DraftBenefit>) => setBenefits(p => p.map(b => b.id === id ? { ...b, ...patch } : b));
  const removeBenefit = (id: string) => setBenefits(p => p.filter(b => b.id !== id));

  // ── Term ops ──
  const addTermFromLib = (libId: string) => {
    const lib = termsLib.find(t => t.id === libId); if (!lib) return;
    setTerms(p => [...p, { id: uid("t"), title: lib.title, body: lib.body, termType: lib.termType ?? "custom", required: !!lib.required, editable: lib.editable ?? true }]);
  };
  const addBlankTerm = () => setTerms(p => [...p, { id: uid("t"), title: "", body: "", termType: "custom", required: false, editable: true }]);
  const setTerm = (id: string, patch: Partial<DraftTerm>) => setTerms(p => p.map(t => t.id === id ? { ...t, ...patch } : t));
  const removeTerm = (id: string) => setTerms(p => p.filter(t => t.id !== id));

  // ── Renewal ops ──
  const setRenewal = (patch: Partial<DraftRenewal>) => setRenewalState(p => ({ ...p, ...patch }));
  const applyRenewalRule = (id: string) => {
    const r = renewalLib.find(x => x.id === id); if (!r) return;
    setRenewalState({
      renewalType: r.renewalType ?? (r.autoRenew ? "auto_same" : "manual"),
      termMonths: String(r.termMonths), noticeDays: String(r.noticeDays),
      reminderDays: r.reminderDays != null ? String(r.reminderDays) : "45",
      priceIncreasePct: String(r.priceIncreasePct), priceIncreaseType: r.priceIncreaseType ?? "pct",
      approvalRequired: !!r.approvalRequired, generateTask: r.generateTask ?? true, generateQuote: !!r.generateQuote,
    });
    setTermMonths(String(r.termMonths));
  };

  const toggleSection = (k: SectionKey) => setSections(p => p.includes(k) ? p.filter(s => s !== k) : [...p, k]);

  // ── Derived: visit plan + value ──
  const visitsPerYearOf = (key: string) => visitRules.find(r => r.key === key)?.visitsPerYear ?? 1;
  // Effective visits/year — reads the guided custom config when frequency is "custom".
  const effVisitsPerYear = (v: DraftVisit) => v.frequencyKey === "custom" ? customVisitsPerYear(v.customVisit) : visitsPerYearOf(v.frequencyKey);

  const generatedVisits = useMemo<AgreementVisit[]>(() => {
    const start = parseInput(startDate) ?? new Date();
    // Only auto-generate visits with a generating cadence produce planned visits.
    // Custom schedules only generate when their config implies on-calendar visits.
    const plan = visits.filter(v => v.name.trim() && v.autoGenerate && !NO_GEN_CADENCE.has(v.frequencyKey)
      && (v.frequencyKey !== "custom" || customVisitsPerYear(v.customVisit) > 0));
    if (plan.length === 0) return [];
    const perVisit = plan.map(v => { const vpy = effVisitsPerYear(v); return vpy > 0 ? Math.max(1, Math.round(vpy / plan.length)) : 1; });
    const total = perVisit.reduce((a, b) => a + b, 0) || plan.length;
    const stepMonths = total > 0 ? 12 / total : 12;
    const out: AgreementVisit[] = [];
    let idx = 0;
    for (let pi = 0; pi < plan.length; pi++) {
      for (let k = 0; k < perVisit[pi]; k++) {
        const d = addMonths(start, Math.round(idx * stepMonths));
        const occ = perVisit[pi] > 1 ? ` ${k + 1}` : "";
        out.push({ id: uid("av"), label: `${plan[pi].name}${occ}`, scheduled: fmtHuman(d), status: "planned", tech: "Unassigned" });
        idx++;
      }
    }
    return out.sort((a, b) => new Date(a.scheduled).getTime() - new Date(b.scheduled).getTime());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visits, startDate, visitRules]);

  const totalVisitsPerYear = generatedVisits.length;
  const primaryBilling = billings[0];
  const primaryRule = billingRules.find(r => r.key === primaryBilling?.frequencyKey);
  const periodsPerYear = primaryRule?.periodsPerYear ?? 1;
  const billingLabel = primaryRule?.name ?? "Annual";

  const annualValue = useMemo(() => {
    if (primaryBilling?.frequencyKey === "custom") return customBillingAnnualValue(primaryBilling.customBilling, totalVisitsPerYear);
    const amt = parseFloat(primaryBilling?.amount ?? "0") || 0;
    if (periodsPerYear > 0) return Math.round(amt * periodsPerYear);
    if (primaryBilling?.frequencyKey === "per_visit") return Math.round(amt * (totalVisitsPerYear || 1));
    return Math.round(amt);
  }, [primaryBilling, periodsPerYear, totalVisitsPerYear]);

  // Representative single amount for list/preview rows (custom rules summarize to one figure).
  const primaryBillingAmount = primaryBilling?.frequencyKey === "custom"
    ? representativeBillingAmount(primaryBilling.customBilling)
    : parseFloat(primaryBilling?.amount ?? "0") || 0;

  // Legacy union mappers (keep list/detail/calendar happy).
  const visitFrequency: VisitFrequency =
    totalVisitsPerYear >= 12 ? "Monthly" :
    totalVisitsPerYear >= 4 ? "Quarterly" :
    totalVisitsPerYear === 2 ? "2x per year" :
    totalVisitsPerYear === 1 ? "1x per year" : "As needed";
  const billingFrequency: BillingFrequency =
    primaryBilling?.frequencyKey === "monthly" ? "Monthly" :
    primaryBilling?.frequencyKey === "quarterly" ? "Quarterly" :
    primaryBilling?.frequencyKey === "semi_annual" ? "Semi-annual" : "Annual";

  const renewalDate = useMemo(() => {
    if (endDate) { const d = parseInput(endDate); return d ? fmtHuman(d) : ""; }
    const start = parseInput(startDate); if (!start) return "";
    return fmtHuman(addMonths(start, parseInt(termMonths) || 12));
  }, [endDate, startDate, termMonths]);

  // ── Snapshot builders (draft → template element shapes) ──
  const servicesDetailed = useMemo<TemplateService[]>(() => services.filter(s => s.name.trim()).map(s => ({
    id: s.id, name: s.name.trim(), description: s.description.trim() || undefined,
    quantity: parseFloat(s.quantity) || 1, included: s.scopeType === "included" || s.scopeType === "covered_item",
    scopeType: s.scopeType, applies: s.applies,
    limit: s.limit ? parseFloat(s.limit) : undefined, itemId: s.itemId || undefined, workOrderTemplateId: s.workOrderTemplateId || undefined,
    visitId: s.visitId || undefined,
  })), [services]);

  const visitPlan = useMemo<TemplateVisit[]>(() => visits.filter(v => v.name.trim()).map(v => ({
    id: v.id, name: v.name.trim(), frequencyKey: v.frequencyKey, preferredWindow: v.preferredWindow.trim() || undefined,
    dueWindowDays: v.dueWindowDays ? parseInt(v.dueWindowDays) : undefined, durationMin: parseInt(v.durationMin) || 90,
    jobTypeKey: v.jobTypeKey || undefined, workOrderTemplateId: v.workOrderTemplateId || undefined,
    dispatchBoardId: v.dispatchBoardId || undefined, requirePhotos: v.requirePhotos || undefined,
    requireChecklist: v.requireChecklist || undefined, autoGenerate: v.autoGenerate,
    customVisit: v.frequencyKey === "custom" ? v.customVisit : undefined,
  })), [visits]);

  const billingRulesOut = useMemo<TemplateBillingRule[]>(() => billings.map(b => ({
    id: b.id, frequencyKey: b.frequencyKey, amount: parseFloat(b.amount) || 0, taxable: b.taxable,
    startDate: b.startDate || undefined, endDate: b.endDate || undefined, autoRenew: b.autoRenew,
    paymentTermsKey: b.paymentTermsKey || undefined, deposit: b.deposit ? parseFloat(b.deposit) : undefined,
    customBilling: b.frequencyKey === "custom" ? b.customBilling : undefined,
  })), [billings]);

  const benefitsDetailed = useMemo<AgreementBenefit[]>(() => benefits.map(b => ({
    label: b.label, kind: b.kind, description: b.description || undefined, value: b.value || undefined,
    appliesTo: b.appliesTo || undefined, limit: b.limit || undefined,
  })), [benefits]);

  const termsOut = useMemo<TemplateTerm[]>(() => terms.filter(t => t.title.trim()).map(t => ({
    title: t.title.trim(), body: t.body, termType: t.termType, required: t.required, editable: t.editable,
  })), [terms]);

  const renewalOut = useMemo<TemplateRenewal>(() => ({
    renewalType: renewal.renewalType,
    autoRenew: renewal.renewalType === "auto_same" || renewal.renewalType === "auto_increase" || renewal.renewalType === "month_to_month",
    termMonths: parseInt(renewal.termMonths) || 12, noticeDays: parseInt(renewal.noticeDays) || 30,
    reminderDays: parseInt(renewal.reminderDays) || 0, priceIncreasePct: parseFloat(renewal.priceIncreasePct) || 0,
    priceIncreaseType: renewal.priceIncreaseType, approvalRequired: renewal.approvalRequired,
    generateTask: renewal.generateTask, generateQuote: renewal.generateQuote,
  }), [renewal]);

  const firstBillingDate = primaryBilling?.startDate && parseInput(primaryBilling.startDate) ? fmtHuman(parseInput(primaryBilling.startDate)!) : undefined;

  // ── Preview doc ──
  const docData: AgreementDocData = {
    sections, title: title || "Service Agreement", planLevel,
    customerName: customer?.name ?? "—", contactName: contactName || undefined,
    propertyLabel, locationName: customer?.locationName,
    startDate: parseInput(startDate) ? fmtHuman(parseInput(startDate)!) : undefined,
    endDate: endDate && parseInput(endDate) ? fmtHuman(parseInput(endDate)!) : undefined,
    renewalDate: renewalDate || undefined,
    coverage,
    services: servicesDetailed, visits: visitPlan, visitFrequencyLabel: visitFrequency,
    billingLabel, billingAmount: primaryBillingAmount, billingTaxable: !!primaryBilling?.taxable,
    firstBillingDate,
    benefits: benefits.map(b => b.label), exclusions: exclusions || undefined, terms: termsOut,
    renewal: { autoRenew: renewalOut.autoRenew, termMonths: renewalOut.termMonths, noticeDays: renewalOut.noticeDays, priceIncreasePct: renewalOut.priceIncreasePct },
  };

  // ── Section completeness (rail dots) ──
  const completeness: Record<string, boolean> = {
    basic: Boolean(customerId && propertyId && startDate && (title.trim() || templateId)),
    visits: visits.some(v => v.name.trim()),
    services: services.some(s => s.name.trim()),
    billing: billings.length > 0 && Boolean(primaryBilling?.frequencyKey),
    benefits: benefits.length > 0,
    terms: terms.some(t => t.title.trim()),
    renewals: Boolean(renewal.renewalType),
    preview: true,
  };

  // ── Persist ──
  const save = (activate: boolean): string | undefined => {
    if (!customer) return undefined;
    const start = parseInput(startDate);
    const firstVisitDate = generatedVisits[0] ? new Date(generatedVisits[0].scheduled) : null;
    const daysOut = firstVisitDate ? (firstVisitDate.getTime() - Date.now()) / 86_400_000 : Infinity;
    const status = !activate ? "active" : daysOut <= 30 && daysOut >= -3650 ? "due_soon" : "active";

    const common = {
      type: (title.trim() || "Service Agreement"),
      industry, templateId, templateKey,
      startDate: start ? fmtHuman(start) : startDate,
      endDate: endDate && parseInput(endDate) ? fmtHuman(parseInput(endDate)!) : undefined,
      renewalDate,
      propertyId, propertyLabel, contactName: contactName || undefined,
      coverage: coverage.length ? coverage : undefined,
      planLevel,
      services: servicesDetailed.map(s => s.name), servicesDetailed,
      visitPlan, visits: generatedVisits,
      visitFrequency, billingFrequency, billingLabel,
      billingAmount: primaryBillingAmount, billingTaxable: !!primaryBilling?.taxable,
      firstBillingDate, billingRules: billingRulesOut, annualValue,
      benefits: benefits.map(b => b.label), benefitsDetailed,
      terms: termsOut, exclusions: exclusions || undefined, sections, renewal: renewalOut,
    };

    if (editId) {
      updateAgreement(editId, common);
      return editId;
    }
    const created = createAgreement({
      customerId: customer.id, customer: customer.name, customerInitials: customer.initials,
      location: customer.locationName.replace(/ Branch$/, ""), assignedTo: "Unassigned",
      status, ...common,
    });
    return created.id;
  };

  return {
    mode: opts.mode, customers, scheduleTemplates, serviceScopeTemplates, visitRules, billingRules, benefitLib, termsLib, renewalLib, jobTypes, paymentTerms: PAYMENT_TERMS,
    customerId, setCustomerId, propertyId, setPropertyId, contactName, setContactName,
    coverage, addCoverage, removeCoverage, startDate, setStartDate, termMonths, setTermMonths, endDate, setEndDate,
    title, setTitle, templateId, chooseTemplate, sections, toggleSection,
    visits, addVisit, setVisit, removeVisit, loadVisitSchedule,
    services, loadServiceScope, addBlankService, setService, removeService,
    billings, addBilling, setBilling, removeBilling,
    benefits, addBenefitFromLib, addCustomBenefit, setBenefit, removeBenefit,
    terms, addTermFromLib, addBlankTerm, setTerm, removeTerm,
    renewal, setRenewal, applyRenewalRule, exclusions, setExclusions,
    customer, properties, generatedVisits, annualValue, renewalDate, docData, completeness, save,
  };
}

// Map a legacy agreement's billing label/frequency back to a billing-rule key.
function billingKeyFromLegacy(ea: CustomerAgreement): string {
  const label = (ea.billingLabel ?? "").toLowerCase();
  if (label.includes("per visit")) return "per_visit";
  if (label.includes("upfront")) return "upfront";
  if (ea.billingFrequency === "Monthly") return "monthly";
  if (ea.billingFrequency === "Quarterly") return "quarterly";
  if (ea.billingFrequency === "Semi-annual") return "semi_annual";
  return "annual";
}
