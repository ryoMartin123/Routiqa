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
  stage?: string;          // custom pipeline stage key (Kanban grouping)
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
export const ALL_PROJECTS: Project[] = [];

// ─── Project tasks ────────────────────────────────────────
export const PROJECT_TASKS: Record<string, ProjectTask[]> = {};

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
  stage?: string;
  startDate?: string; targetDate?: string;
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
    type: input.type ?? "installation", status: "draft", stage: input.stage ?? "planning",
    priority: input.priority ?? "normal",
    startDate: input.startDate, targetDate: input.targetDate,
    assignedTo: input.assignedTo ?? "", assignedToInitials: input.assignedToInitials ?? "",
    estimatedValue: input.estimatedValue, jobIds: [],
    customerName: input.customerName, customerInitials: input.customerInitials, locationName: input.locationName,
  };
  _extraProjects = [project, ...extraProjects()];
  try { localStorage.setItem(PROJECTS_KEY, JSON.stringify(_extraProjects)); } catch { /* ignore */ }
  return project;
}

// Patch a session project (e.g. Kanban stage move, status change). Seed projects
// (ALL_PROJECTS) aren't patched — the prototype's seed is empty.
export function updateProject(id: string, patch: Partial<Project>): Project | undefined {
  let updated: Project | undefined;
  _extraProjects = extraProjects().map(p => {
    if (p.id !== id) return p;
    updated = { ...p, ...patch };
    return updated;
  });
  if (updated) { try { localStorage.setItem(PROJECTS_KEY, JSON.stringify(_extraProjects)); } catch { /* ignore */ } }
  return updated;
}

// Delete a session project; delete every project under a company (cascade).
export function deleteProject(id: string): void {
  if (extraProjects().some(p => p.id === id)) {
    _extraProjects = extraProjects().filter(p => p.id !== id);
    try { localStorage.setItem(PROJECTS_KEY, JSON.stringify(_extraProjects)); } catch { /* ignore */ }
  }
}
export function deleteProjectsByCompany(companyId: string): void {
  getAllProjects().filter(p => p.companyId === companyId).forEach(p => deleteProject(p.id));
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
