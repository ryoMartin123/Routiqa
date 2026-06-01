// Industry starter catalogs — preloadable item catalogs per service industry.
//
// These are NOT system-locked. When applied, the items + categories are COPIED
// into the company's catalog (localStorage store), after which the company can
// edit, disable, delete, or add their own. See applyIndustryCatalog() in data.ts.

import type { ItemType } from "./types";

export interface StarterItem {
  name: string;
  type: ItemType;
  category: string;
  unitPrice: number;
}

export interface IndustryCatalog {
  id: string;
  label: string;
  description: string;
  categories: string[];
  items: StarterItem[];
}

// Shorthand builder: [name, type, category, price]
type Row = [string, ItemType, string, number];
const rows = (list: Row[]): StarterItem[] =>
  list.map(([name, type, category, unitPrice]) => ({ name, type, category, unitPrice }));

// ─── HVAC (full starter catalog) ──────────────────────────
const HVAC: IndustryCatalog = {
  id: "hvac",
  label: "HVAC",
  description: "Heating, cooling, IAQ, ductwork, and maintenance.",
  categories: [
    "Service", "Maintenance", "Diagnostics", "Repairs", "Installations", "Equipment",
    "Mini Splits", "Ductwork", "Indoor Air Quality", "Accessories", "Electrical",
    "Permits", "Agreements", "Fees", "Discounts",
  ],
  items: rows([
    ["Service Call",                  "service",  "Service",            89],
    ["Diagnostic Fee",                "fee",      "Diagnostics",        95],
    ["Emergency Service Call",        "service",  "Service",            189],
    ["After-Hours Service Call",      "service",  "Service",            159],
    ["Residential Maintenance Visit", "service",  "Maintenance",        99],
    ["Commercial Maintenance Visit",  "service",  "Maintenance",        179],
    ["Spring Tune-Up",                "service",  "Maintenance",        119],
    ["Fall Tune-Up",                  "service",  "Maintenance",        119],
    ["Filter Replacement",            "material", "Maintenance",        35],
    ["Coil Cleaning",                 "service",  "Maintenance",        165],
    ["Condensate Drain Cleaning",     "service",  "Maintenance",        95],
    ["Wet Switch",                    "material", "Accessories",        45],
    ["Float Switch",                  "material", "Accessories",        55],
    ["Surge Protector",               "material", "Electrical",         180],
    ["Hard Start Kit",                "material", "Repairs",            145],
    ["Soft Start Kit",                "material", "Repairs",            320],
    ["Condensate Pump",               "material", "Repairs",            175],
    ["4\" Media Filter Cabinet",      "material", "Indoor Air Quality", 220],
    ["Smart Thermostat",              "material", "Accessories",        280],
    ["Basic Thermostat",              "material", "Accessories",        120],
    ["UV Light",                      "equipment","Indoor Air Quality", 450],
    ["In-Duct Air Purifier",          "equipment","Indoor Air Quality", 1250],
    ["Media Filter Upgrade",          "material", "Indoor Air Quality", 240],
    ["Dehumidifier",                  "equipment","Indoor Air Quality", 1800],
    ["Duct Cleaning",                 "service",  "Ductwork",           450],
    ["Dryer Vent Cleaning",           "service",  "Ductwork",           150],
    ["Split Heat Pump Replacement",   "equipment","Installations",      6400],
    ["Gas Furnace Replacement",       "equipment","Installations",      4200],
    ["Air Handler Replacement",       "equipment","Installations",      2600],
    ["Package Unit Replacement",      "equipment","Installations",      7200],
    ["Mini Split Installation",       "equipment","Mini Splits",        3800],
    ["Thermostat Installation",       "labor",    "Installations",      180],
    ["Line Set Replacement",          "material", "Installations",      650],
    ["Equipment Pad",                 "material", "Installations",      95],
    ["Disconnect Box",                "material", "Electrical",         110],
    ["Whip",                          "material", "Electrical",         65],
    ["Duct Repair",                   "service",  "Ductwork",           285],
    ["Duct Replacement",              "service",  "Ductwork",           1200],
    ["Return Addition",               "service",  "Ductwork",           450],
    ["Supply Run Addition",           "service",  "Ductwork",           350],
    ["Plenum Replacement",            "service",  "Ductwork",           650],
    ["Duct Sealing",                  "service",  "Ductwork",           550],
    ["Airflow Balancing",             "service",  "Ductwork",           295],
    ["Permit Fee",                    "fee",      "Permits",            250],
    ["Crane / Lift Fee",              "fee",      "Fees",               600],
    ["Trip Charge",                   "fee",      "Fees",               89],
    ["Disposal Fee",                  "fee",      "Fees",               75],
    ["Financing Fee",                 "fee",      "Fees",               0],
    ["Goodwill Discount",             "discount", "Discounts",          -50],
    ["Maintenance Member Discount",   "discount", "Discounts",          -25],
  ]),
};

// ─── Roofing ──────────────────────────────────────────────
const ROOFING: IndustryCatalog = {
  id: "roofing",
  label: "Roofing",
  description: "Inspections, repairs, replacement, gutters, and ventilation.",
  categories: ["Inspection", "Repairs", "Replacement", "Materials", "Gutters", "Ventilation", "Permits", "Fees", "Discounts"],
  items: rows([
    ["Roof Inspection",            "service",  "Inspection",   149],
    ["Leak Repair",                "service",  "Repairs",      350],
    ["Shingle Replacement (per sq)","material","Replacement",  450],
    ["Full Roof Replacement (per sq)","service","Replacement", 550],
    ["Underlayment (per sq)",      "material", "Materials",    65],
    ["Ice & Water Shield (per sq)","material", "Materials",    120],
    ["Ridge Vent (per ft)",        "material", "Ventilation",  18],
    ["Gutter Installation (per ft)","material","Gutters",      12],
    ["Gutter Cleaning",            "service",  "Repairs",      175],
    ["Flashing Replacement",       "material", "Repairs",      240],
    ["Permit Fee",                 "fee",      "Permits",      250],
    ["Dumpster / Disposal Fee",    "fee",      "Fees",         450],
    ["Trip Charge",                "fee",      "Fees",         89],
    ["Roof Inspection Discount",   "discount", "Discounts",    -50],
  ]),
};

// ─── Plumbing ─────────────────────────────────────────────
const PLUMBING: IndustryCatalog = {
  id: "plumbing",
  label: "Plumbing",
  description: "Drains, water heaters, fixtures, and repiping.",
  categories: ["Service", "Drains", "Water Heaters", "Fixtures", "Repairs", "Repiping", "Permits", "Fees", "Discounts"],
  items: rows([
    ["Service Call",                "service",  "Service",       89],
    ["Drain Cleaning",              "service",  "Drains",        165],
    ["Hydro Jetting",               "service",  "Drains",        450],
    ["Water Heater Installation",   "equipment","Water Heaters", 1600],
    ["Tankless Water Heater Install","equipment","Water Heaters",3800],
    ["Faucet Replacement",          "labor",    "Fixtures",      220],
    ["Toilet Replacement",          "labor",    "Fixtures",      280],
    ["Garbage Disposal",            "equipment","Fixtures",      320],
    ["Leak Repair",                 "service",  "Repairs",       250],
    ["Repipe (per fixture)",        "service",  "Repiping",      650],
    ["Sump Pump",                   "equipment","Repairs",       480],
    ["Permit Fee",                  "fee",      "Permits",       150],
    ["Trip Charge",                 "fee",      "Fees",          89],
    ["New Customer Discount",       "discount", "Discounts",     -40],
  ]),
};

// ─── Electrical ───────────────────────────────────────────
const ELECTRICAL: IndustryCatalog = {
  id: "electrical",
  label: "Electrical",
  description: "Panels, wiring, lighting, outlets, and safety.",
  categories: ["Service", "Panels", "Wiring", "Lighting", "Outlets", "Safety", "Permits", "Fees", "Discounts"],
  items: rows([
    ["Service Call",                "service",  "Service",  99],
    ["Panel Upgrade",               "equipment","Panels",   2400],
    ["Subpanel Installation",       "equipment","Panels",   1200],
    ["Outlet Installation",         "labor",    "Outlets",  165],
    ["Switch Installation",         "labor",    "Outlets",  145],
    ["Ceiling Fan Installation",    "labor",    "Lighting", 220],
    ["Recessed Lighting (per fixture)","labor", "Lighting", 180],
    ["EV Charger Installation",     "equipment","Wiring",   1200],
    ["Whole-Home Surge Protector",  "material", "Safety",   350],
    ["Smoke Detector",              "material", "Safety",   95],
    ["Permit Fee",                  "fee",      "Permits",  150],
    ["Trip Charge",                 "fee",      "Fees",     89],
    ["Safety Inspection Discount",  "discount", "Discounts",-50],
  ]),
};

// ─── Property Maintenance ─────────────────────────────────
const PROPERTY: IndustryCatalog = {
  id: "property_maintenance",
  label: "Property Maintenance",
  description: "Turnover, cleaning, landscaping, and handyman work.",
  categories: ["Service", "Cleaning", "Landscaping", "Repairs", "Inspections", "Turnover", "Fees", "Discounts"],
  items: rows([
    ["Service Call",             "service", "Service",     75],
    ["Property Walkthrough",     "service", "Inspections", 120],
    ["Handyman Labor (per hour)","labor",   "Repairs",     65],
    ["Pressure Washing",         "service", "Cleaning",    250],
    ["Gutter Cleaning",          "service", "Cleaning",    150],
    ["Lawn Maintenance (monthly)","service","Landscaping", 180],
    ["Unit Turnover Cleaning",   "service", "Turnover",    220],
    ["Painting (per room)",      "service", "Turnover",    350],
    ["Drywall Repair",           "service", "Repairs",     185],
    ["Trip Charge",              "fee",     "Fees",        65],
    ["Volume Discount",          "discount","Discounts",   -50],
  ]),
};

// ─── General Service ──────────────────────────────────────
const GENERAL: IndustryCatalog = {
  id: "general",
  label: "General Service",
  description: "A simple, industry-neutral starting catalog.",
  categories: ["Service", "Labor", "Materials", "Maintenance", "Fees", "Discounts"],
  items: rows([
    ["Service Call",              "service",   "Service",     89],
    ["Diagnostic Fee",            "fee",       "Service",     75],
    ["Standard Labor (per hour)", "labor",     "Labor",       95],
    ["Emergency Labor (per hour)","labor",     "Labor",       145],
    ["Materials",                 "material",  "Materials",   0],
    ["Maintenance Visit",         "service",   "Maintenance", 99],
    ["Annual Maintenance Plan",   "membership","Maintenance", 199],
    ["Trip Charge",               "fee",       "Fees",        75],
    ["Disposal Fee",              "fee",       "Fees",        50],
    ["New Customer Discount",     "discount",  "Discounts",   -40],
  ]),
};

export const INDUSTRY_CATALOGS: IndustryCatalog[] = [HVAC, ROOFING, PLUMBING, ELECTRICAL, PROPERTY, GENERAL];

export function getIndustryCatalog(id: string): IndustryCatalog | undefined {
  return INDUSTRY_CATALOGS.find(c => c.id === id);
}
