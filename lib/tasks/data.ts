// ─── Global tasks — types + mock data ─────────────────────
// Aggregates tasks from customer, lead, job, and project contexts.
// Replace with a Supabase query when connected:
//   supabase.from('tasks').select('*')
//     .eq('organization_id', orgId).order('due_date')

export type TaskStatus = "open" | "overdue" | "completed";

export type TaskType =
  | "follow_up"
  | "call"
  | "schedule"
  | "send_estimate"
  | "send_agreement"
  | "review"
  | "inspection"
  | "other";

export interface Task {
  id: string;
  organizationId: string;
  companyId: string;
  locationId: string;

  title: string;
  type: TaskType;
  status: TaskStatus;
  dueDate: string;
  completedAt?: string;
  assignedTo: string;
  assignedToInitials: string;
  notes?: string;

  // Optional linked records
  customerId?: string;
  customerName?: string;
  leadId?: string;
  jobId?: string;
  projectId?: string;

  // Display
  linkedLabel?: string;
  linkedHref?: string;
  linkedType?: "customer" | "lead" | "job" | "project";

  createdAt: string;
}

// ─── Display config ───────────────────────────────────────
export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  follow_up:      "Follow-Up",
  call:           "Call",
  schedule:       "Schedule",
  send_estimate:  "Send Estimate",
  send_agreement: "Send Agreement",
  review:         "Review",
  inspection:     "Inspection",
  other:          "Other",
};

// ─── Mock tasks ───────────────────────────────────────────
export const ALL_TASKS: Task[] = [];

// ─── Lookup helpers ───────────────────────────────────────
export function getAllTasks(): Task[] { return ALL_TASKS; }

export function getTasksForCustomer(customerId: string): Task[] {
  return ALL_TASKS.filter(t => t.customerId === customerId && !t.leadId && !t.jobId);
}

export function getTasksForLead(leadId: string): Task[] {
  return ALL_TASKS.filter(t => t.leadId === leadId);
}

export function getTasksForJob(jobId: string): Task[] {
  return ALL_TASKS.filter(t => t.jobId === jobId);
}
