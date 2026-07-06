"use client";

// ─── New Customer — single-form popup ─────────────────────
// One compact modal instead of the old 4-step wizard: everything the customer
// record actually persists (name, type, phone, email, address, branch) on one
// screen. Success is announced via the bottom-right notice host, not a pane.

import { useState } from "react";
import { X, Home, Building2, Landmark, LayoutGrid, HelpCircle } from "lucide-react";
import { useHierarchy } from "@/components/providers/HierarchyProvider";
import { useCustomers } from "@/components/providers/CustomerProvider";
import { getAllLocations } from "@/lib/hierarchy/data";
import { formatPhone, validatePhone, validateEmail } from "@/lib/utils/validation";
import type { AccountType, Customer, CustomerType, CustomerStatus } from "@/lib/customers/data";
import { AddressAutocomplete, EMPTY_ADDRESS, type ParsedAddress } from "@/components/address/AddressAutocomplete";
import UiSelect from "@/components/ui/Select";
import { pingSaved } from "@/components/shared/SavedPill";

// ─── Account type options ─────────────────────────────────
const ACCOUNT_TYPES: { key: AccountType; label: string; icon: typeof Home; desc: string }[] = [
  { key: "residential",        label: "Residential",         icon: Home,       desc: "Homeowner or renter" },
  { key: "commercial",         label: "Commercial",          icon: Building2,  desc: "Business or office account" },
  { key: "property_management",label: "Property Management", icon: Landmark,   desc: "Manages multiple properties" },
  { key: "multi_site",         label: "Multi-Site",          icon: LayoutGrid, desc: "Multiple service locations" },
  { key: "other",              label: "Other",               icon: HelpCircle, desc: "Custom account type" },
];

// ─── Build a Customer record from form data ───────────────
function buildCustomer(
  name: string,
  phone: string,
  accountType: AccountType,
  status: CustomerStatus,
  locationId: string,
  serviceAreaId: string,
  parsedAddress: ParsedAddress,
  email: string,
): Customer {
  const loc     = getAllLocations().find(l => l.id === locationId);
  const words   = name.trim().split(/\s+/);
  const initials = (words.length >= 2
    ? words[0][0] + words[words.length - 1][0]
    : name.slice(0, 2)).toUpperCase();
  const type: CustomerType = ["commercial", "property_management", "multi_site"].includes(accountType)
    ? "Commercial"
    : "Residential";

  return {
    id: `cust-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: name.trim(),
    initials,
    accountType,
    type,
    status,
    companyId:    loc?.companyId ?? "co_hvac",
    locationId:   (locationId || loc?.id) ?? "",
    serviceAreaId: serviceAreaId || undefined,
    locationName: loc?.name ?? "",
    address:  parsedAddress.addressLine1,
    city:     parsedAddress.city,
    state:    parsedAddress.state,
    zip:      parsedAddress.postalCode,
    phone:    phone.trim(),
    email:    email.trim() || undefined,
    since: new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" }),
    tags:  [],
    notes: "",
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
  value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; error?: string | null;
}) {
  return (
    <div>
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg px-3 py-2 text-sm outline-none transition-all"
        style={{
          border: `1px solid ${error ? "#ef4444" : "var(--border)"}`,
          backgroundColor: "var(--bg-surface)", color: "var(--text-primary)",
        }}
      />
      {error && <p className="mt-1 text-xs" style={{ color: "#ef4444" }}>{error}</p>}
    </div>
  );
}

// ─── Modal root ───────────────────────────────────────────
export default function NewCustomerModal({ open, onClose, onCreated, forceStatus }: {
  open: boolean;
  onClose: () => void;
  // When provided, the modal hands back the created account instead of pinging
  // the notice host — lets another flow (e.g. the lead wizard) continue.
  onCreated?: (customer: Customer) => void;
  // Lock the new account to a status (e.g. "Prospect" from the lead flow).
  forceStatus?: CustomerStatus;
}) {
  const { locationOptions, effectiveLocationId, showCompanySelector, allCompanies } = useHierarchy();
  const { addCustomer } = useCustomers();

  // When the active scope is "All", there's no location to inherit — force a
  // pick rather than silently defaulting to the first branch.
  const needsLocationChoice = !effectiveLocationId && locationOptions.length > 1;
  const locLabel = (companyId: string, name: string) =>
    showCompanySelector ? `${allCompanies.find(c => c.id === companyId)?.name ?? "—"} · ${name}` : name;

  const [name, setName]               = useState("");
  const [accountType, setAccountType] = useState<AccountType>("residential");
  const [phone, setPhone]             = useState("");
  const [email, setEmail]             = useState("");
  const [address, setAddress]         = useState<ParsedAddress>({ ...EMPTY_ADDRESS });
  const [locationId, setLocationId]   = useState(effectiveLocationId ?? (locationOptions.length === 1 ? locationOptions[0]!.id : ""));
  const [errors, setErrors]           = useState<Record<string, string>>({});

  if (!open) return null;

  const clearError = (k: string) => setErrors(e => { const n = { ...e }; delete n[k]; return n; });

  function handleSave(status: CustomerStatus) {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "Account name is required";
    if (needsLocationChoice && !locationId)
      errs.locationId = showCompanySelector ? "Choose a company and branch" : "Choose a branch";
    if (phone.trim()) { const e = validatePhone(phone); if (e) errs.phone = e; }
    if (email.trim()) { const e = validateEmail(email); if (e) errs.email = e; }
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    const customer = buildCustomer(name, phone, accountType, forceStatus ?? status, locationId, "", address, email);
    addCustomer(customer);
    if (onCreated) { onCreated(customer); return; }   // hand back to the caller
    pingSaved(`Account created — ${customer.name}`);
    onClose();
  }

  const canSave = name.trim() !== "" && (!needsLocationChoice || locationId !== "");

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
        style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 16px 48px rgba(0,0,0,0.24)" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <div>
            <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>New Customer</h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Name is all that&apos;s required — everything else can come later.</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg" style={{ color: "var(--text-muted)" }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* One form — no steps */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <Field label="Account Name" required>
            <Input value={name} onChange={v => { setName(v); clearError("name"); }}
              placeholder="e.g. John Smith or ABC Company" error={errors.name} />
          </Field>
          <Field label="Account Type">
            <div className="flex flex-wrap gap-2 pt-1">
              {ACCOUNT_TYPES.map(t => (
                <button key={t.key} onClick={() => setAccountType(t.key)} title={t.desc}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{
                    border: `1.5px solid ${accountType === t.key ? "#c9c0b2" : "var(--border)"}`,
                    backgroundColor: accountType === t.key ? "#E5E0DB" : "var(--bg-surface-2)",
                    color: accountType === t.key ? "#5c5545" : "var(--text-secondary)",
                  }}>
                  <t.icon className="w-3.5 h-3.5" />{t.label}
                </button>
              ))}
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone">
              <Input type="tel" value={phone} onChange={v => { setPhone(formatPhone(v)); clearError("phone"); }}
                placeholder="(000) 000-0000" error={errors.phone} />
            </Field>
            <Field label="Email">
              <Input type="email" value={email} onChange={v => { setEmail(v); clearError("email"); }}
                placeholder="email@example.com" error={errors.email} />
            </Field>
          </div>
          <Field label="Service Address">
            <AddressAutocomplete value={address} onChange={setAddress} placeholder="Start typing a street address…" />
          </Field>
          {locationOptions.length > 1 && (
            <Field label={showCompanySelector ? "Company & Branch" : "Branch"} required={needsLocationChoice}>
              <UiSelect value={locationId} onChange={v => { setLocationId(v); clearError("locationId"); }}
                options={[
                  ...(needsLocationChoice ? [{ value: "", label: "Select where this account belongs…" }] : []),
                  ...locationOptions.map(l => ({ value: l.id, label: locLabel(l.companyId, l.name) })),
                ]} />
              {errors.locationId
                ? <p className="mt-1 text-xs" style={{ color: "#ef4444" }}>{errors.locationId}</p>
                : needsLocationChoice && <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>You&apos;re viewing all locations — pick where this account belongs.</p>}
            </Field>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 flex gap-2 shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
          {forceStatus ? (
            <button onClick={() => handleSave(forceStatus)} disabled={!canSave}
              className="flex-1 py-2 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-40">
              Create Account
            </button>
          ) : (
            <>
              <button onClick={() => handleSave("Prospect")} disabled={!canSave}
                className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-40"
                style={{ border: "1px solid var(--border)", color: "var(--text-secondary)", backgroundColor: "var(--bg-surface)" }}>
                Save as Prospect
              </button>
              <button onClick={() => handleSave("Customer")} disabled={!canSave}
                className="flex-1 py-2 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-40">
                Save as Customer
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
