"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Briefcase } from "lucide-react";
import UiSelect from "@/components/ui/Select";
import DatePicker from "@/components/ui/DatePicker";
import TimePicker from "@/components/ui/TimePicker";
import { getAllCustomers, getProperties, updateCustomer } from "@/lib/customers/data";
import { createJob, type JobType, type JobPriority } from "@/lib/jobs/data";
import { getTechRoster } from "@/lib/calendar/data";
import { AddressAutocomplete, EMPTY_ADDRESS, type ParsedAddress } from "@/components/address/AddressAutocomplete";
import { todayYMD, isPastDateTime } from "@/lib/utils/schedule";

export interface JobWizardPreset {
  customerId?: string;
  projectId?: string;
  lockCustomer?: boolean;
}

const JOB_TYPES: JobType[] = ["maintenance", "repair", "installation", "inspection", "emergency", "estimate", "warranty", "replacement", "other"];
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
  // Roster is derived from the user directory (localStorage) — load client-side.
  const [roster, setRoster] = useState<ReturnType<typeof getTechRoster>>([]);
  useEffect(() => { setRoster(getTechRoster()); }, []);

  const [customerId, setCustomerId] = useState(preset?.customerId ?? customers[0]?.id ?? "");
  const [propertyId, setPropertyId] = useState("");
  const [title, setTitle]   = useState("");
  const [type, setType]     = useState<JobType>("repair");
  const [priority, setPriority] = useState<JobPriority>("normal");
  const [date, setDate]     = useState("");
  const [time, setTime]     = useState("");
  const [duration, setDuration] = useState("120");
  const [tech, setTech]     = useState("");
  const [estimate, setEstimate] = useState("");

  const customer = customers.find(c => c.id === customerId);
  const properties = useMemo(() => (customerId ? getProperties(customerId) : []), [customerId]);
  const selectedProperty = properties.find(p => p.id === propertyId);

  // Service address — required to dispatch. Prefilled from the selected property
  // or the customer's address; empty (and required) for a quick-add customer who
  // has no address yet, so we capture it at the moment we need it.
  const [addr, setAddr] = useState<ParsedAddress>({ ...EMPTY_ADDRESS });
  const [saveToCustomer, setSaveToCustomer] = useState(false);
  useEffect(() => {
    const src = selectedProperty
      ? { line1: selectedProperty.address, city: selectedProperty.city, state: selectedProperty.state, zip: selectedProperty.zip }
      : customer
      ? { line1: customer.address, city: customer.city, state: customer.state, zip: customer.zip }
      : { line1: "", city: "", state: "", zip: "" };
    setAddr({ ...EMPTY_ADDRESS, addressLine1: src.line1 ?? "", city: src.city ?? "", state: src.state ?? "", postalCode: src.zip ?? "" });
    // Default the "save back" toggle on only when we're capturing a fresh address
    // for an account that doesn't have one yet.
    setSaveToCustomer(Boolean(customer) && !selectedProperty && !src.line1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId, propertyId]);

  const formattedAddress = addr.addressLine1.trim()
    ? [addr.addressLine1.trim(), addr.city.trim()].filter(Boolean).join(", ")
    : undefined;

  const schedulePast = isPastDateTime(date, time);
  const canCreate = Boolean(customerId && title.trim() && addr.addressLine1.trim()) && !schedulePast;
  const willSchedule = Boolean(date);

  function handleCreate() {
    if (!customer) return;
    // Persist the address back to the customer so it's there next time.
    if (saveToCustomer) {
      updateCustomer(customer.id, {
        address: addr.addressLine1.trim(), city: addr.city.trim(),
        state: addr.state.trim(), zip: addr.postalCode.trim(),
      });
    }
    const job = createJob({
      companyId: customer.companyId, locationId: customer.locationId, serviceAreaId: customer.serviceAreaId,
      accountId: customer.id, customerName: customer.name, customerInitials: customer.initials, locationName: customer.locationName,
      title: title.trim(), type, priority,
      propertyAddress: formattedAddress, projectId: preset?.projectId,
      estimatedAmount: estimate.trim() ? (estimate.trim().startsWith("$") ? estimate.trim() : `$${estimate.trim()}`) : undefined,
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
        <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <div className="flex items-center gap-2">
            <Briefcase className="w-4 h-4" style={{ color: "#4f46e5" }} />
            <p className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>New Job</p>
          </div>
          <button onClick={onClose} style={{ color: "var(--text-muted)" }}><X className="w-4 h-4" /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto thin-scroll-y px-6 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Customer / Account *</label>
              <UiSelect value={customerId} onChange={v => { setCustomerId(v); setPropertyId(""); }}
                disabled={Boolean(preset?.lockCustomer)} options={customers.map(c => ({ value: c.id, label: c.name }))} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Property <span style={{ color: "var(--text-muted)" }}>(optional)</span></label>
              <UiSelect value={propertyId} onChange={setPropertyId} placeholder="Account address"
                options={[{ value: "", label: "Account address" }, ...properties.map(p => ({ value: p.id, label: `${p.label ? p.label + " — " : ""}${p.address}, ${p.city}` }))]} />
            </div>
          </div>

          {/* Service address — required so the job can actually be dispatched */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Service Address <span style={{ color: "#ef4444" }}>*</span></label>
            <AddressAutocomplete value={addr} onChange={setAddr} placeholder="Start typing a street address…" required />
            {customer && !selectedProperty && (
              <label className="flex items-center gap-2 mt-2 cursor-pointer select-none">
                <input type="checkbox" checked={saveToCustomer} onChange={e => setSaveToCustomer(e.target.checked)} className="accent-indigo-600" />
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>Save this address to {customer.name}</span>
              </label>
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
              <UiSelect value={type} onChange={v => setType(v as JobType)} options={JOB_TYPES.map(t => ({ value: t, label: cap(t) }))} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Priority</label>
              <UiSelect value={priority} onChange={v => setPriority(v as JobPriority)} options={PRIORITIES.map(p => ({ value: p, label: cap(p) }))} />
            </div>
          </div>

          {/* Scheduling */}
          <div className="rounded-xl p-3 space-y-3" style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border-subtle)" }}>
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Schedule</p>
              <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{willSchedule ? "Scheduled" : "Leave blank → Unscheduled (goes to dispatch queue)"}</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Date</label>
                <DatePicker size="sm" value={date} onChange={setDate} placeholder="Pick a date" min={todayYMD()} />
              </div>
              <div>
                <label className="block text-[10px] font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Time</label>
                <TimePicker size="sm" value={time} onChange={setTime} placeholder="Pick a time" />
              </div>
              <div>
                <label className="block text-[10px] font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Duration (min)</label>
                <input type="number" min={15} step={15} value={duration} onChange={e => setDuration(e.target.value)}
                  className="w-full rounded-lg px-2.5 py-1.5 text-xs outline-none" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
              </div>
            </div>
            {schedulePast && (
              <p className="text-[10px]" style={{ color: "#dc2626" }}>
                That date/time is in the past. Choose a current or future slot, or leave blank to send it to the dispatch queue.
              </p>
            )}
            <div>
              <label className="block text-[10px] font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Assigned Technician</label>
              <UiSelect size="sm" value={tech} onChange={setTech}
                options={[{ value: "", label: "Unassigned" }, ...roster.map(r => ({ value: r.name, label: r.name }))]} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Estimated Amount <span style={{ color: "var(--text-muted)" }}>(optional)</span></label>
            <input value={estimate} onChange={e => setEstimate(e.target.value)} placeholder="e.g. 285"
              className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 flex justify-end gap-2 shrink-0" style={{ borderTop: "1px solid var(--border-subtle)" }}>
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
