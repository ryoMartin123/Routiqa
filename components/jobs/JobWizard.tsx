"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Briefcase, Plus } from "lucide-react";
import UiSelect from "@/components/ui/Select";
import AccountCombobox from "@/components/customers/AccountCombobox";
import DatePicker from "@/components/ui/DatePicker";
import TimePicker from "@/components/ui/TimePicker";
import NumberStepper from "@/components/ui/NumberStepper";
import { getAllCustomers, getProperties, updateCustomer } from "@/lib/customers/data";
import { createJob, type JobType, type JobPriority } from "@/lib/jobs/data";
import { jobTypeLabel } from "@/lib/job-config/data";
import { getBoardCandidates, getDispatchBoardMembers } from "@/lib/users/data";
import { AddressAutocomplete, EMPTY_ADDRESS, type ParsedAddress } from "@/components/address/AddressAutocomplete";
import { isPastDateTime, isOutsideHours, formatHour, minTimeFor, minBookableYMD } from "@/lib/utils/schedule";
import { resolveDispatchSettings } from "@/lib/calendar/settings";

export interface JobWizardPreset {
  customerId?: string;
  projectId?: string;
  lockCustomer?: boolean;
}

const JOB_TYPES: JobType[] = ["agreement_visit", "repair", "installation", "inspection", "emergency", "estimate", "warranty", "replacement", "other"];
const PRIORITIES: JobPriority[] = ["low", "normal", "high", "urgent"];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function fmtDate(d: string): string {
  if (!d) return "";
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? "" : dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function fmtTime(t: string): string {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  if (isNaN(h)) return "";
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m ?? 0).padStart(2, "0")} ${period}`;
}
function initialsOf(name: string): string {
  const p = name.replace(/\(.*\)/, "").trim().split(/\s+/);
  return (p.length >= 2 ? p[0][0] + p[p.length - 1][0] : name.slice(0, 2)).toUpperCase();
}

export default function JobWizard({ preset, onClose, onCreated }: {
  preset?: JobWizardPreset;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const customers = getAllCustomers();

  const [customerId, setCustomerId] = useState(preset?.customerId ?? customers[0]?.id ?? "");
  const [propertyId, setPropertyId] = useState("");
  const [title, setTitle]   = useState("");
  const [description, setDescription] = useState("");
  const [type, setType]     = useState<JobType>("repair");
  const [priority, setPriority] = useState<JobPriority>("normal");
  const [date, setDate]     = useState("");
  const [time, setTime]     = useState("");
  const [duration, setDuration] = useState("120");
  const [tech, setTech]     = useState("");

  const customer = customers.find(c => c.id === customerId);
  // Assignee candidates respect the account's scope (down-inclusion): people at
  // its location, its company, or org-wide — not other branches/companies.
  // Only people actually ON the dispatch board(s) for the account's scope can be
  // assigned — board members have a schedule/truck. Dispatchers/office staff who
  // aren't on a board are excluded.
  const roster = useMemo(() => {
    if (!customer) return [];
    const members = getDispatchBoardMembers(customer.companyId, customer.locationId);
    return getBoardCandidates(customer.companyId, customer.locationId)
      .filter(u => members.has(u.fullName))
      .map(u => ({ name: u.fullName, initials: u.initials }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer?.companyId, customer?.locationId]);
  const properties = useMemo(() => (customerId ? getProperties(customerId) : []), [customerId]);
  // One property → just use it. Multiple → let the user pick which (default to
  // the account's primary property).
  const selectedProperty = properties.find(p => p.id === propertyId)
    ?? properties.find(p => p.isPrimary)
    ?? properties[0];
  const multiProperty = properties.length > 1;

  // The account's on-file address for the selected property (read-only).
  const existing = selectedProperty
    ? { line1: selectedProperty.address, city: selectedProperty.city, state: selectedProperty.state, zip: selectedProperty.zip }
    : customer
    ? { line1: customer.address, city: customer.city, state: customer.state, zip: customer.zip }
    : { line1: "", city: "", state: "", zip: "" };
  const hasExisting = Boolean((existing.line1 ?? "").trim());
  const existingLabel = hasExisting
    ? [existing.line1, [existing.city, existing.state].filter(Boolean).join(", "), existing.zip].filter(Boolean).join(", ")
    : "";

  // A separately-entered address is ALWAYS saved back to the account (no opt-out).
  const [useNewAddress, setUseNewAddress] = useState(false);
  const [addr, setAddr] = useState<ParsedAddress>({ ...EMPTY_ADDRESS });
  // No address on file → force entering one. Reset when the account changes.
  useEffect(() => {
    setUseNewAddress(!hasExisting);
    setAddr({ ...EMPTY_ADDRESS });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  const jobAddress = useNewAddress
    ? (addr.addressLine1.trim() ? [addr.addressLine1.trim(), addr.city.trim()].filter(Boolean).join(", ") : "")
    : existingLabel;

  // Dispatch board working hours for THIS job's scope (its company/location).
  // A timed job can only be scheduled inside that window — and the duration has
  // to fit before close.
  const board = useMemo(
    () => resolveDispatchSettings(customer?.companyId, customer?.locationId).hourly,
    [customer?.companyId, customer?.locationId],
  );
  const schedulePast = isPastDateTime(date, time);
  const outsideHours = isOutsideHours(time, parseInt(duration) || 0, board.startHour, board.endHour);
  const addressOk = useNewAddress ? Boolean(addr.addressLine1.trim()) : hasExisting;
  const canCreate = Boolean(customerId && title.trim() && description.trim()) && addressOk && !schedulePast && !outsideHours;
  const willSchedule = Boolean(date);

  function handleCreate() {
    if (!customer) return;
    // A separately-entered address is saved to the account for record.
    if (useNewAddress && addr.addressLine1.trim()) {
      updateCustomer(customer.id, {
        address: addr.addressLine1.trim(), city: addr.city.trim(),
        state: addr.state.trim(), zip: addr.postalCode.trim(),
      });
    }
    const job = createJob({
      companyId: customer.companyId, locationId: customer.locationId, serviceAreaId: customer.serviceAreaId,
      accountId: customer.id, customerName: customer.name, customerInitials: customer.initials, locationName: customer.locationName,
      title: title.trim(), description: description.trim(), type, priority,
      propertyAddress: jobAddress || undefined, projectId: preset?.projectId,
      scheduledDate: date ? fmtDate(date) : undefined,
      scheduledTime: time ? fmtTime(time) : undefined,
      durationMinutes: parseInt(duration) || 120,
      assignedTo: tech || undefined,
      assignedToInitials: tech ? initialsOf(tech) : undefined,
    });
    onCreated(job.id);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[92vh] flex flex-col rounded-2xl overflow-hidden" onClick={e => e.stopPropagation()}
        style={{ backgroundColor: "var(--bg-surface)", boxShadow: "0 16px 48px rgba(0,0,0,0.24)" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2">
            <Briefcase className="w-4 h-4" style={{ color: "#4f46e5" }} />
            <p className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>New Job</p>
          </div>
          <button onClick={onClose} style={{ color: "var(--text-muted)" }}><X className="w-4 h-4" /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto thin-scroll-y px-6 py-4 space-y-4">
          <div className={multiProperty ? "grid grid-cols-2 gap-3" : ""}>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Customer / Account *</label>
              <AccountCombobox value={customerId} onChange={v => { setCustomerId(v); setPropertyId(""); }}
                disabled={Boolean(preset?.lockCustomer)} />
            </div>
            {multiProperty && (
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Property</label>
                <UiSelect value={selectedProperty?.id ?? ""} onChange={v => { setPropertyId(v); setUseNewAddress(false); }}
                  options={properties.map(p => ({ value: p.id, label: `${p.label ? p.label + " — " : ""}${p.address}, ${p.city}` }))} />
              </div>
            )}
          </div>

          {/* Service address — required so the job can be dispatched */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Service Address <span style={{ color: "#ef4444" }}>*</span></label>
            {useNewAddress ? (
              <>
                <AddressAutocomplete value={addr} onChange={setAddr} placeholder="Start typing a street address…" required />
                <div className="flex items-center justify-between mt-2 gap-2">
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>This address will be saved to {customer?.name ?? "the account"}.</span>
                  {hasExisting && (
                    <button onClick={() => setUseNewAddress(false)} className="text-xs font-medium shrink-0" style={{ color: "var(--accent-text)" }}>
                      Use account address
                    </button>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="w-full rounded-lg px-3 py-2 text-sm" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)", color: hasExisting ? "var(--text-primary)" : "var(--text-muted)" }}>
                  {existingLabel || "No address on file"}
                </div>
                <button onClick={() => { setUseNewAddress(true); setAddr({ ...EMPTY_ADDRESS }); }} className="flex items-center gap-1 text-xs font-medium mt-2" style={{ color: "var(--accent-text)" }}>
                  <Plus className="w-3 h-3" /> Add a separate address
                </button>
              </>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Job Title *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. AC not cooling — diagnostic"
              className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Type</label>
              <UiSelect value={type} onChange={v => setType(v as JobType)} options={JOB_TYPES.map(t => ({ value: t, label: jobTypeLabel(t) }))} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Priority</label>
              <UiSelect value={priority} onChange={v => setPriority(v as JobPriority)} options={PRIORITIES.map(p => ({ value: p, label: cap(p) }))} />
            </div>
          </div>

          {/* Description — required, above scheduling */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Description <span style={{ color: "#ef4444" }}>*</span></label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
              placeholder="What needs to be done on this job…"
              className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
          </div>

          {/* Scheduling */}
          <div className="rounded-xl p-3 space-y-3" style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Schedule</p>
              <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{willSchedule ? "Scheduled" : "Leave blank → Unscheduled (goes to dispatch queue)"}</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Date</label>
                <DatePicker size="sm" value={date} onChange={setDate} placeholder="Pick a date" min={minBookableYMD(board.endHour)} />
              </div>
              <div>
                <label className="block text-[10px] font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Time</label>
                <TimePicker size="sm" value={time} onChange={setTime} placeholder="Pick a time"
                  startHour={Math.floor(board.startHour)} endHour={Math.ceil(board.endHour)} minTime={minTimeFor(date)} />
              </div>
              <div>
                <label className="block text-[10px] font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Duration (min)</label>
                <NumberStepper size="sm" min={15} step={15} value={duration} onChange={setDuration} />
              </div>
            </div>
            {schedulePast && (
              <p className="text-[10px]" style={{ color: "#dc2626" }}>
                That date/time is in the past. Choose a current or future slot, or leave blank to send it to the dispatch queue.
              </p>
            )}
            {!schedulePast && outsideHours && (
              <p className="text-[10px]" style={{ color: "#dc2626" }}>
                The dispatch board runs {formatHour(board.startHour)}–{formatHour(board.endHour)}. Pick a start time inside those hours that leaves room for the {parseInt(duration) || 0}-min duration, or leave the time blank to send it to the dispatch queue.
              </p>
            )}
            <div>
              <label className="block text-[10px] font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Assigned Technician</label>
              <UiSelect size="sm" value={tech} onChange={setTech}
                options={[{ value: "", label: "Unassigned" }, ...roster.map(r => ({ value: r.name, label: r.name }))]} />
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 flex justify-end gap-2 shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
          <button onClick={onClose} className="px-3 py-2 rounded-lg text-sm" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
          <button onClick={handleCreate} disabled={!canCreate}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40" style={{ backgroundColor: "#4f46e5" }}>
            Create Job
          </button>
        </div>
      </div>
    </div>
  );
}
