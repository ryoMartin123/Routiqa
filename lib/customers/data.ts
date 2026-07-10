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
import { notifyDataChanged, invalidateOnStorage } from "@/lib/sync/liveData";
import { getAllLeads, type LeadStage } from "@/lib/leads/data";
import { leadSourceLabel } from "@/lib/marketing/lead-sources";
import { getTasksForCustomer, type TaskType as RealTaskType } from "@/lib/tasks/data";
import { emitAutomationEvent } from "@/lib/marketing/automation-engine";

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

// Add a runtime customer AND persist it (the provider's addCustomer also persists,
// but callers outside React — e.g. the sample-data loader — need this directly).
export function addCustomerPersisted(customer: Customer): void {
  _addToStore(customer);
  try { localStorage.setItem("crm-extra-customers", JSON.stringify(_extra)); } catch { /* ignore */ }
  notifyDataChanged();
  emitAutomationEvent("customer_created", {
    subject: customer.name,
    companyId: customer.companyId, locationId: customer.locationId,
    customerId: customer.id, customerName: customer.name,
    fields: { customer_type: customer.type },
  });
}

// A persisted record is only usable if it has the string fields the list/detail
// pages read directly (name, address, etc. are called with .toLowerCase()/sort).
// Dropping malformed/legacy records here keeps one bad entry from white-screening
// the whole Customers page.
function isValidCustomer(c: unknown): c is Customer {
  return !!c && typeof c === "object"
    && typeof (c as Customer).id === "string"
    && typeof (c as Customer).name === "string";
}

export function _loadFromStorage(): void {
  try {
    const raw = localStorage.getItem("crm-extra-customers");
    if (!raw) { _extra = []; return; }
    const parsed = JSON.parse(raw);
    _extra = Array.isArray(parsed) ? parsed.filter(isValidCustomer) : [];
  } catch { _extra = []; }
  _loaded = true;
}

// Lazy-load fallback so reads work outside CustomerProvider (e.g. the mobile
// route group, which has no provider). Loads once from storage if the store is
// still empty; in the CRM the provider has already populated `_extra`, so this
// is a no-op there.
let _loaded = false;
function ensureLoaded(): void {
  if (_loaded || _extra.length || typeof window === "undefined") return;
  _loadFromStorage();
}

// Cross-tab live sync: when another tab writes customers, drop the cache so the
// next read reloads from storage.
invalidateOnStorage(["crm-extra-customers"], () => { _extra = []; _loaded = false; });

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
  ensureLoaded();
  return ALL_CUSTOMERS.find((c) => c.id === id) ?? _extra.find((c) => c.id === id);
}

export function getAllCustomers(): Customer[] {
  ensureLoaded();
  return [...ALL_CUSTOMERS, ..._extra];
}

// Seed minimal customer STUBS for accounts referenced by shared (Supabase) jobs
// but missing from THIS device's localStorage — so the mobile app can still
// resolve a job's customer (name/initials/address) even though customers aren't
// synced cross-device. Only ADDS unknown ids; never overwrites a real record.
// Mobile-only by convention (see components/mobile/MobileShell). Phone/email are
// unknown here, so Call/Text stay disabled until customers are properly synced.
export function upsertCustomerStubsFromJobs(stubs: {
  id: string; name?: string; initials?: string; address?: string;
  companyId?: string; locationId?: string; locationName?: string; serviceAreaId?: string;
}[]): number {
  ensureLoaded();
  const known = new Set([...ALL_CUSTOMERS, ..._extra].map(c => c.id));
  const additions: Customer[] = [];
  for (const s of stubs) {
    if (!s.id || known.has(s.id)) continue;
    known.add(s.id);
    additions.push({
      id: s.id, name: s.name || "Customer", initials: s.initials || "?",
      accountType: "residential", type: "Residential", status: "Customer",
      companyId: s.companyId || "", locationId: s.locationId || "", serviceAreaId: s.serviceAreaId,
      locationName: s.locationName || "",
      address: s.address || "", city: "", state: "", zip: "",
      phone: "", since: "", tags: [], notes: "",
    });
  }
  if (additions.length) {
    _extra = [..._extra, ...additions];
    try { localStorage.setItem("crm-extra-customers", JSON.stringify(_extra)); } catch { /* ignore */ }
    notifyDataChanged();
  }
  return additions.length;
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

// ─── Customer properties runtime store ────────────────────
// Properties added/edited on the customer profile persist here (localStorage)
// so an account can genuinely hold more than one — which is what lets callers
// like the job wizard offer a "which property?" picker.
const PROPERTIES_KEY = "crm-customer-properties";
let _properties: Record<string, Property[]> | null = null;
function propertiesStore(): Record<string, Property[]> {
  if (_properties) return _properties;
  if (typeof window === "undefined") return {};
  try { const raw = localStorage.getItem(PROPERTIES_KEY); _properties = raw ? JSON.parse(raw) : {}; }
  catch { _properties = {}; }
  return _properties!;
}
function persistProperties(): void {
  if (typeof window === "undefined" || !_properties) return;
  try { localStorage.setItem(PROPERTIES_KEY, JSON.stringify(_properties)); } catch { /* ignore */ }
}

export function getProperties(customerId: string): Property[] {
  // Persisted (user-managed) properties win when present.
  const stored = propertiesStore()[customerId];
  if (stored && stored.length) return stored;
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

// Replace the full property set for a customer (the profile's Properties tab
// owns the array and saves it whole). Exactly one stays primary.
export function saveProperties(customerId: string, properties: Property[]): void {
  const store = propertiesStore();
  store[customerId] = properties.map(p => ({ ...p, customerId }));
  persistProperties();
}

export function getEquipment(customerId: string): Equipment[] {
  return EQUIPMENT[customerId] ?? [];
}

// ─── Real-store → profile-display mappers ─────────────────
// The jobs module has a granular status set; collapse it onto the four
// summary statuses the profile renders.
const JOB_STATUS_MAP: Record<RealJobStatus, JobStatus> = {
  new: "Scheduled", scheduled: "Scheduled", en_route: "Scheduled",
  in_progress: "In Progress", waiting_on_parts: "In Progress", waiting_on_customer: "In Progress", waiting_on_approval: "In Progress",
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
      source: leadSourceLabel(l),
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
