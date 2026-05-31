// Photos & Files — mock data + scope-aware getters.
// Replace with Supabase: photos_files table + Storage signed URLs.
// Files are stored ONCE; getFiles() matches by any combination of linked IDs.

import type { PhotoFile, FileScope, FileType, FileLinkKind } from "./types";

const STORAGE_KEY = "crm-photos-files-v2";

// ─── Seed data ────────────────────────────────────────────
// Linked to real customer ids (1,2,4,7,8), properties (p1-1, p8-1…), jobs (j1,j2…).
const SEED: PhotoFile[] = [
  {
    id: "f1", organizationId: "org_northstar", companyId: "co_hvac", locationId: "loc_augusta", serviceAreaId: "sa_augusta",
    accountId: "1", propertyId: "p1-1", jobId: "j1",
    categoryKey: "equipment_plate", fileName: "carrier-nameplate.jpg", fileType: "image",
    storagePath: "acct/1/job/j1/carrier-nameplate.jpg", tags: ["carrier", "nameplate"],
    notes: "3-ton unit serial plate", uploadedBy: "J. Patel", uploadedAt: "2026-04-03", displayDate: "Apr 3, 2026", accountName: "Sarah Mitchell",
  },
  {
    id: "f2", organizationId: "org_northstar", companyId: "co_hvac", locationId: "loc_augusta", serviceAreaId: "sa_augusta",
    accountId: "1", propertyId: "p1-1", jobId: "j1",
    categoryKey: "before", fileName: "filter-before.jpg", fileType: "image",
    storagePath: "acct/1/job/j1/filter-before.jpg", tags: ["filter"],
    uploadedBy: "J. Patel", uploadedAt: "2026-04-03", displayDate: "Apr 3, 2026", accountName: "Sarah Mitchell",
  },
  {
    id: "f3", organizationId: "org_northstar", companyId: "co_hvac", locationId: "loc_augusta", serviceAreaId: "sa_augusta",
    accountId: "1", propertyId: "p1-1", jobId: "j1",
    categoryKey: "after", fileName: "filter-after.jpg", fileType: "image",
    storagePath: "acct/1/job/j1/filter-after.jpg", tags: ["filter"],
    uploadedBy: "J. Patel", uploadedAt: "2026-04-03", displayDate: "Apr 3, 2026", accountName: "Sarah Mitchell",
  },
  {
    id: "f4", organizationId: "org_northstar", companyId: "co_hvac", locationId: "loc_augusta", serviceAreaId: "sa_augusta",
    accountId: "1", propertyId: "p1-1",
    categoryKey: "documents", fileName: "maintenance-agreement.pdf", fileType: "pdf",
    storagePath: "acct/1/maintenance-agreement.pdf", tags: ["agreement"],
    notes: "Signed HVAC maintenance plan", uploadedBy: "Sara (CSR)", uploadedAt: "2022-01-15", displayDate: "Jan 15, 2022", accountName: "Sarah Mitchell",
  },
  {
    id: "f5", organizationId: "org_northstar", companyId: "co_hvac", locationId: "loc_augusta", serviceAreaId: "sa_augusta",
    accountId: "2", propertyId: "p2-1", jobId: "j4",
    categoryKey: "equipment_plate", fileName: "rtu-3-plate.jpg", fileType: "image",
    storagePath: "acct/2/job/j4/rtu-3-plate.jpg", tags: ["trane", "rtu"],
    notes: "RTU 3 nameplate", uploadedBy: "M. Cole", uploadedAt: "2026-03-05", displayDate: "Mar 5, 2026", accountName: "Hammond LLC",
  },
  {
    id: "f6", organizationId: "org_northstar", companyId: "co_hvac", locationId: "loc_augusta", serviceAreaId: "sa_augusta",
    accountId: "2", propertyId: "p2-1", jobId: "j4",
    categoryKey: "issue_found", fileName: "capacitor-issue.jpg", fileType: "image",
    storagePath: "acct/2/job/j4/capacitor-issue.jpg", tags: ["capacitor"],
    notes: "Bulging capacitor on RTU 3", uploadedBy: "M. Cole", uploadedAt: "2026-03-10", displayDate: "Mar 10, 2026", accountName: "Hammond LLC",
  },
  {
    id: "f7", organizationId: "org_northstar", companyId: "co_roofing", locationId: "loc_columbia", serviceAreaId: "sa_columbia",
    accountId: "2", propertyId: "p2-1", projectId: "p2",
    categoryKey: "issue_found", fileName: "roof-damage-overview.jpg", fileType: "image",
    storagePath: "acct/2/project/p2/roof-damage-overview.jpg", tags: ["roof", "damage"],
    notes: "Damage near HVAC curbs", uploadedBy: "D. Nguyen", uploadedAt: "2026-05-28", displayDate: "May 28, 2026", accountName: "Hammond LLC",
  },
  {
    id: "f8", organizationId: "org_northstar", companyId: "co_roofing", locationId: "loc_columbia", serviceAreaId: "sa_columbia",
    accountId: "2", propertyId: "p2-1", projectId: "p2",
    categoryKey: "documents", fileName: "roof-inspection-report.pdf", fileType: "pdf",
    storagePath: "acct/2/project/p2/roof-inspection-report.pdf", tags: ["inspection", "report"],
    uploadedBy: "D. Nguyen", uploadedAt: "2026-05-28", displayDate: "May 28, 2026", accountName: "Hammond LLC",
  },
  {
    id: "f9", organizationId: "org_northstar", companyId: "co_hvac", locationId: "loc_evans", serviceAreaId: "sa_evans",
    accountId: "4", propertyId: "p4-1", jobId: "j8", workOrderId: "wo-j8",
    categoryKey: "during", fileName: "unit-22-drain.jpg", fileType: "image",
    storagePath: "acct/4/job/j8/unit-22-drain.jpg", tags: ["drain", "plumbing"],
    notes: "Blockage ~12ft in", uploadedBy: "M. Cole", uploadedAt: "2026-05-30", displayDate: "May 30, 2026", accountName: "Lakeside Apartments",
  },
  {
    id: "f10", organizationId: "org_northstar", companyId: "co_hvac", locationId: "loc_augusta", serviceAreaId: "sa_augusta",
    accountId: "7", propertyId: "p7-auto", jobId: "pj1-2", projectId: "p1", workOrderId: "wo-pj1-2",
    categoryKey: "during", fileName: "install-progress.jpg", fileType: "image",
    storagePath: "acct/7/job/pj1-2/install-progress.jpg", tags: ["install", "carrier"],
    notes: "Air handler set in attic", uploadedBy: "J. Patel", uploadedAt: "2026-05-30", displayDate: "May 30, 2026", accountName: "Alvarez Residence",
  },
  {
    id: "f11", organizationId: "org_northstar", companyId: "co_hvac", locationId: "loc_augusta", serviceAreaId: "sa_augusta",
    accountId: "8", propertyId: "p8-1", jobId: "pj4-1", projectId: "p4",
    categoryKey: "before", fileName: "rtu-assessment.jpg", fileType: "image",
    storagePath: "acct/8/job/pj4-1/rtu-assessment.jpg", tags: ["assessment"],
    uploadedBy: "J. Patel", uploadedAt: "2026-04-15", displayDate: "Apr 15, 2026", accountName: "ABC Property Group",
  },
  {
    id: "f12", organizationId: "org_northstar", companyId: "co_hvac", locationId: "loc_augusta", serviceAreaId: "sa_augusta",
    accountId: "8", propertyId: "p8-1",
    categoryKey: "documents", fileName: "property-summary-may.pdf", fileType: "pdf",
    storagePath: "acct/8/property-summary-may.pdf", tags: ["report", "monthly"],
    notes: "Monthly property summary", uploadedBy: "Sara (CSR)", uploadedAt: "2026-05-31", displayDate: "May 31, 2026", accountName: "ABC Property Group",
  },
  {
    id: "f13", organizationId: "org_northstar", companyId: "co_hvac", locationId: "loc_augusta", serviceAreaId: "sa_augusta",
    accountId: "1", agreementId: "1",
    categoryKey: "documents", fileName: "hvac-agreement-signed.pdf", fileType: "pdf",
    storagePath: "acct/1/agreement/1/hvac-agreement-signed.pdf", tags: ["agreement", "signed"],
    notes: "Signed maintenance agreement", uploadedBy: "Sara (CSR)", uploadedAt: "2022-01-15", displayDate: "Jan 15, 2022", accountName: "Sarah Mitchell",
  },
  {
    id: "f14", organizationId: "org_northstar", companyId: "co_roofing", locationId: "loc_columbia", serviceAreaId: "sa_columbia",
    accountId: "2", projectId: "p2", quoteId: "q-2001",
    categoryKey: "documents", fileName: "roof-replacement-quote.pdf", fileType: "pdf",
    storagePath: "acct/2/quote/q-2001/roof-replacement-quote.pdf", tags: ["quote", "roofing"],
    notes: "Full roof replacement estimate", uploadedBy: "D. Nguyen", uploadedAt: "2026-03-20", displayDate: "Mar 20, 2026", accountName: "Hammond LLC",
  },
  {
    id: "f15", organizationId: "org_northstar", companyId: "co_hvac", locationId: "loc_augusta", serviceAreaId: "sa_augusta",
    accountId: "2", invoiceId: "inv-1042",
    categoryKey: "documents", fileName: "invoice-1042.pdf", fileType: "pdf",
    storagePath: "acct/2/invoice/inv-1042/invoice-1042.pdf", tags: ["invoice", "billing"],
    notes: "Emergency HVAC repair invoice", uploadedBy: "Sara (CSR)", uploadedAt: "2026-03-12", displayDate: "Mar 12, 2026", accountName: "Hammond LLC",
  },
];

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
