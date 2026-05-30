"use client";

import { use, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, Pencil, Trash2,
  Phone, Mail, MapPin, Building2, Calendar,
  CheckCircle, Circle, AlertCircle,
  ChevronRight, Plus, MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getCustomer, getContacts, getProperties, getEquipment, getJobs, getLeads, getNotes,
  type Contact, type Property, type CustomerType, type CustomerStatus,
  type JobStatus, type LeadStatus, type NoteType, type EquipmentStatus, type PropertyType,
} from "@/lib/customers/data";
import { serviceAreas } from "@/lib/hierarchy/data";
import { formatPhone, validatePhone, validateEmail } from "@/lib/utils/validation";
import { AGREEMENTS } from "@/lib/agreements/data";

// ─── Badge helpers ────────────────────────────────────────
function typePill(type: CustomerType) {
  return type === "Commercial"
    ? { backgroundColor: "#fef3c7", color: "#92400e" }
    : { backgroundColor: "var(--bg-input)", color: "var(--text-secondary)" };
}
function statusPill(status: CustomerStatus) {
  return status === "Customer"
    ? { backgroundColor: "#d1fae5", color: "#065f46" }
    : { backgroundColor: "#e0e7ff", color: "#3730a3" };
}
function jobStatusStyle(s: JobStatus) {
  if (s === "Completed")   return { bg: "#d1fae5", color: "#065f46" };
  if (s === "Scheduled")   return { bg: "#e0e7ff", color: "#3730a3" };
  if (s === "In Progress") return { bg: "#fef3c7", color: "#92400e" };
  return { bg: "var(--bg-input)", color: "var(--text-muted)" };
}
function leadStatusStyle(s: LeadStatus) {
  if (s === "Won")       return { bg: "#d1fae5", color: "#065f46" };
  if (s === "Quoted")    return { bg: "#e0e7ff", color: "#3730a3" };
  if (s === "Contacted") return { bg: "#fef3c7", color: "#92400e" };
  if (s === "Lost")      return { bg: "#fee2e2", color: "#991b1b" };
  return { bg: "var(--bg-input)", color: "var(--text-muted)" };
}
const NOTE_ICON: Record<NoteType, typeof MessageSquare> = {
  note: MessageSquare, call: Phone, email: Mail, visit: MapPin,
};

const TABS = ["Overview", "Contacts", "Properties", "Equipment", "Jobs", "Leads", "Agreements", "Photos & Files", "Notes", "Communication", "Billing"];

// ─── Overview tab ─────────────────────────────────────────
function OverviewTab({ id }: { id: string }) {
  const customer   = getCustomer(id)!;
  const contacts   = getContacts(id);
  const jobs       = getJobs(id);
  const leads      = getLeads(id);
  const notes      = getNotes(id);
  const agreements = AGREEMENTS.filter(a => a.customer === customer.name);
  const primary    = contacts.find(c => c.isPrimary) ?? contacts[0];
  const recentJobs = jobs.slice(0, 3);
  const openLeads  = leads.filter(l => l.status !== "Won" && l.status !== "Lost");

  return (
    <div className="grid grid-cols-3 gap-6">
      {/* Left: contact info + summary */}
      <div className="space-y-4">
        {/* Contact */}
        <Card title="Contact">
          <div className="space-y-2.5">
            <InfoRow icon={Phone} value={customer.phone} />
            {customer.email && <InfoRow icon={Mail}  value={customer.email} />}
            <InfoRow icon={MapPin} value={`${customer.address}, ${customer.city}, ${customer.state} ${customer.zip}`} />
            {customer.type === "Commercial" && <InfoRow icon={Building2} value={customer.locationName} />}
          </div>
        </Card>

        {/* Summary */}
        <Card title="Account Summary">
          <div className="space-y-2">
            {[
              { label: "Customer since", value: customer.since },
              { label: "Total jobs",     value: String(jobs.length) },
              { label: "Open leads",     value: String(openLeads.length) },
              { label: "Agreements",     value: String(agreements.length) },
              { label: "Branch",         value: customer.locationName },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between">
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</span>
                <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{value}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Tags */}
        {customer.tags.length > 0 && (
          <Card title="Tags">
            <div className="flex flex-wrap gap-1.5">
              {customer.tags.map(t => (
                <span key={t} className="text-[10px] font-semibold px-2 py-1 rounded-full" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-secondary)" }}>
                  {t}
                </span>
              ))}
            </div>
          </Card>
        )}

        {/* Notes preview */}
        {customer.notes && (
          <Card title="Notes">
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{customer.notes}</p>
          </Card>
        )}
      </div>

      {/* Right: jobs, agreements, leads */}
      <div className="col-span-2 space-y-4">
        {/* Recent jobs */}
        <SectionCard
          title="Recent Jobs"
          count={jobs.length}
          action={{ label: "View all", onClick: () => {} }}
        >
          {recentJobs.length === 0 ? (
            <Empty text="No jobs yet" />
          ) : recentJobs.map((job, i) => {
            const s = jobStatusStyle(job.status);
            return (
              <Row key={job.id} last={i === recentJobs.length - 1}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{job.title}</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{job.date} · {job.tech}{job.amount ? ` · ${job.amount}` : ""}</p>
                </div>
                <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full ml-3 shrink-0" style={{ backgroundColor: s.bg, color: s.color }}>
                  {job.status}
                </span>
              </Row>
            );
          })}
        </SectionCard>

        {/* Active agreements */}
        <SectionCard
          title="Agreements"
          count={agreements.length}
          action={{ label: "View all", onClick: () => {} }}
        >
          {agreements.length === 0 ? (
            <Empty text="No active agreements">
              <button className="mt-2 text-xs font-medium text-indigo-600 hover:text-indigo-700">Create agreement →</button>
            </Empty>
          ) : agreements.map((a, i) => (
            <Row key={a.id} last={i === agreements.length - 1}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{a.type}</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Renews {a.renewalDate} · {a.visitFrequency}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-3">
                <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{a.annualValue.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}/yr</span>
                <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: "#d1fae5", color: "#065f46" }}>Active</span>
              </div>
            </Row>
          ))}
        </SectionCard>

        {/* Open leads */}
        {openLeads.length > 0 && (
          <SectionCard title="Open Leads" count={openLeads.length}>
            {openLeads.map((lead, i) => {
              const s = leadStatusStyle(lead.status);
              return (
                <Row key={lead.id} last={i === openLeads.length - 1}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{lead.title}</p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{lead.date}{lead.source ? ` · ${lead.source}` : ""}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    {lead.value && <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{lead.value}</span>}
                    <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: s.bg, color: s.color }}>{lead.status}</span>
                  </div>
                </Row>
              );
            })}
          </SectionCard>
        )}

        {/* Recent notes */}
        {notes.length > 0 && (
          <SectionCard title="Recent Notes" count={notes.length}>
            {notes.slice(0, 3).map((note, i) => {
              const Icon = NOTE_ICON[note.type];
              return (
                <Row key={note.id} last={i === Math.min(2, notes.length - 1)}>
                  <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 mr-2.5">
                    <Icon className="w-3 h-3 text-indigo-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-snug" style={{ color: "var(--text-secondary)" }}>{note.text}</p>
                    <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>{note.user} · {note.date}</p>
                  </div>
                </Row>
              );
            })}
          </SectionCard>
        )}
      </div>
    </div>
  );
}

// ─── Contacts tab ─────────────────────────────────────────
const CONTACT_ROLES = [
  "Primary Contact", "Homeowner", "Property Manager", "Tenant",
  "Owner", "Billing Contact", "Facility Manager",
  "Maintenance Coordinator", "Decision Maker", "Other",
];

interface ContactForm {
  name: string; role: string; phone: string; email: string;
  preferredContact: "phone" | "email" | "text"; notes: string; isPrimary: boolean;
}
const EMPTY_CONTACT_FORM: ContactForm = {
  name: "", role: "Homeowner", phone: "", email: "",
  preferredContact: "text", notes: "", isPrimary: false,
};

function ContactCard({
  contact, onSetPrimary,
}: { contact: Contact; onSetPrimary: (id: string) => void }) {
  const initials = contact.name.split(" ").map(w => w[0] ?? "").join("").slice(0, 2).toUpperCase();
  return (
    <div className="rounded-xl p-4" style={{
      backgroundColor: "var(--bg-surface)",
      border: `1px solid ${contact.isPrimary ? "#c7d2fe" : "var(--border-subtle)"}`,
      boxShadow: "var(--shadow-card)",
    }}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${contact.isPrimary ? "bg-indigo-600 text-white" : "bg-indigo-100 text-indigo-600"}`}>
            {initials}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{contact.name}</p>
              {contact.isPrimary && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: "#e0e7ff", color: "#3730a3" }}>Primary</span>
              )}
            </div>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{contact.role ?? "Contact"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!contact.isPrimary && (
            <button onClick={() => onSetPrimary(contact.id)}
              className="text-[11px] px-2 py-1 rounded-lg transition-colors"
              style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
              Set as Primary
            </button>
          )}
          <button className="p-1.5 rounded-lg" style={{ color: "var(--text-muted)" }}>
            <Pencil className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Contact details */}
      <div className="mt-3 space-y-1.5">
        {contact.phone && (
          <div className="flex items-center gap-2 flex-wrap">
            <Phone className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
            <span className="text-sm" style={{ color: "var(--text-primary)" }}>{contact.phone}</span>
            {contact.preferredContact === "phone" && (
              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "#e0e7ff", color: "#4f46e5" }}>Preferred</span>
            )}
            <div className="ml-auto flex gap-1">
              <button className="text-[11px] px-2 py-0.5 rounded-lg transition-colors" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Call</button>
              <button className="text-[11px] px-2 py-0.5 rounded-lg transition-colors" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Text</button>
            </div>
          </div>
        )}
        {contact.email && (
          <div className="flex items-center gap-2">
            <Mail className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
            <span className="text-sm truncate" style={{ color: "var(--text-primary)" }}>{contact.email}</span>
            {contact.preferredContact === "email" && (
              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "#e0e7ff", color: "#4f46e5" }}>Preferred</span>
            )}
            <button className="ml-auto text-[11px] px-2 py-0.5 rounded-lg transition-colors shrink-0" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Email</button>
          </div>
        )}
      </div>

      {contact.notes && (
        <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{contact.notes}</p>
        </div>
      )}
    </div>
  );
}

function AddContactForm({
  form, errors, onChange, onSave, onCancel,
}: {
  form: ContactForm;
  errors: Record<string, string>;
  onChange: (k: keyof ContactForm, v: ContactForm[keyof ContactForm]) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="rounded-xl p-4 space-y-3" style={{ backgroundColor: "var(--bg-surface)", border: "2px solid #c7d2fe", boxShadow: "var(--shadow-card)" }}>
      <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#4f46e5" }}>New Contact</p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Name <span style={{ color: "#ef4444" }}>*</span></label>
          <input value={form.name} onChange={e => onChange("name", e.target.value)}
            placeholder="Full name"
            className="w-full rounded-lg px-3 py-2 text-sm outline-none"
            style={{ border: `1px solid ${errors.name ? "#ef4444" : "var(--border)"}`, backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
          {errors.name && <p className="text-xs mt-1" style={{ color: "#ef4444" }}>{errors.name}</p>}
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Role</label>
          <select value={form.role} onChange={e => onChange("role", e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm outline-none"
            style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }}>
            {CONTACT_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Phone</label>
          <input type="tel" value={form.phone} onChange={e => onChange("phone", formatPhone(e.target.value))}
            placeholder="(000) 000-0000"
            className="w-full rounded-lg px-3 py-2 text-sm outline-none"
            style={{ border: `1px solid ${errors.phone ? "#ef4444" : "var(--border)"}`, backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
          {errors.phone && <p className="text-xs mt-1" style={{ color: "#ef4444" }}>{errors.phone}</p>}
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Email</label>
          <input type="email" value={form.email} onChange={e => onChange("email", e.target.value)}
            placeholder="email@example.com"
            className="w-full rounded-lg px-3 py-2 text-sm outline-none"
            style={{ border: `1px solid ${errors.email ? "#ef4444" : "var(--border)"}`, backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
          {errors.email && <p className="text-xs mt-1" style={{ color: "#ef4444" }}>{errors.email}</p>}
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Preferred Contact Method</label>
        <div className="flex gap-2">
          {(["phone", "email", "text"] as const).map(m => (
            <button key={m} onClick={() => onChange("preferredContact", m)}
              className="flex-1 py-1.5 rounded-lg text-xs font-medium capitalize transition-all"
              style={{
                border: `1.5px solid ${form.preferredContact === m ? "#4f46e5" : "var(--border)"}`,
                backgroundColor: form.preferredContact === m ? "#e0e7ff" : "transparent",
                color: form.preferredContact === m ? "#4f46e5" : "var(--text-secondary)",
              }}>
              {m}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Notes</label>
        <textarea value={form.notes} onChange={e => onChange("notes", e.target.value)}
          placeholder="Optional notes..." rows={2}
          className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none"
          style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
      </div>

      <div className="flex items-center justify-between pt-1">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.isPrimary} onChange={e => onChange("isPrimary", e.target.checked)}
            className="w-3.5 h-3.5 accent-indigo-600" />
          <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Mark as primary contact</span>
        </label>
        <div className="flex gap-2">
          <button onClick={onCancel}
            className="px-3 py-1.5 rounded-lg text-sm transition-colors"
            style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
            Cancel
          </button>
          <button onClick={onSave} disabled={!form.name.trim()}
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-40 transition-colors">
            Save Contact
          </button>
        </div>
      </div>
    </div>
  );
}

function ContactsTab({ id }: { id: string }) {
  const [contacts, setContacts]     = useState<Contact[]>(() => getContacts(id));
  const [showAdd, setShowAdd]       = useState(false);
  const [form, setForm]             = useState<ContactForm>({ ...EMPTY_CONTACT_FORM, isPrimary: contacts.length === 0 });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  function changeForm(k: keyof ContactForm, v: ContactForm[keyof ContactForm]) {
    setForm(f => ({ ...f, [k]: v }));
    setFormErrors(e => { const n = { ...e }; delete n[k as string]; return n; });
  }

  function handleSetPrimary(contactId: string) {
    setContacts(prev => prev.map(c => ({ ...c, isPrimary: c.id === contactId })));
  }

  function handleSave() {
    const errs: Record<string, string> = {};
    if (!form.name.trim())  errs.name  = "Name is required";
    if (form.phone.trim()) { const e = validatePhone(form.phone); if (e) errs.phone = e; }
    if (form.email.trim()) { const e = validateEmail(form.email); if (e) errs.email = e; }
    if (Object.keys(errs).length > 0) { setFormErrors(errs); return; }

    const newContact: Contact = {
      id: `c-${Date.now()}`,
      customerId: id,
      name: form.name.trim(),
      role: form.role,
      phone: form.phone.trim() || undefined,
      email: form.email.trim() || undefined,
      preferredContact: form.preferredContact,
      notes: form.notes.trim() || undefined,
      isPrimary: form.isPrimary || contacts.length === 0,
    };

    setContacts(prev => {
      const updated = form.isPrimary
        ? [newContact, ...prev.map(c => ({ ...c, isPrimary: false }))]
        : [...prev, newContact];
      return updated;
    });
    setShowAdd(false);
    setForm({ ...EMPTY_CONTACT_FORM, isPrimary: false });
    setFormErrors({});
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          {contacts.length} {contacts.length === 1 ? "Contact" : "Contacts"}
        </p>
        <button
          onClick={() => { setShowAdd(true); setForm({ ...EMPTY_CONTACT_FORM, isPrimary: contacts.length === 0 }); }}
          disabled={showAdd}
          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Add Contact
        </button>
      </div>

      {showAdd && (
        <AddContactForm
          form={form} errors={formErrors}
          onChange={changeForm}
          onSave={handleSave}
          onCancel={() => { setShowAdd(false); setFormErrors({}); }}
        />
      )}

      {contacts.map(c => (
        <ContactCard key={c.id} contact={c} onSetPrimary={handleSetPrimary} />
      ))}
    </div>
  );
}

// ─── Properties tab ───────────────────────────────────────
const PROPERTY_TYPES: PropertyType[] = ["Residential", "Commercial", "Industrial", "Multi-Family"];

interface PropertyFormData {
  label: string; address: string; city: string; state: string; zip: string;
  type: PropertyType; serviceAreaId: string; sqft: string; yearBuilt: string;
  accessNotes: string; isPrimary: boolean;
}
const EMPTY_PROPERTY_FORM: PropertyFormData = {
  label: "", address: "", city: "", state: "GA", zip: "",
  type: "Residential", serviceAreaId: "", sqft: "", yearBuilt: "",
  accessNotes: "", isPrimary: false,
};

function PropertyCard({ property }: { property: Property }) {
  const saName = property.serviceAreaId
    ? serviceAreas.find(s => s.id === property.serviceAreaId)?.name
    : null;
  const statusActive = (property.status ?? "active") === "active";

  return (
    <div className="rounded-xl overflow-hidden" style={{
      backgroundColor: "var(--bg-surface)",
      border: `1px solid ${property.isPrimary ? "#c7d2fe" : "var(--border-subtle)"}`,
      boxShadow: "var(--shadow-card)",
    }}>
      {/* Header */}
      <div className="flex items-start justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              {property.label ?? property.address}
            </p>
            {property.isPrimary && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: "#e0e7ff", color: "#3730a3" }}>Primary</span>
            )}
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-secondary)" }}>{property.type}</span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{
              backgroundColor: statusActive ? "#d1fae5" : "var(--bg-input)",
              color: statusActive ? "#065f46" : "var(--text-muted)",
            }}>
              {statusActive ? "Active" : "Inactive"}
            </span>
          </div>
        </div>
        <button className="text-xs px-2 py-1 rounded-lg shrink-0 ml-3 transition-colors" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
          Edit
        </button>
      </div>

      {/* Detail rows */}
      <div className="px-5 py-4 space-y-2">
        <div className="flex items-start gap-2.5">
          <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "var(--text-muted)" }} />
          <div>
            <p className="text-sm" style={{ color: "var(--text-primary)" }}>{property.address}</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>{property.city}, {property.state} {property.zip}</p>
          </div>
        </div>

        {(property.sqft || property.yearBuilt || saName) && (
          <div className="flex items-center gap-4 pt-1">
            {property.sqft && (
              <div>
                <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "var(--text-muted)" }}>Sq Ft</p>
                <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{property.sqft.toLocaleString()}</p>
              </div>
            )}
            {property.yearBuilt && (
              <div>
                <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "var(--text-muted)" }}>Year Built</p>
                <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{property.yearBuilt}</p>
              </div>
            )}
            {saName && (
              <div>
                <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "var(--text-muted)" }}>Service Area</p>
                <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{saName}</p>
              </div>
            )}
          </div>
        )}

        {property.accessNotes && (
          <div className="mt-1 pt-3" style={{ borderTop: "1px solid var(--border-subtle)" }}>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Access Notes</p>
            <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>{property.accessNotes}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function AddPropertyForm({
  form, errors, onChange, onSave, onCancel, hasPrimary,
}: {
  form: PropertyFormData;
  errors: Record<string, string>;
  onChange: (k: keyof PropertyFormData, v: PropertyFormData[keyof PropertyFormData]) => void;
  onSave: () => void;
  onCancel: () => void;
  hasPrimary: boolean;
}) {
  return (
    <div className="rounded-xl p-4 space-y-3" style={{ backgroundColor: "var(--bg-surface)", border: "2px solid #c7d2fe", boxShadow: "var(--shadow-card)" }}>
      <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#4f46e5" }}>New Property</p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Property Label</label>
          <input value={form.label} onChange={e => onChange("label", e.target.value)}
            placeholder="e.g. Main Office, Unit 4B"
            className="w-full rounded-lg px-3 py-2 text-sm outline-none"
            style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Property Type</label>
          <select value={form.type} onChange={e => onChange("type", e.target.value as PropertyType)}
            className="w-full rounded-lg px-3 py-2 text-sm outline-none"
            style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }}>
            {PROPERTY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Street Address <span style={{ color: "#ef4444" }}>*</span></label>
        <input value={form.address} onChange={e => onChange("address", e.target.value)}
          placeholder="123 Main St"
          className="w-full rounded-lg px-3 py-2 text-sm outline-none"
          style={{ border: `1px solid ${errors.address ? "#ef4444" : "var(--border)"}`, backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
        {errors.address && <p className="text-xs mt-1" style={{ color: "#ef4444" }}>{errors.address}</p>}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-1">
          <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>City <span style={{ color: "#ef4444" }}>*</span></label>
          <input value={form.city} onChange={e => onChange("city", e.target.value)} placeholder="City"
            className="w-full rounded-lg px-3 py-2 text-sm outline-none"
            style={{ border: `1px solid ${errors.city ? "#ef4444" : "var(--border)"}`, backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
          {errors.city && <p className="text-xs mt-1" style={{ color: "#ef4444" }}>{errors.city}</p>}
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>State</label>
          <input value={form.state} onChange={e => onChange("state", e.target.value)} placeholder="GA"
            className="w-full rounded-lg px-3 py-2 text-sm outline-none"
            style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Zip</label>
          <input value={form.zip} onChange={e => onChange("zip", e.target.value)} placeholder="30909"
            className="w-full rounded-lg px-3 py-2 text-sm outline-none"
            style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Sq Ft</label>
          <input type="number" value={form.sqft} onChange={e => onChange("sqft", e.target.value)} placeholder="1,800"
            className="w-full rounded-lg px-3 py-2 text-sm outline-none"
            style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Year Built</label>
          <input type="number" value={form.yearBuilt} onChange={e => onChange("yearBuilt", e.target.value)} placeholder="2005"
            className="w-full rounded-lg px-3 py-2 text-sm outline-none"
            style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Service Area</label>
          <select value={form.serviceAreaId} onChange={e => onChange("serviceAreaId", e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm outline-none"
            style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }}>
            <option value="">None</option>
            {serviceAreas.filter(s => s.status === "active").map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Access Notes</label>
        <textarea value={form.accessNotes} onChange={e => onChange("accessNotes", e.target.value)}
          placeholder="Gate codes, key box locations, parking, contact on site..." rows={2}
          className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none"
          style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
      </div>

      <div className="flex items-center justify-between pt-1">
        {!hasPrimary && (
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.isPrimary} onChange={e => onChange("isPrimary", e.target.checked)}
              className="w-3.5 h-3.5 accent-indigo-600" />
            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Mark as primary property</span>
          </label>
        )}
        <div className="flex gap-2 ml-auto">
          <button onClick={onCancel}
            className="px-3 py-1.5 rounded-lg text-sm transition-colors"
            style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
            Cancel
          </button>
          <button onClick={onSave} disabled={!form.address.trim() || !form.city.trim()}
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-40 transition-colors">
            Save Property
          </button>
        </div>
      </div>
    </div>
  );
}

function PropertiesTab({ id }: { id: string }) {
  const [properties, setProperties] = useState<Property[]>(() => getProperties(id));
  const [showAdd, setShowAdd]       = useState(false);
  const [form, setForm]             = useState<PropertyFormData>({ ...EMPTY_PROPERTY_FORM });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  function changeForm(k: keyof PropertyFormData, v: PropertyFormData[keyof PropertyFormData]) {
    setForm(f => ({ ...f, [k]: v }));
    setFormErrors(e => { const n = { ...e }; delete n[k as string]; return n; });
  }

  function handleSave() {
    const errs: Record<string, string> = {};
    if (!form.address.trim()) errs.address = "Address is required";
    if (!form.city.trim())    errs.city    = "City is required";
    if (Object.keys(errs).length > 0) { setFormErrors(errs); return; }

    const hasPrimary = properties.some(p => p.isPrimary);
    const newProp: Property = {
      id: `p-${Date.now()}`,
      customerId: id,
      label:        form.label.trim() || undefined,
      address:      form.address.trim(),
      city:         form.city.trim(),
      state:        form.state.trim(),
      zip:          form.zip.trim(),
      type:         form.type,
      sqft:         form.sqft ? parseInt(form.sqft) : undefined,
      yearBuilt:    form.yearBuilt ? parseInt(form.yearBuilt) : undefined,
      accessNotes:  form.accessNotes.trim() || undefined,
      serviceAreaId: form.serviceAreaId || undefined,
      status:       "active",
      isPrimary:    form.isPrimary || !hasPrimary,
    };

    setProperties(prev =>
      newProp.isPrimary
        ? [newProp, ...prev.map(p => ({ ...p, isPrimary: false }))]
        : [...prev, newProp]
    );
    setShowAdd(false);
    setForm({ ...EMPTY_PROPERTY_FORM });
    setFormErrors({});
  }

  const hasPrimary = properties.some(p => p.isPrimary);

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          {properties.length} {properties.length === 1 ? "Property" : "Properties"}
        </p>
        <button
          onClick={() => { setShowAdd(true); setForm({ ...EMPTY_PROPERTY_FORM, isPrimary: !hasPrimary }); }}
          disabled={showAdd}
          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Add Property
        </button>
      </div>

      {showAdd && (
        <AddPropertyForm
          form={form} errors={formErrors}
          onChange={changeForm}
          onSave={handleSave}
          onCancel={() => { setShowAdd(false); setFormErrors({}); }}
          hasPrimary={hasPrimary}
        />
      )}

      {properties.map(p => (
        <PropertyCard key={p.id} property={p} />
      ))}
    </div>
  );
}

// ─── Jobs tab ─────────────────────────────────────────────
function JobsTab({ id }: { id: string }) {
  const jobs = getJobs(id);
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors">
          <Plus className="w-3.5 h-3.5" /> New Job
        </button>
      </div>
      {jobs.length === 0 ? <StubContent label="No jobs yet" /> : (
        <TableCard cols="1.5fr 1fr 1fr 1fr 1fr 1fr">
          <TableHead cols={["Title", "Type", "Date", "Tech", "Amount", "Status"]} />
          {jobs.map((job, i) => {
            const s = jobStatusStyle(job.status);
            return (
              <TableRow key={job.id} last={i === jobs.length - 1} cols="1.5fr 1fr 1fr 1fr 1fr 1fr">
                <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{job.title}</span>
                <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{job.type}</span>
                <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{job.date}</span>
                <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{job.tech}</span>
                <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{job.amount ?? "—"}</span>
                <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: s.bg, color: s.color }}>{job.status}</span>
              </TableRow>
            );
          })}
        </TableCard>
      )}
    </div>
  );
}

// ─── Leads tab ────────────────────────────────────────────
function LeadsTab({ id }: { id: string }) {
  const leads = getLeads(id);
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors">
          <Plus className="w-3.5 h-3.5" /> New Lead
        </button>
      </div>
      {leads.length === 0 ? <StubContent label="No leads yet" /> : (
        <TableCard cols="2fr 1fr 1fr 1fr 1fr">
          <TableHead cols={["Title", "Status", "Date", "Source", "Value"]} />
          {leads.map((lead, i) => {
            const s = leadStatusStyle(lead.status);
            return (
              <TableRow key={lead.id} last={i === leads.length - 1} cols="2fr 1fr 1fr 1fr 1fr">
                <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{lead.title}</span>
                <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: s.bg, color: s.color }}>{lead.status}</span>
                <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{lead.date}</span>
                <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{lead.source ?? "—"}</span>
                <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{lead.value ?? "TBD"}</span>
              </TableRow>
            );
          })}
        </TableCard>
      )}
    </div>
  );
}

// ─── Agreements tab ───────────────────────────────────────
function AgreementsTab({ id }: { id: string }) {
  const customer   = getCustomer(id)!;
  const agreements = AGREEMENTS.filter(a => a.customer === customer.name);
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors">
          <Plus className="w-3.5 h-3.5" /> New Agreement
        </button>
      </div>
      {agreements.length === 0 ? (
        <StubContent label="No agreements yet">
          <Link href="/agreements" className="mt-2 text-xs font-medium text-indigo-600 hover:text-indigo-700">Browse templates →</Link>
        </StubContent>
      ) : (
        <TableCard cols="2fr 1fr 1fr 1fr 1fr 1fr">
          <TableHead cols={["Agreement", "Status", "Billing", "Next Visit", "Renewal", "Value"]} />
          {agreements.map((a, i) => (
            <TableRow key={a.id} last={i === agreements.length - 1} cols="2fr 1fr 1fr 1fr 1fr 1fr">
              <div>
                <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{a.type}</p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>{a.visitFrequency}</p>
              </div>
              <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: "#d1fae5", color: "#065f46" }}>Active</span>
              <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{a.billingFrequency}</span>
              <span className="text-sm" style={{ color: a.nextVisit ? "var(--text-secondary)" : "var(--text-muted)" }}>{a.nextVisit ?? "—"}</span>
              <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{a.renewalDate}</span>
              <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{a.annualValue.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}/yr</span>
            </TableRow>
          ))}
        </TableCard>
      )}
    </div>
  );
}

// ─── Notes tab ────────────────────────────────────────────
function NotesTab({ id }: { id: string }) {
  const [draft, setDraft] = useState("");
  const notes = getNotes(id);

  return (
    <div className="space-y-4 max-w-2xl">
      {/* Add note */}
      <div className="rounded-xl p-4" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder="Add a note..."
          rows={3}
          className="w-full resize-none text-sm outline-none bg-transparent"
          style={{ color: "var(--text-primary)" }}
        />
        <div className="flex justify-end mt-3 pt-3" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          <button
            disabled={!draft.trim()}
            className="px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 transition-colors"
          >
            Save Note
          </button>
        </div>
      </div>

      {/* Notes timeline */}
      {notes.length === 0 ? (
        <p className="text-sm text-center py-8" style={{ color: "var(--text-muted)" }}>No notes yet</p>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => {
            const Icon = NOTE_ICON[note.type];
            return (
              <div key={note.id} className="rounded-xl p-4" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                    <Icon className="w-3.5 h-3.5 text-indigo-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{note.user}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>{note.type}</span>
                      <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{note.date}</span>
                    </div>
                    <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{note.text}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Equipment tab ────────────────────────────────────────
const EQUIP_STATUS: Record<EquipmentStatus, { label: string; bg: string; color: string }> = {
  operational:   { label: "Operational",   bg: "#d1fae5", color: "#065f46" },
  needs_service: { label: "Needs Service", bg: "#fef3c7", color: "#92400e" },
  retired:       { label: "Retired",       bg: "var(--bg-input)", color: "var(--text-muted)" },
};

function EquipmentTab({ id }: { id: string }) {
  const items = getEquipment(id);
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors">
          <span className="text-base leading-none">+</span> Add Equipment
        </button>
      </div>
      {items.length === 0 ? (
        <StubContent label="No equipment recorded">
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Add HVAC systems, water heaters, or other equipment for this account.</p>
        </StubContent>
      ) : (
        <TableCard cols="">
          <div
            className="grid px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider"
            style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr 1fr", color: "var(--text-muted)", borderBottom: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-surface-2)" }}
          >
            {["Equipment", "Brand", "Model", "Serial #", "Installed", "Last Service", "Status"].map(h => <span key={h}>{h}</span>)}
          </div>
          {items.map((eq, i) => {
            const s = EQUIP_STATUS[eq.status];
            return (
              <div
                key={eq.id}
                className="grid px-4 py-3 items-center hover:bg-[var(--bg-surface-2)] transition-colors"
                style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr 1fr", borderBottom: i < items.length - 1 ? "1px solid var(--border-subtle)" : "none" }}
              >
                <div>
                  <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{eq.name}</p>
                  {eq.notes && <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>{eq.notes}</p>}
                </div>
                <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{eq.brand ?? "—"}</span>
                <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{eq.model ?? "—"}</span>
                <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>{eq.serialNumber ?? "—"}</span>
                <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{eq.installDate ?? "—"}</span>
                <span className="text-sm" style={{ color: eq.lastServiceDate ? "var(--text-secondary)" : "var(--text-muted)" }}>{eq.lastServiceDate ?? "—"}</span>
                <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: s.bg, color: s.color }}>{s.label}</span>
              </div>
            );
          })}
        </TableCard>
      )}
    </div>
  );
}

// ─── Stub tab ─────────────────────────────────────────────
function StubTab({ label, link }: { label: string; link?: string }) {
  return (
    <div className="rounded-xl p-10 text-center" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
      <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{label}</p>
      <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Coming in Phase 1</p>
      {link && <Link href={link} className="mt-2 block text-xs font-medium text-indigo-600 hover:text-indigo-700">Open {label} module →</Link>}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────
export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id }       = use(params);
  const [tab, setTab] = useState("Overview");
  const [portal, setPortal] = useState(false);

  const customer = getCustomer(id);

  if (!customer) {
    return (
      <div className="p-6">
        <Link href="/customers" className="flex items-center gap-1.5 text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
          <ArrowLeft className="w-4 h-4" /> Back to Customers
        </Link>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>Customer not found.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Sticky header */}
      <div style={{ backgroundColor: "var(--bg-surface)", borderBottom: "1px solid var(--border-subtle)" }}>
        {/* Top row */}
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4 min-w-0">
            <Link href="/customers" className="flex items-center gap-1.5 text-sm shrink-0" style={{ color: "var(--text-secondary)" }}>
              <ArrowLeft className="w-4 h-4" /> Customers
            </Link>
            <div className="w-px h-5 shrink-0" style={{ backgroundColor: "var(--border)" }} />
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
                {customer.initials}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>{customer.name}</h1>
                  <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full" style={typePill(customer.type)}>{customer.type}</span>
                  <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full" style={statusPill(customer.status)}>{customer.status}</span>
                </div>
                <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
                  {customer.address}, {customer.city}, {customer.state} · {customer.locationName}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-2 px-2">
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>Portal</span>
              <button onClick={() => setPortal(v => !v)} className="relative w-9 h-5 rounded-full transition-colors" style={{ backgroundColor: portal ? "#4f46e5" : "var(--border)" }}>
                <div className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform" style={{ transform: portal ? "translateX(16px)" : "translateX(0)" }} />
              </button>
            </div>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
              <Pencil className="w-3.5 h-3.5" /> Edit
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm" style={{ border: "1px solid #fecaca", color: "#dc2626" }}>
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-0.5 px-6 overflow-x-auto">
          {TABS.map((t) => {
            const active = tab === t;
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="relative px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap shrink-0"
                style={{ color: active ? "#4f46e5" : "var(--text-muted)" }}
              >
                {t}
                {active && <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t bg-indigo-600" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-6" style={{ backgroundColor: "var(--bg-page)" }}>
        {tab === "Overview"       && <OverviewTab    id={id} />}
        {tab === "Contacts"       && <ContactsTab    id={id} />}
        {tab === "Properties"     && <PropertiesTab  id={id} />}
        {tab === "Equipment"      && <EquipmentTab   id={id} />}
        {tab === "Jobs"           && <JobsTab        id={id} />}
        {tab === "Leads"          && <LeadsTab       id={id} />}
        {tab === "Agreements"     && <AgreementsTab  id={id} />}
        {tab === "Notes"          && <NotesTab       id={id} />}
        {tab === "Photos & Files" && <StubTab label="Photos & Files" link="/files" />}
        {tab === "Communication"  && <StubTab label="Communication" link="/inbox" />}
        {tab === "Billing"        && <StubTab label="Billing" />}
      </div>
    </div>
  );
}

// ─── Shared UI primitives ─────────────────────────────────
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
      <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>{title}</p>
      {children}
    </div>
  );
}

function InfoRow({ icon: Icon, value }: { icon: typeof Phone; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "var(--text-muted)" }} />
      <span className="text-sm" style={{ color: "var(--text-primary)" }}>{value}</span>
    </div>
  );
}

function SectionCard({
  title, count, action, children,
}: {
  title: string;
  count: number;
  action?: { label: string; onClick: () => void };
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{title}</p>
          {count > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>{count}</span>}
        </div>
        {action && <button onClick={action.onClick} className="text-xs font-medium text-indigo-600 hover:text-indigo-700">{action.label}</button>}
      </div>
      <div>{children}</div>
    </div>
  );
}

function Row({ children, last }: { children: React.ReactNode; last: boolean }) {
  return (
    <div className="flex items-center px-4 py-3 hover:bg-[var(--bg-surface-2)] transition-colors" style={!last ? { borderBottom: "1px solid var(--border-subtle)" } : undefined}>
      {children}
    </div>
  );
}

function Empty({ text, children }: { text: string; children?: React.ReactNode }) {
  return (
    <div className="px-4 py-8 text-center">
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>{text}</p>
      {children}
    </div>
  );
}

function StubContent({ label, children }: { label: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-xl p-8 text-center" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>{label}</p>
      {children}
    </div>
  );
}

function TableCard({ cols, children }: { cols: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
      {children}
    </div>
  );
}

function TableHead({ cols }: { cols: string[] }) {
  return (
    <div className={`grid px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider`} style={{ gridTemplateColumns: `repeat(${cols.length}, 1fr)`, color: "var(--text-muted)", borderBottom: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-surface-2)" }}>
      {cols.map(c => <span key={c}>{c}</span>)}
    </div>
  );
}

function TableRow({ cols, last, children }: { cols: string; last: boolean; children: React.ReactNode }) {
  return (
    <div className="grid px-4 py-3 items-center hover:bg-[var(--bg-surface-2)] transition-colors" style={{ gridTemplateColumns: cols, borderBottom: !last ? "1px solid var(--border-subtle)" : "none" }}>
      {children}
    </div>
  );
}
