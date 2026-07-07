// Items / Catalog — reusable line items (services, materials, equipment, fees…)
// that can later be pulled into Quotes and Invoices. Types mirror what will
// become a Supabase `items` table; no mock data here.

export type ItemType =
  | "service"
  | "labor"
  | "material"
  | "equipment"
  | "package"
  | "fee"
  | "discount"
  | "membership"
  | "subcontractor"
  | "other";

export interface Item {
  id: string;
  organizationId: string;
  companyId: string;
  locationId?: string;          // null/undefined = available org/company-wide

  name: string;
  description?: string;
  type: ItemType;
  category: string;             // customizable category (see lib/items/data)

  unitPrice: number;
  unitCost?: number;            // optional internal cost
  taxable: boolean;
  defaultQuantity: number;

  sku?: string;                 // item code / SKU
  active: boolean;

  createdAt: string;
  updatedAt: string;
}

// ─── Type display config ──────────────────────────────────
export const ITEM_TYPES: ItemType[] = [
  "service", "labor", "material", "equipment", "package",
  "fee", "discount", "membership", "subcontractor", "other",
];

export const ITEM_TYPE_CONFIG: Record<ItemType, { label: string; bg: string; color: string }> = {
  service:       { label: "Service",              bg: "#d3ebe6", color: "#0a5c53" },
  labor:         { label: "Labor",                bg: "#cffafe", color: "#155e75" },
  material:      { label: "Material",             bg: "#d1fae5", color: "#065f46" },
  equipment:     { label: "Equipment",            bg: "#ede9fe", color: "#5b21b6" },
  package:       { label: "Package",              bg: "#fce7f3", color: "#9d174d" },
  fee:           { label: "Fee",                  bg: "#ffedd5", color: "#9a3412" },
  discount:      { label: "Discount",             bg: "#fee2e2", color: "#991b1b" },
  membership:    { label: "Membership / Agreement", bg: "#d3ebe6", color: "#0c6b60" },
  subcontractor: { label: "Subcontractor",        bg: "#fef9c3", color: "#854d0e" },
  other:         { label: "Other",                bg: "var(--bg-input)", color: "var(--text-muted)" },
};

// Groupings used by the Items summary cards.
export const TYPE_GROUPS = {
  services:   ["service", "labor"] as ItemType[],
  materials:  ["material", "equipment"] as ItemType[],
  packages:   ["package", "fee"] as ItemType[],
};
