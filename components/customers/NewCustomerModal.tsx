"use client";

import { useState, useEffect } from "react";
import {
  X, Home, Building2, Landmark, LayoutGrid, HelpCircle,
  CheckCircle, ChevronRight, ChevronLeft,
} from "lucide-react";
import { useHierarchy } from "@/components/providers/HierarchyProvider";
import { useCustomers } from "@/components/providers/CustomerProvider";
import { getAllLocations } from "@/lib/hierarchy/data";
import { formatPhone, validatePhone, validateEmail } from "@/lib/utils/validation";
import type { AccountType, PropertyType, Customer, CustomerType, CustomerStatus } from "@/lib/customers/data";
import { AddressAutocomplete, EMPTY_ADDRESS, type ParsedAddress } from "@/components/address/AddressAutocomplete";
import UiSelect from "@/components/ui/Select";

// ─── Types ────────────────────────────────────────────────
interface QuickData {
  name: string;
  phone: string;
  accountType: AccountType;
  locationId: string;
}

interface WizardData {
  accountType: AccountType;
  name: string;
  status: CustomerStatus;
  locationId: string;
  serviceAreaId: string;
  leadSource: string;
  contactName: string;
  contactRole: string;
  contactPhone: string;
  contactEmail: string;
  contactMethod: "phone" | "email" | "text";
  propertyLabel: string;
  propertyParsedAddress: ParsedAddress;
  propertyType: PropertyType;
  accessNotes: string;
}

const DEFAULT_WIZARD: WizardData = {
  accountType: "residential",
  name: "", status: "Prospect", locationId: "", serviceAreaId: "", leadSource: "",
  contactName: "", contactRole: "Homeowner", contactPhone: "", contactEmail: "", contactMethod: "text",
  propertyLabel: "", propertyParsedAddress: { ...EMPTY_ADDRESS },
  propertyType: "Residential", accessNotes: "",
};

// ─── Account type options ─────────────────────────────────
const ACCOUNT_TYPES: { key: AccountType; label: string; icon: typeof Home; desc: string }[] = [
  { key: "residential",        label: "Residential",         icon: Home,       desc: "Homeowner or renter" },
  { key: "commercial",         label: "Commercial",          icon: Building2,  desc: "Business or office account" },
  { key: "property_management",label: "Property Management", icon: Landmark,   desc: "Manages multiple properties" },
  { key: "multi_site",         label: "Multi-Site",          icon: LayoutGrid, desc: "Multiple service locations" },
  { key: "other",              label: "Other",               icon: HelpCircle, desc: "Custom account type" },
];

const CONTACT_ROLES = ["Homeowner", "Property Manager", "Tenant", "Maintenance Coordinator", "Owner", "Billing Contact", "Decision Maker", "Other"];
const LEAD_SOURCES  = ["Phone Call", "Web Form", "Referral", "Google Ads", "Google LSA", "Door-to-Door", "Social Media", "Repeat / Upgrade", "Other"];
const STEPS         = ["Account Type", "Details", "Contact", "Location"];

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

// ─── Step progress indicator ──────────────────────────────
function StepProgress({ current }: { current: number }) {
  return (
    <div className="flex items-center px-6 py-4" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
      {STEPS.map((label, i) => {
        const n = i + 1;
        const done = n < current; const active = n === current;
        return (
          <div key={label} className="flex items-center flex-1 last:flex-none">
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all"
                style={{ backgroundColor: done || active ? "#4f46e5" : "var(--bg-input)", color: done || active ? "#ffffff" : "var(--text-muted)" }}>
                {done ? <CheckCircle className="w-3.5 h-3.5" /> : n}
              </div>
              {active && <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{label}</span>}
            </div>
            {i < STEPS.length - 1 && <div className="flex-1 h-px mx-2" style={{ backgroundColor: done ? "#4f46e5" : "var(--border-subtle)" }} />}
          </div>
        );
      })}
    </div>
  );
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

/** Phone input: auto-formats to (xxx) xxx-xxxx, caps at 10 digits. */
function PhoneInput({ value, onChange, error, required }: {
  value: string; onChange: (v: string) => void; error?: string | null; required?: boolean;
}) {
  return (
    <Field label="Phone" required={required}>
      <Input
        type="tel"
        value={value}
        onChange={raw => onChange(formatPhone(raw))}
        placeholder="(000) 000-0000"
        error={error}
      />
    </Field>
  );
}

function Select({ value, onChange, options }: {
  value: string; onChange: (v: string) => void; options: { value: string; label: string }[];
}) {
  return <UiSelect value={value} onChange={onChange} options={options} />;
}

// ─── Success state ────────────────────────────────────────
function SuccessState({ name, onClose }: { name: string; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 2000); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 p-12">
      <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center">
        <CheckCircle className="w-7 h-7 text-emerald-600" />
      </div>
      <div className="text-center">
        <p className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Account Created</p>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>{name || "New account"} has been saved to Customers.</p>
      </div>
    </div>
  );
}

// ─── Quick Add ────────────────────────────────────────────
function QuickAddContent({ onClose }: { onClose: () => void }) {
  const { locationOptions, effectiveLocationId, showCompanySelector, allCompanies } = useHierarchy();
  const { addCustomer } = useCustomers();

  // When the active scope is "All", there's no location to inherit — force a
  // pick rather than silently defaulting to the first branch.
  const needsLocationChoice = !effectiveLocationId && locationOptions.length > 1;
  const locLabel = (companyId: string, name: string) =>
    showCompanySelector ? `${allCompanies.find(c => c.id === companyId)?.name ?? "—"} · ${name}` : name;

  const [data, setData] = useState<QuickData>({
    name: "", phone: "", accountType: "residential",
    locationId: effectiveLocationId ?? (locationOptions.length === 1 ? locationOptions[0]!.id : ""),
  });
  const [errors, setErrors]     = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  function set<K extends keyof QuickData>(k: K, v: QuickData[K]) {
    setData(d => ({ ...d, [k]: v }));
    if (errors[k]) setErrors(e => { const n = { ...e }; delete n[k]; return n; });
  }

  function handleSave(status: CustomerStatus) {
    const errs: Record<string, string> = {};
    if (!data.name.trim()) errs.name = "Account name is required";
    if (needsLocationChoice && !data.locationId)
      errs.locationId = showCompanySelector ? "Choose a company and branch" : "Choose a branch";
    if (data.phone.trim()) {
      const e = validatePhone(data.phone);
      if (e) errs.phone = e;
    }
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    const customer = buildCustomer(
      data.name, data.phone, data.accountType, status,
      data.locationId, "", { ...EMPTY_ADDRESS }, "",
    );
    addCustomer(customer);
    setSubmitted(true);
  }

  if (submitted) return <SuccessState name={data.name} onClose={onClose} />;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
        <Field label="Account Name" required>
          <Input value={data.name} onChange={v => set("name", v)}
            placeholder="e.g. John Smith or ABC Company" error={errors.name} />
        </Field>
        <PhoneInput value={data.phone} onChange={v => set("phone", v)} error={errors.phone} />
        <Field label="Account Type">
          <div className="flex flex-wrap gap-2 pt-1">
            {ACCOUNT_TYPES.map(t => (
              <button key={t.key} onClick={() => set("accountType", t.key)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{
                  border: `1.5px solid ${data.accountType === t.key ? "#4f46e5" : "var(--border)"}`,
                  backgroundColor: data.accountType === t.key ? "#e0e7ff" : "var(--bg-surface-2)",
                  color: data.accountType === t.key ? "#4f46e5" : "var(--text-secondary)",
                }}>
                <t.icon className="w-3.5 h-3.5" />{t.label}
              </button>
            ))}
          </div>
        </Field>
        {locationOptions.length > 1 && (
          <Field label={showCompanySelector ? "Company & Branch" : "Branch"} required={needsLocationChoice}>
            <Select value={data.locationId} onChange={v => set("locationId", v)}
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
      <div className="px-6 py-4 flex gap-2" style={{ borderTop: "1px solid var(--border-subtle)" }}>
        <button onClick={() => handleSave("Prospect")} disabled={!data.name.trim() || (needsLocationChoice && !data.locationId)}
          className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-40"
          style={{ border: "1px solid var(--border)", color: "var(--text-secondary)", backgroundColor: "var(--bg-surface)" }}>
          Save as Prospect
        </button>
        <button onClick={() => handleSave("Customer")} disabled={!data.name.trim() || (needsLocationChoice && !data.locationId)}
          className="flex-1 py-2 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-40">
          Save as Customer
        </button>
      </div>
    </div>
  );
}

// ─── Wizard steps ─────────────────────────────────────────
function Step1({ data, set }: { data: WizardData; set: <K extends keyof WizardData>(k: K, v: WizardData[K]) => void }) {
  return (
    <div className="space-y-4">
      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Choose the type of account you are creating.</p>
      <div className="grid grid-cols-2 gap-3">
        {ACCOUNT_TYPES.map(t => {
          const active = data.accountType === t.key;
          return (
            <button key={t.key} onClick={() => set("accountType", t.key)}
              className="flex items-start gap-3 p-4 rounded-xl text-left transition-all"
              style={{ border: `2px solid ${active ? "#4f46e5" : "var(--border)"}`, backgroundColor: active ? "#f5f3ff" : "var(--bg-surface-2)" }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                style={{ backgroundColor: active ? "#4f46e5" : "var(--bg-input)" }}>
                <t.icon className="w-4 h-4" style={{ color: active ? "#ffffff" : "var(--text-muted)" }} />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: active ? "#4f46e5" : "var(--text-primary)" }}>{t.label}</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{t.desc}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Step2({ data, set, errors }: { data: WizardData; set: <K extends keyof WizardData>(k: K, v: WizardData[K]) => void; errors: Record<string, string> }) {
  const { locationOptions, serviceAreaOptions, showLocationSelector, showServiceAreaSelector, effectiveLocationId, showCompanySelector, allCompanies } = useHierarchy();
  const needsLocationChoice = !effectiveLocationId && locationOptions.length > 1;
  const locLabel = (companyId: string, name: string) =>
    showCompanySelector ? `${allCompanies.find(c => c.id === companyId)?.name ?? "—"} · ${name}` : name;
  return (
    <div className="space-y-4">
      <Field label="Account Name" required>
        <Input value={data.name} onChange={v => set("name", v)}
          placeholder={data.accountType === "residential" ? "e.g. John Smith" : data.accountType === "commercial" ? "e.g. ABC Company LLC" : "e.g. ABC Property Management"} />
      </Field>
      <Field label="Status">
        <div className="flex gap-2">
          {(["Prospect", "Customer"] as const).map(s => (
            <button key={s} onClick={() => set("status", s)}
              className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
              style={{ border: `1.5px solid ${data.status === s ? "#4f46e5" : "var(--border)"}`, backgroundColor: data.status === s ? "#e0e7ff" : "var(--bg-surface-2)", color: data.status === s ? "#4f46e5" : "var(--text-secondary)" }}>
              {s}
            </button>
          ))}
        </div>
      </Field>
      {showLocationSelector && (
        <Field label={showCompanySelector ? "Company & Branch" : "Branch"} required={needsLocationChoice}>
          <Select value={data.locationId} onChange={v => set("locationId", v)}
            options={[{ value: "", label: "Select branch..." }, ...locationOptions.map(l => ({ value: l.id, label: locLabel(l.companyId, l.name) }))]} />
          {errors.locationId
            ? <p className="mt-1 text-xs" style={{ color: "#ef4444" }}>{errors.locationId}</p>
            : needsLocationChoice && <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>You&apos;re viewing all locations — pick where this account belongs.</p>}
        </Field>
      )}
      {showServiceAreaSelector && (
        <Field label="Service Area">
          <Select value={data.serviceAreaId} onChange={v => set("serviceAreaId", v)}
            options={[{ value: "", label: "All service areas" }, ...serviceAreaOptions.map(s => ({ value: s.id, label: s.name }))]} />
        </Field>
      )}
      <Field label="Lead Source">
        <Select value={data.leadSource} onChange={v => set("leadSource", v)}
          options={[{ value: "", label: "Select source..." }, ...LEAD_SOURCES.map(s => ({ value: s, label: s }))]} />
      </Field>
    </div>
  );
}

function Step3({
  data, set, errors, clearError,
}: {
  data: WizardData;
  set: <K extends keyof WizardData>(k: K, v: WizardData[K]) => void;
  errors: Record<string, string>;
  clearError: (k: string) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
        {data.accountType === "residential" ? "This is typically the homeowner." : "Add the primary point of contact for this account."}
      </p>
      <Field label="Contact Name" required>
        <Input value={data.contactName} onChange={v => { set("contactName", v); clearError("contactName"); }}
          placeholder="Full name" error={errors.contactName} />
      </Field>
      <Field label="Role">
        <Select value={data.contactRole} onChange={v => set("contactRole", v)}
          options={CONTACT_ROLES.map(r => ({ value: r, label: r }))} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <PhoneInput
          value={data.contactPhone}
          onChange={v => { set("contactPhone", v); clearError("contactPhone"); }}
          error={errors.contactPhone}
          required
        />
        <Field label="Email">
          <Input type="email" value={data.contactEmail}
            onChange={v => { set("contactEmail", v); clearError("contactEmail"); }}
            placeholder="email@example.com" error={errors.contactEmail} />
        </Field>
      </div>
      <Field label="Preferred Contact Method">
        <div className="flex gap-2">
          {(["phone", "email", "text"] as const).map(m => (
            <button key={m} onClick={() => set("contactMethod", m)}
              className="flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-all"
              style={{ border: `1.5px solid ${data.contactMethod === m ? "#4f46e5" : "var(--border)"}`, backgroundColor: data.contactMethod === m ? "#e0e7ff" : "var(--bg-surface-2)", color: data.contactMethod === m ? "#4f46e5" : "var(--text-secondary)" }}>
              {m}
            </button>
          ))}
        </div>
      </Field>
    </div>
  );
}

function Step4({ data, set }: { data: WizardData; set: <K extends keyof WizardData>(k: K, v: WizardData[K]) => void }) {
  const propertyTypes: { key: PropertyType; label: string }[] = [
    { key: "Residential", label: "Residential" }, { key: "Commercial", label: "Commercial" },
    { key: "Industrial",  label: "Industrial"  }, { key: "Multi-Family", label: "Multi-Family" },
  ];
  return (
    <div className="space-y-4">
      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Add the primary service address for this account.</p>
      <Field label="Property Label">
        <Input value={data.propertyLabel} onChange={v => set("propertyLabel", v)}
          placeholder={data.accountType === "residential" ? "e.g. Main Residence" : "e.g. Main Office"} />
      </Field>
      <Field label="Address" required>
        <AddressAutocomplete
          value={data.propertyParsedAddress}
          onChange={addr => set("propertyParsedAddress", addr)}
          placeholder="Start typing a street address…"
          required
        />
      </Field>
      <Field label="Property Type">
        <div className="flex flex-wrap gap-2">
          {propertyTypes.map(t => (
            <button key={t.key} onClick={() => set("propertyType", t.key)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{ border: `1.5px solid ${data.propertyType === t.key ? "#4f46e5" : "var(--border)"}`, backgroundColor: data.propertyType === t.key ? "#e0e7ff" : "var(--bg-surface-2)", color: data.propertyType === t.key ? "#4f46e5" : "var(--text-secondary)" }}>
              {t.label}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Access Notes">
        <textarea value={data.accessNotes} onChange={e => set("accessNotes", e.target.value)}
          placeholder="Gate codes, key locations, parking instructions..." rows={2}
          className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none"
          style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
      </Field>
    </div>
  );
}

// ─── Wizard wrapper ───────────────────────────────────────
function WizardContent({ onClose }: { onClose: () => void }) {
  const { locationOptions, effectiveLocationId } = useHierarchy();
  const { addCustomer } = useCustomers();

  // No location to inherit when viewing "All" with multiple branches → must pick.
  const needsLocationChoice = !effectiveLocationId && locationOptions.length > 1;

  const [step, setStep]   = useState(1);
  const [data, setData]   = useState<WizardData>({ ...DEFAULT_WIZARD, locationId: effectiveLocationId ?? (locationOptions.length === 1 ? locationOptions[0]!.id : "") });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  function set<K extends keyof WizardData>(k: K, v: WizardData[K]) {
    setData(d => ({ ...d, [k]: v }));
  }
  function clearError(k: string) {
    setErrors(e => { const n = { ...e }; delete n[k]; return n; });
  }

  const defaultRole: Record<AccountType, string> = {
    residential: "Homeowner", commercial: "Decision Maker",
    property_management: "Property Manager", multi_site: "Account Manager", other: "Primary Contact",
  };

  function validateCurrentStep(): Record<string, string> {
    const errs: Record<string, string> = {};
    if (step === 2 && !data.name.trim()) errs.name = "Account name is required";
    if (step === 2 && needsLocationChoice && !data.locationId) errs.locationId = "Choose where this account belongs";
    if (step === 3) {
      if (!data.contactName.trim()) errs.contactName = "Contact name is required";
      if (!data.contactPhone.trim()) errs.contactPhone = "Phone number is required";
      else { const e = validatePhone(data.contactPhone); if (e) errs.contactPhone = e; }
      if (data.contactEmail.trim()) { const e = validateEmail(data.contactEmail); if (e) errs.contactEmail = e; }
    }
    if (step === 4 && !data.propertyParsedAddress.addressLine1.trim()) errs.propertyAddress = "Address is required";
    return errs;
  }

  function handleNext() {
    const errs = validateCurrentStep();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({});

    if (step === 1) set("contactRole", defaultRole[data.accountType]);
    if (step < 4) { setStep(s => (s + 1) as 1 | 2 | 3 | 4); return; }

    // Step 4 confirmed — create the customer
    const customer = buildCustomer(
      data.name, data.contactPhone, data.accountType, data.status,
      data.locationId, data.serviceAreaId,
      data.propertyParsedAddress,
      data.contactEmail,
    );
    addCustomer(customer);
    setSubmitted(true);
  }

  const basicCanProceed =
    (step === 1) ||
    (step === 2 && data.name.trim() !== "" && (!needsLocationChoice || data.locationId !== "")) ||
    (step === 3 && data.contactName.trim() !== "" && data.contactPhone.trim() !== "") ||
    (step === 4 && data.propertyParsedAddress.addressLine1.trim() !== "");

  if (submitted) return <SuccessState name={data.name} onClose={onClose} />;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <StepProgress current={step} />
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {step === 1 && <Step1 data={data} set={set} />}
        {step === 2 && <Step2 data={data} set={set} errors={errors} />}
        {step === 3 && <Step3 data={data} set={set} errors={errors} clearError={clearError} />}
        {step === 4 && <Step4 data={data} set={set} />}
      </div>
      <div className="px-6 py-4 flex items-center justify-between gap-2" style={{ borderTop: "1px solid var(--border-subtle)" }}>
        <button onClick={() => step > 1 ? setStep(s => (s - 1) as 1 | 2 | 3 | 4) : onClose()}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
          <ChevronLeft className="w-3.5 h-3.5" />
          {step === 1 ? "Cancel" : "Back"}
        </button>
        <div className="flex items-center gap-1">
          {STEPS.map((_, i) => (
            <div key={i} className="w-1.5 h-1.5 rounded-full transition-all"
              style={{ backgroundColor: i + 1 === step ? "#4f46e5" : "var(--border)" }} />
          ))}
        </div>
        <button onClick={handleNext} disabled={!basicCanProceed}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-40">
          {step === 4 ? "Create Account" : "Next"}
          {step < 4 && <ChevronRight className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
}

// ─── Modal root ───────────────────────────────────────────
export default function NewCustomerModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [mode, setMode] = useState<"quick" | "full">("quick");
  useEffect(() => { if (open) setMode("quick"); }, [open]);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
        style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "0 16px 48px rgba(0,0,0,0.24)" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 shrink-0" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <div>
            <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>New Customer</h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              {mode === "quick" ? "Fast entry — name, phone, and type" : "Full setup — 4-step wizard"}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg" style={{ color: "var(--text-muted)" }}>
            <X className="w-4 h-4" />
          </button>
        </div>
        {/* Mode toggle */}
        <div className="flex gap-1 px-6 py-3 shrink-0" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          {(["quick", "full"] as const).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className="flex-1 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all"
              style={{ backgroundColor: mode === m ? "var(--bg-input)" : "transparent", color: mode === m ? "var(--text-primary)" : "var(--text-muted)", border: `1px solid ${mode === m ? "var(--border)" : "transparent"}` }}>
              {m === "quick" ? "⚡ Quick Add" : "🧭 Full Setup"}
            </button>
          ))}
        </div>
        {mode === "quick" ? <QuickAddContent onClose={onClose} /> : <WizardContent onClose={onClose} />}
      </div>
    </div>
  );
}
