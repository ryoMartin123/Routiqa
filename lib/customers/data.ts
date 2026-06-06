// ─── Customer domain types + mock data ───────────────────
// Maps to future DB tables:
//   accounts, contacts, properties, equipment,
//   jobs (summary view), leads, customer_notes
//
// Jobs, leads, and tasks live in their own module stores (lib/jobs,
// lib/leads, lib/tasks) keyed by accountId. The getters below read from
// those real stores and map them onto the customer-profile display types,
// so a job created anywhere shows on its account.

import { getAllJobs, type JobStatus as RealJobStatus, type JobType as RealJobType } from "@/lib/jobs/data";
import { getAllLeads, LEAD_SOURCE_LABELS, type LeadStage } from "@/lib/leads/data";
import { getTasksForCustomer, type TaskType as RealTaskType } from "@/lib/tasks/data";

// ─── Types ────────────────────────────────────────────────
export type AccountType    = "residential" | "commercial" | "property_management" | "multi_site" | "other";
export type CustomerType   = "Residential" | "Commercial";   // display label, derived from accountType
export type CustomerStatus = "Customer" | "Prospect";
export type PropertyType   = "Residential" | "Commercial" | "Industrial" | "Multi-Family";
export type JobStatus      = "Scheduled" | "In Progress" | "Completed" | "Canceled";
export type LeadStatus     = "New" | "Contacted" | "Quoted" | "Won" | "Lost";
export type NoteType       = "note" | "call" | "email" | "visit";
export type EquipmentStatus = "operational" | "needs_service" | "retired";
export type TaskStatus     = "open" | "overdue" | "completed";
export type TaskType       = "follow_up" | "call" | "schedule" | "send_estimate" | "send_agreement" | "other";

export interface Customer {
  id: string;
  name: string;
  initials: string;
  accountType: AccountType;
  type: CustomerType;         // Residential | Commercial (display)
  status: CustomerStatus;
  parentAccountId?: string;   // for sub-accounts under property management parents
  // Hierarchy
  companyId: string;
  locationId: string;
  serviceAreaId?: string;
  locationName: string;
  // Contact
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  email?: string;
  since: string;
  tags: string[];
  notes: string;
}

export interface Contact {
  id: string;
  customerId: string;
  name: string;
  role?: string;             // e.g. "Homeowner", "Property Manager", "Owner"
  phone?: string;
  email?: string;
  preferredContact?: "phone" | "email" | "text";
  isPrimary: boolean;
  notes?: string;
}

export interface Property {
  id: string;
  customerId: string;
  label?: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  type: PropertyType;
  sqft?: number;
  yearBuilt?: number;
  accessNotes?: string;
  serviceAreaId?: string;
  status?: "active" | "inactive";
  isPrimary: boolean;
}

export interface Equipment {
  id: string;
  customerId: string;
  propertyId?: string;
  name: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  installDate?: string;
  lastServiceDate?: string;
  status: EquipmentStatus;
  notes?: string;
}

export interface CustomerJob {
  id: string;
  customerId: string;
  title: string;
  type: string;
  status: JobStatus;
  date: string;
  tech: string;
  amount?: string;
}

export interface CustomerLead {
  id: string;
  customerId: string;
  title: string;
  status: LeadStatus;
  date: string;
  value?: string;
  source?: string;
}

export interface CustomerNote {
  id: string;
  customerId: string;
  date: string;
  user: string;
  userInitials: string;
  text: string;
  type: NoteType;
}

// ─── Customer list ────────────────────────────────────────
export const ALL_CUSTOMERS: Customer[] = [];

// ─── Contacts ─────────────────────────────────────────────
export const CONTACTS: Record<string, Contact[]> = {};

// ─── Properties ───────────────────────────────────────────
export const PROPERTIES: Record<string, Property[]> = {};

// ─── Equipment ────────────────────────────────────────────
export const EQUIPMENT: Record<string, Equipment[]> = {};

// ─── Jobs ─────────────────────────────────────────────────
export const JOBS: Record<string, CustomerJob[]> = {};

// ─── Leads ────────────────────────────────────────────────
export const LEADS: Record<string, CustomerLead[]> = {};

// ─── Notes ────────────────────────────────────────────────
export const NOTES: Record<string, CustomerNote[]> = {};

// ─── Tasks ────────────────────────────────────────────────
export interface CustomerTask {
  id: string;
  customerId: string;
  title: string;
  type: TaskType;
  dueDate: string;
  assignedTo?: string;
  status: TaskStatus;
  notes?: string;
}

export const TASKS: Record<string, CustomerTask[]> = {};

// Profile TaskType is a subset; map unknown real types onto "other".
const PROFILE_TASK_TYPES: TaskType[] = ["follow_up", "call", "schedule", "send_estimate", "send_agreement", "other"];
function mapTaskType(t: RealTaskType): TaskType {
  return PROFILE_TASK_TYPES.includes(t as TaskType) ? (t as TaskType) : "other";
}

export function getTasks(customerId: string): CustomerTask[] {
  const seeded = TASKS[customerId];
  if (seeded) return seeded;
  return getTasksForCustomer(customerId).map(t => ({
    id: t.id,
    customerId,
    title: t.title,
    type: mapTaskType(t.type),
    dueDate: t.dueDate,
    assignedTo: t.assignedTo,
    status: t.status,
    notes: t.notes,
  }));
}

// ─── Runtime store (pre-Supabase) ────────────────────────
// Newly created customers are pushed here so getCustomer() and
// the detail page can find them without a full page reload.
// CustomerProvider also mirrors this into React state for the list page.
let _extra: Customer[] = [];

export function _addToStore(customer: Customer): void {
  _extra = [..._extra, customer];
}

export function _loadFromStorage(): void {
  try {
    const raw = localStorage.getItem("crm-extra-customers");
    if (raw) _extra = JSON.parse(raw) as Customer[];
  } catch { /* ignore */ }
}

// Patch a runtime customer (e.g. saving a service address captured at job time).
// Seed customers aren't patched here (the prototype's seed is empty post-clear).
export function updateCustomer(id: string, patch: Partial<Customer>): Customer | undefined {
  let updated: Customer | undefined;
  _extra = _extra.map(c => {
    if (c.id !== id) return c;
    updated = { ...c, ...patch };
    return updated;
  });
  if (updated) {
    try { localStorage.setItem("crm-extra-customers", JSON.stringify(_extra)); } catch { /* ignore */ }
  }
  return updated ?? getCustomer(id);
}

// Remove a runtime customer from the store.
// Seed customers (ALL_CUSTOMERS) are not removable here; the prototype's
// seed is empty post-clear, so every account lives in _extra.
export function deleteCustomer(id: string): boolean {
  const before = _extra.length;
  _extra = _extra.filter(c => c.id !== id);
  const removed = _extra.length < before;
  if (removed) {
    try { localStorage.setItem("crm-extra-customers", JSON.stringify(_extra)); } catch { /* ignore */ }
  }
  return removed;
}

// ─── Lookup helpers ───────────────────────────────────────
export function getCustomer(id: string): Customer | undefined {
  return ALL_CUSTOMERS.find((c) => c.id === id) ?? _extra.find((c) => c.id === id);
}

export function getAllCustomers(): Customer[] {
  return [...ALL_CUSTOMERS, ..._extra];
}

// ─── By-company helpers (hierarchy cascade) ───────────────
export function getCustomersByCompany(companyId: string): Customer[] {
  return getAllCustomers().filter(c => c.companyId === companyId);
}
// Deletes every customer under a company; returns the deleted ids so callers
// can cascade dependent records (e.g. agreements keyed by customerId).
export function deleteCustomersByCompany(companyId: string): string[] {
  const ids = getCustomersByCompany(companyId).map(c => c.id);
  ids.forEach(id => deleteCustomer(id));
  return ids;
}

export function getContacts(customerId: string): Contact[] {
  return CONTACTS[customerId] ?? [{
    id: `c${customerId}-auto`,
    customerId,
    name: getCustomer(customerId)?.name ?? "Primary Contact",
    role: getCustomer(customerId)?.type === "Commercial" ? "Primary Contact" : "Homeowner",
    phone: getCustomer(customerId)?.phone,
    email: getCustomer(customerId)?.email,
    isPrimary: true,
  }];
}

export function getProperties(customerId: string): Property[] {
  if (PROPERTIES[customerId]) return PROPERTIES[customerId];
  const c = getCustomer(customerId);
  if (!c) return [];
  return [{
    id: `p${customerId}-auto`,
    customerId,
    label: "Primary Address",
    address: c.address, city: c.city, state: c.state, zip: c.zip,
    type: c.type === "Commercial" ? "Commercial" : "Residential",
    isPrimary: true,
  }];
}

export function getEquipment(customerId: string): Equipment[] {
  return EQUIPMENT[customerId] ?? [];
}

// ─── Real-store → profile-display mappers ─────────────────
// The jobs module has a granular status set; collapse it onto the four
// summary statuses the profile renders.
const JOB_STATUS_MAP: Record<RealJobStatus, JobStatus> = {
  new: "Scheduled", scheduled: "Scheduled", en_route: "Scheduled",
  in_progress: "In Progress", waiting_on_parts: "In Progress", waiting_on_customer: "In Progress",
  completed: "Completed", invoiced: "Completed", closed: "Completed",
  canceled: "Canceled", no_show: "Canceled",
};
function titleCase(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

export function getJobs(customerId: string): CustomerJob[] {
  const seeded = JOBS[customerId];
  if (seeded) return seeded;
  return getAllJobs()
    .filter(j => j.accountId === customerId)
    .map(j => ({
      id: j.id,
      customerId,
      title: j.title,
      type: titleCase(j.type as RealJobType),
      status: JOB_STATUS_MAP[j.status] ?? "Scheduled",
      date: j.scheduledDate || "Unscheduled",
      tech: j.assignedTo || "Unassigned",
      amount: j.actualAmount ?? j.estimatedAmount,
    }));
}

// Lead pipeline stage → profile summary status.
const LEAD_STAGE_MAP: Record<LeadStage, LeadStatus> = {
  new_lead: "New",
  contacted: "Contacted", appointment_scheduled: "Contacted", follow_up: "Contacted",
  estimate_needed: "Quoted", estimate_sent: "Quoted",
  won: "Won", lost: "Lost",
};

export function getLeads(customerId: string): CustomerLead[] {
  const seeded = LEADS[customerId];
  if (seeded) return seeded;
  return getAllLeads()
    .filter(l => l.accountId === customerId)
    .map(l => ({
      id: l.id,
      customerId,
      title: l.title,
      status: LEAD_STAGE_MAP[l.stage] ?? "New",
      date: l.displayDate,
      value: l.estimatedValue,
      source: LEAD_SOURCE_LABELS[l.source],
    }));
}

// ─── Customer notes runtime store ─────────────────────────
const NOTES_KEY = "crm-customer-notes";
let _notes: Record<string, CustomerNote[]> | null = null;
function notesStore(): Record<string, CustomerNote[]> {
  if (_notes) return _notes;
  if (typeof window === "undefined") return {};
  try { const raw = localStorage.getItem(NOTES_KEY); _notes = raw ? JSON.parse(raw) : {}; }
  catch { _notes = {}; }
  return _notes!;
}

export function getNotes(customerId: string): CustomerNote[] {
  const seeded = NOTES[customerId] ?? [];
  const runtime = notesStore()[customerId] ?? [];
  return [...runtime, ...seeded];
}

export function addNote(
  customerId: string,
  text: string,
  type: NoteType = "note",
  user = "You",
): CustomerNote {
  const note: CustomerNote = {
    id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    customerId,
    date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    user,
    userInitials: user.split(" ").map(w => w[0] ?? "").join("").slice(0, 2).toUpperCase() || "Y",
    text,
    type,
  };
  const store = { ...notesStore() };
  store[customerId] = [note, ...(store[customerId] ?? [])];
  _notes = store;
  try { localStorage.setItem(NOTES_KEY, JSON.stringify(store)); } catch { /* ignore */ }
  return note;
}
