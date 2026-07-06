// Work Order Templates — settings model + localStorage CRUD.
// Future: lives at the Company layer; companies start from industry defaults.
// When creating a job, the job type suggests the matching work order template.

// ─── Templates ────────────────────────────────────────────
export type WOPriority = "low" | "normal" | "high" | "urgent";

export interface WorkOrderTemplate {
  id:          string;
  name:        string;
  key:         string;
  description: string;
  jobTypeKey:  string;     // links to a Job Type (lib/job-config)
  priority:    WOPriority;
  duration:    number;     // minutes
  active:      boolean;
  order:       number;
}

export const WO_PRIORITY_LABELS: Record<WOPriority, string> = {
  low: "Low", normal: "Normal", high: "High", urgent: "Urgent",
};

// ─── Checklist items ──────────────────────────────────────
// No "checkbox" type — a step with NO type is a simple check-off (the circle
// on the step itself); Multi Select covers picking among options.
export type ChecklistItemType =
  | "short_text" | "long_text" | "number"
  | "dropdown" | "multi_select" | "photo" | "signature" | "datetime";

export interface ChecklistItem {
  id:         string;
  templateId: string;
  label:      string;
  type?:      ChecklistItemType;   // undefined = simple check-off step
  required:   boolean;
  order:      number;
  active:     boolean;
  options?:   string[];    // for dropdown / multi_select — the choices the tech picks from
  unit?:      string;      // for number — e.g. "PSI", "°F"
  photoIds?:  string[];    // RequiredPhoto ids this step requires (drawn as links on the canvas)
}

export const CHECKLIST_TYPE_LABELS: Record<ChecklistItemType, string> = {
  short_text: "Short Text", long_text: "Long Text",
  number: "Number", dropdown: "Dropdown", multi_select: "Multi Select",
  photo: "Photo Required", signature: "Signature", datetime: "Date / Time",
};
// Display label that tolerates untyped (check-off) steps.
export const checklistTypeLabel = (t?: ChecklistItemType) => t ? CHECKLIST_TYPE_LABELS[t] : "Check-off";

// ─── Required photos ──────────────────────────────────────
export interface RequiredPhoto {
  id:         string;
  templateId: string;
  category:   string;
  required:   boolean;
  minCount:   number;
  notes:      string;
}

export const PHOTO_CATEGORIES = [
  "Before", "Issue Found", "Equipment Plate", "Work In Progress",
  "After", "Completion", "Customer Approval", "Warranty",
];

// ─── Instructions (one record per template) ───────────────
export interface WOInstructions {
  templateId:     string;
  internal:       string;
  customerFacing: string;
  safety:         string;
  access:         string;
  materials:      string;
  completion:     string;
}

// ─── Default templates ────────────────────────────────────
const DEFAULT_TEMPLATES: WorkOrderTemplate[] = [
  { id: "wt-1", name: "General Service Call",      key: "general_service_call", description: "Standard service visit instructions", jobTypeKey: "service_call",   priority: "normal", duration: 60,  active: true, order: 1 },
  { id: "wt-2", name: "Maintenance Visit",         key: "maintenance_visit",    description: "Routine maintenance checklist",       jobTypeKey: "maintenance_visit",priority: "normal", duration: 90,  active: true, order: 2 },
  { id: "wt-3", name: "Installation",              key: "installation",         description: "New equipment install & startup",     jobTypeKey: "installation",   priority: "high",   duration: 240, active: true, order: 3 },
  { id: "wt-4", name: "Inspection",                key: "inspection",           description: "Site or equipment inspection",        jobTypeKey: "inspection",     priority: "normal", duration: 60,  active: true, order: 4 },
  { id: "wt-5", name: "Estimate / Consultation",   key: "estimate",             description: "On-site estimate workflow",           jobTypeKey: "estimate",       priority: "normal", duration: 45,  active: true, order: 5 },
  { id: "wt-6", name: "Callback",                  key: "callback",             description: "Return visit on prior work",          jobTypeKey: "callback",       priority: "high",   duration: 60,  active: true, order: 6 },
  { id: "wt-7", name: "Warranty Visit",            key: "warranty_visit",       description: "Warranty-covered work",               jobTypeKey: "warranty",       priority: "normal", duration: 90,  active: true, order: 7 },
  { id: "wt-8", name: "Emergency Call",            key: "emergency_call",       description: "Urgent dispatch instructions",        jobTypeKey: "emergency",      priority: "urgent", duration: 120, active: true, order: 8 },
  { id: "wt-9", name: "Commercial PM",             key: "commercial_pm",        description: "Commercial preventive maintenance",   jobTypeKey: "commercial_pm",  priority: "normal", duration: 180, active: true, order: 9 },
];

// Seed checklist items for the Maintenance Visit template (wt-2)
const DEFAULT_CHECKLIST: ChecklistItem[] = [
  { id: "ci-1", templateId: "wt-2", label: "Arrival / Site Verification", required: true,  order: 1, active: true },
  { id: "ci-2", templateId: "wt-2", label: "Diagnosis / Inspection",      type: "long_text", required: true,  order: 2, active: true },
  { id: "ci-3", templateId: "wt-2", label: "Safety Check",                required: true,  order: 3, active: true },
  { id: "ci-4", templateId: "wt-2", label: "Work Completed",              required: true,  order: 4, active: true },
  { id: "ci-5", templateId: "wt-2", label: "Customer Review",             type: "signature", required: false, order: 5, active: true },
  { id: "ci-6", templateId: "wt-2", label: "Cleanup",                     required: true,  order: 6, active: true },
  { id: "ci-7", templateId: "wt-2", label: "Final Photos",                type: "photo",     required: true,  order: 7, active: true },
  { id: "ci-8", templateId: "wt-2", label: "Completion Notes",            type: "long_text", required: false, order: 8, active: true },
];

// Seed required photos for the Maintenance Visit template (wt-2)
const DEFAULT_PHOTOS: RequiredPhoto[] = [
  { id: "rp-1", templateId: "wt-2", category: "Equipment Plate",    required: true,  minCount: 1, notes: "Capture the nameplate / serial number." },
  { id: "rp-2", templateId: "wt-2", category: "Before",             required: true,  minCount: 1, notes: "" },
  { id: "rp-3", templateId: "wt-2", category: "After",              required: false, minCount: 1, notes: "" },
  { id: "rp-4", templateId: "wt-2", category: "Completion",         required: true,  minCount: 1, notes: "" },
];

// ─── Storage ──────────────────────────────────────────────
const T_KEY = "crm-wo-templates";
const C_KEY = "crm-wo-checklists";
const P_KEY = "crm-wo-photos";
const I_KEY = "crm-wo-instructions";
const L_KEY = "crm-wo-layouts";

// ─── Canvas layout (lane positions) per template ──────────
export interface TemplateLayout { workflow: { x: number; y: number }; photos: { x: number; y: number } }
let _layouts: Record<string, TemplateLayout> | null = null;
function loadLayouts(): Record<string, TemplateLayout> {
  if (_layouts) return _layouts;
  if (typeof window === "undefined") return (_layouts = {});
  try { const raw = localStorage.getItem(L_KEY); _layouts = raw ? JSON.parse(raw) : {}; }
  catch { _layouts = {}; }
  return _layouts!;
}
export function getLayout(templateId: string): TemplateLayout | undefined { return loadLayouts()[templateId]; }
export function saveLayout(templateId: string, layout: TemplateLayout): void {
  const all = loadLayouts(); all[templateId] = layout;
  try { localStorage.setItem(L_KEY, JSON.stringify(all)); } catch { /* ignore */ }
}

function read<T>(key: string, fallback: T[]): T[] {
  if (typeof window === "undefined") return fallback;
  try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T[]) : [...fallback]; }
  catch { return [...fallback]; }
}
function write<T>(key: string, value: T[]): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

let _templates: WorkOrderTemplate[] | null = null;
let _checklist: ChecklistItem[] | null = null;
let _photos: RequiredPhoto[] | null = null;
let _instructions: WOInstructions[] | null = null;

// Legacy template job-type keys → real job-config keys. Early seeds linked
// templates with a keyspace ("service_call", "maintenance_visit", …) that never
// existed in lib/job-config, so those links resolved to nothing (the builder
// showed "None" and job-type matching fell through to a blind fallback).
// Migrated transparently on read.
const LEGACY_JOBKEY: Record<string, string> = {
  service_call: "repair", maintenance_visit: "agreement_visit",
  callback: "repair", commercial_pm: "agreement_visit", warranty_visit: "warranty",
};

// Templates
export function getTemplates(): WorkOrderTemplate[] {
  if (!_templates) _templates = read(T_KEY, DEFAULT_TEMPLATES);
  return [..._templates]
    .map(t => LEGACY_JOBKEY[t.jobTypeKey] ? { ...t, jobTypeKey: LEGACY_JOBKEY[t.jobTypeKey] } : t)
    .sort((a, b) => a.order - b.order);
}
export function saveTemplates(list: WorkOrderTemplate[]): void {
  const ordered = [...list].sort((a, b) => a.order - b.order).map((t, i) => ({ ...t, order: i + 1 }));
  _templates = ordered; write(T_KEY, ordered);
}

// Checklist items (per template)
export function getChecklist(templateId: string): ChecklistItem[] {
  if (!_checklist) _checklist = read(C_KEY, DEFAULT_CHECKLIST);
  return _checklist
    .filter(c => c.templateId === templateId)
    // Legacy "checkbox" steps read back as plain check-offs.
    .map(c => ((c.type as string) === "checkbox" ? { ...c, type: undefined } : c))
    .sort((a, b) => a.order - b.order);
}
export function saveChecklist(templateId: string, items: ChecklistItem[]): void {
  if (!_checklist) _checklist = read(C_KEY, DEFAULT_CHECKLIST);
  const others = _checklist.filter(c => c.templateId !== templateId);
  const ordered = [...items].sort((a, b) => a.order - b.order).map((c, i) => ({ ...c, order: i + 1 }));
  _checklist = [...others, ...ordered]; write(C_KEY, _checklist);
}

// Required photos (per template)
export function getPhotos(templateId: string): RequiredPhoto[] {
  if (!_photos) _photos = read(P_KEY, DEFAULT_PHOTOS);
  return _photos.filter(p => p.templateId === templateId);
}
export function savePhotos(templateId: string, items: RequiredPhoto[]): void {
  if (!_photos) _photos = read(P_KEY, DEFAULT_PHOTOS);
  const others = _photos.filter(p => p.templateId !== templateId);
  _photos = [...others, ...items]; write(P_KEY, _photos);
}

// Instructions (per template)
export function getInstructions(templateId: string): WOInstructions {
  if (!_instructions) _instructions = read(I_KEY, []);
  return _instructions.find(i => i.templateId === templateId) ?? {
    templateId, internal: "", customerFacing: "", safety: "", access: "", materials: "", completion: "",
  };
}
export function saveInstructions(rec: WOInstructions): void {
  if (!_instructions) _instructions = read(I_KEY, []);
  const others = _instructions.filter(i => i.templateId !== rec.templateId);
  _instructions = [...others, rec]; write(I_KEY, _instructions);
}

// ─── Helpers ──────────────────────────────────────────────
export function woId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
}
export function woSlug(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "").slice(0, 48);
}

// Job.type values ARE job-config keys, with two legacy aliases still carried by
// old records. (Templates link via the same keyspace since the LEGACY_JOBKEY
// migration above.)
const TYPE_ALIAS: Record<string, string> = {
  maintenance: "agreement_visit",   // legacy JobType, no longer configurable
  replacement: "installation",      // no dedicated template — installs cover it
};

// Suggests the work order template for a given job type: the template LINKED to
// that exact job type first, else the general service-call template. Never a
// blind "first template" fallback — a Service job must not silently pick up a
// Maintenance template just because it sorts first.
export function suggestTemplateForJobType(jobType: string): WorkOrderTemplate | undefined {
  const key = TYPE_ALIAS[jobType] ?? jobType;
  const active = getTemplates().filter(t => t.active);
  return active.find(t => t.jobTypeKey === key)
      ?? active.find(t => t.key === "general_service_call");
}

// Every active template LINKED to this job type (a type can have several
// variants — the picker shows these first and tucks the rest away).
export function templatesForJobType(jobType: string): WorkOrderTemplate[] {
  const key = TYPE_ALIAS[jobType] ?? jobType;
  return getTemplates().filter(t => t.active && t.jobTypeKey === key);
}
