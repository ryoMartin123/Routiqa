"use client";

// ─── New / Edit Task modal ────────────────────────────────
// Single-screen quick entry for follow-ups, calls, and scheduled actions.
// Optionally links the task to a customer, lead, job, or project. A linked
// record fixes the task's company/location and surfaces the task on that
// record's profile (the customer/lead/job getters in lib/tasks key off these
// ids). Doubles as an editor when handed an existing task.

import { useState } from "react";
import { X, CheckSquare } from "lucide-react";
import { useHierarchy } from "@/components/providers/HierarchyProvider";
import { usePermissionContext } from "@/components/providers/PermissionProvider";
import { getAllLocations } from "@/lib/hierarchy/data";
import { getStaffedUsers } from "@/lib/users/data";
import { getCustomer } from "@/lib/customers/data";
import { getAllLeads } from "@/lib/leads/data";
import { getAllJobs } from "@/lib/jobs/data";
import { getAllProjects } from "@/lib/projects/data";
import {
  createTask, updateTask,
  type Task, type TaskType, type NewTaskInput,
} from "@/lib/tasks/data";
import { getTaskSettings, getActiveTaskTypes, taskTypeLabel } from "@/lib/tasks/settings";
import AccountCombobox from "@/components/customers/AccountCombobox";
import RecordCombobox, { type RecordOption } from "@/components/shared/RecordCombobox";
import UiSelect from "@/components/ui/Select";
import DatePicker from "@/components/ui/DatePicker";
import type { AnchorRecordType } from "@/lib/comments/data";

const UNASSIGNED = "Unassigned";

type LinkType = "none" | "customer" | "lead" | "job" | "project";
const LINK_TYPES: { key: LinkType; label: string }[] = [
  { key: "none",     label: "None"     },
  { key: "customer", label: "Customer" },
  { key: "lead",     label: "Lead"     },
  { key: "job",      label: "Job"      },
  { key: "project",  label: "Project"  },
];

// All link fields, cleared — so editing replaces (not merges) the prior link.
const EMPTY_LINK = {
  customerId: undefined, customerName: undefined,
  leadId: undefined, jobId: undefined, projectId: undefined,
  linkedLabel: undefined, linkedHref: undefined, linkedType: undefined,
} satisfies Partial<Task>;

// "Jun 12, 2026" (display + parseable) ⇄ "2026-06-12" (date input value).
function toInputDate(display?: string): string {
  if (!display) return "";
  const d = new Date(display);
  if (isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fromInputDate(value: string): string {
  if (!value) return "";
  // Parse as local date (avoid the UTC shift of `new Date("2026-06-12")`).
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
// "yyyy-mm-dd" for today + N days — the configured New Task default due date.
function dueInDays(days: number): string {
  const d = new Date(); d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// A comment-thread anchor converted to a task link. Pins the task to the exact
// spot (the deep-link href) the comment lives at. recordType may be any anchor
// type; only customer/lead/job/project also seed a record link in the form.
export interface TaskAnchor {
  recordType: AnchorRecordType;
  recordId:   string;
  href:       string;
  label:      string;
}

const LINKABLE_TYPES = ["customer", "lead", "job", "project"];

function initialLink(task?: Task, defaultCustomerId?: string, anchor?: TaskAnchor, defaultLink?: DefaultLink): { type: LinkType; id: string } {
  if (task?.customerId) return { type: "customer", id: task.customerId };
  if (task?.leadId)     return { type: "lead",     id: task.leadId };
  if (task?.jobId)      return { type: "job",      id: task.jobId };
  if (task?.projectId)  return { type: "project",  id: task.projectId };
  if (defaultLink)      return { type: defaultLink.type, id: defaultLink.id };
  if (anchor && LINKABLE_TYPES.includes(anchor.recordType)) return { type: anchor.recordType as LinkType, id: anchor.recordId };
  if (defaultCustomerId) return { type: "customer", id: defaultCustomerId };
  return { type: "none", id: "" };
}
type DefaultLink = { type: "customer" | "lead" | "job" | "project"; id: string };

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
        {label} {required && <span style={{ color: "#ef4444" }}>*</span>}
      </label>
      {children}
    </div>
  );
}

export default function NewTaskModal({ open, onClose, onSaved, task, defaultCustomerId, defaultLink, lockLink, defaultTitle, defaultAssigneeId, anchor }: {
  open: boolean;
  onClose: () => void;
  onSaved?: (task: Task) => void;
  task?: Task;                    // edit mode when provided
  defaultCustomerId?: string;     // pre-link to an account (e.g. from a profile)
  defaultLink?: DefaultLink;      // pre-link to a customer/lead/job/project (e.g. from its detail page)
  lockLink?: boolean;             // with defaultLink: fix the link (created from inside that record)
  defaultTitle?: string;          // pre-fill the title (e.g. from a comment)
  defaultAssigneeId?: string;     // pre-select an assignee by user id (e.g. a mention)
  anchor?: TaskAnchor;            // pin the task to a comment anchor's exact spot
}) {
  const { effectiveCompanyId, effectiveLocationId, locationOptions, showCompanySelector, allCompanies } = useHierarchy();
  const { actingUser } = usePermissionContext();

  const staff = getStaffedUsers();
  const assigneeOptions = [
    { value: UNASSIGNED, label: UNASSIGNED },
    ...staff.map(u => ({ value: u.fullName, label: u.fullName })),
  ];

  // Configurable task types + New Task defaults (Settings → Tasks).
  const settings = getTaskSettings();
  const activeTypes = getActiveTaskTypes();
  const seedLink = initialLink(task, defaultCustomerId, anchor, defaultLink);

  const defaultType = settings.defaultTypeKey || activeTypes[0]?.key || "follow_up";
  const defaultAssigned = settings.defaultAssignee === "creator" ? (actingUser?.fullName ?? UNASSIGNED) : UNASSIGNED;
  // A mention can seed the assignee; a comment can seed the title (capped).
  const seededAssignee = task?.assignedTo
    ?? (defaultAssigneeId ? staff.find(u => u.id === defaultAssigneeId)?.fullName : undefined)
    ?? defaultAssigned;
  const seededTitle = task?.title ?? (defaultTitle ? defaultTitle.replace(/\s+/g, " ").trim().slice(0, 120) : "");

  const [title, setTitle]         = useState(seededTitle);
  const [type, setType]           = useState<TaskType>(task?.type ?? defaultType);
  const [due, setDue]             = useState(task ? toInputDate(task.dueDate) : dueInDays(settings.defaultDueInDays));
  const [assignedTo, setAssigned] = useState(seededAssignee);

  // The current type may be inactive/deleted (edit mode) — keep it selectable.
  const typeOptions = activeTypes.map(t => ({ value: t.key, label: t.label }));
  if (type && !activeTypes.some(t => t.key === type)) typeOptions.unshift({ value: type, label: taskTypeLabel(type) });
  const [linkType, setLinkType]   = useState<LinkType>(seedLink.type);
  const [linkId, setLinkId]       = useState(seedLink.id);
  const [notes, setNotes]         = useState(task?.notes ?? "");
  const [error, setError]         = useState<string | null>(null);

  // Records within the active scope, mapped to combobox options.
  const inScope = (x: { companyId: string; locationId: string }) =>
    (!effectiveCompanyId  || x.companyId  === effectiveCompanyId) &&
    (!effectiveLocationId || x.locationId === effectiveLocationId);
  const leadOptions: RecordOption[]    = getAllLeads().filter(inScope).map(l => ({ id: l.id, label: l.customerName, sublabel: l.title }));
  const jobOptions: RecordOption[]     = getAllJobs().filter(inScope).map(j => ({ id: j.id, label: j.title, sublabel: j.customerName }));
  const projectOptions: RecordOption[] = getAllProjects().filter(inScope).map(p => ({ id: p.id, label: p.name, sublabel: p.customerName }));

  // The picked record (resolved from the full list so edit works out-of-scope).
  const linked = (() => {
    if (!linkId) return null;
    if (linkType === "customer") { const c = getCustomer(linkId); return c && { companyId: c.companyId, locationId: c.locationId, fields: { customerId: c.id, customerName: c.name, linkedLabel: c.name, linkedHref: `/customers/${c.id}`, linkedType: "customer" as const } }; }
    if (linkType === "lead")     { const l = getAllLeads().find(x => x.id === linkId);    return l && { companyId: l.companyId, locationId: l.locationId, fields: { leadId: l.id,    customerName: l.customerName, linkedLabel: l.title, linkedHref: `/leads/${l.id}`,    linkedType: "lead" as const } }; }
    if (linkType === "job")      { const j = getAllJobs().find(x => x.id === linkId);     return j && { companyId: j.companyId, locationId: j.locationId, fields: { jobId: j.id,     customerName: j.customerName, linkedLabel: j.title, linkedHref: `/jobs/${j.id}`,     linkedType: "job" as const } }; }
    if (linkType === "project")  { const p = getAllProjects().find(x => x.id === linkId); return p && { companyId: p.companyId, locationId: p.locationId, fields: { projectId: p.id, customerName: p.customerName, linkedLabel: p.name, linkedHref: `/projects/${p.id}`, linkedType: "project" as const } }; }
    return null;
  })();

  // Without a link the task lands in the active scope; when viewing "All" with
  // several branches, the user must pick one.
  const needsBranch = !linked && !effectiveLocationId && locationOptions.length > 1;
  const [branchId, setBranchId] = useState(
    task?.locationId ?? effectiveLocationId ?? (locationOptions.length === 1 ? locationOptions[0]!.id : ""),
  );

  if (!open) return null;

  function changeLinkType(t: LinkType) {
    setLinkType(t);
    setLinkId("");
    setError(null);
  }

  function handleSave() {
    if (!title.trim()) { setError("Give the task a title."); return; }
    if (!due)          { setError("Pick a due date."); return; }
    if (linkType !== "none" && !linkId) { setError(`Choose a ${linkType} to link, or set the link to None.`); return; }

    // Scope: from the linked record, else the active/picked branch.
    let companyId: string, locationId: string;
    if (linked) {
      companyId = linked.companyId; locationId = linked.locationId;
    } else {
      if (needsBranch && !branchId) { setError(showCompanySelector ? "Choose a company and branch." : "Choose a branch."); return; }
      const locId = effectiveLocationId || branchId;
      const loc = getAllLocations().find(l => l.id === locId);
      companyId = loc?.companyId ?? effectiveCompanyId ?? "co_hvac";
      locationId = locId ?? "";
    }

    const linkFields = linked ? linked.fields : {};
    // A comment anchor pins the task to the exact deep-link spot — even for
    // record types the form can't link (quote/item/dispatch/…), where it sets
    // just the href/label so the task still navigates back to the spot.
    const finalLink = anchor
      ? { ...linkFields, linkedHref: anchor.href, linkedLabel: anchor.label }
      : linkFields;
    const base: NewTaskInput = {
      title: title.trim(), type, dueDate: fromInputDate(due),
      assignedTo, notes: notes.trim() || undefined,
      companyId, locationId,
      ...finalLink,
    };

    const saved = task
      ? updateTask(task.id, {
          ...base,
          assignedToInitials: initials(assignedTo),
          ...EMPTY_LINK, ...finalLink,   // replace any prior link wholesale
        })
      : createTask(base);

    if (saved) onSaved?.(saved);
    onClose();
  }

  const branchLabel = (companyId: string, name: string) =>
    showCompanySelector ? `${allCompanies.find(c => c.id === companyId)?.name ?? "—"} · ${name}` : name;

  const linkEmpty: Record<LinkType, string> = {
    none: "", customer: "", lead: "No leads in this scope.", job: "No jobs in this scope.", project: "No projects in this scope.",
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
        style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 16px 48px rgba(0,0,0,0.24)" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "var(--accent-soft-bg)" }}>
              <CheckSquare className="w-4 h-4" style={{ color: "var(--accent-text)" }} />
            </div>
            <div>
              <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>{task ? "Edit Task" : "New Task"}</h2>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Follow-up, call, or scheduled action</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg" style={{ color: "var(--text-muted)" }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <Field label="Task" required>
            <input value={title} onChange={e => { setTitle(e.target.value); setError(null); }}
              placeholder="e.g. Call to confirm appointment"
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <UiSelect value={type} onChange={v => setType(v)} options={typeOptions} />
            </Field>
            <Field label="Due Date" required>
              <DatePicker value={due} onChange={v => { setDue(v); setError(null); }} clearable={false} placeholder="Select date" />
            </Field>
          </div>

          <Field label="Assigned To">
            <UiSelect value={assignedTo} onChange={setAssigned} options={assigneeOptions} />
          </Field>

          <Field label="Link to Record">
            {lockLink && linkType !== "none" ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)" }}>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded" style={{ backgroundColor: "#e0e7ff", color: "#4f46e5" }}>
                  {LINK_TYPES.find(l => l.key === linkType)?.label}
                </span>
                <span className="text-sm truncate" style={{ color: "var(--text-primary)" }}>{linked?.fields.linkedLabel ?? "—"}</span>
                <span className="ml-auto text-[11px]" style={{ color: "var(--text-muted)" }}>Locked</span>
              </div>
            ) : (
            <>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {LINK_TYPES.map(lt => {
                const active = linkType === lt.key;
                return (
                  <button key={lt.key} onClick={() => changeLinkType(lt.key)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                    style={{
                      border: `1.5px solid ${active ? "#4f46e5" : "var(--border)"}`,
                      backgroundColor: active ? "#e0e7ff" : "var(--bg-surface-2)",
                      color: active ? "#4f46e5" : "var(--text-secondary)",
                    }}>
                    {lt.label}
                  </button>
                );
              })}
            </div>
            {linkType === "customer" && (
              <AccountCombobox value={linkId} onChange={id => { setLinkId(id); setError(null); }} placeholder="Search accounts…" />
            )}
            {linkType === "lead" && (
              <RecordCombobox value={linkId} onChange={id => { setLinkId(id); setError(null); }} options={leadOptions} placeholder="Search leads…" emptyText={linkEmpty.lead} />
            )}
            {linkType === "job" && (
              <RecordCombobox value={linkId} onChange={id => { setLinkId(id); setError(null); }} options={jobOptions} placeholder="Search jobs…" emptyText={linkEmpty.job} />
            )}
            {linkType === "project" && (
              <RecordCombobox value={linkId} onChange={id => { setLinkId(id); setError(null); }} options={projectOptions} placeholder="Search projects…" emptyText={linkEmpty.project} />
            )}
            {linkType !== "none" && (
              <p className="mt-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
                Linking shows this task on the {linkType}&apos;s profile.
              </p>
            )}
            </>
            )}
          </Field>

          {needsBranch && (
            <Field label={showCompanySelector ? "Company & Branch" : "Branch"} required>
              <UiSelect value={branchId} onChange={setBranchId}
                options={[
                  { value: "", label: showCompanySelector ? "Select company & branch…" : "Select branch…" },
                  ...locationOptions.map(l => ({ value: l.id, label: branchLabel(l.companyId, l.name) })),
                ]} />
            </Field>
          )}

          <Field label="Notes">
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder="Optional details…"
              className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none"
              style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
          </Field>

          {error && <p className="text-xs" style={{ color: "#ef4444" }}>{error}</p>}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 flex gap-2" style={{ borderTop: "1px solid var(--border)" }}>
          <button onClick={onClose}
            className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ border: "1px solid var(--border)", color: "var(--text-secondary)", backgroundColor: "var(--bg-surface)" }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={!title.trim() || !due}
            className="flex-1 py-2 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-40">
            {task ? "Save Changes" : "Create Task"}
          </button>
        </div>
      </div>
    </div>
  );
}

function initials(name: string): string {
  if (name === UNASSIGNED) return "—";
  const p = name.replace(/\(.*\)/, "").trim().split(/\s+/);
  return (p.length >= 2 ? p[0][0] + p[p.length - 1][0] : name.slice(0, 2)).toUpperCase();
}
