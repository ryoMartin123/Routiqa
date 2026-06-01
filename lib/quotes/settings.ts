// Quote Settings — org-level defaults for quote behavior (Settings → Quote
// Settings). localStorage-backed for now; mirrors a future per-org settings row.

const KEY = "crm-quote-settings";

export interface QuoteSettings {
  numberPrefix: string;            // e.g. "Q"
  numberFormat: string;            // tokens: {prefix} {year} {seq}
  defaultExpirationDays: number;   // used to prefill the quote "Expires" date
  requireCustomer: boolean;        // before creating a quote
  requireProperty: boolean;        // before sending a quote
  requireLineItem: boolean;        // before sending a quote
  allowApproval: boolean;          // show approve/decline actions
  allowDuplicate: boolean;         // show duplicate action
  allowConvert: boolean;           // allow convert to job/project
}

export const DEFAULT_QUOTE_SETTINGS: QuoteSettings = {
  numberPrefix: "Q",
  numberFormat: "{prefix}-{year}-{seq}",
  defaultExpirationDays: 30,
  requireCustomer: true,
  requireProperty: false,
  requireLineItem: true,
  allowApproval: true,
  allowDuplicate: true,
  allowConvert: true,
};

export function getQuoteSettings(): QuoteSettings {
  if (typeof window === "undefined") return DEFAULT_QUOTE_SETTINGS;
  try {
    const r = localStorage.getItem(KEY);
    return r ? { ...DEFAULT_QUOTE_SETTINGS, ...JSON.parse(r) } : DEFAULT_QUOTE_SETTINGS;
  } catch { return DEFAULT_QUOTE_SETTINGS; }
}
export function saveQuoteSettings(s: QuoteSettings): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
}
export function resetQuoteSettings(): QuoteSettings {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  return DEFAULT_QUOTE_SETTINGS;
}

// Preview a quote number from the configured prefix/format.
export function previewQuoteNumber(s: QuoteSettings, seq = 42): string {
  return s.numberFormat
    .replace("{prefix}", s.numberPrefix)
    .replace("{year}", String(new Date().getFullYear()))
    .replace("{seq}", String(seq).padStart(4, "0"));
}
