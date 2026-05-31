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
export const ALL_LEADS: Lead[] = [
  // ── Northstar HVAC — Augusta ───────────────────────────
  {
    id: "l1",
    companyId: "co_hvac", locationId: "loc_augusta", serviceAreaId: "sa_augusta",
    accountId: "1",
    title: "Water Heater Replacement",
    stage: "follow_up", source: "phone", estimatedValue: "$1,200",
    assignedTo: "Sara (CSR)", assignedToInitials: "SC",
    customerName: "Sarah Mitchell", customerInitials: "SM",
    customerPhone: "(706) 555-0142", customerEmail: "sarah.m@email.com",
    customerAddress: "412 Oak St, Augusta, GA",
    notes: "Quote sent May 20. Customer said she'd discuss with husband and get back.",
    createdAt: "2026-05-20", displayDate: "May 20, 2026", locationName: "Augusta Branch",
  },
  {
    id: "l2",
    companyId: "co_hvac", locationId: "loc_augusta", serviceAreaId: "sa_augusta",
    accountId: "2",
    title: "Building 2 HVAC Upgrade",
    stage: "estimate_needed", source: "phone", estimatedValue: "TBD",
    assignedTo: "M. Cole", assignedToInitials: "MC",
    customerName: "Hammond LLC", customerInitials: "HL",
    customerPhone: "(706) 442-8800", customerEmail: "office@hammondllc.com",
    customerAddress: "1200 Industrial Way, Augusta, GA",
    notes: "Customer requested evaluation for Building 2. Need to schedule site assessment.",
    createdAt: "2026-05-15", displayDate: "May 15, 2026", locationName: "Augusta Branch",
  },
  {
    id: "l3",
    companyId: "co_hvac", locationId: "loc_augusta", serviceAreaId: "sa_martinez",
    title: "Full System Replacement",
    stage: "new_lead", source: "website", estimatedValue: "$8,500",
    assignedTo: "J. Patel", assignedToInitials: "JP",
    customerName: "Marcus Webb", customerInitials: "MW",
    customerPhone: "(706) 555-9901",
    customerAddress: "88 Spring Valley Rd, Martinez, GA",
    notes: "Web form. 15-year-old Carrier system. Wants full replacement.",
    createdAt: "2026-05-28", displayDate: "May 28, 2026", locationName: "Augusta Branch",
  },
  {
    id: "l4",
    companyId: "co_hvac", locationId: "loc_augusta", serviceAreaId: "sa_grovetown",
    title: "Heat Pump Replacement",
    stage: "appointment_scheduled", source: "google_lsa", estimatedValue: "$6,800",
    assignedTo: "J. Patel", assignedToInitials: "JP",
    customerName: "Patricia Holloway", customerInitials: "PH",
    customerPhone: "(706) 555-2211", customerEmail: "p.holloway@email.com",
    customerAddress: "44 Creek View Dr, Grovetown, GA",
    notes: "Google LSA lead. Site visit booked Jun 3 at 10am.",
    createdAt: "2026-05-29", displayDate: "May 29, 2026", locationName: "Augusta Branch",
  },
  {
    id: "l5",
    companyId: "co_hvac", locationId: "loc_augusta", serviceAreaId: "sa_augusta",
    title: "Commercial Maintenance Agreement",
    stage: "estimate_sent", source: "referral", estimatedValue: "$3,600/yr",
    assignedTo: "Sara (CSR)", assignedToInitials: "SC",
    customerName: "Peach State Properties", customerInitials: "PS",
    customerPhone: "(706) 555-4400", customerEmail: "ops@peachstate.com",
    customerAddress: "1100 Gordon Hwy, Augusta, GA",
    notes: "Referred by Hammond LLC. 3 commercial properties. Quote sent May 22.",
    createdAt: "2026-05-10", displayDate: "May 10, 2026", locationName: "Augusta Branch",
  },
  {
    id: "l6",
    companyId: "co_hvac", locationId: "loc_augusta", serviceAreaId: "sa_augusta",
    title: "Emergency AC Repair",
    stage: "follow_up", source: "phone", estimatedValue: "$450",
    assignedTo: "J. Patel", assignedToInitials: "JP",
    customerName: "Brenda Coleman", customerInitials: "BC",
    customerPhone: "(706) 555-8822",
    customerAddress: "1044 Tobacco Rd, Augusta, GA",
    notes: "Estimate provided. Waiting on customer approval.",
    createdAt: "2026-05-27", displayDate: "May 27, 2026", locationName: "Augusta Branch",
  },
  {
    id: "l7",
    companyId: "co_hvac", locationId: "loc_augusta", serviceAreaId: "sa_augusta",
    title: "Ductwork Replacement",
    stage: "lost", source: "google_ads", estimatedValue: "$4,200",
    assignedTo: "J. Patel", assignedToInitials: "JP",
    customerName: "Reginald Thorn", customerInitials: "RT",
    customerPhone: "(706) 555-7733",
    customerAddress: "229 Mill Pond Rd, Augusta, GA",
    notes: "Went with competitor. Price was the deciding factor.",
    createdAt: "2026-04-15", displayDate: "Apr 15, 2026", locationName: "Augusta Branch",
  },

  // ── Northstar HVAC — Evans ─────────────────────────────
  {
    id: "l8",
    companyId: "co_hvac", locationId: "loc_evans", serviceAreaId: "sa_evans",
    accountId: "11",
    title: "New Construction HVAC Install",
    stage: "contacted", source: "phone", estimatedValue: "TBD",
    assignedTo: "J. Patel", assignedToInitials: "JP",
    customerName: "Michael Dunbar", customerInitials: "MD",
    customerPhone: "(706) 555-1234", customerEmail: "m.dunbar@email.com",
    customerAddress: "78 Clubhouse Dr, Evans, GA",
    notes: "New construction project. Site visit scheduled Jun 15.",
    createdAt: "2026-04-22", displayDate: "Apr 22, 2026", locationName: "Evans Branch",
  },
  {
    id: "l9",
    companyId: "co_hvac", locationId: "loc_evans", serviceAreaId: "sa_evans",
    accountId: "12",
    title: "HVAC Maintenance Agreement Renewal",
    stage: "won", source: "repeat", estimatedValue: "$349/yr",
    assignedTo: "Sara (CSR)", assignedToInitials: "SC",
    customerName: "Evans Professional Park", customerInitials: "EP",
    customerPhone: "(706) 555-8899", customerEmail: "admin@evanspro.com",
    customerAddress: "3000 Professional Pkwy, Evans, GA",
    notes: "Renewal agreement signed. Starts July 1.",
    createdAt: "2026-05-01", displayDate: "May 1, 2026", locationName: "Evans Branch",
    convertedToJobId: "pj5-1",
  },

  // ── Northstar Roofing — Columbia ───────────────────────
  {
    id: "l10",
    companyId: "co_roofing", locationId: "loc_columbia", serviceAreaId: "sa_columbia",
    accountId: "5",
    title: "Roof Damage Assessment",
    stage: "new_lead", source: "website", estimatedValue: "TBD",
    assignedTo: "D. Nguyen", assignedToInitials: "DN",
    customerName: "T. Okafor", customerInitials: "TO",
    customerPhone: "(803) 391-4422", customerEmail: "tokafor@email.com",
    customerAddress: "334 Pinehurst Rd, Martinez, GA",
    notes: "Web form — storm damage inquiry.",
    createdAt: "2026-05-28", displayDate: "May 28, 2026", locationName: "Columbia Branch",
  },
  {
    id: "l11",
    companyId: "co_roofing", locationId: "loc_columbia", serviceAreaId: "sa_columbia",
    accountId: "6",
    title: "Consulting Retainer",
    stage: "estimate_sent", source: "referral", estimatedValue: "$3,000/mo",
    assignedTo: "Marcus Reyes", assignedToInitials: "MR",
    customerName: "Southeast Restoration", customerInitials: "SR",
    customerPhone: "(803) 229-1183", customerEmail: "info@serestoration.com",
    customerAddress: "555 Commerce Blvd, Columbia, SC",
    notes: "Proposal sent. Decision maker is COO. Follow-up call Jun 5.",
    createdAt: "2026-05-10", displayDate: "May 10, 2026", locationName: "Columbia Branch",
  },
  {
    id: "l12",
    companyId: "co_roofing", locationId: "loc_columbia", serviceAreaId: "sa_columbia",
    accountId: "14",
    title: "Roofing Inspection Plan",
    stage: "contacted", source: "phone", estimatedValue: "$599/yr",
    assignedTo: "D. Nguyen", assignedToInitials: "DN",
    customerName: "Columbia Health Systems", customerInitials: "CH",
    customerPhone: "(803) 555-9900", customerEmail: "facilities@colhealth.com",
    customerAddress: "1301 Taylor St, Columbia, SC",
    notes: "Spoke with facilities director. Call scheduled for next week.",
    createdAt: "2026-05-20", displayDate: "May 20, 2026", locationName: "Columbia Branch",
  },
];

// ─── Bulk test leads (preview a busy pipeline) ────────────
// Deterministic generation (no randomness → no hydration mismatch). Piled into
// new_lead/contacted so per-column scrolling is visible.
const _stagePlan: { stage: LeadStage; count: number }[] = [
  { stage: "new_lead", count: 14 },
  { stage: "contacted", count: 9 },
  { stage: "appointment_scheduled", count: 5 },
  { stage: "estimate_needed", count: 4 },
  { stage: "estimate_sent", count: 5 },
  { stage: "follow_up", count: 3 },
];
const _first = ["James","Maria","Robert","Linda","David","Patricia","John","Jennifer","Michael","Elizabeth","William","Susan","Richard","Karen","Joseph","Nancy","Thomas","Betty","Chris","Sandra","Daniel","Ashley","Paul","Donna","Mark","Carol","Kevin","Ruth","Brian","Sharon","George","Michelle","Edward","Laura","Ronald","Amy","Steven","Angela","Jason","Melissa"];
const _last  = ["Carter","Bennett","Foster","Hughes","Powell","Sanders","Brooks","Ward","Cook","Bailey","Reed","Cooper","Bell","Murphy","Rivera","Gomez","Long","Ross","Hayes","Price","Wood","Barnes","Ellis","Coleman","Jenkins","Perry","Russell","Sullivan","Bryant","Wells","Alexander","Griffin","Patton","Diaz","Myers","Ford","Hart","Stone","Cross","Vance"];
const _titles = ["AC Tune-Up","Furnace Replacement","Thermostat Upgrade","Ductwork Repair","Heat Pump Install","Mini-Split Install","Maintenance Plan","Emergency Repair Quote","Air Quality System","New Construction HVAC","Coil Cleaning","Zoning System"];
const _srcs: LeadSource[] = ["website","referral","google_lsa","google_ads","phone","social","door_knock","repeat"];
const _reps: [string, string][] = [["J. Patel","JP"],["M. Cole","MC"],["D. Nguyen","DN"],["Sara (CSR)","SC"]];
const _cities: [string, string, string][] = [["Augusta","loc_augusta","sa_augusta"],["Martinez","loc_augusta","sa_martinez"],["Grovetown","loc_augusta","sa_grovetown"],["Evans","loc_evans","sa_evans"]];
const _months: [string, string][] = [["Mar","03"],["Apr","04"],["May","05"]];

let _ti = 0;
for (const { stage, count } of _stagePlan) {
  for (let k = 0; k < count; k++) {
    const i = _ti++;
    const first = _first[i % _first.length];
    const last  = _last[(i * 7) % _last.length];
    const rep   = _reps[i % _reps.length];
    const city  = _cities[i % _cities.length];
    const [mon, mm] = _months[i % _months.length];
    const day = (i % 27) + 1;
    ALL_LEADS.push({
      id: `lt${i + 1}`,
      companyId: "co_hvac", locationId: city[1], serviceAreaId: city[2],
      title: _titles[i % _titles.length],
      stage, source: _srcs[i % _srcs.length],
      estimatedValue: i % 4 === 0 ? "TBD" : `$${(1 + (i % 9)) * 1000 + (i % 5) * 250}`,
      assignedTo: rep[0], assignedToInitials: rep[1],
      customerName: `${first} ${last}`, customerInitials: (first[0] + last[0]).toUpperCase(),
      customerPhone: `(706) 555-${String(1000 + i).slice(-4)}`,
      customerAddress: `${100 + i} Maple Ave, ${city[0]}, GA`,
      createdAt: `2026-${mm}-${String(day).padStart(2, "0")}`,
      displayDate: `${mon} ${day}, 2026`,
      locationName: city[1] === "loc_evans" ? "Evans Branch" : "Augusta Branch",
    });
  }
}

// ─── Lead notes ───────────────────────────────────────────
export const LEAD_NOTES: Record<string, LeadNote[]> = {
  "l1": [
    { id: "ln1-1", leadId: "l1", date: "May 20, 2026", user: "J. Patel",   userInitials: "JP", type: "email", text: "Sent water heater replacement quote for $1,200 installed." },
    { id: "ln1-2", leadId: "l1", date: "May 12, 2026", user: "Sara (CSR)", userInitials: "SC", type: "call",  text: "Customer called asking about water heater pricing. Booked follow-up with J. Patel." },
  ],
  "l2": [
    { id: "ln2-1", leadId: "l2", date: "May 15, 2026", user: "Sara (CSR)", userInitials: "SC", type: "call", text: "D. Webb called requesting evaluation of Building 2 HVAC. Three units may need replacement." },
  ],
  "l5": [
    { id: "ln5-1", leadId: "l5", date: "May 22, 2026", user: "Sara (CSR)", userInitials: "SC", type: "email", text: "Quote sent for 3-property commercial maintenance agreement. $3,600/yr." },
    { id: "ln5-2", leadId: "l5", date: "May 10, 2026", user: "Marcus Reyes", userInitials: "MR", type: "call", text: "Referral from Hammond LLC. Spoke with property operations manager. Very interested." },
  ],
  "l11": [
    { id: "ln11-1", leadId: "l11", date: "May 18, 2026", user: "Marcus Reyes", userInitials: "MR", type: "email", text: "Proposal sent to COO — $3,000/mo consulting retainer. 90-day initial term." },
    { id: "ln11-2", leadId: "l11", date: "May 10, 2026", user: "Marcus Reyes", userInitials: "MR", type: "call",  text: "Spoke with COO briefly. Referral from Columbia Health. Warm lead." },
  ],
};

// ─── Lead tasks ───────────────────────────────────────────
export const LEAD_TASKS: Record<string, LeadTask[]> = {
  "l1": [
    { id: "lt1-1", leadId: "l1", title: "Follow up on water heater quote", dueDate: "Jun 5, 2026",  assignedTo: "Sara (CSR)", status: "open" },
  ],
  "l2": [
    { id: "lt2-1", leadId: "l2", title: "Schedule site assessment for Building 2", dueDate: "Jun 3, 2026",  assignedTo: "M. Cole",    status: "open" },
    { id: "lt2-2", leadId: "l2", title: "Call D. Webb to confirm assessment details",dueDate: "Jun 1, 2026",  assignedTo: "Sara (CSR)", status: "open" },
  ],
  "l5": [
    { id: "lt5-1", leadId: "l5", title: "Follow up on commercial agreement quote",  dueDate: "May 30, 2026", assignedTo: "Sara (CSR)", status: "overdue" },
  ],
  "l11": [
    { id: "lt11-1", leadId: "l11", title: "Follow-up call with COO",               dueDate: "Jun 5, 2026",  assignedTo: "Marcus Reyes", status: "open" },
  ],
  "l4": [
    { id: "lt4-1", leadId: "l4", title: "Confirm site visit Jun 3 with Patricia",   dueDate: "Jun 1, 2026",  assignedTo: "J. Patel",   status: "open" },
  ],
};

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
