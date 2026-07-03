// ─── Inventory & Procurement — mock data (pre-Supabase) ───
// Inventory & Procurement OWNS the master records: inventory items, warehouses /
// truck stock, vendors, subcontractors, purchase orders, receiving movements,
// material requests, and subcontractor assignments. CRM Projects/Jobs LINK to
// these later; Accounting owns bills/payments; Documents owns the files.
//
// Mock/local state only (in-memory, like the Items store) — callers refresh via a
// local tick. No Supabase, no payments, no real approval workflow yet.

// ─── Vendor type / status ─────────────────────────────────
export type VendorType =
  | "material_supplier" | "equipment_supplier" | "subcontractor"
  | "service_provider" | "utility" | "professional_service" | "other";

export const VENDOR_TYPE_LABELS: Record<VendorType, string> = {
  material_supplier: "Material Supplier",
  equipment_supplier: "Equipment Supplier",
  subcontractor: "Subcontractor",
  service_provider: "Service Provider",
  utility: "Utility / Vendor",
  professional_service: "Professional Service",
  other: "Other",
};

export type VendorStatus = "active" | "on_hold" | "inactive" | "pending_review";
export const VENDOR_STATUS_STYLE: Record<VendorStatus, { label: string; dot: string }> = {
  active:         { label: "Active",         dot: "#10b981" },
  on_hold:        { label: "On Hold",        dot: "#f59e0b" },
  inactive:       { label: "Inactive",       dot: "#9ca3af" },
  pending_review: { label: "Pending Review", dot: "#0ea5e9" },
};

// ─── Documents (Documents app owns the files; we track status here) ──
export type DocKind =
  | "w9" | "insurance" | "agreement" | "price_sheet" | "account_app"
  | "tax_exempt" | "license" | "coi" | "contract";

export const DOC_KIND_LABELS: Record<DocKind, string> = {
  w9: "W-9", insurance: "Insurance Certificate", agreement: "Vendor Agreement",
  price_sheet: "Price Sheet", account_app: "Account Application", tax_exempt: "Tax Exemption",
  license: "License", coi: "Certificate of Insurance (COI)", contract: "Contract",
};

export type DocStatus = "valid" | "expiring" | "expired" | "missing";
export interface VendorDocument {
  id: string;
  kind: DocKind;
  name: string;
  status: DocStatus;
  expiresOn?: string;
  uploadedAt?: string;
}

// Roll a document set up into a single compliance signal.
export type ComplianceLevel = "ok" | "warning" | "issue";
export function docComplianceLevel(docs: VendorDocument[]): ComplianceLevel {
  if (docs.some(d => d.status === "missing" || d.status === "expired")) return "issue";
  if (docs.some(d => d.status === "expiring")) return "warning";
  return "ok";
}
export const COMPLIANCE_STYLE: Record<ComplianceLevel, { label: string; bg: string; color: string }> = {
  ok:      { label: "Compliant",   bg: "#d1fae5", color: "#065f46" },
  warning: { label: "Expiring",    bg: "#fef3c7", color: "#92400e" },
  issue:   { label: "Action Needed", bg: "#fee2e2", color: "#991b1b" },
};

// ─── Warehouses / stock locations ─────────────────────────
export interface Warehouse {
  id: string;
  name: string;
  kind: "warehouse" | "office" | "branch" | "truck" | "trailer" | "staging";
}

// ─── Inventory items ──────────────────────────────────────
export interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  category: string;
  vendor?: string;
  cost?: number;
  sellPrice?: number;
  unit?: string;
  qtyOnHand: number;
  location: string;
  reorderPoint: number;
}

export type StockStatus = "in" | "low" | "out";
export const STOCK_STATUS_STYLE: Record<StockStatus, { label: string; dot: string }> = {
  in: { label: "In stock", dot: "#10b981" },
  low: { label: "Low stock", dot: "#f59e0b" },
  out: { label: "Out of stock", dot: "#ef4444" },
};
export function itemStock(i: InventoryItem): StockStatus {
  if (i.qtyOnHand <= 0) return "out";
  if (i.qtyOnHand <= i.reorderPoint) return "low";
  return "in";
}

// ─── Vendor master ────────────────────────────────────────
export interface Vendor {
  id: string;
  name: string;
  type: VendorType;
  status: VendorStatus;
  preferred?: boolean;
  primaryContactName?: string;
  primaryContactEmail?: string;
  primaryContactPhone?: string;
  billingEmail?: string;
  address?: string;
  paymentTerms?: string;
  website?: string;
  notes?: string;
  documents: VendorDocument[];
  createdAt: string;
  updatedAt: string;
}

// ─── Subcontractor (a vendor of type "subcontractor" + extra fields) ──
export const SUB_TRADES = [
  "Electrical", "Roofing", "Plumbing", "Drywall", "Ductwork", "Crane",
  "Concrete", "Insulation", "Excavation", "General Labor", "Other",
] as const;
export type SubTrade = typeof SUB_TRADES[number];

export type SubStatus = "approved" | "pending_review" | "missing_documents" | "on_hold" | "inactive";
export const SUB_STATUS_STYLE: Record<SubStatus, { label: string; dot: string }> = {
  approved:          { label: "Approved",         dot: "#10b981" },
  pending_review:    { label: "Pending Review",    dot: "#0ea5e9" },
  missing_documents: { label: "Missing Documents", dot: "#ef4444" },
  on_hold:           { label: "On Hold",           dot: "#f59e0b" },
  inactive:          { label: "Inactive",          dot: "#9ca3af" },
};

export interface Subcontractor {
  id: string;
  vendorId: string;            // links to the Vendor master record
  companyName: string;
  trade: SubTrade;
  status: SubStatus;
  primaryContactName?: string;
  phone?: string;
  email?: string;
  serviceArea?: string;
  defaultRate?: string;        // e.g. "$85/hr" or "Per project"
  insuranceStatus: DocStatus;
  insuranceExpiration?: string;
  w9Status: DocStatus;
  licenseStatus: DocStatus;
  licenseNumber?: string;
  licenseExpiration?: string;
  contractStatus: DocStatus;
  notes?: string;
  documents: VendorDocument[];
  createdAt: string;
  updatedAt: string;
}

// Compliance signal for a subcontractor (drives badges + dashboard warnings).
export function subCompliance(s: Subcontractor): ComplianceLevel {
  const flags = [s.insuranceStatus, s.w9Status, s.licenseStatus, s.contractStatus];
  if (flags.some(f => f === "missing" || f === "expired")) return "issue";
  if (flags.some(f => f === "expiring")) return "warning";
  return "ok";
}
export function subComplianceWarnings(s: Subcontractor): string[] {
  const out: string[] = [];
  if (s.w9Status === "missing") out.push("W-9 missing");
  if (s.insuranceStatus === "expired") out.push("Insurance expired");
  else if (s.insuranceStatus === "missing") out.push("Insurance missing");
  else if (s.insuranceStatus === "expiring") out.push("Insurance expiring");
  if (s.licenseStatus === "expired") out.push("License expired");
  else if (s.licenseStatus === "missing") out.push("License missing");
  if (s.contractStatus === "missing") out.push("Contract missing");
  if (s.status === "pending_review") out.push("Pending approval");
  return out;
}

// ─── Subcontractor assignment (linked to a CRM project/phase/job — mock) ──
export type AssignmentStatus = "proposed" | "scheduled" | "in_progress" | "completed" | "canceled" | "on_hold";
export const ASSIGNMENT_STATUS_STYLE: Record<AssignmentStatus, { label: string; dot: string }> = {
  proposed:    { label: "Proposed",    dot: "#9ca3af" },
  scheduled:   { label: "Scheduled",   dot: "#0ea5e9" },
  in_progress: { label: "In Progress", dot: "#f59e0b" },
  completed:   { label: "Completed",   dot: "#10b981" },
  canceled:    { label: "Canceled",    dot: "#9ca3af" },
  on_hold:     { label: "On Hold",     dot: "#f59e0b" },
};
export interface SubcontractorAssignment {
  id: string;
  subcontractorId: string;
  projectId?: string;          // mock CRM link
  projectName?: string;        // denormalized for display
  jobId?: string;
  phaseId?: string;
  phaseName?: string;
  scopeOfWork: string;
  scheduledDate?: string;
  status: AssignmentStatus;
  contractAmount?: number;
  notes?: string;
  createdAt: string;
}

// ─── Purchase orders ──────────────────────────────────────
export type POStatus =
  | "draft" | "pending_approval" | "approved" | "ordered"
  | "partially_received" | "received" | "canceled" | "closed";

export const PO_STATUS_STYLE: Record<POStatus, { label: string; dot: string }> = {
  draft:              { label: "Draft",              dot: "#9ca3af" },
  pending_approval:   { label: "Pending Approval",   dot: "#0ea5e9" },
  approved:           { label: "Approved",           dot: "#6366f1" },
  ordered:            { label: "Ordered",            dot: "#f59e0b" },
  partially_received: { label: "Partially Received", dot: "#f59e0b" },
  received:           { label: "Received",           dot: "#10b981" },
  canceled:           { label: "Canceled",           dot: "#9ca3af" },
  closed:             { label: "Closed",             dot: "#6b7280" },
};
// Statuses considered "open" (active, awaiting receipt) for dashboards/cards.
const OPEN_PO_STATUSES: POStatus[] = ["pending_approval", "approved", "ordered", "partially_received"];

export type TrackingMethod = "manual" | "barcode" | "rfid_case" | "rfid_item" | "serialized" | "bin";
export const TRACKING_METHOD_LABELS: Record<TrackingMethod, string> = {
  manual: "Manual count", barcode: "Barcode / QR", rfid_case: "RFID box / case",
  rfid_item: "RFID individual", serialized: "Serialized", bin: "Bin count",
};

export interface POLine {
  id: string;
  itemId?: string;
  itemName: string;
  description?: string;
  quantityOrdered: number;
  quantityReceived: number;
  unitCost: number;
  tracking: TrackingMethod;
}

export interface PurchaseOrder {
  id: string;
  number: string;
  vendorId: string;
  vendorName: string;          // denormalized for list display
  status: POStatus;
  projectId?: string;
  projectName?: string;
  jobId?: string;
  materialRequestId?: string;
  expectedDelivery?: string;
  orderedDate?: string;
  createdBy: string;
  approvedBy?: string;
  notes?: string;
  lines: POLine[];
  createdAt: string;
  updatedAt: string;
}

export function poSubtotal(po: PurchaseOrder): number {
  return po.lines.reduce((s, l) => s + l.unitCost * l.quantityOrdered, 0);
}
export function poReceivedQty(po: PurchaseOrder): number {
  return po.lines.reduce((s, l) => s + l.quantityReceived, 0);
}
export function poOrderedQty(po: PurchaseOrder): number {
  return po.lines.reduce((s, l) => s + l.quantityOrdered, 0);
}
// "Received" rollup for the list column: none / partial / full.
export function poReceivingState(po: PurchaseOrder): "none" | "partial" | "full" {
  const ordered = poOrderedQty(po), received = poReceivedQty(po);
  if (received <= 0) return "none";
  if (received >= ordered) return "full";
  return "partial";
}

// ─── Inventory movements (receiving + transfers) ──────────
export interface InventoryMovement {
  id: string;
  movementType: "receipt" | "transfer" | "usage" | "adjustment";
  itemName: string;
  quantity: number;
  fromLocation?: string;
  toLocation?: string;
  relatedPoId?: string;
  relatedProjectId?: string;
  relatedJobId?: string;
  createdBy: string;
  createdAt: string;
  notes?: string;
}

// ─── Material requests (project/job request for materials — mock) ──
export type MaterialRequestStatus = "open" | "sourcing" | "ordered" | "fulfilled" | "canceled";
export interface MaterialRequest {
  id: string;
  number: string;
  projectId?: string;
  projectName?: string;
  jobId?: string;
  requestedBy: string;
  neededBy?: string;
  status: MaterialRequestStatus;
  source: "warehouse" | "vendor" | "truck";
  items: { name: string; quantity: number }[];
  createdAt: string;
}

export interface InventoryActivity {
  id: string;
  kind: "received" | "truck_adjusted" | "po_created" | "doc_uploaded" | "sub_assigned" | "compliance" | "material_request";
  text: string;
  when: string;
}

// ─── Helpers ──────────────────────────────────────────────
function uid(prefix: string): string { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`; }
function nowIso(): string { return new Date().toISOString(); }
const today = "Jun 24, 2026";

// ─── Seed data ────────────────────────────────────────────
const WAREHOUSES: Warehouse[] = [
  { id: "wh-main", name: "Main Warehouse", kind: "warehouse" },
  { id: "wh-augusta", name: "Augusta Office", kind: "office" },
  { id: "wh-stapleton", name: "Stapleton Branch", kind: "branch" },
  { id: "wh-truck1", name: "Truck - Tucker", kind: "truck" },
  { id: "wh-truck2", name: "Truck - Brian", kind: "truck" },
  { id: "wh-install", name: "Install Trailer", kind: "trailer" },
  { id: "wh-roofing", name: "Roofing Trailer", kind: "trailer" },
  { id: "wh-staging", name: "Job Staging Area", kind: "staging" },
];

let _items: InventoryItem[] = [
  { id: "it-wetswitch", name: "Wet Switch", sku: "HVAC-WS-01", category: "HVAC Controls", vendor: "East Coast Metal", cost: 12.5, sellPrice: 39, unit: "each", qtyOnHand: 2, location: "Main Warehouse", reorderPoint: 10 },
  { id: "it-mediafilter", name: "4-inch Media Filter", sku: "HVAC-MF-4", category: "Filters", vendor: "East Coast Metal", cost: 24, sellPrice: 59, unit: "each", qtyOnHand: 3, location: "Truck - Tucker", reorderPoint: 12 },
  { id: "it-disconnect", name: "Disconnect", sku: "ELEC-DC-30", category: "Electrical", vendor: "Border States", cost: 18, sellPrice: 49, unit: "each", qtyOnHand: 1, location: "Main Warehouse", reorderPoint: 8 },
  { id: "it-thermostat", name: "Thermostat", sku: "HVAC-TSTAT", category: "HVAC Controls", vendor: "Carrier Supply", cost: 96, sellPrice: 249, unit: "each", qtyOnHand: 4, location: "Augusta Office", reorderPoint: 6 },
  { id: "it-pvc", name: "PVC Fittings", sku: "PLMB-PVC-AS", category: "Plumbing", vendor: "Ferguson", cost: 3.25, sellPrice: 9, unit: "each", qtyOnHand: 14, location: "Install Trailer", reorderPoint: 25 },
  { id: "it-condenser", name: "3-Ton Condenser", sku: "HVAC-COND-3T", category: "Equipment", vendor: "Carrier Supply", cost: 1850, sellPrice: 3200, unit: "each", qtyOnHand: 5, location: "Main Warehouse", reorderPoint: 2 },
  { id: "it-coil", name: "Evaporator Coil", sku: "HVAC-COIL-3T", category: "Equipment", vendor: "Carrier Supply", cost: 420, sellPrice: 820, unit: "each", qtyOnHand: 6, location: "Main Warehouse", reorderPoint: 3 },
  { id: "it-lineset", name: "Line Set 3/8 x 3/4", sku: "HVAC-LS-3834", category: "Refrigeration", vendor: "East Coast Metal", cost: 68, sellPrice: 140, unit: "each", qtyOnHand: 0, location: "Truck - Brian", reorderPoint: 4 },
  { id: "it-whip", name: "Whip / Flex Conduit", sku: "ELEC-WHIP-6", category: "Electrical", vendor: "Border States", cost: 9.5, sellPrice: 24, unit: "each", qtyOnHand: 22, location: "Stapleton Branch", reorderPoint: 10 },
  { id: "it-drainpan", name: "Condensate Drain Pan", sku: "HVAC-PAN-AS", category: "HVAC Controls", vendor: "Ferguson", cost: 16, sellPrice: 45, unit: "each", qtyOnHand: 9, location: "Truck - Tucker", reorderPoint: 6 },
  { id: "it-shingles", name: "Architectural Shingles", sku: "ROOF-SHG-AR", category: "Roofing", vendor: "ABC Supply", cost: 32, sellPrice: 0, unit: "bundle", qtyOnHand: 40, location: "Roofing Trailer", reorderPoint: 30 },
];

const doc = (kind: DocKind, status: DocStatus, expiresOn?: string): VendorDocument =>
  ({ id: uid("doc"), kind, name: DOC_KIND_LABELS[kind], status, expiresOn, uploadedAt: status === "missing" ? undefined : today });

let _vendors: Vendor[] = [
  { id: "v-ecm", name: "East Coast Metal", type: "material_supplier", status: "active", preferred: true,
    primaryContactName: "Dana Ruiz", primaryContactEmail: "orders@ecmetal.com", primaryContactPhone: "(706) 555-0190",
    paymentTerms: "Net 30", website: "ecmetal.com", documents: [doc("w9", "valid"), doc("agreement", "valid"), doc("price_sheet", "valid")], createdAt: nowIso(), updatedAt: nowIso() },
  { id: "v-carrier", name: "Carrier Supply", type: "equipment_supplier", status: "active", preferred: true,
    primaryContactName: "Mark Ellison", primaryContactPhone: "(706) 555-0191", paymentTerms: "Net 30",
    documents: [doc("w9", "valid"), doc("account_app", "valid")], createdAt: nowIso(), updatedAt: nowIso() },
  { id: "v-ferguson", name: "Ferguson", type: "material_supplier", status: "active",
    primaryContactPhone: "(706) 555-0142", paymentTerms: "Net 15",
    documents: [doc("w9", "valid")], createdAt: nowIso(), updatedAt: nowIso() },
  { id: "v-abc", name: "ABC Supply", type: "material_supplier", status: "active",
    primaryContactPhone: "(706) 555-0177", paymentTerms: "Net 30",
    documents: [doc("w9", "missing"), doc("price_sheet", "valid")], createdAt: nowIso(), updatedAt: nowIso() },
  { id: "v-border", name: "Border States", type: "equipment_supplier", status: "active",
    primaryContactPhone: "(706) 555-0133", paymentTerms: "Net 30",
    documents: [doc("w9", "valid"), doc("price_sheet", "expiring", "Jul 15, 2026")], createdAt: nowIso(), updatedAt: nowIso() },
  { id: "v-georgia-power", name: "Georgia Power", type: "utility", status: "active",
    paymentTerms: "Due on receipt", documents: [], createdAt: nowIso(), updatedAt: nowIso() },
  // Subcontractor vendors (their richer profiles live in _subcontractors)
  { id: "v-bright", name: "Bright Spark Electric", type: "subcontractor", status: "active",
    primaryContactName: "Leo Park", primaryContactPhone: "(706) 555-0211", paymentTerms: "Net 30",
    documents: [doc("w9", "valid"), doc("coi", "valid"), doc("license", "valid"), doc("contract", "valid")], createdAt: nowIso(), updatedAt: nowIso() },
  { id: "v-summit", name: "Summit Roofing Co.", type: "subcontractor", status: "active",
    primaryContactName: "Rosa Kim", primaryContactPhone: "(706) 555-0222", paymentTerms: "Net 30",
    documents: [doc("w9", "valid"), doc("coi", "expired", "May 30, 2026"), doc("license", "valid")], createdAt: nowIso(), updatedAt: nowIso() },
  { id: "v-cleanline", name: "Clean Line Drywall", type: "subcontractor", status: "pending_review",
    primaryContactName: "Sam Doyle", primaryContactPhone: "(706) 555-0233",
    documents: [doc("w9", "missing"), doc("coi", "missing")], createdAt: nowIso(), updatedAt: nowIso() },
  { id: "v-airflow", name: "AirFlow Ductwork", type: "subcontractor", status: "active",
    primaryContactName: "Nia Cole", primaryContactPhone: "(706) 555-0244", paymentTerms: "Net 30",
    documents: [doc("w9", "valid"), doc("coi", "valid")], createdAt: nowIso(), updatedAt: nowIso() },
];

let _subcontractors: Subcontractor[] = [
  { id: "sub-bright", vendorId: "v-bright", companyName: "Bright Spark Electric", trade: "Electrical", status: "approved",
    primaryContactName: "Leo Park", phone: "(706) 555-0211", email: "leo@brightspark.com", serviceArea: "Augusta, GA",
    defaultRate: "$85/hr", insuranceStatus: "valid", insuranceExpiration: "Mar 1, 2027", w9Status: "valid",
    licenseStatus: "valid", licenseNumber: "EL-22841", licenseExpiration: "Jan 1, 2027", contractStatus: "valid",
    documents: [doc("w9", "valid"), doc("coi", "valid"), doc("license", "valid"), doc("contract", "valid")], createdAt: nowIso(), updatedAt: nowIso() },
  { id: "sub-summit", vendorId: "v-summit", companyName: "Summit Roofing Co.", trade: "Roofing", status: "missing_documents",
    primaryContactName: "Rosa Kim", phone: "(706) 555-0222", email: "rosa@summitroof.com", serviceArea: "CSRA",
    defaultRate: "Per project", insuranceStatus: "expired", insuranceExpiration: "May 30, 2026", w9Status: "valid",
    licenseStatus: "valid", licenseNumber: "RF-10932", contractStatus: "valid",
    documents: [doc("w9", "valid"), doc("coi", "expired", "May 30, 2026"), doc("license", "valid")], createdAt: nowIso(), updatedAt: nowIso() },
  { id: "sub-cleanline", vendorId: "v-cleanline", companyName: "Clean Line Drywall", trade: "Drywall", status: "pending_review",
    primaryContactName: "Sam Doyle", phone: "(706) 555-0233", serviceArea: "Augusta, GA",
    defaultRate: "$55/hr", insuranceStatus: "missing", w9Status: "missing", licenseStatus: "valid", contractStatus: "missing",
    documents: [], createdAt: nowIso(), updatedAt: nowIso() },
  { id: "sub-airflow", vendorId: "v-airflow", companyName: "AirFlow Ductwork", trade: "Ductwork", status: "approved",
    primaryContactName: "Nia Cole", phone: "(706) 555-0244", email: "nia@airflowduct.com", serviceArea: "Evans, GA",
    defaultRate: "$70/hr", insuranceStatus: "valid", insuranceExpiration: "Sep 1, 2026", w9Status: "valid",
    licenseStatus: "valid", licenseNumber: "MC-5521", contractStatus: "valid",
    documents: [doc("w9", "valid"), doc("coi", "valid")], createdAt: nowIso(), updatedAt: nowIso() },
];

let _assignments: SubcontractorAssignment[] = [
  { id: "asn-1", subcontractorId: "sub-bright", projectId: "proj-rtu", projectName: "RTU Replacement — Columbia County", phaseName: "Electrical Rough-In",
    scopeOfWork: "Disconnect & re-feed (3) rooftop units; new whips and disconnects.", scheduledDate: "Jul 8, 2026", status: "scheduled", contractAmount: 6800, createdAt: nowIso() },
  { id: "asn-2", subcontractorId: "sub-airflow", projectId: "proj-rtu", projectName: "RTU Replacement — Columbia County", phaseName: "Ductwork",
    scopeOfWork: "Transition curbs and duct connections for (3) units.", scheduledDate: "Jul 10, 2026", status: "proposed", contractAmount: 4200, createdAt: nowIso() },
  { id: "asn-3", subcontractorId: "sub-summit", projectId: "proj-roof", projectName: "Warehouse Re-Roof — Grovetown", phaseName: "Tear-off & Dry-in",
    scopeOfWork: "Full tear-off and dry-in of 12,000 sq ft TPO roof.", scheduledDate: "Jun 30, 2026", status: "in_progress", contractAmount: 48500, createdAt: nowIso() },
];

let _purchaseOrders: PurchaseOrder[] = [
  { id: "po-ecm", number: "PO-1042", vendorId: "v-ecm", vendorName: "East Coast Metal", status: "ordered",
    projectId: "proj-rtu", projectName: "RTU Replacement — Columbia County", expectedDelivery: "Jun 27, 2026", orderedDate: "Jun 21, 2026", createdBy: "Ryo Martin",
    lines: [
      { id: "pl-1", itemId: "it-wetswitch", itemName: "Wet Switch", quantityOrdered: 12, quantityReceived: 0, unitCost: 12.5, tracking: "manual" },
      { id: "pl-2", itemId: "it-disconnect", itemName: "Disconnect", quantityOrdered: 8, quantityReceived: 0, unitCost: 18, tracking: "barcode" },
    ], createdAt: nowIso(), updatedAt: nowIso() },
  { id: "po-hvac", number: "PO-1043", vendorId: "v-carrier", vendorName: "Carrier Supply", status: "partially_received",
    projectId: "proj-rtu", projectName: "RTU Replacement — Columbia County", expectedDelivery: "Jun 25, 2026", orderedDate: "Jun 20, 2026", createdBy: "Ryo Martin",
    lines: [
      { id: "pl-3", itemId: "it-condenser", itemName: "3-Ton Condenser", quantityOrdered: 3, quantityReceived: 1, unitCost: 1850, tracking: "serialized" },
      { id: "pl-4", itemId: "it-coil", itemName: "Evaporator Coil", quantityOrdered: 3, quantityReceived: 0, unitCost: 420, tracking: "serialized" },
    ], createdAt: nowIso(), updatedAt: nowIso() },
  { id: "po-roof", number: "PO-1044", vendorId: "v-abc", vendorName: "ABC Supply", status: "draft",
    projectId: "proj-roof", projectName: "Warehouse Re-Roof — Grovetown", expectedDelivery: "Jul 1, 2026", createdBy: "Ryo Martin",
    lines: [
      { id: "pl-5", itemId: "it-shingles", itemName: "Architectural Shingles", quantityOrdered: 60, quantityReceived: 0, unitCost: 32, tracking: "manual" },
    ], createdAt: nowIso(), updatedAt: nowIso() },
];

let _movements: InventoryMovement[] = [
  { id: "mv-1", movementType: "receipt", itemName: "Media Filters (8)", quantity: 8, fromLocation: "East Coast Metal", toLocation: "Main Warehouse", relatedPoId: "po-ecm", createdBy: "Tucker Hayes", createdAt: nowIso(), notes: "" },
];

let _materialRequests: MaterialRequest[] = [
  { id: "mr-1", number: "MR-2031", projectId: "proj-rtu", projectName: "RTU Replacement — Columbia County", jobId: "job-2031", requestedBy: "Kylie Brooks", neededBy: "Jun 28, 2026", status: "ordered", source: "vendor", items: [{ name: "Wet Switch", quantity: 12 }, { name: "Disconnect", quantity: 8 }], createdAt: nowIso() },
];

// Mock CRM project/job options for linking (replaced by real CRM lookups later).
export const MOCK_PROJECTS = [
  { id: "proj-rtu", name: "RTU Replacement — Columbia County" },
  { id: "proj-roof", name: "Warehouse Re-Roof — Grovetown" },
  { id: "proj-tenant", name: "Tenant Build-out — Downtown Augusta" },
];
export const MOCK_JOBS = [
  { id: "job-2031", name: "Job #2031 — Rooftop Unit #1" },
  { id: "job-2032", name: "Job #2032 — Rooftop Unit #2" },
];

const ACTIVITY: InventoryActivity[] = [
  { id: "act-1", kind: "po_created", text: "PO-1048 created for East Coast Metal", when: "2 hours ago" },
  { id: "act-2", kind: "received", text: "Wet Switches received into Main Warehouse", when: "Yesterday" },
  { id: "act-3", kind: "sub_assigned", text: "Bright Spark Electric assigned to RTU Replacement Project", when: "Jun 22, 2026" },
  { id: "act-4", kind: "compliance", text: "Insurance certificate expired for Summit Roofing Co.", when: "Jun 21, 2026" },
  { id: "act-5", kind: "material_request", text: "Material request MR-2031 created for Job #2031", when: "Jun 20, 2026" },
];

// ─── Items API ────────────────────────────────────────────
export function getWarehouses(): Warehouse[] { return WAREHOUSES; }
export function getStockLocations(): string[] { return WAREHOUSES.map(w => w.name); }
export function getInventoryItems(): InventoryItem[] { return _items; }
export function getInventoryItem(id: string): InventoryItem | undefined { return _items.find(i => i.id === id); }
export function getLowStockItems(): InventoryItem[] { return _items.filter(i => i.qtyOnHand <= i.reorderPoint); }
export function getItemCategories(): string[] { return [...new Set(_items.map(i => i.category))].sort(); }
export function inventoryValue(): number { return _items.reduce((s, i) => s + (i.cost ?? 0) * i.qtyOnHand, 0); }

export type ItemInput = Omit<InventoryItem, "id">;
export function createItem(input: ItemInput): InventoryItem { const it = { ...input, id: uid("it") }; _items = [it, ..._items]; return it; }
export function updateItem(id: string, patch: Partial<InventoryItem>): void { _items = _items.map(i => i.id === id ? { ...i, ...patch, id: i.id } : i); }
export function deleteItem(id: string): void { _items = _items.filter(i => i.id !== id); }
export function adjustItemQty(id: string, delta: number): void { _items = _items.map(i => i.id === id ? { ...i, qtyOnHand: Math.max(0, i.qtyOnHand + delta) } : i); }

// ─── Vendors API ──────────────────────────────────────────
export function getVendors(): Vendor[] { return _vendors; }
export function getVendor(id: string): Vendor | undefined { return _vendors.find(v => v.id === id); }
export type VendorInput = Omit<Vendor, "id" | "createdAt" | "updatedAt" | "documents"> & { documents?: VendorDocument[] };
export function createVendor(input: VendorInput): Vendor {
  const v: Vendor = { ...input, documents: input.documents ?? [], id: uid("v"), createdAt: nowIso(), updatedAt: nowIso() };
  _vendors = [v, ..._vendors];
  return v;
}
export function updateVendor(id: string, patch: Partial<Vendor>): void {
  _vendors = _vendors.map(v => v.id === id ? { ...v, ...patch, id: v.id, updatedAt: nowIso() } : v);
}

// ─── Subcontractors API ───────────────────────────────────
export function getSubcontractors(): Subcontractor[] { return _subcontractors; }
export function getSubcontractor(id: string): Subcontractor | undefined { return _subcontractors.find(s => s.id === id); }
export type SubcontractorInput = Omit<Subcontractor, "id" | "createdAt" | "updatedAt" | "documents" | "vendorId"> & { vendorId?: string; documents?: VendorDocument[] };
export function createSubcontractor(input: SubcontractorInput): Subcontractor {
  // Also mint a linked vendor master record of type "subcontractor".
  const vendor = createVendor({
    name: input.companyName, type: "subcontractor",
    status: input.status === "approved" ? "active" : input.status === "inactive" ? "inactive" : "pending_review",
    primaryContactName: input.primaryContactName, primaryContactPhone: input.phone, primaryContactEmail: input.email,
  });
  const s: Subcontractor = { ...input, vendorId: input.vendorId ?? vendor.id, documents: input.documents ?? [], id: uid("sub"), createdAt: nowIso(), updatedAt: nowIso() };
  _subcontractors = [s, ..._subcontractors];
  return s;
}
export function updateSubcontractor(id: string, patch: Partial<Subcontractor>): void {
  _subcontractors = _subcontractors.map(s => s.id === id ? { ...s, ...patch, id: s.id, updatedAt: nowIso() } : s);
}

// ─── Assignments API ──────────────────────────────────────
export function getAssignments(): SubcontractorAssignment[] { return _assignments; }
export function getAssignmentsForSub(subId: string): SubcontractorAssignment[] { return _assignments.filter(a => a.subcontractorId === subId); }
export function activeAssignmentCount(subId: string): number {
  return _assignments.filter(a => a.subcontractorId === subId && ["proposed", "scheduled", "in_progress", "on_hold"].includes(a.status)).length;
}
export type AssignmentInput = Omit<SubcontractorAssignment, "id" | "createdAt">;
export function createAssignment(input: AssignmentInput): SubcontractorAssignment {
  const a: SubcontractorAssignment = { ...input, id: uid("asn"), createdAt: nowIso() };
  _assignments = [a, ..._assignments];
  return a;
}

// ─── Purchase orders API ──────────────────────────────────
export function getPurchaseOrders(): PurchaseOrder[] { return _purchaseOrders; }
export function getPurchaseOrder(id: string): PurchaseOrder | undefined { return _purchaseOrders.find(p => p.id === id); }
export function getOpenPurchaseOrders(): PurchaseOrder[] { return _purchaseOrders.filter(p => OPEN_PO_STATUSES.includes(p.status)); }
export function getPartiallyReceivedPOs(): PurchaseOrder[] { return _purchaseOrders.filter(p => p.status === "partially_received"); }
export function getOverduePOs(): PurchaseOrder[] {
  // Mock: ordered/approved POs whose expected delivery is before "today".
  return _purchaseOrders.filter(p => OPEN_PO_STATUSES.includes(p.status) && p.expectedDelivery && new Date(p.expectedDelivery) < new Date(today));
}
function nextPoNumber(): string {
  const max = _purchaseOrders.reduce((m, p) => { const n = parseInt(p.number.replace(/\D/g, "")) || 0; return Math.max(m, n); }, 1044);
  return `PO-${max + 1}`;
}
export type POInput = Omit<PurchaseOrder, "id" | "number" | "createdAt" | "updatedAt"> & { number?: string };
export function createPurchaseOrder(input: POInput): PurchaseOrder {
  const po: PurchaseOrder = { ...input, number: input.number ?? nextPoNumber(), id: uid("po"), createdAt: nowIso(), updatedAt: nowIso() };
  _purchaseOrders = [po, ..._purchaseOrders];
  return po;
}
export function updatePurchaseOrder(id: string, patch: Partial<PurchaseOrder>): void {
  _purchaseOrders = _purchaseOrders.map(p => p.id === id ? { ...p, ...patch, id: p.id, updatedAt: nowIso() } : p);
}

// Receive quantities against a PO's lines, create a movement, and roll up status.
export function receivePurchaseOrder(
  poId: string,
  receipts: { lineId: string; quantity: number }[],
  destination: string,
  opts?: { createdBy?: string; notes?: string },
): void {
  const po = getPurchaseOrder(poId);
  if (!po) return;
  const lines = po.lines.map(l => {
    const r = receipts.find(x => x.lineId === l.id);
    return r ? { ...l, quantityReceived: Math.min(l.quantityOrdered, l.quantityReceived + Math.max(0, r.quantity)) } : l;
  });
  // Movements + on-hand updates per received line.
  for (const r of receipts) {
    if (r.quantity <= 0) continue;
    const line = po.lines.find(l => l.id === r.lineId);
    if (!line) continue;
    _movements = [{
      id: uid("mv"), movementType: "receipt", itemName: line.itemName, quantity: r.quantity,
      fromLocation: po.vendorName, toLocation: destination, relatedPoId: po.id, relatedProjectId: po.projectId,
      createdBy: opts?.createdBy ?? "—", createdAt: nowIso(), notes: opts?.notes,
    }, ..._movements];
    if (line.itemId) adjustItemQty(line.itemId, r.quantity);
  }
  const totalOrdered = lines.reduce((s, l) => s + l.quantityOrdered, 0);
  const totalReceived = lines.reduce((s, l) => s + l.quantityReceived, 0);
  const status: POStatus = totalReceived <= 0 ? po.status : totalReceived >= totalOrdered ? "received" : "partially_received";
  updatePurchaseOrder(poId, { lines, status });
}

// ─── Truck stock consumption (field → inventory) ──────────
// A part consumed on a work order is pulled from the tech's truck. Items link to
// the price book by SKU and to a warehouse/truck by its NAME (InventoryItem.location).
export function getWarehouse(id: string): Warehouse | undefined { return WAREHOUSES.find(w => w.id === id); }

// Find the stock record for a SKU at a given location (warehouse/truck name).
export function findStockItem(sku: string, locationName: string): InventoryItem | undefined {
  if (!sku || !locationName) return undefined;
  return _items.find(i => i.sku === sku && i.location === locationName);
}

export interface StockChange { item: InventoryItem; qtyBefore: number; qtyAfter: number }

// Consume `qty` of a SKU from a truck/warehouse. Logs a "usage" movement against
// the job. No-op (returns undefined) when the SKU isn't stocked there — services,
// labor, or a part the truck doesn't carry simply don't move stock.
export function consumeFromTruck(sku: string, locationName: string, qty: number, ctx?: { jobId?: string; createdBy?: string; notes?: string }): StockChange | undefined {
  if (qty <= 0) return undefined;
  const item = findStockItem(sku, locationName);
  if (!item) return undefined;
  const before = item.qtyOnHand;
  adjustItemQty(item.id, -qty);
  _movements = [{
    id: uid("mv"), movementType: "usage", itemName: item.name, quantity: qty,
    fromLocation: locationName, relatedJobId: ctx?.jobId,
    createdBy: ctx?.createdBy ?? "—", createdAt: nowIso(), notes: ctx?.notes,
  }, ..._movements];
  return { item, qtyBefore: before, qtyAfter: Math.max(0, before - qty) };
}

// Put stock back (e.g. a WO line was removed before invoicing).
export function returnToTruck(sku: string, locationName: string, qty: number): void {
  if (qty <= 0) return;
  const item = findStockItem(sku, locationName);
  if (item) adjustItemQty(item.id, qty);
}

// ─── Movements / material requests / activity API ─────────
export function getMovements(): InventoryMovement[] { return _movements; }
export function getMaterialRequests(): MaterialRequest[] { return _materialRequests; }
export function getInventoryActivity(): InventoryActivity[] { return ACTIVITY; }

// ─── CRM Project ↔ procurement links ──────────────────────
// A Project Vendor Link records a vendor's involvement in a CRM project. The
// vendor master stays in Inventory; this is the lightweight link CRM owns.
export type ProjectVendorStatus = "active" | "pending" | "completed" | "removed";
export const PROJECT_VENDOR_STATUS_STYLE: Record<ProjectVendorStatus, { label: string; dot: string }> = {
  active:    { label: "Active",    dot: "#10b981" },
  pending:   { label: "Pending",   dot: "#0ea5e9" },
  completed: { label: "Completed", dot: "#9ca3af" },
  removed:   { label: "Removed",   dot: "#ef4444" },
};
export interface ProjectVendorLink {
  id: string;
  projectId: string;
  vendorId: string;
  purpose: string;            // e.g. "Equipment supplier", "Crane rental"
  status: ProjectVendorStatus;
  contactPerson?: string;
  amountCommitted?: number;
  notes?: string;
  createdAt: string;
}
let _projectVendorLinks: ProjectVendorLink[] = [];
export function getProjectVendorLinks(projectId: string): ProjectVendorLink[] {
  return _projectVendorLinks.filter(l => l.projectId === projectId && l.status !== "removed");
}
export type ProjectVendorLinkInput = Omit<ProjectVendorLink, "id" | "createdAt">;
export function createProjectVendorLink(input: ProjectVendorLinkInput): ProjectVendorLink {
  const l: ProjectVendorLink = { ...input, id: uid("pvl"), createdAt: nowIso() };
  _projectVendorLinks = [l, ..._projectVendorLinks];
  return l;
}
export function removeProjectVendorLink(id: string): void {
  _projectVendorLinks = _projectVendorLinks.map(l => l.id === id ? { ...l, status: "removed" } : l);
}

// Project-scoped procurement getters (drive the CRM Materials & Vendors tab).
export function posForProject(projectId: string): PurchaseOrder[] { return _purchaseOrders.filter(p => p.projectId === projectId); }
export function assignmentsForProject(projectId: string): SubcontractorAssignment[] { return _assignments.filter(a => a.projectId === projectId); }
export function materialRequestsForProject(projectId: string): MaterialRequest[] { return _materialRequests.filter(m => m.projectId === projectId); }

let _mrSeq = 2031;
export type NewMaterialRequestInput = Omit<MaterialRequest, "id" | "number" | "createdAt"> & { number?: string };
export function createMaterialRequest(input: NewMaterialRequestInput): MaterialRequest {
  const mr: MaterialRequest = { ...input, number: input.number ?? `MR-${++_mrSeq}`, id: uid("mr"), createdAt: nowIso() };
  _materialRequests = [mr, ..._materialRequests];
  return mr;
}

// Derived procurement activity for one project (mock feed).
export interface ProjectProcurementEvent { id: string; kind: InventoryActivity["kind"]; text: string; when: string }
export function projectProcurementActivity(projectId: string): ProjectProcurementEvent[] {
  const out: ProjectProcurementEvent[] = [];
  for (const po of posForProject(projectId)) {
    out.push({ id: `ev-po-${po.id}`, kind: "po_created", text: `${po.number} created for ${po.vendorName}`, when: po.orderedDate ?? "Recently" });
    if (poReceivedQty(po) > 0) out.push({ id: `ev-rcv-${po.id}`, kind: "received", text: `${poReceivedQty(po)} item(s) received on ${po.number}`, when: "Recently" });
  }
  for (const a of assignmentsForProject(projectId)) {
    const sub = _subcontractors.find(s => s.id === a.subcontractorId);
    out.push({ id: `ev-asn-${a.id}`, kind: "sub_assigned", text: `${sub?.companyName ?? "Subcontractor"} assigned${a.phaseName ? ` to ${a.phaseName}` : ""}`, when: a.scheduledDate ?? "Recently" });
    if (sub && subCompliance(sub) === "issue") out.push({ id: `ev-comp-${a.id}`, kind: "compliance", text: `Compliance issue for ${sub.companyName} (${subComplianceWarnings(sub)[0] ?? "documents"})`, when: "Action needed" });
  }
  for (const mr of materialRequestsForProject(projectId)) {
    out.push({ id: `ev-mr-${mr.id}`, kind: "material_request", text: `Material request ${mr.number} (${mr.items.length} item${mr.items.length === 1 ? "" : "s"})`, when: mr.neededBy ? `Needed by ${mr.neededBy}` : "Recently" });
  }
  return out;
}

// Cross-entity compliance rollup for dashboards.
export function complianceIssueCount(): number {
  const vendorIssues = _vendors.filter(v => docComplianceLevel(v.documents) !== "ok").length;
  const subIssues = _subcontractors.filter(s => subCompliance(s) !== "ok").length;
  return vendorIssues + subIssues;
}
export function openPosForVendor(vendorId: string): PurchaseOrder[] {
  return _purchaseOrders.filter(p => p.vendorId === vendorId && OPEN_PO_STATUSES.includes(p.status));
}
export function posForVendor(vendorId: string): PurchaseOrder[] {
  return _purchaseOrders.filter(p => p.vendorId === vendorId);
}
