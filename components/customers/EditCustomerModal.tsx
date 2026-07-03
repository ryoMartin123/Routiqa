"use client";

import { useState } from "react";
import { X, Home, Building2, Landmark, LayoutGrid, HelpCircle } from "lucide-react";
import { useHierarchy } from "@/components/providers/HierarchyProvider";
import { useCustomers } from "@/components/providers/CustomerProvider";
import { getAllLocations } from "@/lib/hierarchy/data";
import { formatPhone, validatePhone, validateEmail } from "@/lib/utils/validation";
import type { AccountType, Customer, CustomerType, CustomerStatus } from "@/lib/customers/data";
import { syncJobsAddressForAccount } from "@/lib/jobs/data";
import { AddressAutocomplete, EMPTY_ADDRESS, type ParsedAddress } from "@/components/address/AddressAutocomplete";
import UiSelect from "@/components/ui/Select";

// ─── Account type options ─────────────────────────────────
const ACCOUNT_TYPES: { key: AccountType; label: string; icon: typeof Home }[] = [
  { key: "residential",         label: "Residential",         icon: Home       },
  { key: "commercial",          label: "Commercial",          icon: Building2  },
  { key: "property_management", label: "Property Management", icon: Landmark   },
  { key: "multi_site",          label: "Multi-Site",          icon: LayoutGrid },
  { key: "other",               label: "Other",               icon: HelpCircle },
];

// Commercial-flavored account types map to the "Commercial" display badge.
function deriveType(accountType: AccountType): CustomerType {
  return ["commercial", "property_management", "multi_site"].includes(accountType)
    ? "Commercial"
    : "Residential";
}

function deriveInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  return (words.length >= 2 ? words[0][0] + words[words.length - 1][0] : name.slice(0, 2)).toUpperCase();
}

interface EditForm {
  name: string;
  accountType: AccountType;
  status: CustomerStatus;
  phone: string;
  email: string;
  parsedAddress: ParsedAddress;
  locationId: string;
  serviceAreaId: string;
  tags: string;   // comma-separated while editing
  notes: string;
}

function toForm(c: Customer): EditForm {
  return {
    name: c.name,
    accountType: c.accountType,
    status: c.status,
    phone: c.phone ?? "",
    email: c.email ?? "",
    parsedAddress: {
      ...EMPTY_ADDRESS,
      addressLine1: c.address ?? "",
      city: c.city ?? "",
      state: c.state || "GA",
      postalCode: c.zip ?? "",
      formattedAddress: [c.address, c.city, c.state, c.zip].filter(Boolean).join(", "),
      // An existing saved address is treated as verified — the breakdown stays
      // hidden with an "Edit manually" escape, like a freshly-picked address.
      validationStatus: c.address ? "validated" : "unvalidated",
    },
    locationId: c.locationId,
    serviceAreaId: c.serviceAreaId ?? "",
    tags: c.tags.join(", "),
    notes: c.notes ?? "",
  };
}

// ─── Form primitives ──────────────────────────────────────
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

function Input({ value, onChange, placeholder, type = "text", error }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string; error?: string | null;
}) {
  return (
    <div>
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full rounded-lg px-3 py-2 text-sm outline-none transition-all"
        style={{ border: `1px solid ${error ? "#ef4444" : "var(--border)"}`, backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }}
      />
      {error && <p className="mt-1 text-xs" style={{ color: "#ef4444" }}>{error}</p>}
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────
export default function EditCustomerModal({
  customer, open, onClose, onSaved,
}: {
  customer: Customer;
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const { locationOptions, serviceAreaOptions, showLocationSelector, showServiceAreaSelector, showCompanySelector, allCompanies } = useHierarchy();
  const { updateCustomer } = useCustomers();

  const [data, setData]     = useState<EditForm>(() => toForm(customer));
  const [initial]           = useState(() => JSON.stringify(toForm(customer)));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const dirty = JSON.stringify(data) !== initial;

  function set<K extends keyof EditForm>(k: K, v: EditForm[K]) {
    setData(d => ({ ...d, [k]: v }));
    if (errors[k]) setErrors(e => { const n = { ...e }; delete n[k]; return n; });
  }

  const locLabel = (companyId: string, name: string) =>
    showCompanySelector ? `${allCompanies.find(c => c.id === companyId)?.name ?? "—"} · ${name}` : name;

  if (!open) return null;

  function handleSave() {
    const errs: Record<string, string> = {};
    if (!data.name.trim()) errs.name = "Account name is required";
    if (data.phone.trim()) { const e = validatePhone(data.phone); if (e) errs.phone = e; }
    if (data.email.trim()) { const e = validateEmail(data.email); if (e) errs.email = e; }
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    const loc = getAllLocations().find(l => l.id === data.locationId);
    const patch: Partial<Customer> = {
      name:        data.name.trim(),
      initials:    deriveInitials(data.name),
      accountType: data.accountType,
      type:        deriveType(data.accountType),
      status:      data.status,
      phone:       data.phone.trim(),
      email:       data.email.trim() || undefined,
      address:     data.parsedAddress.addressLine1,
      city:        data.parsedAddress.city,
      state:       data.parsedAddress.state,
      zip:         data.parsedAddress.postalCode,
      locationId:  data.locationId || customer.locationId,
      locationName: loc?.name ?? customer.locationName,
      companyId:   loc?.companyId ?? customer.companyId,
      serviceAreaId: data.serviceAreaId || undefined,
      tags:        data.tags.split(",").map(t => t.trim()).filter(Boolean),
      notes:       data.notes.trim(),
    };

    updateCustomer(customer.id, patch);

    // Cascade the address change to jobs that were using this customer's address.
    const fmt = (a?: string, c?: string, s?: string, z?: string) =>
      [a, c, [s, z].filter(Boolean).join(" ")].filter(Boolean).join(", ");
    const oldAddr = fmt(customer.address, customer.city, customer.state, customer.zip);
    const newAddr = fmt(patch.address, patch.city, patch.state, patch.zip);
    if (oldAddr !== newAddr) syncJobsAddressForAccount(customer.id, oldAddr, newAddr);

    onSaved?.();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
        style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 16px 48px rgba(0,0,0,0.24)" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <div>
            <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Edit Account</h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Update account details for {customer.name}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg" style={{ color: "var(--text-muted)" }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <Field label="Account Name" required>
            <Input value={data.name} onChange={v => set("name", v)} placeholder="e.g. John Smith or ABC Company" error={errors.name} />
          </Field>

          <Field label="Account Type">
            <div className="flex flex-wrap gap-2 pt-1">
              {ACCOUNT_TYPES.map(t => {
                const active = data.accountType === t.key;
                return (
                  <button key={t.key} onClick={() => set("accountType", t.key)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                    style={{
                      border: `1.5px solid ${active ? "#4f46e5" : "var(--border)"}`,
                      backgroundColor: active ? "#e0e7ff" : "var(--bg-surface-2)",
                      color: active ? "#4f46e5" : "var(--text-secondary)",
                    }}>
                    <t.icon className="w-3.5 h-3.5" />{t.label}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="Status">
            <div className="flex gap-2">
              {(["Prospect", "Customer"] as const).map(s => (
                <button key={s} onClick={() => set("status", s)}
                  className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
                  style={{
                    border: `1.5px solid ${data.status === s ? "#4f46e5" : "var(--border)"}`,
                    backgroundColor: data.status === s ? "#e0e7ff" : "var(--bg-surface-2)",
                    color: data.status === s ? "#4f46e5" : "var(--text-secondary)",
                  }}>
                  {s}
                </button>
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone">
              <Input type="tel" value={data.phone} onChange={v => set("phone", formatPhone(v))} placeholder="(000) 000-0000" error={errors.phone} />
            </Field>
            <Field label="Email">
              <Input type="email" value={data.email} onChange={v => set("email", v)} placeholder="email@example.com" error={errors.email} />
            </Field>
          </div>

          <Field label="Account Address">
            <AddressAutocomplete
              value={data.parsedAddress}
              onChange={addr => set("parsedAddress", addr)}
              placeholder="Start typing a street address…"
            />
          </Field>

          {showLocationSelector && locationOptions.length > 0 && (
            <Field label={showCompanySelector ? "Company & Branch" : "Branch"}>
              <UiSelect value={data.locationId} onChange={v => set("locationId", v)}
                options={locationOptions.map(l => ({ value: l.id, label: locLabel(l.companyId, l.name) }))} />
            </Field>
          )}

          {showServiceAreaSelector && (
            <Field label="Service Area">
              <UiSelect value={data.serviceAreaId} onChange={v => set("serviceAreaId", v)}
                placeholder="None"
                options={[{ value: "", label: "None" }, ...serviceAreaOptions.map(s => ({ value: s.id, label: s.name }))]} />
            </Field>
          )}

          <Field label="Tags">
            <Input value={data.tags} onChange={v => set("tags", v)} placeholder="Comma-separated, e.g. VIP, Maintenance Plan" />
          </Field>

          <Field label="Notes">
            <textarea value={data.notes} onChange={e => set("notes", e.target.value)}
              placeholder="Account-level notes..." rows={3}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none"
              style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
          </Field>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 flex justify-end gap-2 shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
          <button onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={!data.name.trim() || !dirty}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-40">
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
