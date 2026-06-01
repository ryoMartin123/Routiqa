// Taxes & Fees — basic tax rate, taxable item types, and optional default fees
// (Settings → Taxes & Fees). localStorage-backed for now. No advanced/jurisdiction
// pricing rules yet.

import type { ItemType } from "@/lib/items/types";

const KEY = "crm-tax-fee-settings";

export interface TaxFeeSettings {
  defaultTaxRate: number;          // percent, e.g. 7 = 7%
  taxableTypes: ItemType[];        // item types taxed by default
  permitFeeEnabled: boolean;
  permitFee: number;
  tripChargeEnabled: boolean;
  tripCharge: number;
}

export const DEFAULT_TAX_FEE_SETTINGS: TaxFeeSettings = {
  defaultTaxRate: 0,
  taxableTypes: ["material", "equipment", "package"],
  permitFeeEnabled: false,
  permitFee: 250,
  tripChargeEnabled: false,
  tripCharge: 89,
};

export function getTaxFeeSettings(): TaxFeeSettings {
  if (typeof window === "undefined") return DEFAULT_TAX_FEE_SETTINGS;
  try {
    const r = localStorage.getItem(KEY);
    return r ? { ...DEFAULT_TAX_FEE_SETTINGS, ...JSON.parse(r) } : DEFAULT_TAX_FEE_SETTINGS;
  } catch { return DEFAULT_TAX_FEE_SETTINGS; }
}
export function saveTaxFeeSettings(s: TaxFeeSettings): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
}
export function resetTaxFeeSettings(): TaxFeeSettings {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  return DEFAULT_TAX_FEE_SETTINGS;
}
