// Items / Catalog — mock data + a localStorage-backed runtime store.
//
// Single source of truth for catalog items, their (customizable) categories,
// and catalog defaults. Mirrors the Quotes store pattern: seed constants +
// session "extras" + per-item "overrides", all merged on read so a given item
// stays consistent everywhere. Replace with Supabase queries when ready.

import type { Item, ItemType, BundleComponent } from "./types";
import type { LineItem } from "@/lib/quotes/data";
import type { LineItemCategory } from "@/lib/quotes/types";
import { getIndustryCatalog, type StarterItem } from "./industry-catalogs";

export type { Item, ItemType, BundleComponent } from "./types";
export { INDUSTRY_CATALOGS, getIndustryCatalog } from "./industry-catalogs";

// ─── Customizable categories ──────────────────────────────
export interface ItemCategory {
  id: string;
  name: string;
  active: boolean;
  order: number;
}

const DEFAULT_CATEGORY_NAMES = [
  "System Replacement", "Mini Splits", "Accessories", "Indoor Air Quality",
  "Ductwork", "Maintenance", "Electrical", "Permits", "Discounts",
  "Labor", "Subcontractor", "Other",
];

function defaultCategories(): ItemCategory[] {
  return DEFAULT_CATEGORY_NAMES.map((name, i) => ({ id: `cat-${i + 1}`, name, active: true, order: i }));
}

// ─── Catalog defaults (Settings → Items & Categories) ─────
export interface ItemDefaults {
  defaultTaxable: boolean;
  defaultQuantity: number;
  showCostField: boolean;
  allowCustomQuoteLines: boolean;
  allowSavingCustomLineAsItem: boolean;
}

export const DEFAULT_ITEM_DEFAULTS: ItemDefaults = {
  defaultTaxable: true,
  defaultQuantity: 1,
  showCostField: true,
  allowCustomQuoteLines: true,
  allowSavingCustomLineAsItem: true,
};

// ─── Currency helper (re-export the Quotes formatter) ─────
export { fmt } from "@/lib/quotes/data";

// ─── Seed items ───────────────────────────────────────────
const D = "Apr 2026";
export const ALL_ITEMS: Item[] = [
  { id: "it-1",  organizationId: "org_northstar", companyId: "co_hvac", name: "2.5 Ton 14 SEER AC System",        description: "Builder-grade split AC system, standard 10-yr warranty.", type: "equipment", category: "System Replacement", unitPrice: 5200, unitCost: 3400, taxable: true,  defaultQuantity: 1, sku: "AC-25-14",   active: true, createdAt: D, updatedAt: D },
  { id: "it-2",  organizationId: "org_northstar", companyId: "co_hvac", name: "3 Ton 16 SEER Heat Pump System",    description: "High-efficiency heat pump system, extended warranty.",     type: "equipment", category: "System Replacement", unitPrice: 6400, unitCost: 4100, taxable: true,  defaultQuantity: 1, sku: "HP-30-16",   active: true, createdAt: D, updatedAt: D },
  { id: "it-3",  organizationId: "org_northstar", companyId: "co_hvac", name: "Comfort Package — Better",          description: "Mid-tier system bundle with smart thermostat + IAQ.",      type: "package",   category: "System Replacement", unitPrice: 8900, unitCost: 5600, taxable: true,  defaultQuantity: 1, sku: "PKG-BETTER", active: true, createdAt: D, updatedAt: D },
  { id: "it-4",  organizationId: "org_northstar", companyId: "co_hvac", name: "Single-Zone Mini Split 12k BTU",    description: "Ductless single-zone mini split, installed.",              type: "equipment", category: "Mini Splits",        unitPrice: 3200, unitCost: 2050, taxable: true,  defaultQuantity: 1, sku: "MS-12K",     active: true, createdAt: D, updatedAt: D },
  { id: "it-5",  organizationId: "org_northstar", companyId: "co_hvac", name: "Dual-Zone Mini Split 18k BTU",      description: "Ductless dual-zone mini split, installed.",                type: "equipment", category: "Mini Splits",        unitPrice: 4600, unitCost: 2900, taxable: true,  defaultQuantity: 1, sku: "MS-18K",     active: true, createdAt: D, updatedAt: D },
  { id: "it-6",  organizationId: "org_northstar", companyId: "co_hvac", name: "Smart Thermostat (Ecobee Premium)", description: "Wi-Fi smart thermostat with remote sensor.",               type: "material",  category: "Accessories",        unitPrice: 280,  unitCost: 150,  taxable: true,  defaultQuantity: 1, sku: "TH-ECO-P",   active: true, createdAt: D, updatedAt: D },
  { id: "it-7",  organizationId: "org_northstar", companyId: "co_hvac", name: "Whole-Home Air Purifier",          description: "Media air cleaner / purification system.",                 type: "equipment", category: "Indoor Air Quality", unitPrice: 1450, unitCost: 820,  taxable: true,  defaultQuantity: 1, sku: "IAQ-PUR",    active: true, createdAt: D, updatedAt: D },
  { id: "it-8",  organizationId: "org_northstar", companyId: "co_hvac", name: "Flex Duct Run (per run)",          description: "Insulated flex duct run, installed.",                      type: "material",  category: "Ductwork",           unitPrice: 350,  unitCost: 180,  taxable: true,  defaultQuantity: 1, sku: "DUCT-FLEX",  active: true, createdAt: D, updatedAt: D },
  { id: "it-9",  organizationId: "org_northstar", companyId: "co_hvac", name: "HVAC Maintenance Visit",           description: "Seasonal tune-up and inspection.",                         type: "service",   category: "Maintenance",        unitPrice: 89,   taxable: false, defaultQuantity: 1, sku: "SVC-MAINT",  active: true, createdAt: D, updatedAt: D },
  { id: "it-10", organizationId: "org_northstar", companyId: "co_hvac", name: "Annual Maintenance Plan",          description: "Two visits per year, priority service, 15% repair discount.", type: "membership", category: "Maintenance",       unitPrice: 240,  taxable: false, defaultQuantity: 1, sku: "PLAN-ANN",   active: true, createdAt: D, updatedAt: D },
  { id: "it-11", organizationId: "org_northstar", companyId: "co_hvac", name: "Installation Labor (per hour)",    description: "Standard installation labor rate.",                        type: "labor",     category: "Labor",              unitPrice: 120,  unitCost: 55,   taxable: false, defaultQuantity: 1, sku: "LAB-INSTALL",active: true, createdAt: D, updatedAt: D },
  { id: "it-12", organizationId: "org_northstar", companyId: "co_hvac", name: "Electrical Whip & Disconnect",     description: "Electrical connection kit for outdoor unit.",              type: "material",  category: "Electrical",         unitPrice: 180,  unitCost: 95,   taxable: true,  defaultQuantity: 1, sku: "ELE-WHIP",   active: true, createdAt: D, updatedAt: D },
  { id: "it-13", organizationId: "org_northstar", companyId: "co_hvac", name: "Permit & Inspection Fee",          description: "Municipal permit and inspection coordination.",            type: "fee",       category: "Permits",            unitPrice: 250,  taxable: false, defaultQuantity: 1, sku: "FEE-PERMIT", active: true, createdAt: D, updatedAt: D },
  { id: "it-14", organizationId: "org_northstar", companyId: "co_hvac", name: "Crane Service (half day)",         description: "Subcontracted crane for rooftop equipment.",               type: "subcontractor", category: "Subcontractor",  unitPrice: 600,  unitCost: 450,  taxable: false, defaultQuantity: 1, sku: "SUB-CRANE",  active: true, createdAt: D, updatedAt: D },
  { id: "it-15", organizationId: "org_northstar", companyId: "co_hvac", name: "Seasonal Promotion",               description: "Limited-time seasonal discount.",                          type: "discount",  category: "Discounts",          unitPrice: -250, taxable: false, defaultQuantity: 1, sku: "DISC-SEASON",active: false, createdAt: D, updatedAt: D },
];

// ─── Runtime store ────────────────────────────────────────
const I_KEY  = "crm-extra-items";
const IO_KEY = "crm-item-overrides";
const IC_KEY = "crm-item-categories";
const ID_KEY = "crm-item-defaults";
const IR_KEY = "crm-items-replaced";   // when set, the seed catalog is hidden (industry "Replace" applied)

let _extra:      Item[] | null = null;
let _overrides:  Record<string, Partial<Item>> | null = null;
let _categories: ItemCategory[] | null = null;
let _defaults:   ItemDefaults | null = null;

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) as T : fallback; }
  catch { return fallback; }
}
function writeJSON(key: string, val: unknown) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* ignore */ }
}

function extra(): Item[] { if (!_extra) _extra = readJSON<Item[]>(I_KEY, []); return _extra; }
function overrides(): Record<string, Partial<Item>> { if (!_overrides) _overrides = readJSON(IO_KEY, {}); return _overrides; }
function applyOverride(it: Item): Item { const o = overrides()[it.id]; return o ? { ...it, ...o } : it; }

function nowStamp(): string {
  return new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function isReplaced(): boolean {
  if (typeof window === "undefined") return false;
  try { return localStorage.getItem(IR_KEY) === "1"; } catch { return false; }
}

// ─── Items API ────────────────────────────────────────────
// When an industry "Replace" has been applied, the seed catalog is hidden and
// only the company's own (localStorage) items remain.
export function getAllItems(): Item[] {
  const base = isReplaced() ? [] : ALL_ITEMS;
  return [...extra(), ...base].map(applyOverride);
}
export function getItem(id: string): Item | undefined { return getAllItems().find(i => i.id === id); }

export interface NewItemInput {
  name: string; description?: string; type: ItemType; category: string;
  unitPrice: number; unitCost?: number; taxable: boolean; defaultQuantity: number;
  sku?: string; active?: boolean; companyId?: string; locationId?: string;
  components?: BundleComponent[]; bundlePricing?: "sum" | "fixed"; expandOnAdd?: boolean;
  inventoryItemId?: string;
}

export function createItem(input: NewItemInput): Item {
  const item: Item = {
    id: `it-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    organizationId: "org_northstar",
    companyId: input.companyId ?? "co_hvac",
    locationId: input.locationId,
    name: input.name.trim(), description: input.description?.trim() || undefined,
    type: input.type, category: input.category,
    unitPrice: input.unitPrice, unitCost: input.unitCost,
    taxable: input.taxable, defaultQuantity: input.defaultQuantity,
    sku: input.sku?.trim() || undefined,
    active: input.active ?? true,
    components: input.components,
    bundlePricing: input.bundlePricing,
    expandOnAdd: input.expandOnAdd,
    inventoryItemId: input.inventoryItemId,
    createdAt: nowStamp(), updatedAt: nowStamp(),
  };
  _extra = [item, ...extra()];
  writeJSON(I_KEY, _extra);
  return item;
}

export function updateItem(id: string, patch: Partial<Item>): Item | undefined {
  const isExtra = extra().some(i => i.id === id);
  if (isExtra) {
    _extra = extra().map(i => i.id === id ? { ...i, ...patch, updatedAt: nowStamp() } : i);
    writeJSON(I_KEY, _extra);
  } else {
    const all = { ...overrides() };
    all[id] = { ...all[id], ...patch, updatedAt: nowStamp() };
    _overrides = all;
    writeJSON(IO_KEY, all);
  }
  return getItem(id);
}

export function toggleItemActive(id: string): Item | undefined {
  const cur = getItem(id);
  if (!cur) return;
  return updateItem(id, { active: !cur.active });
}

// ─── Industry starter catalogs ────────────────────────────
const TAXABLE_TYPES: ItemType[] = ["material", "equipment", "package"];

function starterToItem(si: StarterItem, companyId: string): Item {
  return {
    id: `it-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    organizationId: "org_northstar", companyId,
    name: si.name, type: si.type, category: si.category,
    unitPrice: si.unitPrice, taxable: TAXABLE_TYPES.includes(si.type),
    defaultQuantity: 1, active: true,
    createdAt: nowStamp(), updatedAt: nowStamp(),
  };
}

// Count items in a catalog not already present (by name) — for the preview UI.
export function countMissingFromCatalog(industryId: string): number {
  const cat = getIndustryCatalog(industryId);
  if (!cat) return 0;
  const have = new Set(getAllItems().map(i => i.name.toLowerCase()));
  return cat.items.filter(si => !have.has(si.name.toLowerCase())).length;
}

// Apply an industry starter catalog by COPYING items + categories into the
// company's catalog. "missing" adds only what's absent; "replace" starts the
// catalog over from this industry. Either way the result is fully editable.
export function applyIndustryCatalog(industryId: string, mode: "missing" | "replace", companyId = "co_hvac"): void {
  const cat = getIndustryCatalog(industryId);
  if (!cat) return;

  if (mode === "replace") {
    const items = cat.items.map(si => starterToItem(si, companyId));
    _extra = items; writeJSON(I_KEY, items);
    _overrides = {}; writeJSON(IO_KEY, {});
    saveItemCategories(cat.categories.map((name, i) => ({ id: `cat-${i + 1}`, name, active: true, order: i })));
    try { localStorage.setItem(IR_KEY, "1"); } catch { /* ignore */ }
    return;
  }

  // missing only — add items whose name isn't already present
  const have = new Set(getAllItems().map(i => i.name.toLowerCase()));
  const additions = cat.items.filter(si => !have.has(si.name.toLowerCase())).map(si => starterToItem(si, companyId));
  if (additions.length) { _extra = [...additions, ...extra()]; writeJSON(I_KEY, _extra); }

  // add any categories not already present
  const existing = getItemCategories();
  const haveCats = new Set(existing.map(c => c.name.toLowerCase()));
  let order = existing.length;
  const newCats = cat.categories.filter(n => !haveCats.has(n.toLowerCase()))
    .map(n => ({ id: `cat-${Date.now()}-${order}`, name: n, active: true, order: order++ }));
  if (newCats.length) saveItemCategories([...existing, ...newCats]);
}

// ─── Categories API ───────────────────────────────────────
export function getItemCategories(): ItemCategory[] {
  if (!_categories) _categories = readJSON<ItemCategory[]>(IC_KEY, defaultCategories());
  return [..._categories].sort((a, b) => a.order - b.order);
}
export function getActiveCategoryNames(): string[] {
  return getItemCategories().filter(c => c.active).map(c => c.name);
}
export function saveItemCategories(list: ItemCategory[]): void {
  _categories = list;
  writeJSON(IC_KEY, list);
}
export function resetItemCategories(): ItemCategory[] {
  _categories = defaultCategories();
  try { localStorage.removeItem(IC_KEY); } catch { /* ignore */ }
  return _categories;
}
export function addItemCategory(name: string): ItemCategory[] {
  const list = getItemCategories();
  if (list.some(c => c.name.toLowerCase() === name.trim().toLowerCase())) return list;
  const next = [...list, { id: `cat-${Date.now()}`, name: name.trim(), active: true, order: list.length }];
  saveItemCategories(next);
  return next;
}

// ─── Defaults API ─────────────────────────────────────────
export function getItemDefaults(): ItemDefaults {
  if (!_defaults) _defaults = readJSON<ItemDefaults>(ID_KEY, DEFAULT_ITEM_DEFAULTS);
  return _defaults;
}
export function saveItemDefaults(d: ItemDefaults): void {
  _defaults = d;
  writeJSON(ID_KEY, d);
}

// ─── Items → Quote line mapping ───────────────────────────
// Copies the item's *current* fields into a quote line so later price changes
// never alter existing quotes. Maps the catalog type to the quote category.
const TYPE_TO_QUOTE_CATEGORY: Record<ItemType, LineItemCategory> = {
  service: "Labor", labor: "Labor", material: "Materials", equipment: "Equipment",
  package: "Other", fee: "Other", discount: "Discount", membership: "Maintenance Plan",
  subcontractor: "Subcontractor", other: "Other",
};

export function itemToQuoteLine(item: Item): LineItem {
  const qty = item.defaultQuantity || 1;
  return {
    id: `li-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    name: item.name,
    description: item.description ?? item.name,
    quantity: qty,
    unitPrice: item.unitPrice,
    total: Math.round(qty * item.unitPrice * 100) / 100,
    category: TYPE_TO_QUOTE_CATEGORY[item.type],
    taxable: item.taxable,
    optional: false,
    itemId: item.id,
    unitCost: resolveItemCost(item),
  };
}

// ─── Bundles ──────────────────────────────────────────────
// A bundle (type "package" with components) composes other pricebook items.
// "sum" pricing tracks the components live; "fixed" is a flat bundle price —
// cost ALWAYS sums from components so margin stays honest either way.
export function bundleComponentSum(item: Item, all: Item[] = getAllItems()): { price: number; cost: number } {
  let price = 0, cost = 0;
  for (const c of item.components ?? []) {
    const comp = all.find(i => i.id === c.itemId);
    if (!comp) continue;
    price += comp.unitPrice * c.quantity;
    cost += (comp.unitCost ?? 0) * c.quantity;
  }
  return { price: Math.round(price * 100) / 100, cost: Math.round(cost * 100) / 100 };
}

export function isBundle(item: Item): boolean {
  return item.type === "package" && (item.components?.length ?? 0) > 0;
}

// The price the item actually sells at right now (sum-mode bundles are live).
export function resolveItemPrice(item: Item): number {
  if (isBundle(item) && (item.bundlePricing ?? "sum") === "sum") return bundleComponentSum(item).price;
  return item.unitPrice;
}
export function resolveItemCost(item: Item): number | undefined {
  if (isBundle(item)) return bundleComponentSum(item).cost;
  return item.unitCost;
}

// Bundle-aware add-to-quote: expandOnAdd bundles become one line PER component
// (each with its own itemId back-ref); everything else is a single line at the
// resolved price. All values are snapshots — later catalog edits never touch
// existing quotes.
export function itemToQuoteLines(item: Item): LineItem[] {
  if (isBundle(item) && item.expandOnAdd) {
    const all = getAllItems();
    const lines: LineItem[] = [];
    for (const c of item.components ?? []) {
      const comp = all.find(i => i.id === c.itemId);
      if (!comp) continue;
      const line = itemToQuoteLine(comp);
      line.quantity = c.quantity;
      line.total = Math.round(c.quantity * line.unitPrice * 100) / 100;
      lines.push(line);
    }
    return lines.length ? lines : [itemToQuoteLine(item)];
  }
  const line = itemToQuoteLine(item);
  if (isBundle(item)) {
    line.unitPrice = resolveItemPrice(item);
    line.total = Math.round(line.quantity * line.unitPrice * 100) / 100;
  }
  return [line];
}
