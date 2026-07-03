// ─── Users & assignments — store (pre-Supabase) ───────────
// The team directory. Each user holds one or more role@scope assignments — the
// "multiple assignments" model — which the permissions resolver consumes.
//
// Maps to future DB: `users` (or profiles) + `user_assignments` (role, scope ids).
// Seeded with only the account owner — a fresh org has exactly one user until
// more are invited here. Runtime changes persist to localStorage.

import type { RoleKey } from "@/lib/roles/types";
import type { AppAccess } from "@/lib/platform/access";
import { removeMemberFromAllBoards, getBoardsForContext } from "@/lib/calendar/settings";

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
  phone?: string;               // optional contact number (shown in the detail drawer)
  status: UserStatus;
  isOrgOwner?: boolean;          // the owner grant — can't be removed/deactivated
  assignments: RoleAssignment[];
  createdAt: string;            // ISO date
  lastLoginAt?: string;         // ISO date — surfaced in the Security tab (mock)
  // Platform-layer 1: explicit app-access override. When set it wins over the
  // role-derived default (portal is always forced on). See lib/platform/access.
  appAccess?: Partial<AppAccess>;
  // Field tech's home truck/van (an inventory Warehouse id, kind "truck"). Parts
  // consumed on a work order deduct from here. See lib/mobile/truck.
  truckWarehouseId?: string;
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
// Matches lib/hierarchy currentUser (Ryo Martin) so "You" lines up.
const SEED: AppUser[] = [
  {
    id: "user_marcus",
    fullName: "Ryo Martin",
    initials: "RM",
    email: "ryo@northstar.example",
    phone: "+1 (706) 555-0100",
    status: "active",
    isOrgOwner: true,
    assignments: [{ id: "asg-owner", role: "org_owner", level: "org" }],
    createdAt: "2026-01-01",
    lastLoginAt: "2026-06-22",
  },
  // ── Mock platform users — exercise app-access via the View-as menu ──
  // Each carries an explicit appAccess override so the launcher and shell show
  // exactly the apps described, regardless of CRM role-derived defaults.
  {
    id: "user_tucker",
    fullName: "Tucker Hayes",
    initials: "TH",
    email: "tucker@northstar.example",
    phone: "+1 (706) 555-0142",
    status: "active",
    assignments: [{ id: "asg-tucker", role: "field_technician", level: "location", companyId: "co_hvac", locationId: "loc_augusta" }],
    createdAt: "2026-02-01",
    lastLoginAt: "2026-06-21",
    appAccess: { crm: true, documents: true },
  },
  {
    id: "user_kylie",
    fullName: "Kylie Brooks",
    initials: "KB",
    email: "kylie@northstar.example",
    status: "active",
    assignments: [{ id: "asg-kylie", role: "dispatcher", level: "location", companyId: "co_hvac", locationId: "loc_augusta" }],
    createdAt: "2026-02-01",
    appAccess: { crm: true, documents: true },
  },
  {
    id: "user_nicole",
    fullName: "Nicole Adams",
    initials: "NA",
    email: "nicole@northstar.example",
    status: "active",
    assignments: [{ id: "asg-nicole", role: "accounting", level: "org" }],
    createdAt: "2026-02-01",
    appAccess: { crm: true, accounting: true, documents: true },
  },
  {
    id: "user_hr",
    fullName: "Dana Whitfield",
    initials: "DW",
    email: "dana@northstar.example",
    status: "active",
    assignments: [{ id: "asg-hr", role: "hr_manager", level: "org" }],
    createdAt: "2026-02-01",
    appAccess: { hr: true, documents: true },
  },
];

// ─── localStorage-backed store ────────────────────────────
const STORAGE_KEY = "crm-users";
// Tombstones for SEED users the user has deleted — without this the union-in
// below would resurrect them on every fresh load (so deletes never "stuck").
const DELETED_SEEDS_KEY = "crm-users-deleted-seeds";
const SEED_IDS = new Set(SEED.map((s) => s.id));
let _users: AppUser[] | null = null;

function readDeletedSeeds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try { return new Set(JSON.parse(localStorage.getItem(DELETED_SEEDS_KEY) || "[]") as string[]); }
  catch { return new Set(); }
}
function writeDeletedSeeds(ids: Set<string>): void {
  try { localStorage.setItem(DELETED_SEEDS_KEY, JSON.stringify([...ids])); } catch { /* ignore */ }
}

function init(): AppUser[] {
  if (_users) return _users;
  if (typeof window === "undefined") return [...SEED];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const stored = raw ? (JSON.parse(raw) as AppUser[]) : [];
    // Union in any SEED users missing from a previously-cached directory so the
    // mock platform users (and the owner) always exist for the demo. New seed
    // users added later show up without a manual reset — but NOT ones the user
    // has explicitly deleted (those are tombstoned).
    const deleted = readDeletedSeeds();
    const haveIds = new Set(stored.map((u) => u.id));
    const missing = SEED.filter((s) => !haveIds.has(s.id) && !deleted.has(s.id));
    _users = stored.length ? [...stored, ...missing] : SEED.filter((s) => !deleted.has(s.id));
    if (missing.length && stored.length) persist();
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
  phone?: string;
  status?: UserStatus;
  assignments: Omit<RoleAssignment, "id">[];
  truckWarehouseId?: string;    // field tech's home truck (inventory Warehouse id)
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
        phone: input.phone ?? existing.phone,
        status: input.status ?? existing.status,
        truckWarehouseId: input.truckWarehouseId,
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
    phone: input.phone,
    status: input.status ?? "invited",
    assignments,
    truckWarehouseId: input.truckWarehouseId,
    createdAt: new Date().toISOString().slice(0, 10),
  };
  _users = [...list, created];
  persist();
  return created;
}

// Soft toggle — deactivate/reactivate. Owner can't be deactivated.
export function setUserStatus(id: string, status: UserStatus): void {
  const list = init();
  const u = list.find(x => x.id === id);
  if (!u || u.isOrgOwner) return;
  u.status = status;
  persist();
}

// Set (or clear) a user's explicit app-access override. Portal is always forced
// on by the resolver, so it's never written here. Passing undefined removes the
// override entirely, dropping the user back to their role-derived defaults. The
// owner is full-access and ignores overrides.
export function setUserAppAccess(id: string, appAccess: Partial<AppAccess> | undefined): void {
  const list = init();
  const u = list.find(x => x.id === id);
  if (!u || u.isOrgOwner) return;
  if (appAccess) {
    const { portal: _portal, ...rest } = appAccess;
    void _portal;
    u.appAccess = rest;
  } else {
    delete u.appAccess;
  }
  persist();
}

// Permanently remove a user from the directory AND from the rest of the system.
// The org owner can't be deleted.
export function deleteUser(id: string): void {
  const list = init();
  const u = list.find(x => x.id === id);
  if (!u || u.isOrgOwner) return;
  const name = u.fullName;
  _users = list.filter(x => x.id !== id);
  // Tombstone deleted SEED users so init() doesn't resurrect them on reload.
  if (SEED_IDS.has(id)) { const d = readDeletedSeeds(); d.add(id); writeDeletedSeeds(d); }
  persist();
  // Cascade: scrub them from dispatch boards (boards reference people by name, so
  // a delete wouldn't otherwise remove them from the board). Best-effort.
  try { removeMemberFromAllBoards(name); } catch { /* dispatch store may be absent */ }
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

// Staffed = on the team (invited or active); excludes only deactivated users.
// Rosters/pickers use this so a tech you just invited is immediately schedulable.
export function getStaffedUsers(): AppUser[] {
  return init().filter(u => u.status !== "inactive");
}

function hasRoleIn(u: AppUser, roles: RoleKey[]): boolean {
  return u.assignments.some(a => roles.includes(a.role));
}

// Field technicians — dispatch board rows & job assignees (invited + active).
export function getTechnicianUsers(): AppUser[] {
  return getStaffedUsers().filter(u => hasRoleIn(u, TECH_ROLES));
}
export function getTechnicianNames(): string[] {
  return getTechnicianUsers().map(u => u.fullName);
}
// Everyone on the team (invited + active) — anyone can be put on a dispatch board
// or assigned a job. Role lists above are used only as suggestions.
export function getStaffedNames(): string[] {
  return getStaffedUsers().map(u => u.fullName);
}
// Users who can run a board — dispatchers plus managers/admins/owner.
export function getDispatcherNames(): string[] {
  return getStaffedUsers().filter(u => hasRoleIn(u, DISPATCH_ROLES)).map(u => u.fullName);
}

// ─── Board scope eligibility (down-inclusion) ─────────────
// A user is eligible for a board if their assignment scope is comparable to the
// board's scope on the hierarchy path — i.e. the board's node is at or above the
// user's node (or vice-versa). A location tech is eligible for that location's,
// their company's, and org boards; never a sibling location or another company.
function assignmentInScope(a: RoleAssignment, companyId?: string, locationId?: string): boolean {
  if (!companyId) return true;             // org board → everyone
  if (!a.companyId) return true;           // org-wide user → eligible anywhere
  if (a.companyId !== companyId) return false; // different company → no
  if (!locationId) return true;            // company board → anyone in the company
  if (!a.locationId) return true;          // company-level user → eligible on its locations
  return a.locationId === locationId;      // location board → must be this location
}

// Staffed users eligible for a board at the given company/location scope.
export function getBoardCandidates(companyId?: string, locationId?: string): AppUser[] {
  return getStaffedUsers().filter(u => u.assignments.some(a => assignmentInScope(a, companyId, locationId)));
}
export function getBoardCandidateNames(companyId?: string, locationId?: string): string[] {
  return getBoardCandidates(companyId, locationId).map(u => u.fullName);
}
// Suggested members / dispatchers within a board's scope (used to sort the picker).
export function getTechnicianCandidates(companyId?: string, locationId?: string): string[] {
  return getBoardCandidates(companyId, locationId).filter(u => hasRoleIn(u, TECH_ROLES)).map(u => u.fullName);
}
export function getDispatcherCandidates(companyId?: string, locationId?: string): string[] {
  return getBoardCandidates(companyId, locationId).filter(u => hasRoleIn(u, DISPATCH_ROLES)).map(u => u.fullName);
}

// People ACTUALLY ON the dispatch board(s) for a scope — explicit members plus
// role-matched members. This is who has a schedule/truck and is therefore
// dispatchable (mappable + assignable). Dispatchers/office staff who aren't on a
// board are excluded, even though they're board *candidates*.
export function getDispatchBoardMembers(companyId?: string, locationId?: string): Set<string> {
  const names = new Set<string>();
  for (const b of getBoardsForContext(companyId, locationId)) {
    b.techNames.forEach(n => names.add(n));
    getUsersByRoles(b.roleKeys ?? [], b.companyId || undefined, b.locationId || undefined).forEach(u => names.add(u.fullName));
  }
  return names;
}

// Staffed users holding any of the given roles — used by dispatch boards that
// assign members by role. Optionally narrowed to a board's scope so a role only
// pulls in people who actually belong to that company/location.
export function getUsersByRoles(roleKeys: string[], companyId?: string, locationId?: string): AppUser[] {
  if (!roleKeys.length) return [];
  const set = new Set(roleKeys);
  return getStaffedUsers().filter(u =>
    u.assignments.some(a => set.has(a.role) && assignmentInScope(a, companyId, locationId)),
  );
}
