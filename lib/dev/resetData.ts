// ─── Data reset ───────────────────────────────────────────
// Wipes operational business RECORDS while preserving the configured environment
// (users, roles, hierarchy), the catalog (items), and every template. Used for a
// clean testing slate. Because all stores are localStorage-backed and read into
// their in-memory cache lazily, clearing the keys and reloading re-initializes
// every module empty — no per-module cache reset needed.

// Keys holding business records that get created as you operate the CRM.
// Everything NOT listed here is kept: users/roles, hierarchy (companies,
// locations, service areas + overrides), all settings/config, the item catalog,
// and all templates (quote, proposal, agreement, work-order, marketing).
export const BUSINESS_RECORD_KEYS: string[] = [
  // Customers & sub-entities
  "crm-extra-customers",
  "crm-customer-notes",
  "crm-customer-properties",
  // Leads
  "crm-extra-leads",
  // Jobs & work-order instances
  "crm-extra-jobs",
  "crm-job-overrides",
  "crm-work-orders",
  // Projects
  "crm-extra-projects",
  "crm-project-phases",
  // Quotes & invoices
  "crm-extra-quotes",
  "crm-quote-overrides",
  "crm-extra-invoices",
  "crm-invoice-overrides",
  // Agreements (instances; agreement *templates*/config are kept)
  "crm-agreements-extra",
  // Tasks
  "crm-extra-tasks",
  // Marketing campaigns (templates are kept)
  "crm-extra-campaigns",
  // Photos & files
  "crm-photos-files-v2",
  // Cross-cutting record layers
  "crm-comments",
  "crm-notification-events",
  "crm-dispatch-converted",
  // Sample-data manifest (the records it tracked are being cleared too)
  "crm-sample-manifest",
];

export interface ResetResult { cleared: number }

// Remove every business-record key from localStorage. Returns how many keys held
// data. Callers should reload the page afterward so all module caches re-init.
export function clearAllRecords(): ResetResult {
  if (typeof window === "undefined") return { cleared: 0 };
  let cleared = 0;
  for (const key of BUSINESS_RECORD_KEYS) {
    try {
      if (localStorage.getItem(key) !== null) cleared++;
      localStorage.removeItem(key);
    } catch { /* ignore */ }
  }
  return { cleared };
}
