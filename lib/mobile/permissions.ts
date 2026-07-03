// ─── Mobile capability layer ──────────────────────────────
// Resolves what the acting field user can SEE and DO in the mobile app from the
// SAME role/permission system the CRM declares (lib/roles) plus platform app
// access (lib/platform/access). Nothing here is mobile-specific policy: if the
// CRM says a field technician can't view invoices or financial totals, the
// mobile app hides them. Pure function of the user — no imports from
// lib/mobile/data (data.ts wraps this for the acting user).

import type { AppUser } from "@/lib/users/data";
import type { AccessLevel } from "@/lib/roles/types";
import { principalFromAppUser } from "@/lib/roles/principal";
import { can, accessLevel, fieldVisible, hasFlag } from "@/lib/roles/resolver";
import { hasAppAccess } from "@/lib/platform/access";

export interface MobileCaps {
  /** jobs.view — "own" scopes lists to the signed-in tech, "all" shows the board */
  jobs: AccessLevel;
  jobsEdit: AccessLevel;
  customersView: boolean;
  tasks: AccessLevel;
  tasksCreate: boolean;
  /** files (photos): view/create */
  photos: boolean;
  photosCreate: boolean;
  quotesCreate: boolean;
  invoicesView: boolean;
  /** payments.create — enables "collect payment" in the field */
  collectPayments: boolean;
  /** finance_totals mask — job/invoice amounts */
  financials: boolean;
  /** finance_field_pricing mask — line-item pricing on work orders in the field */
  woPricing: boolean;
  /** comms_internal_notes mask */
  internalNotes: boolean;
  /** communications.view — the messages surface */
  messages: boolean;
  /** documents app (SOPs / training library) */
  documents: boolean;
  /** jobs_status_override flag — dispatch authority over any status */
  statusOverride: boolean;
  reports: boolean;
}

export function capsFor(u: AppUser): MobileCaps {
  const p = principalFromAppUser(u);
  return {
    jobs: accessLevel(p, "jobs", "view"),
    jobsEdit: accessLevel(p, "jobs", "edit"),
    customersView: can(p, "customers", "view"),
    tasks: accessLevel(p, "tasks", "view"),
    tasksCreate: can(p, "tasks", "create"),
    photos: can(p, "files", "view"),
    photosCreate: can(p, "files", "create"),
    quotesCreate: can(p, "quotes", "create"),
    invoicesView: can(p, "invoices", "view"),
    collectPayments: can(p, "payments", "create"),
    financials: fieldVisible(p, "finance_totals"),
    woPricing: fieldVisible(p, "finance_field_pricing"),
    internalNotes: fieldVisible(p, "comms_internal_notes"),
    messages: can(p, "communications", "view"),
    documents: hasAppAccess(u, "documents"),
    statusOverride: hasFlag(p, "jobs_status_override"),
    reports: can(p, "reports", "view"),
  };
}
