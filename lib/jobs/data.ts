// ─── Jobs domain — types + mock data ─────────────────────
// jobs.project_id is nullable: standalone jobs have no project.
// work_orders belong to jobs. checklist_items belong to work_orders.
//
// Maps to future DB tables:
//   projects, jobs, work_orders, checklist_items, job_notes

// ─── Types ────────────────────────────────────────────────
export type JobStatus      = "new" | "scheduled" | "en_route" | "in_progress" | "waiting_on_parts" | "waiting_on_customer" | "completed" | "invoiced" | "closed" | "canceled" | "no_show";
export type JobType        = "maintenance" | "repair" | "installation" | "inspection" | "emergency" | "estimate" | "warranty" | "replacement" | "other";
export type JobPriority    = "low" | "normal" | "high" | "urgent";
export type WorkOrderStatus = "pending" | "in_progress" | "completed";
export type JobNoteType    = "note" | "call" | "email" | "visit";

export interface Job {
  id: string;
  companyId: string;
  locationId: string;
  serviceAreaId?: string;
  projectId?: string;          // undefined = standalone job
  accountId: string;
  propertyAddress?: string;
  agreementId?: string;
  title: string;
  type: JobType;
  status: JobStatus;
  priority: JobPriority;
  scheduledDate: string;
  scheduledTime: string;
  durationMinutes: number;
  completedDate?: string;
  assignedTo: string;
  assignedToInitials: string;
  estimatedAmount?: string;
  actualAmount?: string;
  // Denormalized for list display
  customerName: string;
  customerInitials: string;
  locationName: string;
}

export interface ChecklistItem {
  id: string;
  label: string;
  isComplete: boolean;
  completedBy?: string;
  sortOrder: number;
}

export interface WorkOrder {
  id: string;
  jobId: string;
  title: string;
  instructions: string;
  status: WorkOrderStatus;
  checklist: ChecklistItem[];
}

export interface JobNote {
  id: string;
  jobId: string;
  date: string;
  user: string;
  userInitials: string;
  text: string;
  type: JobNoteType;
}

// ─── Status display config ────────────────────────────────
export const JOB_STATUS_CONFIG: Record<JobStatus, { label: string; bg: string; color: string }> = {
  new:                  { label: "New",                  bg: "var(--bg-input)", color: "var(--text-secondary)" },
  scheduled:            { label: "Scheduled",            bg: "#e0e7ff",         color: "#3730a3" },
  en_route:             { label: "En Route",             bg: "#fef3c7",         color: "#92400e" },
  in_progress:          { label: "In Progress",          bg: "#dbeafe",         color: "#1e40af" },
  waiting_on_parts:     { label: "Waiting on Parts",     bg: "#fef3c7",         color: "#92400e" },
  waiting_on_customer:  { label: "Waiting on Customer",  bg: "#fef3c7",         color: "#92400e" },
  completed:            { label: "Completed",            bg: "#d1fae5",         color: "#065f46" },
  invoiced:             { label: "Invoiced",             bg: "#ecfdf5",         color: "#059669" },
  closed:               { label: "Closed",               bg: "var(--bg-input)", color: "var(--text-muted)" },
  canceled:             { label: "Canceled",             bg: "var(--bg-input)", color: "var(--text-muted)" },
  no_show:              { label: "No Show",              bg: "#fee2e2",         color: "#991b1b" },
};

// Resolves a job's status to display config from the company's configured
// Job Statuses (Settings → Job Types & Statuses), falling back to the built-in
// JOB_STATUS_CONFIG for any status key not present in settings.
// Call from a client component with the array from getJobStatuses().
export interface StatusDisplay { label: string; bg: string; color: string }

export function resolveJobStatus(
  statusKey: string,
  configured: { key: string; name: string; color: string }[],
): StatusDisplay {
  const match = configured.find(s => s.key === statusKey);
  if (match) return { label: match.name, color: match.color, bg: match.color + "22" };
  const legacy = JOB_STATUS_CONFIG[statusKey as JobStatus];
  if (legacy) return legacy;
  return { label: statusKey, bg: "var(--bg-input)", color: "var(--text-secondary)" };
}

export const JOB_TYPE_CONFIG: Record<JobType, string> = {
  maintenance:  "#6366f1", repair:      "#ef4444",
  installation: "#10b981", inspection:  "#3b82f6",
  emergency:    "#dc2626", estimate:    "#8b5cf6",
  warranty:     "#f59e0b", replacement: "#0891b2",
  other:        "#6b7280",
};

// ─── Mock jobs ────────────────────────────────────────────
export const ALL_JOBS: Job[] = [
  // ── Standalone jobs ────────────────────────────────────
  { id: "j1",  companyId: "co_hvac",    locationId: "loc_augusta",  accountId: "1",  customerName: "Sarah Mitchell",        customerInitials: "SM", locationName: "Augusta Branch",  title: "HVAC Spring Tune-up",               type: "maintenance",  status: "scheduled",   priority: "normal", scheduledDate: "Jun 12, 2026", scheduledTime: "8:00 AM",  durationMinutes: 90,  assignedTo: "J. Patel",   assignedToInitials: "JP", estimatedAmount: "$0 (Agreement)", propertyAddress: "412 Oak St, Augusta, GA" },
  { id: "j2",  companyId: "co_hvac",    locationId: "loc_augusta",  accountId: "3",  customerName: "K. Brennan",            customerInitials: "KB", locationName: "Augusta Branch",  title: "Water Heater Emergency Repair",     type: "emergency",    status: "completed",   priority: "urgent", scheduledDate: "May 20, 2026", scheduledTime: "1:00 PM",  durationMinutes: 120, assignedTo: "J. Patel",   assignedToInitials: "JP", estimatedAmount: "$320", actualAmount: "$285", completedDate: "May 20, 2026", propertyAddress: "27 Maple Ct, Augusta, GA" },
  { id: "j3",  companyId: "co_hvac",    locationId: "loc_augusta",  accountId: "9",  customerName: "Jennifer Torres",       customerInitials: "JT", locationName: "Augusta Branch",  title: "HVAC Spring Tune-up",               type: "maintenance",  status: "scheduled",   priority: "normal", scheduledDate: "Jun 12, 2026", scheduledTime: "10:30 AM", durationMinutes: 90,  assignedTo: "J. Patel",   assignedToInitials: "JP", estimatedAmount: "$0 (Agreement)", propertyAddress: "1450 Riverwatch Pkwy, Augusta, GA" },
  { id: "j4",  companyId: "co_hvac",    locationId: "loc_augusta",  accountId: "2",  customerName: "Hammond LLC",           customerInitials: "HL", locationName: "Augusta Branch",  title: "Commercial HVAC Q2 Inspection",     type: "maintenance",  status: "scheduled",   priority: "normal", scheduledDate: "Jun 10, 2026", scheduledTime: "9:00 AM",  durationMinutes: 180, assignedTo: "M. Cole",    assignedToInitials: "MC", estimatedAmount: "$0 (Agreement)", propertyAddress: "1200 Industrial Way, Augusta, GA" },
  { id: "j5",  companyId: "co_roofing", locationId: "loc_columbia", accountId: "5",  customerName: "T. Okafor",             customerInitials: "TO", locationName: "Columbia Branch", title: "Roof Damage Estimate",              type: "estimate",     status: "scheduled",   priority: "normal", scheduledDate: "Jun 8, 2026",  scheduledTime: "2:00 PM",  durationMinutes: 60,  assignedTo: "D. Nguyen",  assignedToInitials: "DN", propertyAddress: "334 Pinehurst Rd, Martinez, GA" },
  { id: "j6",  companyId: "co_hvac",    locationId: "loc_augusta",  accountId: "13", customerName: "Donna Reeves",          customerInitials: "DR", locationName: "Augusta Branch",  title: "Filter Replacement",                type: "maintenance",  status: "completed",   priority: "low",    scheduledDate: "May 15, 2026", scheduledTime: "10:00 AM", durationMinutes: 30,  assignedTo: "J. Patel",   assignedToInitials: "JP", estimatedAmount: "$45", actualAmount: "$45", completedDate: "May 15, 2026", propertyAddress: "50 Windsor Spring Rd, Augusta, GA" },
  { id: "j7",  companyId: "co_hvac",    locationId: "loc_augusta",  accountId: "10", customerName: "Grovetown Storage LLC", customerInitials: "GS", locationName: "Augusta Branch",  title: "Monthly Property Walkthrough",      type: "inspection",   status: "scheduled",   priority: "normal", scheduledDate: "May 30, 2026", scheduledTime: "9:00 AM",  durationMinutes: 90,  assignedTo: "D. Nguyen",  assignedToInitials: "DN", estimatedAmount: "$0 (Agreement)", propertyAddress: "200 Storage Way, Grovetown, GA" },
  { id: "j8",  companyId: "co_hvac",    locationId: "loc_evans",    accountId: "4",  customerName: "Lakeside Apartments",   customerInitials: "LA", locationName: "Evans Branch",    title: "Emergency Drain — Unit 22",         type: "emergency",    status: "in_progress", priority: "urgent", scheduledDate: "May 30, 2026", scheduledTime: "11:00 AM", durationMinutes: 120, assignedTo: "M. Cole",    assignedToInitials: "MC", estimatedAmount: "$185", propertyAddress: "88 Lakeside Dr, Evans, GA" },
  { id: "j9",  companyId: "co_roofing", locationId: "loc_columbia", accountId: "15", customerName: "Carlos Vega",           customerInitials: "CV", locationName: "Columbia Branch", title: "Plumbing Q3 Inspection",            type: "inspection",   status: "scheduled",   priority: "normal", scheduledDate: "Aug 15, 2026", scheduledTime: "9:00 AM",  durationMinutes: 90,  assignedTo: "M. Cole",    assignedToInitials: "MC", estimatedAmount: "$0 (Agreement)", propertyAddress: "209 Bees Creek Rd, Aiken, SC" },
  { id: "j10", companyId: "co_hvac",    locationId: "loc_evans",    accountId: "11", customerName: "Michael Dunbar",        customerInitials: "MD", locationName: "Evans Branch",    title: "New Construction HVAC Estimate",    type: "estimate",     status: "scheduled",   priority: "normal", scheduledDate: "Jun 15, 2026", scheduledTime: "11:00 AM", durationMinutes: 60,  assignedTo: "J. Patel",   assignedToInitials: "JP", propertyAddress: "78 Clubhouse Dr, Evans, GA" },
  { id: "j11", companyId: "co_hvac",    locationId: "loc_augusta",  accountId: "8",  customerName: "ABC Property Group",    customerInitials: "AP", locationName: "Augusta Branch",  title: "Monthly Property Walkthrough",      type: "inspection",   status: "scheduled",   priority: "normal", scheduledDate: "May 30, 2026", scheduledTime: "2:00 PM",  durationMinutes: 120, assignedTo: "D. Nguyen",  assignedToInitials: "DN", estimatedAmount: "$0 (Agreement)", propertyAddress: "890 Business Park Dr, Augusta, GA" },
  { id: "j12", companyId: "co_hvac",    locationId: "loc_evans",    accountId: "12", customerName: "Evans Professional Park",customerInitials:"EP", locationName: "Evans Branch",    title: "Commercial HVAC Emergency Repair",  type: "emergency",    status: "completed",   priority: "urgent", scheduledDate: "May 25, 2026", scheduledTime: "3:00 PM",  durationMinutes: 150, assignedTo: "M. Cole",    assignedToInitials: "MC", estimatedAmount: "$680", actualAmount: "$650", completedDate: "May 25, 2026", propertyAddress: "3000 Professional Pkwy, Evans, GA" },

  // ── Project-linked jobs — p1: Alvarez HVAC Replacement ─
  { id: "pj1-1", projectId: "p1", companyId: "co_hvac",    locationId: "loc_augusta",  accountId: "7",  customerName: "Alvarez Residence",   customerInitials: "AR", locationName: "Augusta Branch",  title: "Equipment Removal & Site Prep", type: "replacement",  status: "completed",   priority: "normal", scheduledDate: "May 28, 2026", scheduledTime: "8:00 AM",  durationMinutes: 180, assignedTo: "J. Patel",  assignedToInitials: "JP", completedDate: "May 28, 2026", propertyAddress: "1840 Peach Orchard Rd, Augusta, GA" },
  { id: "pj1-2", projectId: "p1", companyId: "co_hvac",    locationId: "loc_augusta",  accountId: "7",  customerName: "Alvarez Residence",   customerInitials: "AR", locationName: "Augusta Branch",  title: "New Unit Installation",         type: "installation", status: "in_progress", priority: "high",   scheduledDate: "May 30, 2026", scheduledTime: "8:00 AM",  durationMinutes: 480, assignedTo: "J. Patel",  assignedToInitials: "JP", estimatedAmount: "$7,400", propertyAddress: "1840 Peach Orchard Rd, Augusta, GA" },
  { id: "pj1-3", projectId: "p1", companyId: "co_hvac",    locationId: "loc_augusta",  accountId: "7",  customerName: "Alvarez Residence",   customerInitials: "AR", locationName: "Augusta Branch",  title: "System Startup & Testing",      type: "inspection",   status: "scheduled",   priority: "normal", scheduledDate: "Jun 3, 2026",  scheduledTime: "9:00 AM",  durationMinutes: 120, assignedTo: "J. Patel",  assignedToInitials: "JP", propertyAddress: "1840 Peach Orchard Rd, Augusta, GA" },

  // ── p2: Hammond LLC Roof Replacement ───────────────────
  { id: "pj2-1", projectId: "p2", companyId: "co_roofing", locationId: "loc_columbia", accountId: "2",  customerName: "Hammond LLC",         customerInitials: "HL", locationName: "Columbia Branch", title: "Tear-off & Deck Inspection",    type: "replacement",  status: "scheduled",   priority: "high",   scheduledDate: "Jun 15, 2026", scheduledTime: "7:00 AM",  durationMinutes: 480, assignedTo: "D. Nguyen", assignedToInitials: "DN", estimatedAmount: "$18,000", propertyAddress: "1200 Industrial Way, Augusta, GA" },
  { id: "pj2-2", projectId: "p2", companyId: "co_roofing", locationId: "loc_columbia", accountId: "2",  customerName: "Hammond LLC",         customerInitials: "HL", locationName: "Columbia Branch", title: "New Roof Installation",         type: "installation", status: "scheduled",   priority: "high",   scheduledDate: "Jun 16, 2026", scheduledTime: "7:00 AM",  durationMinutes: 600, assignedTo: "D. Nguyen", assignedToInitials: "DN", estimatedAmount: "$30,000", propertyAddress: "1200 Industrial Way, Augusta, GA" },

  // ── p3: Lakeside Plumbing Overhaul ─────────────────────
  { id: "pj3-1", projectId: "p3", companyId: "co_hvac",    locationId: "loc_evans",    accountId: "4",  customerName: "Lakeside Apartments", customerInitials: "LA", locationName: "Evans Branch",    title: "Main Line Camera Inspection",   type: "inspection",   status: "completed",   priority: "normal", scheduledDate: "May 10, 2026", scheduledTime: "9:00 AM",  durationMinutes: 180, assignedTo: "M. Cole",   assignedToInitials: "MC", completedDate: "May 10, 2026", propertyAddress: "88 Lakeside Dr, Evans, GA" },
  { id: "pj3-2", projectId: "p3", companyId: "co_hvac",    locationId: "loc_evans",    accountId: "4",  customerName: "Lakeside Apartments", customerInitials: "LA", locationName: "Evans Branch",    title: "Building A — Repiping",         type: "installation", status: "scheduled",   priority: "normal", scheduledDate: "Jun 20, 2026", scheduledTime: "8:00 AM",  durationMinutes: 480, assignedTo: "M. Cole",   assignedToInitials: "MC", estimatedAmount: "$6,200", propertyAddress: "88 Lakeside Dr, Evans, GA" },
  { id: "pj3-3", projectId: "p3", companyId: "co_hvac",    locationId: "loc_evans",    accountId: "4",  customerName: "Lakeside Apartments", customerInitials: "LA", locationName: "Evans Branch",    title: "Building B — Repiping",         type: "installation", status: "scheduled",   priority: "normal", scheduledDate: "Jul 10, 2026", scheduledTime: "8:00 AM",  durationMinutes: 480, assignedTo: "M. Cole",   assignedToInitials: "MC", estimatedAmount: "$5,800", propertyAddress: "88 Lakeside Dr, Evans, GA" },

  // ── p4: ABC Property HVAC Upgrade ──────────────────────
  { id: "pj4-1", projectId: "p4", companyId: "co_hvac",    locationId: "loc_augusta",  accountId: "8",  customerName: "ABC Property Group",  customerInitials: "AP", locationName: "Augusta Branch",  title: "Equipment Assessment",          type: "inspection",   status: "completed",   priority: "normal", scheduledDate: "Apr 15, 2026", scheduledTime: "9:00 AM",  durationMinutes: 120, assignedTo: "J. Patel",  assignedToInitials: "JP", completedDate: "Apr 15, 2026", propertyAddress: "890 Business Park Dr, Augusta, GA" },
  { id: "pj4-2", projectId: "p4", companyId: "co_hvac",    locationId: "loc_augusta",  accountId: "8",  customerName: "ABC Property Group",  customerInitials: "AP", locationName: "Augusta Branch",  title: "Unit 1 — RTU Replacement",      type: "replacement",  status: "scheduled",   priority: "normal", scheduledDate: "Jul 1, 2026",  scheduledTime: "7:00 AM",  durationMinutes: 360, assignedTo: "J. Patel",  assignedToInitials: "JP", estimatedAmount: "$14,500", propertyAddress: "890 Business Park Dr, Augusta, GA" },

  // ── p5: Evans Pro Park Commercial ──────────────────────
  { id: "pj5-1", projectId: "p5", companyId: "co_hvac",    locationId: "loc_evans",    accountId: "12", customerName: "Evans Professional Park",customerInitials:"EP", locationName: "Evans Branch",    title: "Site Assessment & Planning",    type: "inspection",   status: "scheduled",   priority: "low",    scheduledDate: "Jun 20, 2026", scheduledTime: "10:00 AM", durationMinutes: 90,  assignedTo: "M. Cole",   assignedToInitials: "MC", propertyAddress: "3000 Professional Pkwy, Evans, GA" },
  { id: "pj5-2", projectId: "p5", companyId: "co_hvac",    locationId: "loc_evans",    accountId: "12", customerName: "Evans Professional Park",customerInitials:"EP", locationName: "Evans Branch",    title: "Unit A — RTU Installation",     type: "installation", status: "scheduled",   priority: "low",    scheduledDate: "Jul 15, 2026", scheduledTime: "7:00 AM",  durationMinutes: 480, assignedTo: "M. Cole",   assignedToInitials: "MC", estimatedAmount: "$22,000", propertyAddress: "3000 Professional Pkwy, Evans, GA" },
];

// ─── Work orders ──────────────────────────────────────────
export const WORK_ORDERS: Record<string, WorkOrder> = {
  "j1": {
    id: "wo-j1", jobId: "j1",
    title: "Residential HVAC Spring Maintenance",
    instructions: "Perform full spring tune-up per HVAC Residential Maintenance Plan agreement.\n\nSafety: Disconnect power before opening unit. Verify refrigerant handling certification before any refrigerant work.\n\nPriority items: Check filter and replace if needed. Inspect capacitors — unit is 5 years old.",
    status: "pending",
    checklist: [
      { id: "c1", label: "Verify disconnect and power down unit",         isComplete: false, sortOrder: 1 },
      { id: "c2", label: "Replace air filter (1-inch, 20x25)",           isComplete: false, sortOrder: 2 },
      { id: "c3", label: "Check refrigerant charge (target 410A)",       isComplete: false, sortOrder: 3 },
      { id: "c4", label: "Inspect and clean evaporator coils",           isComplete: false, sortOrder: 4 },
      { id: "c5", label: "Inspect and clean condenser coils",            isComplete: false, sortOrder: 5 },
      { id: "c6", label: "Check capacitors and contactor",               isComplete: false, sortOrder: 6 },
      { id: "c7", label: "Test thermostat and verify setpoint",          isComplete: false, sortOrder: 7 },
      { id: "c8", label: "Record supply/return temps and pressures",     isComplete: false, sortOrder: 8 },
      { id: "c9", label: "Document findings and recommendations",        isComplete: false, sortOrder: 9 },
    ],
  },
  "j4": {
    id: "wo-j4", jobId: "j4",
    title: "Commercial HVAC Quarterly Maintenance — Q2",
    instructions: "Quarterly maintenance for all 4 rooftop units per Commercial HVAC Quarterly Plan agreement.\n\nCoordinate with D. Webb (property manager) before arrival. Access to roof requires signing in at front desk.\n\nNote: Unit 3 had a capacitor issue in March — inspect closely.",
    status: "pending",
    checklist: [
      { id: "c1", label: "Check in with D. Webb at front desk",          isComplete: false, sortOrder: 1 },
      { id: "c2", label: "RTU 1 — Replace filters, inspect coils",       isComplete: false, sortOrder: 2 },
      { id: "c3", label: "RTU 2 — Replace filters, inspect coils",       isComplete: false, sortOrder: 3 },
      { id: "c4", label: "RTU 3 — Replace filters, check capacitor",     isComplete: false, sortOrder: 4 },
      { id: "c5", label: "RTU 4 — Replace filters, inspect coils",       isComplete: false, sortOrder: 5 },
      { id: "c6", label: "Check refrigerant on all units",               isComplete: false, sortOrder: 6 },
      { id: "c7", label: "Test all controls and safety switches",        isComplete: false, sortOrder: 7 },
      { id: "c8", label: "Complete service report for each unit",        isComplete: false, sortOrder: 8 },
    ],
  },
  "j8": {
    id: "wo-j8", jobId: "j8",
    title: "Emergency Drain Service — Unit 22",
    instructions: "Emergency drain blockage in Unit 22 bathroom. Tenant reported complete backup. Mike Torres (property manager) will provide access.\n\nBring 50ft drain snake. Check for damage downstream of blockage.",
    status: "in_progress",
    checklist: [
      { id: "c1", label: "Meet Mike Torres for unit access",              isComplete: true,  completedBy: "M. Cole", sortOrder: 1 },
      { id: "c2", label: "Diagnose blockage location",                   isComplete: true,  completedBy: "M. Cole", sortOrder: 2 },
      { id: "c3", label: "Clear blockage with drain snake",              isComplete: false, sortOrder: 3 },
      { id: "c4", label: "Test drain flow and verify clear",             isComplete: false, sortOrder: 4 },
      { id: "c5", label: "Inspect for pipe damage",                      isComplete: false, sortOrder: 5 },
      { id: "c6", label: "Document and photograph if damage found",      isComplete: false, sortOrder: 6 },
    ],
  },
  "pj1-2": {
    id: "wo-pj1-2", jobId: "pj1-2",
    title: "Carrier Heat Pump System Installation",
    instructions: "Install new Carrier 4-ton heat pump system (24ACC648A003 outdoor, FE4ANF005 air handler). Refrigerant lines were pre-run during day 1 removal.\n\nPermit #2026-AUG-HVAC-0441 is on file. Carrier distributor delivery confirmed 7:30 AM.",
    status: "in_progress",
    checklist: [
      { id: "c1",  label: "Verify equipment delivery — check model/serial against PO",    isComplete: true,  completedBy: "J. Patel", sortOrder: 1 },
      { id: "c2",  label: "Set and level outdoor unit on new pad",                        isComplete: true,  completedBy: "J. Patel", sortOrder: 2 },
      { id: "c3",  label: "Install air handler in attic",                                 isComplete: true,  completedBy: "J. Patel", sortOrder: 3 },
      { id: "c4",  label: "Connect refrigerant lines and pressure test",                  isComplete: true,  completedBy: "J. Patel", sortOrder: 4 },
      { id: "c5",  label: "Pull vacuum on system (target < 300 microns)",                 isComplete: false, sortOrder: 5 },
      { id: "c6",  label: "Charge system to spec",                                        isComplete: false, sortOrder: 6 },
      { id: "c7",  label: "Connect all electrical — disconnect, whip, thermostat",        isComplete: false, sortOrder: 7 },
      { id: "c8",  label: "Program Ecobee thermostat",                                    isComplete: false, sortOrder: 8 },
      { id: "c9",  label: "Test full system — heat and cool modes",                       isComplete: false, sortOrder: 9 },
      { id: "c10", label: "Record nameplate data, serial numbers, refrigerant charge",    isComplete: false, sortOrder: 10 },
      { id: "c11", label: "Customer walkthrough and sign-off",                            isComplete: false, sortOrder: 11 },
    ],
  },
};

// ─── Job notes ────────────────────────────────────────────
export const JOB_NOTES: Record<string, JobNote[]> = {
  "j2": [
    { id: "jn2-1", jobId: "j2", date: "May 20, 2026, 1:42 PM", user: "J. Patel",   userInitials: "JP", type: "visit", text: "Arrived on site. Water heater pressure relief valve was discharging. Diagnosed faulty T&P valve and thermostat." },
    { id: "jn2-2", jobId: "j2", date: "May 20, 2026, 3:15 PM", user: "J. Patel",   userInitials: "JP", type: "note",  text: "Replaced T&P valve and upper thermostat. Tested full operation. No leaks. Advised customer to monitor." },
    { id: "jn2-3", jobId: "j2", date: "May 20, 2026, 3:30 PM", user: "Sara (CSR)", userInitials: "SC", type: "call",  text: "Customer called to confirm job complete and ask about water heater age. Unit is 7 years old. Recommended budgeting for replacement in 2-3 years." },
  ],
  "j8": [
    { id: "jn8-1", jobId: "j8", date: "May 30, 2026, 11:20 AM", user: "M. Cole",    userInitials: "MC", type: "visit", text: "On site. Unit 22 bathroom drain completely blocked. Hair clog approximately 12 feet in. Running snake now." },
    { id: "jn8-2", jobId: "j8", date: "May 30, 2026, 12:05 PM", user: "Sara (CSR)", userInitials: "SC", type: "call",  text: "Mike Torres called asking for ETA on resolution. Told him 30-45 minutes." },
  ],
  "pj1-2": [
    { id: "jnp1-1", jobId: "pj1-2", date: "May 30, 2026, 8:15 AM", user: "J. Patel", userInitials: "JP", type: "note", text: "Equipment delivered on time. All parts match PO. Started on outdoor unit placement." },
    { id: "jnp1-2", jobId: "pj1-2", date: "May 30, 2026, 12:30 PM", user: "J. Patel", userInitials: "JP", type: "note", text: "Air handler installed. Refrigerant lines connected and pressure tested — no leaks. Starting vacuum pull after lunch." },
  ],
  "j4": [
    { id: "jn4-1", jobId: "j4", date: "May 29, 2026", user: "Sara (CSR)", userInitials: "SC", type: "call", text: "Called D. Webb to confirm June 10 appointment. Confirmed 9am access. Asked us to bring extra RTU 3 filters." },
  ],
};

// ─── Runtime store (seed + jobs created in-session, e.g. from a quote) ────
const JOBS_KEY = "crm-extra-jobs";
let _extraJobs: Job[] | null = null;
function extraJobs(): Job[] {
  if (_extraJobs) return _extraJobs;
  if (typeof window === "undefined") return [];
  try { const r = localStorage.getItem(JOBS_KEY); _extraJobs = r ? JSON.parse(r) : []; }
  catch { _extraJobs = []; }
  return _extraJobs!;
}

// Session-created jobs only (for hydration-safe merging in client lists).
export function getSessionJobs(): Job[] { return extraJobs(); }
// All jobs (seed + session). Server-side returns seed only.
export function getAllJobs(): Job[] { return [...extraJobs(), ...ALL_JOBS]; }

export interface NewJobInput {
  companyId: string; locationId: string; serviceAreaId?: string;
  accountId: string; customerName: string; customerInitials: string; locationName: string;
  title: string; type?: JobType; priority?: JobPriority;
  propertyAddress?: string; estimatedAmount?: string; projectId?: string;
  scheduledDate?: string; scheduledTime?: string; durationMinutes?: number;
  assignedTo?: string; assignedToInitials?: string;
}

// Create a job (e.g. converted from a quote). Unscheduled by default — status
// "new" with no date until dispatched.
export function createJob(input: NewJobInput): Job {
  const job: Job = {
    id: `job-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    companyId: input.companyId, locationId: input.locationId, serviceAreaId: input.serviceAreaId,
    projectId: input.projectId, accountId: input.accountId,
    propertyAddress: input.propertyAddress,
    title: input.title, type: input.type ?? "installation",
    status: input.scheduledDate ? "scheduled" : "new",
    priority: input.priority ?? "normal",
    scheduledDate: input.scheduledDate ?? "", scheduledTime: input.scheduledTime ?? "",
    durationMinutes: input.durationMinutes ?? 120,
    assignedTo: input.assignedTo ?? "", assignedToInitials: input.assignedToInitials ?? "",
    estimatedAmount: input.estimatedAmount,
    customerName: input.customerName, customerInitials: input.customerInitials, locationName: input.locationName,
  };
  _extraJobs = [job, ...extraJobs()];
  try { localStorage.setItem(JOBS_KEY, JSON.stringify(_extraJobs)); } catch { /* ignore */ }
  return job;
}

// ─── Lookup helpers ───────────────────────────────────────
export const JOBS_MAP: Record<string, Job> = Object.fromEntries(ALL_JOBS.map(j => [j.id, j]));

export function getJob(id: string): Job | undefined {
  return JOBS_MAP[id] ?? extraJobs().find(j => j.id === id);
}

export function getJobsForProject(projectId: string): Job[] {
  return getAllJobs().filter(j => j.projectId === projectId);
}

export function getWorkOrder(jobId: string): WorkOrder | undefined {
  return WORK_ORDERS[jobId];
}

export function getJobNotes(jobId: string): JobNote[] {
  return JOB_NOTES[jobId] ?? [];
}
