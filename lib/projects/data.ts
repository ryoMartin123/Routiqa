// ─── Projects domain — types + mock data ─────────────────
// A project is an optional container for multi-phase or multi-day work.
// Simple service calls use Job-only (no project).
//
// Maps to future DB table: projects

import { getJobsForProject } from "@/lib/jobs/data";

export type ProjectStatus   = "draft" | "active" | "on_hold" | "completed" | "canceled";
export type ProjectType     = "installation" | "replacement" | "restoration" | "renovation" | "multi_phase" | "other";
export type ProjectPriority = "low" | "normal" | "high" | "urgent";

export interface Project {
  id: string;
  companyId: string;
  locationId: string;
  serviceAreaId?: string;
  accountId: string;
  propertyAddress?: string;
  name: string;
  description: string;
  scope?: string;
  type: ProjectType;
  status: ProjectStatus;
  priority: ProjectPriority;
  startDate?: string;
  targetDate?: string;
  completedDate?: string;
  assignedTo: string;
  assignedToInitials: string;
  estimatedValue?: string;
  actualValue?: string;
  jobIds: string[];
  // Denormalized
  customerName: string;
  customerInitials: string;
  locationName: string;
}

export interface ProjectTask {
  id: string;
  projectId: string;
  title: string;
  isComplete: boolean;
  dueDate?: string;
  assignedTo?: string;
}

// ─── Status display config ────────────────────────────────
export const PROJECT_STATUS_CONFIG: Record<ProjectStatus, { label: string; bg: string; color: string }> = {
  draft:     { label: "Draft",     bg: "var(--bg-input)", color: "var(--text-muted)"  },
  active:    { label: "Active",    bg: "#d1fae5",         color: "#065f46"            },
  on_hold:   { label: "On Hold",   bg: "#fef3c7",         color: "#92400e"            },
  completed: { label: "Completed", bg: "#e0e7ff",         color: "#3730a3"            },
  canceled:  { label: "Canceled",  bg: "#fee2e2",         color: "#991b1b"            },
};

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  installation: "Installation",
  replacement:  "Replacement",
  restoration:  "Restoration",
  renovation:   "Renovation",
  multi_phase:  "Multi-Phase",
  other:        "Other",
};

// ─── Mock projects ────────────────────────────────────────
export const ALL_PROJECTS: Project[] = [
  {
    id: "p1",
    companyId: "co_hvac", locationId: "loc_augusta", accountId: "7",
    customerName: "Alvarez Residence", customerInitials: "AR", locationName: "Augusta Branch",
    name: "HVAC System Full Replacement",
    description: "Complete replacement of aging Rheem HVAC system with new Carrier 4-ton heat pump.",
    scope: "Remove existing Rheem 3-ton system (air handler + outdoor unit). Install new Carrier 4-ton heat pump system (24ACC648A003 + FE4ANF005). Replace refrigerant lines. Update disconnect and wiring. Install Ecobee SmartThermostat. Full startup and testing. Customer walkthrough.",
    type: "replacement", status: "active", priority: "high",
    startDate: "May 28, 2026", targetDate: "Jun 3, 2026",
    assignedTo: "J. Patel", assignedToInitials: "JP",
    estimatedValue: "$8,400",
    jobIds: ["pj1-1", "pj1-2", "pj1-3"],
    propertyAddress: "1840 Peach Orchard Rd, Augusta, GA",
  },
  {
    id: "p2",
    companyId: "co_roofing", locationId: "loc_columbia", accountId: "2",
    customerName: "Hammond LLC", customerInitials: "HL", locationName: "Columbia Branch",
    name: "Full Commercial Roof Replacement",
    description: "Complete tear-off and replacement of flat roof on 12,000 sq ft main office building.",
    scope: "Tear off existing modified bitumen roof. Inspect and repair deck as needed. Install new TPO membrane roofing system with tapered insulation. New flashing, edge metal, and drains. 20-year manufacturer warranty.",
    type: "replacement", status: "active", priority: "high",
    startDate: "Jun 15, 2026", targetDate: "Jun 17, 2026",
    assignedTo: "D. Nguyen", assignedToInitials: "DN",
    estimatedValue: "$48,000",
    jobIds: ["pj2-1", "pj2-2"],
    propertyAddress: "1200 Industrial Way, Augusta, GA",
  },
  {
    id: "p3",
    companyId: "co_hvac", locationId: "loc_evans", accountId: "4",
    customerName: "Lakeside Apartments", customerInitials: "LA", locationName: "Evans Branch",
    name: "Building-Wide Plumbing Overhaul",
    description: "Full repiping of Buildings A and B following camera inspection showing extensive corrosion.",
    scope: "Camera inspection of all main lines. Repipe Building A (12 units) with PEX — supply lines only. Repipe Building B (12 units) with PEX — supply lines only. Patch drywall as needed. Final pressure test and inspection.",
    type: "restoration", status: "active", priority: "normal",
    startDate: "May 10, 2026", targetDate: "Jul 15, 2026",
    assignedTo: "M. Cole", assignedToInitials: "MC",
    estimatedValue: "$18,200",
    jobIds: ["pj3-1", "pj3-2", "pj3-3"],
    propertyAddress: "88 Lakeside Dr, Evans, GA",
  },
  {
    id: "p4",
    companyId: "co_hvac", locationId: "loc_augusta", accountId: "8",
    customerName: "ABC Property Group", customerInitials: "AP", locationName: "Augusta Branch",
    name: "Multi-Property HVAC Upgrade",
    description: "Phased upgrade of rooftop units across 3 properties. Phase 1: 890 Business Park Dr.",
    scope: "Phase 1: Replace 2 aging RTUs at 890 Business Park Dr with new Carrier commercial units. Phase 2 and 3 (future): remaining properties depending on budget approval.",
    type: "multi_phase", status: "on_hold", priority: "normal",
    startDate: "Apr 15, 2026", targetDate: "Aug 1, 2026",
    assignedTo: "J. Patel", assignedToInitials: "JP",
    estimatedValue: "$38,000",
    jobIds: ["pj4-1", "pj4-2"],
    propertyAddress: "890 Business Park Dr, Augusta, GA",
  },
  {
    id: "p5",
    companyId: "co_hvac", locationId: "loc_evans", accountId: "12",
    customerName: "Evans Professional Park", customerInitials: "EP", locationName: "Evans Branch",
    name: "Commercial HVAC Upgrade — Phase 1",
    description: "Replace Unit A (east wing RTU) as first phase of full commercial HVAC upgrade.",
    scope: "Site assessment to confirm specifications. Remove existing 10-ton Carrier RTU (Unit A). Install new Carrier 48HCDA12A3A5. New curb adapter, electrical, and controls. Startup and commissioning.",
    type: "installation", status: "draft", priority: "low",
    startDate: "Jun 20, 2026", targetDate: "Jul 20, 2026",
    assignedTo: "M. Cole", assignedToInitials: "MC",
    estimatedValue: "$24,500",
    jobIds: ["pj5-1", "pj5-2"],
    propertyAddress: "3000 Professional Pkwy, Evans, GA",
  },
];

// ─── Project tasks ────────────────────────────────────────
export const PROJECT_TASKS: Record<string, ProjectTask[]> = {
  "p1": [
    { id: "pt1-1", projectId: "p1", title: "Confirm equipment delivery with Carrier distributor", isComplete: true,  dueDate: "May 27, 2026", assignedTo: "J. Patel" },
    { id: "pt1-2", projectId: "p1", title: "Pull HVAC permit with city",                          isComplete: true,  dueDate: "May 26, 2026", assignedTo: "Sara (CSR)" },
    { id: "pt1-3", projectId: "p1", title: "Customer walkthrough and final sign-off",             isComplete: false, dueDate: "Jun 3, 2026",  assignedTo: "J. Patel" },
    { id: "pt1-4", projectId: "p1", title: "Send final invoice",                                  isComplete: false, dueDate: "Jun 4, 2026",  assignedTo: "Sara (CSR)" },
  ],
  "p2": [
    { id: "pt2-1", projectId: "p2", title: "Order TPO membrane and insulation",   isComplete: true,  dueDate: "Jun 5, 2026",  assignedTo: "D. Nguyen" },
    { id: "pt2-2", projectId: "p2", title: "Confirm dumpster placement with D. Webb", isComplete: false, dueDate: "Jun 12, 2026", assignedTo: "Sara (CSR)" },
    { id: "pt2-3", projectId: "p2", title: "Schedule city inspection",            isComplete: false, dueDate: "Jun 17, 2026", assignedTo: "Sara (CSR)" },
  ],
  "p3": [
    { id: "pt3-1", projectId: "p3", title: "Notify all tenants of water shutoff schedule", isComplete: true,  dueDate: "Jun 13, 2026", assignedTo: "Sara (CSR)" },
    { id: "pt3-2", projectId: "p3", title: "Order PEX materials for Building A",           isComplete: true,  dueDate: "Jun 10, 2026", assignedTo: "M. Cole" },
    { id: "pt3-3", projectId: "p3", title: "Order PEX materials for Building B",           isComplete: false, dueDate: "Jul 1, 2026",  assignedTo: "M. Cole" },
    { id: "pt3-4", projectId: "p3", title: "Final water pressure test and sign-off",       isComplete: false, dueDate: "Jul 15, 2026", assignedTo: "M. Cole" },
  ],
  "p4": [
    { id: "pt4-1", projectId: "p4", title: "Get budget approval from Robert Chen",   isComplete: false, dueDate: "Jun 15, 2026", assignedTo: "Sara (CSR)" },
    { id: "pt4-2", projectId: "p4", title: "Send updated proposal with Phase 1 scope", isComplete: false, dueDate: "Jun 10, 2026", assignedTo: "J. Patel" },
  ],
};

// ─── Runtime store (seed + projects created in-session, e.g. from a quote) ──
const PROJECTS_KEY = "crm-extra-projects";
let _extraProjects: Project[] | null = null;
function extraProjects(): Project[] {
  if (_extraProjects) return _extraProjects;
  if (typeof window === "undefined") return [];
  try { const r = localStorage.getItem(PROJECTS_KEY); _extraProjects = r ? JSON.parse(r) : []; }
  catch { _extraProjects = []; }
  return _extraProjects!;
}

export function getSessionProjects(): Project[] { return extraProjects(); }
export function getAllProjects(): Project[] { return [...extraProjects(), ...ALL_PROJECTS]; }

export interface NewProjectInput {
  companyId: string; locationId: string; serviceAreaId?: string;
  accountId: string; customerName: string; customerInitials: string; locationName: string;
  name: string; description?: string; type?: ProjectType; priority?: ProjectPriority;
  estimatedValue?: string; propertyAddress?: string;
  assignedTo?: string; assignedToInitials?: string;
}

// Create a project (e.g. converted from a quote). Starts as a draft.
export function createProject(input: NewProjectInput): Project {
  const project: Project = {
    id: `proj-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    companyId: input.companyId, locationId: input.locationId, serviceAreaId: input.serviceAreaId,
    accountId: input.accountId, propertyAddress: input.propertyAddress,
    name: input.name, description: input.description ?? "",
    type: input.type ?? "installation", status: "draft", priority: input.priority ?? "normal",
    assignedTo: input.assignedTo ?? "", assignedToInitials: input.assignedToInitials ?? "",
    estimatedValue: input.estimatedValue, jobIds: [],
    customerName: input.customerName, customerInitials: input.customerInitials, locationName: input.locationName,
  };
  _extraProjects = [project, ...extraProjects()];
  try { localStorage.setItem(PROJECTS_KEY, JSON.stringify(_extraProjects)); } catch { /* ignore */ }
  return project;
}

// ─── Lookup helpers ───────────────────────────────────────
export const PROJECTS_MAP: Record<string, Project> = Object.fromEntries(ALL_PROJECTS.map(p => [p.id, p]));

export function getProject(id: string): Project | undefined {
  return PROJECTS_MAP[id] ?? extraProjects().find(p => p.id === id);
}

export function getProjectTasks(projectId: string): ProjectTask[] {
  return PROJECT_TASKS[projectId] ?? [];
}

export function getProjectProgress(projectId: string): { total: number; completed: number } {
  const jobs = getJobsForProject(projectId);
  return {
    total: jobs.length,
    completed: jobs.filter(j => j.status === "completed").length,
  };
}
