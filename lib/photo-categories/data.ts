// Photo Categories — settings model + localStorage CRUD.
// Future: lives at the Company layer; companies start from industry defaults.
// Used by Work Order required-photo rules, Photos & Files filtering, and reports.

export type AppliesTo =
  | "Customer" | "Property" | "Lead" | "Job"
  | "Project" | "Work Order" | "Agreement" | "Equipment";

export interface PhotoCategory {
  id:                string;
  name:              string;
  key:               string;
  description:       string;
  color:             string;
  appliesTo:         AppliesTo[];
  requiredByDefault: boolean;
  active:            boolean;
  order:             number;
}

export const APPLIES_TO_OPTIONS: AppliesTo[] =
  ["Customer", "Property", "Lead", "Job", "Project", "Work Order", "Agreement", "Equipment"];

export const PHOTO_CAT_COLORS = [
  "#239c8d", "#3b82f6", "#0891b2", "#8b5cf6",
  "#f59e0b", "#ec4899", "#10b981", "#ef4444", "#6b7280",
];

// ─── Default general categories ───────────────────────────
const DEFAULTS: PhotoCategory[] = [
  { id: "pc-1",  name: "Before",            key: "before",            description: "Condition before work begins",  color: "#239c8d", appliesTo: ["Job", "Work Order"],            requiredByDefault: true,  active: true, order: 1 },
  { id: "pc-2",  name: "During",            key: "during",            description: "Work in progress",              color: "#3b82f6", appliesTo: ["Job", "Work Order"],            requiredByDefault: false, active: true, order: 2 },
  { id: "pc-3",  name: "After",             key: "after",             description: "Condition after work",           color: "#10b981", appliesTo: ["Job", "Work Order"],            requiredByDefault: true,  active: true, order: 3 },
  { id: "pc-4",  name: "Issue Found",       key: "issue_found",       description: "Problems discovered on site",    color: "#ef4444", appliesTo: ["Job", "Work Order"],            requiredByDefault: false, active: true, order: 4 },
  { id: "pc-5",  name: "Equipment Plate",   key: "equipment_plate",   description: "Nameplate / serial number",      color: "#0891b2", appliesTo: ["Equipment", "Work Order"],      requiredByDefault: true,  active: true, order: 5 },
  { id: "pc-6",  name: "Work Completed",    key: "work_completed",    description: "Finished work",                  color: "#8b5cf6", appliesTo: ["Job", "Work Order"],            requiredByDefault: true,  active: true, order: 6 },
  { id: "pc-7",  name: "Customer Approval", key: "customer_approval", description: "Customer sign-off / approval",   color: "#ec4899", appliesTo: ["Job", "Agreement"],             requiredByDefault: false, active: true, order: 7 },
  { id: "pc-8",  name: "Warranty",          key: "warranty",          description: "Warranty documentation",         color: "#f59e0b", appliesTo: ["Job", "Equipment"],             requiredByDefault: false, active: true, order: 8 },
  { id: "pc-9",  name: "Documents",         key: "documents",         description: "Permits, invoices, paperwork",   color: "#6b7280", appliesTo: ["Customer", "Job", "Project"],   requiredByDefault: false, active: true, order: 9 },
  { id: "pc-10", name: "Completion",        key: "completion",        description: "Final completion photos",        color: "#10b981", appliesTo: ["Job", "Work Order", "Project"], requiredByDefault: true,  active: true, order: 10 },
];

const STORAGE_KEY = "crm-photo-categories";
let _cats: PhotoCategory[] | null = null;

function init(): PhotoCategory[] {
  if (_cats) return _cats;
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    _cats = raw ? (JSON.parse(raw) as PhotoCategory[]) : [...DEFAULTS];
  } catch { _cats = [...DEFAULTS]; }
  return _cats;
}

export function getPhotoCategories(): PhotoCategory[] {
  return [...init()].sort((a, b) => a.order - b.order);
}
export function savePhotoCategories(list: PhotoCategory[]): void {
  const ordered = [...list].sort((a, b) => a.order - b.order).map((c, i) => ({ ...c, order: i + 1 }));
  _cats = ordered;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(ordered)); } catch { /* ignore */ }
}
export function resetPhotoCategories(): PhotoCategory[] {
  _cats = [...DEFAULTS];
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(_cats)); } catch { /* ignore */ }
  return [...DEFAULTS];
}
export function pcId(): string { return `pc-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`; }
export function pcSlug(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "").slice(0, 48);
}
