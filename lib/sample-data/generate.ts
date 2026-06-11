// ─── Sample data — generators ────────────────────────────
// Builds realistic records through the SAME create APIs the app's wizards use,
// so generated data is indistinguishable from hand-entered data. Each generator
// returns the created entity (when a child may need it as a parent) plus a
// manifest entry describing what was made and what it depends on.

import { addCustomerPersisted, saveProperties, getProperties, type Customer, type AccountType, type CustomerType, type Property } from "@/lib/customers/data";
import { createJob, createWorkOrder, updateJob, type JobType, type Job } from "@/lib/jobs/data";
import { createProject, type Project } from "@/lib/projects/data";
import { createQuote, createInvoice, type LineItem } from "@/lib/quotes/data";
import { createLead, type LeadSource } from "@/lib/leads/data";
import { createTask } from "@/lib/tasks/data";
import { createAgreement, type AgreementVisit } from "@/lib/agreements/data";
import { manifestKey } from "./manifest";
import type { SampleEntry, SampleType } from "./types";

export interface GenCtx {
  companyId:    string;
  locationId:   string;
  locationName: string;
  serviceAreaId?: string;
}

// ─── Pools ────────────────────────────────────────────────
const FIRST = ["James", "Maria", "David", "Sarah", "Robert", "Linda", "Michael", "Patricia", "Carlos", "Emily", "Tyler", "Aisha", "Nathan", "Grace", "Devin"];
const LAST  = ["Carter", "Nguyen", "Patel", "Johnson", "Reyes", "Brooks", "Foster", "Ramirez", "Coleman", "Bishop", "Hayes", "Whitfield", "Salinas", "Okonkwo", "Bauer"];
const BIZ   = ["Riverside Dental", "Summit Logistics", "Maple Grove Apartments", "Atlas Manufacturing", "Bluewater Cafe", "Pioneer Storage", "Cedar Ridge HOA", "Harbor Freight Depot", "Greenfield Schools", "Magnolia Medical", "Iron Gate Brewing", "Lakeside Resort"];
const STREETS = ["Telfair St", "Central Ave", "Greene St", "Walton Way", "Broad St", "Wrightsboro Rd", "Washington Rd", "Riverwatch Pkwy", "Davis Rd", "Belair Rd", "Gordon Hwy", "Pleasant Home Rd"];
const PLACES = [
  { city: "Augusta", state: "GA", zip: "30901" },
  { city: "Evans", state: "GA", zip: "30809" },
  { city: "Martinez", state: "GA", zip: "30907" },
  { city: "Grovetown", state: "GA", zip: "30813" },
  { city: "North Augusta", state: "SC", zip: "29841" },
  { city: "Aiken", state: "SC", zip: "29801" },
];
const TECHS = ["Marcus Reyes", "Dana Whitfield", "Luis Romero", "Priya Shah", "Owen Bauer"];

const JOB_TYPES: JobType[] = ["maintenance", "repair", "installation", "inspection", "emergency", "estimate", "warranty", "replacement"];
const JOB_TITLES: Record<string, string[]> = {
  maintenance:  ["AC Tune-Up", "Seasonal HVAC Service", "Filter & Coil Cleaning"],
  repair:       ["Compressor Repair", "Thermostat Replacement", "Refrigerant Leak Fix"],
  installation: ["New System Install", "Ductwork Installation", "Mini-Split Install"],
  inspection:   ["Annual Safety Inspection", "Pre-Sale HVAC Inspection", "Quarterly Check"],
  emergency:    ["No-Cool Emergency", "After-Hours Furnace Out", "Water Leak Response"],
  estimate:     ["Replacement Estimate", "System Upgrade Walkthrough", "On-Site Consult"],
  warranty:     ["Warranty Coil Replacement", "Warranty Compressor Claim", "Parts Warranty Visit"],
  replacement:  ["Rooftop Unit Replacement", "Furnace Replacement", "Condenser Swap"],
};
const LEAD_SOURCES: LeadSource[] = ["website", "referral", "google_lsa", "google_ads", "phone", "social", "repeat"];
const LEAD_TITLES = ["New AC system inquiry", "Furnace not heating", "Requesting maintenance plan", "Bathroom remodel estimate", "Commercial rooftop quote", "Heat pump replacement", "Annual service signup"];
const PROJECT_NAMES = ["Whole-Home Comfort Upgrade", "Office Retrofit", "Multi-Unit HVAC Replacement", "New Construction Mechanical", "Energy Efficiency Project", "Rooftop Replacement Program"];
const TASK_TITLES = ["Follow up on estimate", "Call to confirm appointment", "Send maintenance reminder", "Request Google review", "Schedule seasonal tune-up", "Check on open proposal"];
const TASK_TYPES = ["follow_up", "call", "schedule", "send_estimate", "review", "inspection"];

const ITEM_SETS: { description: string; unitPrice: number; qty?: number }[][] = [
  [{ description: "High-efficiency furnace (80k BTU)", unitPrice: 3200 }, { description: "Installation & haul-away", unitPrice: 950 }],
  [{ description: "2.5-ton AC condenser", unitPrice: 2450 }, { description: "Evaporator coil", unitPrice: 780 }, { description: "Labor", unitPrice: 600 }],
  [{ description: "Annual maintenance visit", unitPrice: 189, qty: 2 }],
  [{ description: "Ductless mini-split (single zone)", unitPrice: 2890 }, { description: "Line set & mounting", unitPrice: 420 }],
  [{ description: "Smart thermostat", unitPrice: 240 }, { description: "Install & setup", unitPrice: 120 }],
];

// ─── Helpers ──────────────────────────────────────────────
let _vary = 0;
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function rid(): string { return `${Date.now().toString(36)}-${(_vary++).toString(36)}-${Math.random().toString(36).slice(2, 5)}`; }
function initials(name: string): string {
  const w = name.trim().split(/\s+/);
  return (w.length >= 2 ? w[0][0] + w[w.length - 1][0] : name.slice(0, 2)).toUpperCase();
}
function phone(): string { return `(706) 555-0${Math.floor(100 + Math.random() * 900)}`; }
// "Mon D, YYYY" offset by `days` from today (negative = past).
function dateOffset(days: number): string {
  const d = new Date(); d.setDate(d.getDate() + days);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function time(): string { return pick(["8:00 AM", "9:30 AM", "11:00 AM", "1:00 PM", "2:30 PM", "4:00 PM"]); }
function money(n: number): string { return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function lineItems(): LineItem[] {
  return pick(ITEM_SETS).map((it, i) => {
    const qty = it.qty ?? 1;
    return { id: `li-${rid()}-${i}`, description: it.description, quantity: qty, unitPrice: it.unitPrice, total: qty * it.unitPrice };
  });
}
function entry(type: SampleType, id: string, parentIds: string[] = [], ref?: string): SampleEntry {
  return { key: manifestKey(), type, id, parentIds, ref };
}

const COMMERCIAL: AccountType[] = ["commercial", "property_management", "multi_site"];

// ─── Generators ───────────────────────────────────────────
export function genCustomer(ctx: GenCtx): { record: Customer; entry: SampleEntry } {
  const commercial = Math.random() < 0.4;
  const accountType: AccountType = commercial ? pick(COMMERCIAL) : "residential";
  const name = commercial ? pick(BIZ) : `${pick(FIRST)} ${pick(LAST)}`;
  const place = pick(PLACES);
  const type: CustomerType = COMMERCIAL.includes(accountType) ? "Commercial" : "Residential";
  const customer: Customer = {
    id: `cust-${Date.now()}-${rid()}`,
    name, initials: initials(name), accountType, type,
    status: Math.random() < 0.75 ? "Customer" : "Prospect",
    companyId: ctx.companyId, locationId: ctx.locationId, locationName: ctx.locationName, serviceAreaId: ctx.serviceAreaId,
    address: `${Math.floor(100 + Math.random() * 9000)} ${pick(STREETS)}`,
    city: place.city, state: place.state, zip: place.zip,
    phone: phone(), email: `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@example.com`,
    since: new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" }),
    tags: [], notes: "",
  };
  addCustomerPersisted(customer);

  // Commercial accounts get a couple of properties so the property picker has data.
  if (commercial) {
    const props: Property[] = [0, 1].map(i => ({
      id: `p-${rid()}-${i}`, customerId: customer.id,
      label: i === 0 ? "Main Building" : "Annex",
      address: customer.address, city: customer.city, state: customer.state, zip: customer.zip,
      type: "Commercial", status: "active", isPrimary: i === 0,
    }));
    saveProperties(customer.id, props);
  }
  return { record: customer, entry: entry("customer", customer.id) };
}

export function genLead(ctx: GenCtx): { entry: SampleEntry } {
  const name = Math.random() < 0.5 ? `${pick(FIRST)} ${pick(LAST)}` : pick(BIZ);
  const place = pick(PLACES);
  const lead = createLead({
    companyId: ctx.companyId, locationId: ctx.locationId, locationName: ctx.locationName, serviceAreaId: ctx.serviceAreaId,
    title: pick(LEAD_TITLES), source: pick(LEAD_SOURCES),
    estimatedValue: money(Math.floor(800 + Math.random() * 12000)),
    assignedTo: Math.random() < 0.7 ? pick(TECHS) : undefined,
    customerName: name, customerPhone: phone(),
    customerEmail: `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@example.com`,
    customerAddress: `${Math.floor(100 + Math.random() * 9000)} ${pick(STREETS)}, ${place.city}, ${place.state} ${place.zip}`,
  });
  return { entry: entry("lead", lead.id) };
}

export function genProject(ctx: GenCtx, customer: Customer): { record: Project; entry: SampleEntry } {
  const project = createProject({
    companyId: ctx.companyId, locationId: ctx.locationId, serviceAreaId: ctx.serviceAreaId,
    accountId: customer.id, customerName: customer.name, customerInitials: customer.initials, locationName: ctx.locationName,
    name: pick(PROJECT_NAMES), type: "installation",
    estimatedValue: money(Math.floor(8000 + Math.random() * 40000)),
    propertyAddress: `${customer.address}, ${customer.city}, ${customer.state} ${customer.zip}`,
    assignedTo: pick(TECHS),
  });
  return { record: project, entry: entry("project", project.id, [customer.id]) };
}

export function genJob(ctx: GenCtx, customer: Customer, project?: Project): { record: Job; entry: SampleEntry } {
  const type = pick(JOB_TYPES);
  const scheduled = Math.random() < 0.8;
  const job = createJob({
    companyId: ctx.companyId, locationId: ctx.locationId, serviceAreaId: ctx.serviceAreaId,
    accountId: customer.id, customerName: customer.name, customerInitials: customer.initials, locationName: ctx.locationName,
    propertyAddress: `${customer.address}, ${customer.city}, ${customer.state} ${customer.zip}`,
    title: pick(JOB_TITLES[type]), type, priority: Math.random() < 0.15 ? "high" : "normal",
    estimatedAmount: money(Math.floor(150 + Math.random() * 6000)),
    assignedTo: pick(TECHS), assignedToInitials: undefined,
    scheduledDate: scheduled ? dateOffset(Math.floor(-10 + Math.random() * 30)) : undefined,
    scheduledTime: scheduled ? time() : undefined,
    projectId: project?.id,
  });
  // Spread across realistic statuses so the Jobs board/tabs have variety.
  const roll = Math.random();
  if (scheduled && roll < 0.25)      updateJob(job.id, { status: "completed", completedDate: dateOffset(-Math.floor(1 + Math.random() * 8)) });
  else if (scheduled && roll < 0.4)  updateJob(job.id, { status: "in_progress" });
  const parents = [customer.id]; if (project) parents.push(project.id);
  return { record: { ...job }, entry: entry("job", job.id, parents) };
}

export function genWorkOrder(job: Job): { entry: SampleEntry } {
  const wo = createWorkOrder({
    jobId: job.id, title: `${job.title} — Work Order`,
    instructions: "Confirm scope with customer on arrival. Photograph before and after.",
    checklist: ["Confirm equipment & model", "Complete service tasks", "Test system operation", "Review with customer", "Capture photos"],
  });
  // id = wo.id (unique); ref = jobId is the store key used to delete it.
  return { entry: entry("workorder", wo.id, [job.id], job.id) };
}

export function genQuote(ctx: GenCtx, customer: Customer): { entry: SampleEntry } {
  const q = createQuote({
    customerId: customer.id, customerName: customer.name, customerInitials: customer.initials, locationName: ctx.locationName,
    companyId: ctx.companyId, locationId: ctx.locationId, serviceAreaId: ctx.serviceAreaId,
    title: `${pick(["Replacement", "Repair", "Upgrade", "Service"])} Estimate`,
    lineItems: lineItems(), taxRate: 0.07,
    markSent: Math.random() < 0.5,
  });
  return { entry: entry("quote", q.id, [customer.id]) };
}

export function genInvoice(ctx: GenCtx, customer: Customer, job?: Job): { entry: SampleEntry } {
  const inv = createInvoice({
    customerId: customer.id, customerName: customer.name, customerInitials: customer.initials, locationName: ctx.locationName,
    companyId: ctx.companyId, locationId: ctx.locationId, serviceAreaId: ctx.serviceAreaId,
    title: job ? job.title : `${pick(["Service", "Installation", "Repair"])} Invoice`,
    lineItems: lineItems(), taxRate: 0.07,
    dueDate: dateOffset(Math.floor(-5 + Math.random() * 35)),
    jobId: job?.id, projectId: job?.projectId,
    linkedLabel: job ? `Job: ${job.title}` : undefined, linkedType: job ? "job" : undefined, linkedId: job?.id,
  });
  const parents = [customer.id]; if (job) parents.push(job.id);
  return { entry: entry("invoice", inv.id, parents) };
}

export function genAgreement(ctx: GenCtx, customer: Customer): { entry: SampleEntry } {
  // Planned visits — not yet jobs. They surface in the "Visits to Schedule"
  // widget / agreement Visits tab; scheduling one materializes a dispatchable job.
  const visits: AgreementVisit[] = ["Spring Tune-Up", "Fall Tune-Up"].map((label, k) => ({
    id: `av-${customer.id}-${k}-${Math.random().toString(36).slice(2, 5)}`,
    label,
    scheduled: dateOffset(30 + k * 150),
    status: "planned",
    tech: "Unassigned",
  }));
  const props = getProperties(customer.id);
  const property = props.find(p => p.isPrimary) ?? props[0];
  const ag = createAgreement({
    customerId: customer.id, customer: customer.name, customerInitials: customer.initials,
    propertyId: property.id,
    propertyLabel: `${property.label ? property.label + " — " : ""}${property.address}, ${property.city}`,
    location: ctx.locationName, assignedTo: pick(TECHS),
    type: "HVAC Residential Maintenance Plan", industry: "HVAC", templateId: "t1",
    startDate: dateOffset(-Math.floor(Math.random() * 60)), renewalDate: dateOffset(300 + Math.floor(Math.random() * 60)),
    services: ["2 tune-ups / year", "Priority scheduling", "15% repair discount"],
    visitFrequency: "2x per year", billingFrequency: "Annual",
    annualValue: pick([198, 258, 318, 420]),
    status: "active",
    visits,
  });
  return { entry: entry("agreement", ag.id, [customer.id]) };
}

export function genTask(ctx: GenCtx, customer: Customer): { entry: SampleEntry } {
  const t = createTask({
    title: pick(TASK_TITLES), type: pick(TASK_TYPES),
    dueDate: dateOffset(Math.floor(-3 + Math.random() * 14)),
    assignedTo: Math.random() < 0.8 ? pick(TECHS) : undefined,
    companyId: ctx.companyId, locationId: ctx.locationId,
    customerId: customer.id, customerName: customer.name,
    linkedType: "customer", linkedLabel: customer.name, linkedHref: `/customers/${customer.id}`,
  });
  return { entry: entry("task", t.id, [customer.id]) };
}
