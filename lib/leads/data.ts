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
  new_lead:              { label: "New Lead",           bg: "#e0e7ff", color: "#4f46e5", order: 1 },
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

// ─── Lookup helpers ───────────────────────────────────────
const LEADS_MAP: Record<string, Lead> = Object.fromEntries(ALL_LEADS.map(l => [l.id, l]));

export function getLead(id: string): Lead | undefined {
  return LEADS_MAP[id];
}

export function getAllLeads(): Lead[] {
  return ALL_LEADS;
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
