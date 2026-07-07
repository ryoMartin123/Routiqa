// ─── Leads domain — types + mock data ─────────────────────
// Maps to future DB tables: leads, lead_notes, lead_tasks
// Supabase: replace ALL_LEADS with a .select() query filtered by org/company/location.

export type LeadStage =
  | "new_lead"
  | "contacted"
  | "appointment_scheduled"
  | "estimate_needed"
  | "estimate_sent"
  | "follow_up"
  | "won"
  | "lost";

export type LeadSource =
  | "website"
  | "referral"
  | "google_lsa"
  | "google_ads"
  | "phone"
  | "social"
  | "door_knock"
  | "repeat"
  | "other";

export type LeadNoteType = "note" | "call" | "email" | "visit";

export interface Lead {
  id: string;
  companyId: string;
  locationId: string;
  serviceAreaId?: string;
  accountId?: string;       // set if lead is linked to an existing customer

  title: string;
  stage: LeadStage;
  source: LeadSource;
  estimatedValue?: string;

  assignedTo: string;
  assignedToInitials: string;

  // Customer / prospect display info
  customerName: string;
  customerInitials: string;
  customerPhone?: string;
  customerEmail?: string;
  customerAddress?: string;

  notes?: string;

  // ISO date string for sorting; displayDate for UI
  createdAt: string;
  displayDate: string;
  locationName: string;

  // Set when converted
  convertedToJobId?: string;
  convertedToProjectId?: string;
}

export interface LeadNote {
  id: string;
  leadId: string;
  date: string;
  user: string;
  userInitials: string;
  type: LeadNoteType;
  text: string;
}

export interface LeadTask {
  id: string;
  leadId: string;
  title: string;
  dueDate: string;
  assignedTo: string;
  status: "open" | "overdue" | "completed";
}

// ─── Stage config ─────────────────────────────────────────
export const LEAD_STAGE_CONFIG: Record<LeadStage, { label: string; bg: string; color: string; order: number }> = {
  new_lead:              { label: "New Lead",           bg: "#d3ebe6", color: "#0f8578", order: 1 },
  contacted:             { label: "Contacted",          bg: "#fef3c7", color: "#92400e", order: 2 },
  appointment_scheduled: { label: "Appt. Scheduled",   bg: "#dbeafe", color: "#1e40af", order: 3 },
  estimate_needed:       { label: "Estimate Needed",   bg: "#fce7f3", color: "#9d174d", order: 4 },
  estimate_sent:         { label: "Estimate Sent",     bg: "#ede9fe", color: "#5b21b6", order: 5 },
  follow_up:             { label: "Follow-Up",         bg: "#fef9c3", color: "#854d0e", order: 6 },
  won:                   { label: "Won",               bg: "#d1fae5", color: "#065f46", order: 7 },
  lost:                  { label: "Lost",              bg: "#fee2e2", color: "#991b1b", order: 8 },
};

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  website:    "Website",
  referral:   "Referral",
  google_lsa: "Google LSA",
  google_ads:  "Google Ads",
  phone:      "Phone",
  social:     "Social Media",
  door_knock: "Door Knock",
  repeat:     "Repeat Customer",
  other:      "Other",
};

// ─── Mock leads ───────────────────────────────────────────
export const ALL_LEADS: Lead[] = [];

// ─── Lead notes ───────────────────────────────────────────
export const LEAD_NOTES: Record<string, LeadNote[]> = {};

// ─── Lead tasks ───────────────────────────────────────────
export const LEAD_TASKS: Record<string, LeadTask[]> = {};

// ─── Runtime store (pre-Supabase) ─────────────────────────
// Leads created in the app persist to localStorage, mirroring the customers and
// jobs stores. Loaded lazily on first client-side access.
const LEADS_KEY = "crm-extra-leads";
let _extra: Lead[] | null = null;

function extraLeads(): Lead[] {
  if (_extra) return _extra;
  if (typeof window === "undefined") return [];
  try { const raw = localStorage.getItem(LEADS_KEY); _extra = raw ? (JSON.parse(raw) as Lead[]) : []; }
  catch { _extra = []; }
  return _extra!;
}
function persistLeads(): void {
  if (typeof window === "undefined" || !_extra) return;
  try { localStorage.setItem(LEADS_KEY, JSON.stringify(_extra)); } catch { /* ignore */ }
}

function initialsOf(name: string): string {
  const p = name.replace(/\(.*\)/, "").trim().split(/\s+/);
  return (p.length >= 2 ? p[0][0] + p[p.length - 1][0] : name.slice(0, 2)).toUpperCase();
}

// ─── Lookup helpers ───────────────────────────────────────
export function getLead(id: string): Lead | undefined {
  return ALL_LEADS.find(l => l.id === id) ?? extraLeads().find(l => l.id === id);
}

export function getAllLeads(): Lead[] {
  return [...ALL_LEADS, ...extraLeads()];
}

// ─── Create ───────────────────────────────────────────────
export interface NewLeadInput {
  companyId: string;
  locationId: string;
  locationName: string;
  serviceAreaId?: string;
  accountId?: string;            // set when the lead is tied to an existing/just-created account

  title: string;
  source: LeadSource;
  stage?: LeadStage;             // defaults to "new_lead"
  estimatedValue?: string;
  assignedTo?: string;           // defaults to "Unassigned"

  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  customerAddress?: string;

  notes?: string;
}

// Patch a lead in the runtime store (e.g. marking it converted to a project/job).
// Seed leads (ALL_LEADS) aren't patched — the prototype's seed is empty.
export function updateLead(id: string, patch: Partial<Lead>): Lead | undefined {
  let updated: Lead | undefined;
  _extra = extraLeads().map(l => {
    if (l.id !== id) return l;
    updated = { ...l, ...patch };
    return updated;
  });
  if (updated) persistLeads();
  return updated;
}

// Remove a runtime lead. Seed leads (ALL_LEADS) aren't removable here.
export function deleteLead(id: string): boolean {
  const before = extraLeads().length;
  _extra = extraLeads().filter(l => l.id !== id);
  const removed = _extra.length < before;
  if (removed) persistLeads();
  return removed;
}

export function createLead(input: NewLeadInput): Lead {
  const now = new Date();
  const assignedTo = input.assignedTo?.trim() || "Unassigned";
  const lead: Lead = {
    id: `lead-${now.getTime()}-${Math.random().toString(36).slice(2, 6)}`,
    companyId: input.companyId,
    locationId: input.locationId,
    serviceAreaId: input.serviceAreaId,
    accountId: input.accountId,
    title: input.title.trim(),
    stage: input.stage ?? "new_lead",
    source: input.source,
    estimatedValue: input.estimatedValue?.trim() || undefined,
    assignedTo,
    assignedToInitials: assignedTo === "Unassigned" ? "—" : initialsOf(assignedTo),
    customerName: input.customerName,
    customerInitials: initialsOf(input.customerName),
    customerPhone: input.customerPhone,
    customerEmail: input.customerEmail,
    customerAddress: input.customerAddress,
    notes: input.notes?.trim() || undefined,
    createdAt: now.toISOString(),
    displayDate: now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    locationName: input.locationName,
  };
  _extra = [lead, ...extraLeads()];
  persistLeads();
  return lead;
}

export function getLeadNotes(leadId: string): LeadNote[] {
  return LEAD_NOTES[leadId] ?? [];
}

export function getLeadTasks(leadId: string): LeadTask[] {
  return LEAD_TASKS[leadId] ?? [];
}

// Age in days from createdAt ISO string
export function leadAgeDays(createdAt: string): number {
  const diff = Date.now() - new Date(createdAt).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}
