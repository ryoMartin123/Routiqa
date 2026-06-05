// ─── Customer domain types + mock data ───────────────────
// Maps to future DB tables:
//   accounts, contacts, properties, equipment,
//   jobs (summary view), leads, customer_notes

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

export function getTasks(customerId: string): CustomerTask[] {
  return TASKS[customerId] ?? [];
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

// ─── Lookup helpers ───────────────────────────────────────
export function getCustomer(id: string): Customer | undefined {
  return ALL_CUSTOMERS.find((c) => c.id === id) ?? _extra.find((c) => c.id === id);
}

export function getAllCustomers(): Customer[] {
  return [...ALL_CUSTOMERS, ..._extra];
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

export function getJobs(customerId: string): CustomerJob[] {
  return JOBS[customerId] ?? [];
}

export function getLeads(customerId: string): CustomerLead[] {
  return LEADS[customerId] ?? [];
}

export function getNotes(customerId: string): CustomerNote[] {
  return NOTES[customerId] ?? [];
}
