// ─── Users & assignments — store (pre-Supabase) ───────────
// The team directory. Each user holds one or more role@scope assignments — the
// "multiple assignments" model — which the permissions resolver consumes.
//
// Maps to future DB: `users` (or profiles) + `user_assignments` (role, scope ids).
// Seeded with only the account owner — a fresh org has exactly one user until
// more are invited here. Runtime changes persist to localStorage.

import type { RoleKey } from "@/lib/roles/types";

export type UserStatus = "active" | "invited" | "inactive";
export type ScopeLevel = "org" | "company" | "location" | "service_area";

// A role granted at a scope. companyId/locationId/serviceAreaId are filled in
// from the level down (a location assignment also carries its companyId).
export interface RoleAssignment {
  id: string;
  role: RoleKey;
  level: ScopeLevel;
  companyId?: string;
  locationId?: string;
  serviceAreaId?: string;
}

export interface AppUser {
  id: string;
  fullName: string;
  initials: string;
  email: string;
  status: UserStatus;
  isOrgOwner?: boolean;          // the owner grant — can't be removed/deactivated
  assignments: RoleAssignment[];
  createdAt: string;            // ISO date
}

// ─── Helpers ──────────────────────────────────────────────
export function initialsOf(name: string): string {
  const p = name.trim().split(/\s+/);
  return (p.length >= 2 ? p[0][0] + p[p.length - 1][0] : name.slice(0, 2)).toUpperCase();
}

function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

// ─── Seed: the account owner only ─────────────────────────
// Matches lib/hierarchy currentUser (Marcus Reyes) so "You" lines up.
const SEED: AppUser[] = [
  {
    id: "user_marcus",
    fullName: "Marcus Reyes",
    initials: "MR",
    email: "marcus@northstar.example",
    status: "active",
    isOrgOwner: true,
    assignments: [{ id: "asg-owner", role: "org_owner", level: "org" }],
    createdAt: "2026-01-01",
  },
];

// ─── localStorage-backed store ────────────────────────────
const STORAGE_KEY = "crm-users";
let _users: AppUser[] | null = null;

function init(): AppUser[] {
  if (_users) return _users;
  if (typeof window === "undefined") return [...SEED];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    _users = raw ? (JSON.parse(raw) as AppUser[]) : [...SEED];
  } catch {
    _users = [...SEED];
  }
  return _users;
}

function persist(): void {
  if (!_users) return;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(_users)); } catch { /* ignore */ }
}

// ─── Public API ───────────────────────────────────────────
export function getUsers(): AppUser[] {
  return [...init()];
}

export function getUser(id: string): AppUser | undefined {
  return init().find(u => u.id === id);
}

export interface UpsertUserInput {
  id?: string;
  fullName: string;
  email: string;
  status?: UserStatus;
  assignments: Omit<RoleAssignment, "id">[];
}

// Create or update a user. New users default to "invited".
export function upsertUser(input: UpsertUserInput): AppUser {
  const list = init();
  const assignments: RoleAssignment[] = input.assignments.map(a => ({ ...a, id: uid("asg") }));

  if (input.id) {
    const idx = list.findIndex(u => u.id === input.id);
    if (idx >= 0) {
      const existing = list[idx];
      const updated: AppUser = {
        ...existing,
        fullName: input.fullName,
        initials: initialsOf(input.fullName),
        email: input.email,
        status: input.status ?? existing.status,
        // The owner keeps its owner grant regardless of edits.
        assignments: existing.isOrgOwner ? existing.assignments : assignments,
      };
      list[idx] = updated;
      persist();
      return updated;
    }
  }

  const created: AppUser = {
    id: uid("user"),
    fullName: input.fullName,
    initials: initialsOf(input.fullName),
    email: input.email,
    status: input.status ?? "invited",
    assignments,
    createdAt: new Date().toISOString().slice(0, 10),
  };
  _users = [...list, created];
  persist();
  return created;
}

// Soft toggle — never hard-delete a user. Owner can't be deactivated.
export function setUserStatus(id: string, status: UserStatus): void {
  const list = init();
  const u = list.find(x => x.id === id);
  if (!u || u.isOrgOwner) return;
  u.status = status;
  persist();
}

// ─── Derived people lists (rosters / assignee pickers) ────
// The rest of the app identifies a person by display name (assignedTo: string),
// so these return names. Technicians populate the dispatch board & job assignee
// pickers; dispatchers populate the board editor.
const TECH_ROLES: RoleKey[] = ["field_technician", "installer"];
const DISPATCH_ROLES: RoleKey[] = ["dispatcher", "location_manager", "branch_manager", "org_admin", "org_owner"];

export function getActiveUsers(): AppUser[] {
  return init().filter(u => u.status === "active");
}

function hasRoleIn(u: AppUser, roles: RoleKey[]): boolean {
  return u.assignments.some(a => roles.includes(a.role));
}

// Active field technicians — dispatch board rows & job assignees.
export function getTechnicianUsers(): AppUser[] {
  return getActiveUsers().filter(u => hasRoleIn(u, TECH_ROLES));
}
export function getTechnicianNames(): string[] {
  return getTechnicianUsers().map(u => u.fullName);
}
// Users who can run a board — dispatchers plus managers/admins/owner.
export function getDispatcherNames(): string[] {
  return getActiveUsers().filter(u => hasRoleIn(u, DISPATCH_ROLES)).map(u => u.fullName);
}
