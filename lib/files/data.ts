// Photos & Files — mock data + scope-aware getters.
// Replace with Supabase: photos_files table + Storage signed URLs.
// Files are stored ONCE; getFiles() matches by any combination of linked IDs.

import type { PhotoFile, FileScope, FileType, FileLinkKind } from "./types";

const STORAGE_KEY = "crm-photos-files-v2";

// ─── Seed data ────────────────────────────────────────────
// Linked to real customer ids (1,2,4,7,8), properties (p1-1, p8-1…), jobs (j1,j2…).
const SEED: PhotoFile[] = [];

// ─── Runtime store ────────────────────────────────────────
let _files: PhotoFile[] | null = null;

function init(): PhotoFile[] {
  if (_files) return _files;
  if (typeof window === "undefined") return SEED;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    _files = raw ? (JSON.parse(raw) as PhotoFile[]) : [...SEED];
  } catch { _files = [...SEED]; }
  return _files;
}

function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(_files)); } catch { /* ignore */ }
}

// ─── Scope-aware getter ───────────────────────────────────
// Returns files matching ALL provided scope IDs (AND). Empty scope = all files.
export function getFiles(scope: FileScope = {}): PhotoFile[] {
  return init()
    .filter(f =>
      (!scope.accountId   || f.accountId   === scope.accountId)   &&
      (!scope.propertyId  || f.propertyId  === scope.propertyId)  &&
      (!scope.leadId      || f.leadId      === scope.leadId)      &&
      (!scope.jobId       || f.jobId       === scope.jobId)       &&
      (!scope.projectId   || f.projectId   === scope.projectId)   &&
      (!scope.workOrderId || f.workOrderId === scope.workOrderId) &&
      (!scope.agreementId || f.agreementId === scope.agreementId) &&
      (!scope.quoteId     || f.quoteId     === scope.quoteId)     &&
      (!scope.invoiceId   || f.invoiceId   === scope.invoiceId)   &&
      (!scope.equipmentId || f.equipmentId === scope.equipmentId)
    )
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

// Distinct uploaders (for the filter dropdown).
export function getUploaders(): string[] {
  return Array.from(new Set(init().map(f => f.uploadedBy))).sort();
}

// Distinct accounts present in the library (for the account filter).
export function getFileAccounts(): { id: string; name: string }[] {
  const map = new Map<string, string>();
  for (const f of init()) {
    if (f.accountId) map.set(f.accountId, f.accountName ?? f.accountId);
  }
  return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
}

// Distinct locations present in the library (for the location filter).
export function getFileLocations(): string[] {
  return Array.from(new Set(init().map(f => f.locationId))).filter(Boolean).sort();
}

// The most specific linked record a file belongs to → drives the badge.
// Order matters: a work-order photo is more specific than a job photo, etc.
export function fileLinkKind(f: PhotoFile): FileLinkKind {
  if (f.workOrderId) return "work_order";
  if (f.jobId)       return "job";
  if (f.projectId)   return "project";
  if (f.agreementId) return "agreement";
  if (f.quoteId)     return "quote";
  if (f.invoiceId)   return "invoice";
  if (f.propertyId)  return "property";
  return "account";
}

// Badge label + accent color per link kind.
export const LINK_BADGE: Record<FileLinkKind, { label: string; color: string }> = {
  work_order: { label: "Work Order Photo",   color: "#0891b2" },
  job:        { label: "Job Photo",          color: "#4f46e5" },
  project:    { label: "Project File",       color: "#7c3aed" },
  agreement:  { label: "Agreement Document", color: "#059669" },
  quote:      { label: "Quote Attachment",   color: "#d97706" },
  invoice:    { label: "Invoice Attachment", color: "#dc2626" },
  property:   { label: "Property File",      color: "#0d9488" },
  account:    { label: "Account File",       color: "#6b7280" },
};

// Does a file carry the given link kind at all (for the "Linked to" filter)?
export function fileHasLink(f: PhotoFile, kind: FileLinkKind): boolean {
  switch (kind) {
    case "work_order": return !!f.workOrderId;
    case "job":        return !!f.jobId;
    case "project":    return !!f.projectId;
    case "agreement":  return !!f.agreementId;
    case "quote":      return !!f.quoteId;
    case "invoice":    return !!f.invoiceId;
    case "property":   return !!f.propertyId;
    case "account":    return fileLinkKind(f) === "account"; // account-only
  }
}

// ─── Mock upload — auto-fills the scope chain ─────────────
export function addFile(input: {
  scope: FileScope; fileName: string; fileType: FileType; categoryKey: string;
  uploadedBy: string; notes?: string; accountName?: string;
}): PhotoFile[] {
  const list = init();
  const today = new Date();
  const f: PhotoFile = {
    id: `f-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    organizationId: "org_northstar", companyId: "co_hvac", locationId: "loc_augusta",
    accountId:    input.scope.accountId ?? "",
    propertyId:   input.scope.propertyId,
    leadId:       input.scope.leadId,
    jobId:        input.scope.jobId,
    projectId:    input.scope.projectId,
    workOrderId:  input.scope.workOrderId,
    agreementId:  input.scope.agreementId,
    equipmentId:  input.scope.equipmentId,
    categoryKey:  input.categoryKey,
    fileName:     input.fileName,
    fileType:     input.fileType,
    storagePath:  `acct/${input.scope.accountId}/${input.fileName}`,
    notes:        input.notes,
    tags:         [],
    uploadedBy:   input.uploadedBy,
    uploadedAt:   today.toISOString().slice(0, 10),
    displayDate:  today.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    accountName:  input.accountName,
  };
  _files = [f, ...list];
  persist();
  return getFiles();
}
