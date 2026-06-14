// Reusable Visit Schedule + Service Scope templates for Settings → Agreements.
//
//   Visit Schedule = "when we go"  → a named set of recurring visits (appointments).
//   Service Scope   = "what we do" → a named group of included services (tasks).
//
// These are the high-level building blocks the Agreement Builder loads from:
// choosing a Visit Schedule fills in the visits, choosing a Service Scope fills in
// the services. They reuse the TemplateVisit / TemplateService shapes so the
// Builder and PlanTemplates all speak the same language.
//
// localStorage-backed CRUD mirroring the seed + cached-list pattern used by
// settings.ts / templates.ts. Replace with Supabase queries when ready.

import type { Industry } from "./data";
import { agrId, agrSlug, type VisitCadence, type ServiceScopeType, type ServiceApplies } from "./settings";
import type { TemplateVisit, TemplateService } from "./templates";

// ─── Types ────────────────────────────────────────────────
export interface VisitScheduleTemplate {
  id: string; name: string; key: string;
  description?: string;
  industry?: Industry;
  frequencyType?: VisitCadence;   // overall cadence summary (e.g. semi_annual)
  visits: TemplateVisit[];        // the recurring appointments this schedule generates
  active: boolean; order: number;
}

export interface ServiceScopeTemplate {
  id: string; name: string; key: string;
  description?: string;
  industry?: Industry;
  services: TemplateService[];    // the tasks performed (what we do)
  active: boolean; order: number;
}

// ─── Seed builders ────────────────────────────────────────
const vis = (
  name: string, frequencyKey: string, durationMin: number,
  preferredWindow?: string, jobTypeKey = "maintenance",
  workOrderTemplateId?: string,
): TemplateVisit =>
  ({ id: agrId("tv"), name, frequencyKey, durationMin, preferredWindow, jobTypeKey, workOrderTemplateId, autoGenerate: true });

const svc = (name: string, description?: string): TemplateService =>
  ({ id: agrId("ts"), name, description, quantity: 1, included: true, scopeType: "included", applies: "per_visit" });

// ─── Seed defaults ────────────────────────────────────────
const DEFAULT_VISIT_SCHEDULES: VisitScheduleTemplate[] = [
  {
    id: "vst-1", name: "Semi-Annual HVAC Spring/Fall", key: "semi_annual_hvac_spring_fall",
    description: "Two seasonal tune-up visits — cooling in spring, heating in fall.",
    industry: "HVAC", frequencyType: "semi_annual",
    visits: [
      vis("Spring Cooling Tune-Up", "semi_annual", 90, "March–May", "maintenance", "wt-2"),
      vis("Fall Heating Tune-Up",   "semi_annual", 90, "September–November", "maintenance", "wt-2"),
    ],
    active: true, order: 1,
  },
  {
    id: "vst-2", name: "Quarterly Commercial PM", key: "quarterly_commercial_pm",
    description: "Four preventive-maintenance visits per year for commercial sites.",
    industry: "HVAC", frequencyType: "quarterly",
    visits: [vis("Quarterly PM Visit", "quarterly", 120, "Each quarter", "maintenance", "wt-9")],
    active: true, order: 2,
  },
  {
    id: "vst-3", name: "Annual Roof Inspection", key: "annual_roof_inspection",
    description: "One scheduled roof inspection visit each year.",
    industry: "Roofing", frequencyType: "annual",
    visits: [vis("Annual Inspection", "annual", 120, "Spring", "inspection", "wt-4")],
    active: true, order: 3,
  },
  {
    id: "vst-4", name: "Monthly Property Walkthrough", key: "monthly_property_walkthrough",
    description: "A recurring monthly walkthrough of the property.",
    industry: "Property Maintenance", frequencyType: "monthly",
    visits: [vis("Monthly Walkthrough", "monthly", 60, "Each month", "maintenance", "wt-2")],
    active: true, order: 4,
  },
  {
    id: "vst-5", name: "On-Demand Service Allowance", key: "on_demand_service_allowance",
    description: "No pre-scheduled visits — service booked on demand within the agreement.",
    industry: "General", frequencyType: "on_demand",
    visits: [vis("On-Demand Service", "on_demand", 90, "As needed", "maintenance")],
    active: true, order: 5,
  },
  {
    id: "vst-6", name: "Custom", key: "custom",
    description: "Start from an empty schedule and add visits manually.",
    industry: "General", frequencyType: "custom",
    visits: [],
    active: true, order: 6,
  },
];

const DEFAULT_SERVICE_SCOPES: ServiceScopeTemplate[] = [
  {
    id: "sst-1", name: "HVAC Cooling Tune-Up Services", key: "hvac_cooling_tune_up_services",
    description: "Standard tasks performed during a cooling-season tune-up.",
    industry: "HVAC",
    services: [
      svc("Inspect outdoor coil"), svc("Check refrigerant performance"),
      svc("Inspect electrical components"), svc("Clear condensate drain"),
      svc("Test thermostat"),
    ],
    active: true, order: 1,
  },
  {
    id: "sst-2", name: "HVAC Heating Tune-Up Services", key: "hvac_heating_tune_up_services",
    description: "Standard tasks performed during a heating-season tune-up.",
    industry: "HVAC",
    services: [
      svc("Inspect heat exchanger"), svc("Test ignition / burners"),
      svc("Check gas pressure & connections"), svc("Inspect electrical components"),
      svc("Replace air filter"), svc("Test thermostat"),
    ],
    active: true, order: 2,
  },
  {
    id: "sst-3", name: "Commercial PM Services", key: "commercial_pm_services",
    description: "Preventive-maintenance tasks for commercial equipment.",
    industry: "HVAC",
    services: [
      svc("Inspect & test equipment"), svc("Filter changes"),
      svc("Coil cleaning"), svc("Refrigerant check"), svc("Service reporting"),
    ],
    active: true, order: 3,
  },
  {
    id: "sst-4", name: "Roof Inspection Services", key: "roof_inspection_services",
    description: "Tasks performed during a roof inspection visit.",
    industry: "Roofing",
    services: [
      svc("Roof surface inspection"), svc("Flashing & seal check"),
      svc("Gutter cleaning"), svc("Photo report"),
    ],
    active: true, order: 4,
  },
  {
    id: "sst-5", name: "Property Walkthrough Services", key: "property_walkthrough_services",
    description: "Tasks performed during a property walkthrough.",
    industry: "Property Maintenance",
    services: [
      svc("Exterior & grounds check"), svc("Minor repairs included"),
      svc("Seasonal prep"), svc("Property condition report"),
    ],
    active: true, order: 5,
  },
];

// ─── Storage ──────────────────────────────────────────────
const VST_KEY = "crm-agr-visit-schedules";
const SST_KEY = "crm-agr-service-scopes";

let _schedules: VisitScheduleTemplate[] | null = null;
let _scopes: ServiceScopeTemplate[] | null = null;

function read<T>(key: string, fallback: T[]): T[] {
  if (typeof window === "undefined") return [...fallback];
  try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T[]) : [...fallback]; }
  catch { return [...fallback]; }
}
function write<T>(key: string, value: T[]): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

const sortOrder = <T extends { order: number }>(l: T[]) => [...l].sort((a, b) => a.order - b.order);
const reorder = <T extends { order: number }>(l: T[]) => sortOrder(l).map((x, i) => ({ ...x, order: i + 1 }));

// Visit Schedule Templates
export function getVisitScheduleTemplates(): VisitScheduleTemplate[] {
  if (!_schedules) _schedules = read(VST_KEY, DEFAULT_VISIT_SCHEDULES);
  return sortOrder(_schedules);
}
export function saveVisitScheduleTemplates(list: VisitScheduleTemplate[]): void {
  _schedules = reorder(list); write(VST_KEY, _schedules);
}
export function blankVisitSchedule(): VisitScheduleTemplate {
  const max = getVisitScheduleTemplates().reduce((m, t) => Math.max(m, t.order), 0);
  return { id: agrId("vst"), name: "", key: "", description: "", industry: "General", frequencyType: "custom", visits: [], active: true, order: max + 1 };
}

// Service Scope Templates
export function getServiceScopeTemplates(): ServiceScopeTemplate[] {
  if (!_scopes) _scopes = read(SST_KEY, DEFAULT_SERVICE_SCOPES);
  return sortOrder(_scopes);
}
export function saveServiceScopeTemplates(list: ServiceScopeTemplate[]): void {
  _scopes = reorder(list); write(SST_KEY, _scopes);
}
export function blankServiceScope(): ServiceScopeTemplate {
  const max = getServiceScopeTemplates().reduce((m, t) => Math.max(m, t.order), 0);
  return { id: agrId("sst"), name: "", key: "", description: "", industry: "General", services: [], active: true, order: max + 1 };
}

// ══════════════════════════════════════════════════════════
// Atomic building blocks: individual Visit Templates + Services
// ══════════════════════════════════════════════════════════
// These are the reusable single units the bundle editors compose from:
//   Visit Templates  → loaded into Visit Schedule Templates.
//   Services         → loaded into Service Scope Templates.

export interface VisitTemplate {
  id: string; name: string;
  description?: string; industry?: Industry;
  frequencyKey: string;          // → VisitRule.key
  preferredWindow?: string;
  durationMin: number;
  jobTypeKey?: string;
  workOrderTemplateId?: string;
  dispatchBoardId?: string;
  autoGenerate?: boolean;
  active: boolean; order: number;
}

export interface ServiceItem {
  id: string; name: string;
  description?: string; industry?: Industry;
  scopeType?: ServiceScopeType;
  applies?: ServiceApplies;
  defaultQuantity?: number;
  limit?: number;
  itemId?: string;
  workOrderTemplateId?: string;
  active: boolean; order: number;
}

// Map an atomic unit into the shape a bundle stores (fresh id each time).
export function visitTemplateToVisit(v: VisitTemplate): TemplateVisit {
  return {
    id: agrId("tv"), name: v.name, frequencyKey: v.frequencyKey, preferredWindow: v.preferredWindow,
    durationMin: v.durationMin, jobTypeKey: v.jobTypeKey, workOrderTemplateId: v.workOrderTemplateId,
    dispatchBoardId: v.dispatchBoardId, autoGenerate: v.autoGenerate ?? true,
  };
}
export function serviceItemToService(s: ServiceItem): TemplateService {
  const included = s.scopeType === "included" || s.scopeType === "covered_item" || s.scopeType == null;
  return {
    id: agrId("ts"), name: s.name, description: s.description, quantity: s.defaultQuantity ?? 1,
    included, scopeType: s.scopeType ?? "included", applies: s.applies ?? "per_visit",
    limit: s.limit, itemId: s.itemId, workOrderTemplateId: s.workOrderTemplateId,
  };
}

const DEFAULT_VISIT_TEMPLATES: VisitTemplate[] = [
  { id: "vt-1", name: "Spring Cooling Tune-Up", industry: "HVAC", frequencyKey: "semi_annual", preferredWindow: "March–May", durationMin: 90, jobTypeKey: "maintenance", workOrderTemplateId: "wt-2", autoGenerate: true, active: true, order: 1 },
  { id: "vt-2", name: "Fall Heating Tune-Up",   industry: "HVAC", frequencyKey: "semi_annual", preferredWindow: "September–November", durationMin: 90, jobTypeKey: "maintenance", workOrderTemplateId: "wt-2", autoGenerate: true, active: true, order: 2 },
  { id: "vt-3", name: "Quarterly PM Visit",     industry: "HVAC", frequencyKey: "quarterly", preferredWindow: "Each quarter", durationMin: 120, jobTypeKey: "maintenance", workOrderTemplateId: "wt-9", autoGenerate: true, active: true, order: 3 },
  { id: "vt-4", name: "Annual Roof Inspection", industry: "Roofing", frequencyKey: "annual", preferredWindow: "Spring", durationMin: 120, jobTypeKey: "inspection", workOrderTemplateId: "wt-4", autoGenerate: true, active: true, order: 4 },
  { id: "vt-5", name: "Monthly Walkthrough",    industry: "Property Maintenance", frequencyKey: "monthly", preferredWindow: "Each month", durationMin: 60, jobTypeKey: "maintenance", workOrderTemplateId: "wt-2", autoGenerate: true, active: true, order: 5 },
  { id: "vt-6", name: "On-Demand Service",      industry: "General", frequencyKey: "on_demand", preferredWindow: "As needed", durationMin: 90, jobTypeKey: "maintenance", autoGenerate: false, active: true, order: 6 },
];

const svcItem = (id: string, name: string, industry: Industry, order: number, scopeType: ServiceScopeType = "included", applies: ServiceApplies = "per_visit"): ServiceItem =>
  ({ id, name, industry, scopeType, applies, active: true, order });

const DEFAULT_SERVICE_ITEMS: ServiceItem[] = [
  svcItem("si-1", "Inspect outdoor coil", "HVAC", 1),
  svcItem("si-2", "Check refrigerant performance", "HVAC", 2),
  svcItem("si-3", "Inspect electrical components", "HVAC", 3),
  svcItem("si-4", "Clear condensate drain", "HVAC", 4),
  svcItem("si-5", "Test thermostat", "HVAC", 5),
  svcItem("si-6", "Inspect heat exchanger", "HVAC", 6),
  svcItem("si-7", "Test ignition / burners", "HVAC", 7),
  svcItem("si-8", "Replace air filter", "HVAC", 8),
  svcItem("si-9", "Coil cleaning", "HVAC", 9),
  svcItem("si-10", "Refrigerant check", "HVAC", 10),
  svcItem("si-11", "Service reporting", "HVAC", 11),
  svcItem("si-12", "Roof surface inspection", "Roofing", 12),
  svcItem("si-13", "Flashing & seal check", "Roofing", 13),
  svcItem("si-14", "Gutter cleaning", "Roofing", 14),
  svcItem("si-15", "Photo report", "General", 15),
  svcItem("si-16", "Exterior & grounds check", "Property Maintenance", 16),
  svcItem("si-17", "Seasonal prep", "Property Maintenance", 17),
  svcItem("si-18", "Repair discount", "General", 18, "discounted", "per_term"),
];

const VT_KEY = "crm-agr-visit-templates";
const SI_KEY = "crm-agr-service-items";

let _visitTemplates: VisitTemplate[] | null = null;
let _serviceItems: ServiceItem[] | null = null;

// Visit Templates (atomic)
export function getVisitTemplates(): VisitTemplate[] {
  if (!_visitTemplates) _visitTemplates = read(VT_KEY, DEFAULT_VISIT_TEMPLATES);
  return sortOrder(_visitTemplates);
}
export function saveVisitTemplates(list: VisitTemplate[]): void {
  _visitTemplates = reorder(list); write(VT_KEY, _visitTemplates);
}

// Services (atomic)
export function getServiceItems(): ServiceItem[] {
  if (!_serviceItems) _serviceItems = read(SI_KEY, DEFAULT_SERVICE_ITEMS);
  return sortOrder(_serviceItems);
}
export function saveServiceItems(list: ServiceItem[]): void {
  _serviceItems = reorder(list); write(SI_KEY, _serviceItems);
}

export { agrId, agrSlug };
