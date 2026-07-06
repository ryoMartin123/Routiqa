// Activity Events — TypeScript types.
// Mirrors supabase/migrations/0005_activity_events.sql.

export type EventType =
  | "account_created"
  | "contact_added"
  | "property_added"
  | "lead_created"
  | "lead_stage_changed"
  | "job_created"
  | "job_scheduled"
  | "job_completed"
  | "work_order_created"
  | "quote_created"
  | "quote_sent"
  | "quote_accepted"
  | "invoice_created"
  | "payment_received"
  | "agreement_created"
  | "agreement_renewed"
  | "photo_uploaded"
  | "file_uploaded"
  | "note_added"
  | "email_sent"
  | "sms_sent"
  | "call_logged"
  | "status_changed"
  | "task_created"
  | "task_completed";

export type FilterCategory =
  | "all"
  | "notes"
  | "jobs"
  | "quotes"
  | "invoices"
  | "communication"
  | "photos"
  | "tasks"
  | "agreements";

// Maps each event type to the filter tab it belongs to.
// Events not in a specific category show under "all" only.
export const EVENT_FILTER_MAP: Record<EventType, FilterCategory | "all"> = {
  account_created:    "all",
  contact_added:      "all",
  property_added:     "all",
  lead_created:       "all",
  lead_stage_changed: "all",
  job_created:        "jobs",
  job_scheduled:      "jobs",
  job_completed:      "jobs",
  work_order_created: "jobs",
  quote_created:      "quotes",
  quote_sent:         "quotes",
  quote_accepted:     "quotes",
  invoice_created:    "invoices",
  payment_received:   "invoices",
  agreement_created:  "agreements",
  agreement_renewed:  "agreements",
  photo_uploaded:     "photos",
  file_uploaded:      "photos",
  note_added:         "notes",
  email_sent:         "communication",
  sms_sent:           "communication",
  call_logged:        "communication",
  status_changed:     "jobs",
  task_created:       "tasks",
  task_completed:     "tasks",
};

export interface ActivityEvent {
  id: string;
  customerId: string;
  eventType: EventType;
  title: string;
  description?: string;
  createdBy: string;
  // ISO-format date string used for sorting (YYYY-MM-DD or YYYY-MM-DDTHH:mm)
  createdAt: string;
  // Human-readable display date shown in the UI
  displayDate: string;
  // Optional metadata for display (stage name, amount, etc.)
  metadata?: Record<string, string | number | boolean>;
}
