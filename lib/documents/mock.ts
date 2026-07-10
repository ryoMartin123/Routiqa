// ─── Documents & Company Info — mock data + CRUD ──────────
// A company knowledge base + document manager. Folders organize; documents are
// editable knowledge/article/file records; templates are reusable starters.
// Mock/local (in-memory, tick-refresh) — no Supabase. Files/uploads, version
// history, approvals, and required-reading are placeholders for a later phase.

export const DOC_ROOT_ID = "root";

import type { DesignDoc } from "@/lib/design-studio/model";

export type DocType =
  | "SOP" | "Policy" | "Training" | "Template" | "HR Document" | "Sales Document"
  | "Safety Document" | "System Document" | "Vendor Document" | "Subcontractor Document"
  | "Meeting Notes" | "Contract" | "Editable Document" | "Note" | "Checklist"
  | "Form" | "Spreadsheet" | "PDF" | "Image" | "Link" | "Other";

export const DOC_TYPES: DocType[] = [
  "SOP", "Policy", "Training", "Template", "HR Document", "Sales Document",
  "Safety Document", "System Document", "Vendor Document", "Subcontractor Document",
  "Meeting Notes", "Contract", "Editable Document", "Note", "Checklist",
  "Form", "Spreadsheet", "PDF", "Image", "Link", "Other",
];

export type DocStatus = "Draft" | "In Review" | "Published" | "Archived";
export const DOC_STATUSES: DocStatus[] = ["Draft", "In Review", "Published", "Archived"];
// Semantic (not the app accent): Published green, Draft gray, Review amber, Archived muted.
export const STATUS_COLOR: Record<DocStatus, string> = {
  Draft: "#6b7280", "In Review": "#f59e0b", Published: "#10b981", Archived: "#9ca3af",
};

export type DocVisibility =
  | "Everyone" | "Field Employees" | "Office/Admin" | "Managers Only"
  | "Specific Roles" | "Specific Users" | "Company/Location" | "Private" | "Linked Record Only";
export const DOC_VISIBILITIES: DocVisibility[] = [
  "Everyone", "Field Employees", "Office/Admin", "Managers Only",
  "Specific Roles", "Specific Users", "Company/Location", "Private", "Linked Record Only",
];
export const VIS_COLOR: Record<DocVisibility, string> = {
  Everyone: "#0ea5e9", "Field Employees": "#10b981", "Office/Admin": "#239c8d",
  "Managers Only": "#a855f7", "Specific Roles": "#8b5cf6", "Specific Users": "#8b5cf6",
  "Company/Location": "#0891b2", Private: "#ef4444", "Linked Record Only": "#f59e0b",
};

export type LinkedApp = "CRM" | "HR" | "Inventory" | "Team Workspace" | "Accounting" | "Platform";
export const LINKED_APPS: LinkedApp[] = ["CRM", "HR", "Inventory", "Team Workspace", "Accounting", "Platform"];
export const LINKED_APP_COLOR: Record<LinkedApp, string> = {
  CRM: "#239c8d", HR: "#ec4899", Inventory: "#f97316", "Team Workspace": "#2563eb", Accounting: "#10b981", Platform: "#a855f7",
};

export interface LinkedRecord { app: LinkedApp; label: string }

export interface DocFolder {
  id: string;
  name: string;
  parentId: string | null;       // null = top-level (under the Company Documents root)
  description?: string;
  visibility: DocVisibility;
  archived?: boolean;
}

export interface DocItem {
  id: string;
  title: string;
  body?: string;                 // plain text — derived from `design` when one exists
  design?: DesignDoc;            // block design (Design Studio); opens in the studio, not the text editor
  folderId: string;              // where it LIVES (folder tree)
  type: DocType;                 // what it IS (drives which smart view it appears in)
  category?: string;             // department/grouping (defaults to top-level folder)
  status: DocStatus;
  visibility: DocVisibility;
  tags: string[];
  owner: string;
  linkedApp?: LinkedApp;
  linkedRecords?: LinkedRecord[];
  reviewDate?: string;
  requiresAcknowledgement?: boolean;
  trainingRequired?: boolean;
  templateType?: string;
  archived?: boolean;
  version: number;
  createdAt: string;
  updated: string;               // human date
}

export interface DocTemplate {
  id: string;
  name: string;
  type: DocType;
  description: string;
  body: string;
}

// ─── Nested tree shape (built from the flat folder list for the tree UI) ──
export interface FolderNode extends DocFolder { children: FolderNode[] }

// ─── Helpers ──────────────────────────────────────────────
function uid(p: string): string { return `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`; }
const today = "Jun 24, 2026";

// ─── Seed folders (flat with parentId) ────────────────────
let _folders: DocFolder[] = [
  // System Management
  { id: "system", name: "System Management", parentId: null, visibility: "Office/Admin" },
  { id: "sys-2025", name: "2025 Updates", parentId: "system", visibility: "Office/Admin" },
  { id: "sys-hiring", name: "Hiring Process", parentId: "system", visibility: "Managers Only" },
  { id: "sys-billing", name: "Billing Process", parentId: "system", visibility: "Office/Admin" },
  { id: "sys-fundamentals", name: "Fundamentals", parentId: "system", visibility: "Everyone" },
  // HVAC Operations
  { id: "hvac", name: "HVAC Operations", parentId: null, visibility: "Field Employees", description: "Field SOPs, install & maintenance procedures, and safety." },
  { id: "hvac-service", name: "Service SOPs", parentId: "hvac", visibility: "Field Employees" },
  { id: "hvac-install", name: "Install SOPs", parentId: "hvac", visibility: "Field Employees" },
  { id: "hvac-maint", name: "Maintenance Procedures", parentId: "hvac", visibility: "Field Employees" },
  { id: "hvac-safety", name: "Safety", parentId: "hvac", visibility: "Everyone" },
  // HR
  { id: "hr", name: "HR", parentId: null, visibility: "Everyone" },
  { id: "hr-handbook", name: "Employee Handbook", parentId: "hr", visibility: "Everyone" },
  { id: "hr-onboarding", name: "Onboarding", parentId: "hr", visibility: "Managers Only" },
  { id: "hr-training", name: "Training", parentId: "hr", visibility: "Everyone" },
  { id: "hr-policies", name: "Policies", parentId: "hr", visibility: "Everyone" },
  // Sales
  { id: "sales", name: "Sales", parentId: null, visibility: "Office/Admin" },
  { id: "sales-scripts", name: "Scripts", parentId: "sales", visibility: "Office/Admin" },
  { id: "sales-proposals", name: "Proposal Templates", parentId: "sales", visibility: "Office/Admin" },
  { id: "sales-financing", name: "Financing", parentId: "sales", visibility: "Office/Admin" },
  // Accounting
  { id: "accounting", name: "Accounting", parentId: null, visibility: "Office/Admin" },
  { id: "acct-billing", name: "Billing Process", parentId: "accounting", visibility: "Office/Admin" },
  { id: "acct-collections", name: "Collections", parentId: "accounting", visibility: "Office/Admin" },
  { id: "acct-reports", name: "Reports", parentId: "accounting", visibility: "Managers Only" },
  // Vendors
  { id: "vendors", name: "Vendors", parentId: null, visibility: "Office/Admin", description: "Vendor compliance & purchasing documents." },
  { id: "vend-w9", name: "W-9s", parentId: "vendors", visibility: "Office/Admin" },
  { id: "vend-coi", name: "Insurance Certificates", parentId: "vendors", visibility: "Office/Admin" },
  { id: "vend-price", name: "Price Sheets", parentId: "vendors", visibility: "Office/Admin" },
  { id: "vend-contracts", name: "Contracts", parentId: "vendors", visibility: "Managers Only" },
  // Subcontractors
  { id: "subs", name: "Subcontractors", parentId: null, visibility: "Office/Admin", description: "Subcontractor agreements, compliance, and scopes." },
  { id: "sub-agreements", name: "Agreements", parentId: "subs", visibility: "Managers Only" },
  { id: "sub-cois", name: "COIs", parentId: "subs", visibility: "Office/Admin" },
  { id: "sub-licenses", name: "Licenses", parentId: "subs", visibility: "Office/Admin" },
  { id: "sub-scopes", name: "Work Scopes", parentId: "subs", visibility: "Office/Admin" },
];

const lr = (app: LinkedApp, label: string): LinkedRecord => ({ app, label });
function mkDoc(d: Omit<DocItem, "version" | "createdAt"> & { version?: number; createdAt?: string }): DocItem {
  return { version: d.version ?? 1, createdAt: d.createdAt ?? d.updated, ...d };
}

let _docs: DocItem[] = [
  mkDoc({ id: "d-acservice", title: "AC Service SOP", folderId: "hvac-service", type: "SOP", category: "HVAC Operations", reviewDate: "Dec 1, 2026", status: "Published", owner: "Ryo Martin", updated: "Jun 18, 2026", tags: ["sop", "service"], visibility: "Field Employees", linkedApp: "CRM", body: "Standard operating procedure for AC service calls.\n\n1. Confirm customer & equipment\n2. Diagnose system\n3. Perform service tasks\n4. Test operation\n5. Review with customer & capture photos" }),
  mkDoc({ id: "d-maintcheck", title: "Maintenance Visit Checklist", folderId: "hvac-maint", type: "Checklist", status: "Published", owner: "Tucker Hayes", updated: "Jun 17, 2026", tags: ["checklist", "maintenance"], visibility: "Field Employees", linkedApp: "CRM" }),
  mkDoc({ id: "d-installstart", title: "Install Startup Procedure", folderId: "hvac-install", type: "SOP", status: "Draft", owner: "Tucker Hayes", updated: "Jun 20, 2026", tags: ["sop", "install"], visibility: "Field Employees" }),
  mkDoc({ id: "d-workphone", title: "Work Phone Setup SOP", folderId: "sys-fundamentals", type: "SOP", status: "Published", owner: "Ryo Martin", updated: "May 28, 2026", tags: ["it", "onboarding"], visibility: "Everyone" }),
  mkDoc({ id: "d-truckinspect", title: "Truck Inspection Checklist", folderId: "hvac-safety", type: "Checklist", status: "Published", owner: "Dana Whitfield", updated: "Jun 11, 2026", tags: ["safety", "fleet"], visibility: "Field Employees" }),
  mkDoc({ id: "d-custcomm", title: "Customer Communication SOP", folderId: "sales-scripts", type: "SOP", status: "In Review", owner: "Ryo Martin", updated: "Jun 22, 2026", tags: ["sales", "communication"], visibility: "Office/Admin", linkedApp: "CRM" }),
  mkDoc({ id: "d-handbook", title: "Employee Handbook", folderId: "hr-handbook", type: "HR Document", category: "HR", requiresAcknowledgement: true, status: "Published", owner: "Dana Whitfield", updated: "Jun 01, 2026", tags: ["policy", "hr"], visibility: "Everyone", linkedApp: "HR", version: 4 }),
  mkDoc({ id: "d-safetypolicy", title: "Safety Policy", folderId: "hvac-safety", type: "Policy", status: "Published", owner: "Dana Whitfield", updated: "Apr 02, 2026", tags: ["safety", "policy"], visibility: "Everyone" }),
  mkDoc({ id: "d-pto", title: "PTO Policy", folderId: "hr-policies", type: "Policy", status: "Published", owner: "Dana Whitfield", updated: "Jun 15, 2026", tags: ["policy", "pto"], visibility: "Everyone", linkedApp: "HR" }),
  mkDoc({ id: "d-vendw9", title: "Vendor W-9: East Coast Metal", folderId: "vend-w9", type: "Vendor Document", category: "Vendors", status: "Published", owner: "Nicole Adams", updated: "Jun 10, 2026", tags: ["w-9", "vendor"], visibility: "Office/Admin", linkedApp: "Inventory", linkedRecords: [lr("Inventory", "East Coast Metal")] }),
  mkDoc({ id: "d-subcoi", title: "Subcontractor COI: Smith Electrical", folderId: "sub-cois", type: "Subcontractor Document", category: "Subcontractors", status: "In Review", owner: "Nicole Adams", updated: "Jun 21, 2026", tags: ["coi", "compliance"], visibility: "Managers Only", linkedApp: "Inventory", linkedRecords: [lr("Inventory", "Smith Electrical")] }),
  mkDoc({ id: "d-friday", title: "Friday Training: Airflow Diagnostics", folderId: "hr-training", type: "Training", category: "Training", trainingRequired: true, status: "Published", owner: "Ryo Martin", updated: "Jun 13, 2026", tags: ["training", "hvac"], visibility: "Field Employees", linkedApp: "HR", linkedRecords: [lr("Team Workspace", "Friday Training Meeting")] }),
  mkDoc({ id: "d-proposalterms", title: "Proposal Terms Template", folderId: "sales-proposals", type: "Template", status: "Published", owner: "Ryo Martin", updated: "Jun 09, 2026", tags: ["proposal", "template"], visibility: "Office/Admin", linkedApp: "CRM" }),
  mkDoc({ id: "d-financing", title: "Financing Explanation Template", folderId: "sales-financing", type: "Template", status: "Published", owner: "Ryo Martin", updated: "May 22, 2026", tags: ["financing", "template"], visibility: "Office/Admin", linkedApp: "CRM" }),
  mkDoc({ id: "d-collections", title: "Collections Procedure", folderId: "acct-collections", type: "SOP", status: "Published", owner: "Nicole Adams", updated: "Jun 05, 2026", tags: ["accounting"], visibility: "Office/Admin", linkedApp: "Accounting" }),
  mkDoc({ id: "d-close", title: "Monthly Close Report", folderId: "acct-reports", type: "Spreadsheet", status: "Draft", owner: "Nicole Adams", updated: "Jun 19, 2026", tags: ["report"], visibility: "Managers Only", linkedApp: "Accounting" }),
  mkDoc({ id: "d-newhire", title: "New Hire Checklist", folderId: "sys-hiring", type: "Checklist", status: "Published", owner: "Dana Whitfield", updated: "Jun 12, 2026", tags: ["hiring"], visibility: "Managers Only", linkedApp: "HR" }),
  mkDoc({ id: "d-fundamentals", title: "Company Fundamentals", folderId: "sys-fundamentals", type: "Editable Document", status: "Published", owner: "Ryo Martin", updated: "May 30, 2026", tags: ["overview"], visibility: "Everyone" }),
];

// ─── Templates (reusable starters — not company documents) ──
const TEMPLATES: DocTemplate[] = [
  { id: "tpl-sop", name: "SOP Template", type: "SOP", description: "Standard operating procedure starter.", body: "Purpose:\n\nScope:\n\nProcedure:\n1.\n2.\n3.\n\nSafety notes:\n\nRevision history:" },
  { id: "tpl-policy", name: "Policy Template", type: "Policy", description: "Company policy starter.", body: "Policy statement:\n\nApplies to:\n\nDetails:\n\nEffective date:\n\nAcknowledgement required: Yes" },
  { id: "tpl-training", name: "Training Guide Template", type: "Editable Document", description: "Training guide starter.", body: "Objective:\n\nMaterials:\n\nSteps:\n\nKnowledge check:" },
  { id: "tpl-meeting", name: "Meeting Notes Template", type: "Meeting Notes", description: "Meeting notes starter.", body: "Date:\nAttendees:\n\nAgenda:\n\nNotes:\n\nAction items:" },
  { id: "tpl-vendor", name: "Vendor File Template", type: "Editable Document", description: "Vendor document checklist.", body: "Vendor:\n\nDocuments on file:\n- W-9\n- Insurance certificate\n- Vendor agreement\n- Price sheet" },
  { id: "tpl-subcompliance", name: "Subcontractor Compliance Template", type: "Checklist", description: "Subcontractor compliance checklist.", body: "Subcontractor:\n\nCompliance:\n- W-9\n- COI (insurance)\n- License\n- Signed agreement" },
  { id: "tpl-custcomm", name: "Customer Communication Template", type: "Editable Document", description: "Customer message starter.", body: "Greeting:\n\nPurpose:\n\nDetails:\n\nNext steps:\n\nSign-off:" },
];

// ─── Activity (mock recent feed) ──────────────────────────
export interface DocActivity { id: string; text: string; when: string }
let _activity: DocActivity[] = [
  { id: "da-1", text: "Customer Communication SOP submitted for review", when: "2 hours ago" },
  { id: "da-2", text: "Employee Handbook published (v4)", when: "Yesterday" },
  { id: "da-3", text: "Subcontractor COI: Smith Electrical uploaded", when: "Jun 21, 2026" },
  { id: "da-4", text: "Truck Inspection Checklist updated", when: "Jun 11, 2026" },
];
function logActivity(text: string) { _activity = [{ id: uid("da"), text, when: "Just now" }, ..._activity].slice(0, 30); }

// ─── Folder API ───────────────────────────────────────────
export function getFolders(): DocFolder[] { return _folders.filter(f => !f.archived); }
export function getFolder(id: string): DocFolder | undefined { return _folders.find(f => f.id === id); }
export function topFolders(): DocFolder[] { return getFolders().filter(f => f.parentId === null); }
export function childFolders(parentId: string | null): DocFolder[] { return getFolders().filter(f => f.parentId === parentId); }

export function getFolderTree(): FolderNode[] {
  const build = (parentId: string | null): FolderNode[] =>
    childFolders(parentId).map(f => ({ ...f, children: build(f.id) }));
  return build(null);
}

export function descendantFolderIds(folderId: string): string[] {
  const out = [folderId];
  for (const c of childFolders(folderId)) out.push(...descendantFolderIds(c.id));
  return out;
}

// Document count at-or-below a folder (for tree counts).
export function docCountDeep(folderId: string): number {
  const ids = new Set(descendantFolderIds(folderId));
  return _docs.filter(d => !isArchived(d) && ids.has(d.folderId)).length;
}

export function folderPath(folderId: string): DocFolder[] {
  const path: DocFolder[] = [];
  let cur = getFolder(folderId);
  while (cur) { path.unshift(cur); cur = cur.parentId ? getFolder(cur.parentId) : undefined; }
  return path;
}

export interface NewFolderInput { name: string; parentId: string | null; description?: string; visibility: DocVisibility }
export function createFolder(input: NewFolderInput): DocFolder {
  const f: DocFolder = { ...input, id: uid("fold") };
  _folders = [..._folders, f];
  logActivity(`Folder "${f.name}" created`);
  return f;
}
export function renameFolder(id: string, name: string): void { _folders = _folders.map(f => f.id === id ? { ...f, name } : f); }
export function updateFolder(id: string, patch: Partial<DocFolder>): void { _folders = _folders.map(f => f.id === id ? { ...f, ...patch, id: f.id } : f); }
export function archiveFolder(id: string): void { _folders = _folders.map(f => f.id === id ? { ...f, archived: true } : f); }

// ─── Document API ─────────────────────────────────────────
function isArchived(d: DocItem): boolean { return d.status === "Archived" || d.archived === true; }
export function getDocuments(): DocItem[] { return _docs; }

// ─── Smart-view queries (left sidebar = smart views by metadata) ──
// Category defaults to the top-level folder name when not set explicitly.
export function docCategory(d: DocItem): string {
  if (d.category) return d.category;
  return folderPath(d.folderId)[0]?.name ?? "—";
}
export function inFolderTree(d: DocItem, rootFolderId: string): boolean {
  return descendantFolderIds(rootFolderId).includes(d.folderId);
}
// Live (non-archived) documents matching a predicate — drives the smart views.
export function documentsWhere(pred: (d: DocItem) => boolean): DocItem[] {
  return _docs.filter(d => !isArchived(d) && pred(d));
}
export function documentsByType(type: DocType): DocItem[] { return documentsWhere(d => d.type === type); }
export function archivedDocuments(): DocItem[] { return _docs.filter(isArchived); }
export function categoriesInUse(docs: DocItem[]): string[] { return [...new Set(docs.map(docCategory))].sort(); }
export function getDocument(id: string): DocItem | undefined { return _docs.find(d => d.id === id); }
export function docsInFolder(folderId: string, includeArchived = false): DocItem[] {
  return _docs.filter(d => d.folderId === folderId && (includeArchived || !isArchived(d)));
}
export function archivedDocs(): DocItem[] { return _docs.filter(isArchived); }

export interface NewDocInput {
  title: string; folderId: string; type: DocType; status?: DocStatus; visibility: DocVisibility;
  body?: string; design?: DesignDoc; tags?: string[]; owner?: string; linkedApp?: LinkedApp; linkedRecords?: LinkedRecord[];
}
export function createDocument(input: NewDocInput): DocItem {
  const d: DocItem = {
    id: uid("doc"), title: input.title.trim() || "Untitled", folderId: input.folderId,
    type: input.type, status: input.status ?? "Draft", visibility: input.visibility,
    body: input.body ?? "", design: input.design, tags: input.tags ?? [], owner: input.owner ?? "Ryo Martin",
    linkedApp: input.linkedApp, linkedRecords: input.linkedRecords, version: 1, createdAt: today, updated: today,
  };
  _docs = [d, ..._docs];
  logActivity(`"${d.title}" created`);
  return d;
}
export function updateDocument(id: string, patch: Partial<DocItem>): DocItem | undefined {
  let out: DocItem | undefined;
  _docs = _docs.map(d => { if (d.id !== id) return d; out = { ...d, ...patch, id: d.id, updated: today }; return out; });
  return out;
}
export function moveDocument(id: string, folderId: string): void { updateDocument(id, { folderId }); }
export function renameDocument(id: string, title: string): void { updateDocument(id, { title }); }
export function archiveDocument(id: string): void { updateDocument(id, { status: "Archived" }); logActivity(`Document archived`); }
export function duplicateDocument(id: string): DocItem | undefined {
  const src = getDocument(id);
  if (!src) return undefined;
  const copy: DocItem = { ...src, id: uid("doc"), title: `${src.title} (Copy)`, status: "Draft", version: 1, createdAt: today, updated: today };
  _docs = [copy, ..._docs];
  return copy;
}
export function publishDocument(id: string): void { updateDocument(id, { status: "Published" }); }

// ─── Templates API ────────────────────────────────────────
export function getTemplates(): DocTemplate[] { return TEMPLATES; }
export function getTemplate(id: string): DocTemplate | undefined { return TEMPLATES.find(t => t.id === id); }

// ─── Activity + dashboard helpers ─────────────────────────
export function getActivity(): DocActivity[] { return _activity; }
export function recentlyUpdated(n = 6): DocItem[] {
  return [..._docs].filter(d => !isArchived(d)).slice(0, n);
}
export function publishedSOPs(): DocItem[] { return _docs.filter(d => d.status === "Published" && (d.type === "SOP" || d.type === "Checklist")); }
export function needingReview(): DocItem[] { return _docs.filter(d => d.status === "In Review" || d.status === "Draft"); }
// Vendor/subcontractor folders missing documents (mock compliance signal).
export function foldersMissingComplianceDocs(): DocFolder[] {
  return getFolders().filter(f => (f.parentId === "vendors" || f.parentId === "subs") && docsInFolder(f.id).length === 0);
}
export function popularFolders(n = 6): { folder: DocFolder; count: number }[] {
  return topFolders().map(f => ({ folder: f, count: docCountDeep(f.id) })).sort((a, b) => b.count - a.count).slice(0, n);
}
export function totalDocs(): number { return _docs.filter(d => !isArchived(d)).length; }
