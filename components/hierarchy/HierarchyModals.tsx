"use client";

// Guided Add Company / Add Location modals.
//
// These are the "grow when ready" entry points. Adding the second location
// flips multi-location on automatically (handled in HierarchyProvider.addLocation);
// these modals just surface that as a celebratory confirmation so the admin
// understands their structure just leveled up.

import { useState } from "react";
import { X, MapPin, Building2, CheckCircle, Sparkles, Map, Trash2, AlertTriangle } from "lucide-react";
import { useHierarchy } from "@/components/providers/HierarchyProvider";
import { useCustomers } from "@/components/providers/CustomerProvider";
import UiSelect from "@/components/ui/Select";
import type { Company, Location, ServiceArea, Status } from "@/lib/hierarchy/types";
import { getCompanyImpact } from "@/lib/hierarchy/cascade";

const INDUSTRIES = [
  { value: "hvac", label: "HVAC" },
  { value: "roofing", label: "Roofing" },
  { value: "plumbing", label: "Plumbing" },
  { value: "electrical", label: "Electrical" },
  { value: "restoration", label: "Restoration" },
  { value: "property_maintenance", label: "Property Maintenance" },
  { value: "consulting", label: "Consulting" },
  { value: "other", label: "Other" },
];

const INDUSTRY_COLORS: Record<string, string> = {
  hvac: "#6366f1", roofing: "#0891b2", plumbing: "#0d9488", electrical: "#d97706",
  restoration: "#dc2626", property_maintenance: "#059669", consulting: "#7c3aed", other: "#6b7280",
};

// ─── Shared shell ─────────────────────────────────────────
function ModalShell({ icon: Icon, title, subtitle, onClose, children }: {
  icon: typeof MapPin; title: string; subtitle: string;
  onClose: () => void; children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden" onClick={e => e.stopPropagation()}
        style={{ backgroundColor: "var(--bg-surface)", boxShadow: "0 16px 48px rgba(0,0,0,0.24)" }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#e0e7ff" }}>
              <Icon className="w-4 h-4" style={{ color: "#4f46e5" }} />
            </div>
            <div>
              <p className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>{title}</p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>{subtitle}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ color: "var(--text-muted)" }}><X className="w-4 h-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Labeled({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
        {label} {required && <span style={{ color: "#ef4444" }}>*</span>}
      </label>
      {children}
    </div>
  );
}

function TextInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className="w-full rounded-lg px-3 py-2 text-sm outline-none"
      style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
  );
}

// Active / Inactive segmented toggle — inactive hides the record from selectors
// and new-record pickers but keeps it for record/history. `activeDisabled`
// blocks activation (e.g. the parent company/branch is inactive).
function StatusToggle({ value, onChange, activeDisabled }: {
  value: Status; onChange: (v: Status) => void; activeDisabled?: boolean;
}) {
  return (
    <div className="flex gap-2">
      {(["active", "inactive"] as const).map(s => {
        const disabled = s === "active" && activeDisabled;
        return (
          <button key={s} disabled={disabled} onClick={() => onChange(s)}
            className="flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              border: `1.5px solid ${value === s ? "#4f46e5" : "var(--border)"}`,
              backgroundColor: value === s ? "#e0e7ff" : "var(--bg-surface-2)",
              color: value === s ? "#4f46e5" : "var(--text-secondary)",
            }}>
            {s}
          </button>
        );
      })}
    </div>
  );
}

function FooterButtons({ onCancel, onSave, disabled, label }: {
  onCancel: () => void; onSave: () => void; disabled?: boolean; label: string;
}) {
  return (
    <div className="px-6 py-4 flex justify-end gap-2" style={{ borderTop: "1px solid var(--border-subtle)" }}>
      <button onClick={onCancel} className="px-3 py-2 rounded-lg text-sm" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
      <button onClick={onSave} disabled={disabled}
        className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40" style={{ backgroundColor: "#4f46e5" }}>
        {label}
      </button>
    </div>
  );
}

// Confirmation shown after a save that flipped a hierarchy layer on.
function GrowthSuccess({ name, leveledUp, onClose }: { name: string; leveledUp: string | null; onClose: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-10 text-center">
      <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ backgroundColor: "#d1fae5" }}>
        <CheckCircle className="w-7 h-7" style={{ color: "#059669" }} />
      </div>
      <p className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>{name} added</p>
      {leveledUp && (
        <div className="flex items-start gap-2 rounded-lg px-3 py-2 text-left" style={{ backgroundColor: "#f5f3ff", border: "1px solid #ddd6fe" }}>
          <Sparkles className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#7c3aed" }} />
          <p className="text-xs" style={{ color: "#5b21b6" }}>{leveledUp}</p>
        </div>
      )}
      <button onClick={onClose}
        className="mt-1 px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: "#4f46e5" }}>
        Done
      </button>
    </div>
  );
}

// ─── Add Location ─────────────────────────────────────────
export function AddLocationModal({ open, onClose, defaultCompanyId }: {
  open: boolean; onClose: () => void; defaultCompanyId?: string;
}) {
  const { allCompanies, addLocation, orgSettings } = useHierarchy();
  const activeCompanies = allCompanies.filter(c => c.status === "active");

  const [companyId, setCompanyId] = useState(defaultCompanyId ?? activeCompanies[0]?.id ?? "");
  const [name, setName]   = useState("");
  const [city, setCity]   = useState("");
  const [state, setState] = useState("");
  const [done, setDone]   = useState<{ name: string; leveledUp: string | null } | null>(null);

  if (!open) return null;

  const canSave = Boolean(companyId && name.trim());

  function handleSave() {
    if (!canSave) return;
    const wasMulti = orgSettings.multiLocation;
    addLocation({ companyId, name, city: city.trim() || undefined, state: state.trim() || undefined });
    setDone({
      name: name.trim(),
      leveledUp: !wasMulti
        ? "Multi-location turned on — a branch selector now appears in the top bar so you can work in each location."
        : null,
    });
  }

  function reset() {
    setName(""); setCity(""); setState(""); setDone(null); onClose();
  }

  return (
    <ModalShell icon={MapPin} title="Add Location" subtitle="A branch or operating office under a company" onClose={reset}>
      {done ? (
        <GrowthSuccess name={done.name} leveledUp={done.leveledUp} onClose={reset} />
      ) : (
        <>
          <div className="px-6 py-4 space-y-4">
            {activeCompanies.length > 1 && (
              <Labeled label="Company" required>
                <UiSelect value={companyId} onChange={setCompanyId}
                  options={activeCompanies.map(c => ({ value: c.id, label: c.name }))} />
              </Labeled>
            )}
            <Labeled label="Location Name" required>
              <TextInput value={name} onChange={setName} placeholder="e.g. Aiken Branch" />
            </Labeled>
            <div className="grid grid-cols-2 gap-3">
              <Labeled label="City"><TextInput value={city} onChange={setCity} placeholder="e.g. Aiken" /></Labeled>
              <Labeled label="State"><TextInput value={state} onChange={setState} placeholder="e.g. SC" /></Labeled>
            </div>
          </div>
          <div className="px-6 py-4 flex justify-end gap-2" style={{ borderTop: "1px solid var(--border-subtle)" }}>
            <button onClick={reset} className="px-3 py-2 rounded-lg text-sm" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
            <button onClick={handleSave} disabled={!canSave}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40" style={{ backgroundColor: "#4f46e5" }}>
              Add Location
            </button>
          </div>
        </>
      )}
    </ModalShell>
  );
}

// ─── Add Company ──────────────────────────────────────────
export function AddCompanyModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { addCompany, orgSettings } = useHierarchy();

  const [name, setName]         = useState("");
  const [industry, setIndustry] = useState("hvac");
  const [done, setDone]         = useState<{ name: string; leveledUp: string | null } | null>(null);

  if (!open) return null;

  const canSave = Boolean(name.trim());

  function handleSave() {
    if (!canSave) return;
    const wasMulti = orgSettings.multiCompany;
    addCompany({ name, industry, primaryColor: INDUSTRY_COLORS[industry] });
    setDone({
      name: name.trim(),
      leveledUp: !wasMulti
        ? "Multi-company turned on — a company selector now appears in the top bar so you can switch between brands."
        : null,
    });
  }

  function reset() { setName(""); setIndustry("hvac"); setDone(null); onClose(); }

  return (
    <ModalShell icon={Building2} title="Add Company" subtitle="A brand or business unit under your organization" onClose={reset}>
      {done ? (
        <GrowthSuccess name={done.name} leveledUp={done.leveledUp} onClose={reset} />
      ) : (
        <>
          <div className="px-6 py-4 space-y-4">
            <Labeled label="Company Name" required>
              <TextInput value={name} onChange={setName} placeholder="e.g. Northstar Plumbing" />
            </Labeled>
            <Labeled label="Industry">
              <UiSelect value={industry} onChange={setIndustry} options={INDUSTRIES} />
            </Labeled>
          </div>
          <div className="px-6 py-4 flex justify-end gap-2" style={{ borderTop: "1px solid var(--border-subtle)" }}>
            <button onClick={reset} className="px-3 py-2 rounded-lg text-sm" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
            <button onClick={handleSave} disabled={!canSave}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40" style={{ backgroundColor: "#4f46e5" }}>
              Add Company
            </button>
          </div>
        </>
      )}
    </ModalShell>
  );
}

// ─── Edit Company (with delete + cascade warning) ─────────
export function EditCompanyModal({ company, open, onClose }: { company: Company; open: boolean; onClose: () => void }) {
  const { editCompany, removeCompany } = useHierarchy();
  const { reload: reloadCustomers } = useCustomers();
  const [name, setName]         = useState(company.name);
  const [industry, setIndustry] = useState(company.industry ?? "hvac");
  const [status, setStatus]     = useState<Status>(company.status);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [initial] = useState(() => JSON.stringify({ name: company.name, industry: company.industry ?? "hvac", status: company.status }));

  if (!open) return null;
  const dirty = JSON.stringify({ name, industry, status }) !== initial;
  const canSave = Boolean(name.trim()) && dirty;

  function handleSave() {
    if (!canSave) return;
    editCompany(company.id, { name: name.trim(), industry, primaryColor: INDUSTRY_COLORS[industry], status });
    onClose();
  }

  function handleDelete() {
    removeCompany(company.id);   // deletes company + branches + service areas + scoped data
    reloadCustomers();           // re-sync the customer list state after the cascade
    onClose();
  }

  if (confirmDelete) {
    return (
      <DeleteCompanyConfirm company={company} onCancel={() => setConfirmDelete(false)} onConfirm={handleDelete} onClose={onClose} />
    );
  }

  return (
    <ModalShell icon={Building2} title="Edit Company" subtitle="Update this brand or business unit" onClose={onClose}>
      <div className="px-6 py-4 space-y-4">
        <Labeled label="Company Name" required>
          <TextInput value={name} onChange={setName} placeholder="e.g. Northstar Plumbing" />
        </Labeled>
        <Labeled label="Industry">
          <UiSelect value={industry} onChange={setIndustry} options={INDUSTRIES} />
        </Labeled>
        <Labeled label="Status"><StatusToggle value={status} onChange={setStatus} /></Labeled>
        {status === "inactive" && (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Deactivating also deactivates this company&apos;s branches and service areas. They can&apos;t be reactivated until the company is active again.
          </p>
        )}
      </div>
      {/* Footer with a danger action on the left */}
      <div className="px-6 py-4 flex items-center justify-between gap-2" style={{ borderTop: "1px solid var(--border-subtle)" }}>
        <button onClick={() => setConfirmDelete(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{ border: "1px solid #fecaca", color: "#dc2626" }}>
          <Trash2 className="w-3.5 h-3.5" /> Delete
        </button>
        <div className="flex gap-2">
          <button onClick={onClose} className="px-3 py-2 rounded-lg text-sm" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
          <button onClick={handleSave} disabled={!canSave}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40" style={{ backgroundColor: "#4f46e5" }}>
            Save Changes
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

// Confirmation step listing exactly what a company delete will remove.
function DeleteCompanyConfirm({ company, onCancel, onConfirm, onClose }: {
  company: Company; onCancel: () => void; onConfirm: () => void; onClose: () => void;
}) {
  const impact = getCompanyImpact(company.id);
  const rows: { label: string; n: number }[] = [
    { label: "Branches / locations", n: impact.locations },
    { label: "Service areas",        n: impact.serviceAreas },
    { label: "Customers / accounts", n: impact.customers },
    { label: "Jobs",                 n: impact.jobs },
    { label: "Quotes",               n: impact.quotes },
    { label: "Invoices",             n: impact.invoices },
    { label: "Projects",             n: impact.projects },
    { label: "Agreements",           n: impact.agreements },
    { label: "Leads",                n: impact.leads },
  ].filter(r => r.n > 0);

  return (
    <ModalShell icon={AlertTriangle} title="Delete Company" subtitle={company.name} onClose={onClose}>
      <div className="px-6 py-4 space-y-4">
        <div className="rounded-lg px-3 py-2.5 flex items-start gap-2" style={{ backgroundColor: "#fef2f2", border: "1px solid #fecaca" }}>
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#dc2626" }} />
          <p className="text-xs" style={{ color: "#991b1b" }}>
            This permanently deletes <span className="font-semibold">{company.name}</span> and everything tied to it. This can&apos;t be undone.
          </p>
        </div>

        {rows.length > 0 ? (
          <div>
            <p className="text-xs font-medium mb-2" style={{ color: "var(--text-secondary)" }}>The following will also be deleted:</p>
            <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border-subtle)" }}>
              {rows.map((r, i) => (
                <div key={r.label} className="flex items-center justify-between px-3 py-2 text-sm"
                  style={{ borderTop: i === 0 ? "none" : "1px solid var(--border-subtle)", backgroundColor: "var(--bg-surface)" }}>
                  <span style={{ color: "var(--text-secondary)" }}>{r.label}</span>
                  <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{r.n}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>No other records are tied to this company.</p>
        )}
      </div>
      <div className="px-6 py-4 flex justify-end gap-2" style={{ borderTop: "1px solid var(--border-subtle)" }}>
        <button onClick={onCancel} className="px-3 py-2 rounded-lg text-sm" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
        <button onClick={onConfirm} className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: "#dc2626" }}>
          Delete Company{impact.total > 0 ? ` + ${impact.total} record${impact.total === 1 ? "" : "s"}` : ""}
        </button>
      </div>
    </ModalShell>
  );
}

// ─── Edit Location ────────────────────────────────────────
export function EditLocationModal({ location, open, onClose }: { location: Location; open: boolean; onClose: () => void }) {
  const { allCompanies, editLocation } = useHierarchy();
  const activeCompanies = allCompanies.filter(c => c.status === "active" || c.id === location.companyId);
  const [companyId, setCompanyId] = useState(location.companyId);
  const [name, setName]   = useState(location.name);
  const [city, setCity]   = useState(location.city ?? "");
  const [state, setState] = useState(location.state ?? "");
  const [status, setStatus] = useState<Status>(location.status);
  const [initial] = useState(() => JSON.stringify({ companyId: location.companyId, name: location.name, city: location.city ?? "", state: location.state ?? "", status: location.status }));

  if (!open) return null;
  // A branch can't be active under an inactive company.
  const companyActive = allCompanies.find(c => c.id === companyId)?.status === "active";
  const effStatus: Status = companyActive ? status : "inactive";
  const dirty = JSON.stringify({ companyId, name, city, state, status: effStatus }) !== initial;
  const canSave = Boolean(companyId && name.trim()) && dirty;

  function handleSave() {
    if (!canSave) return;
    editLocation(location.id, {
      companyId, name: name.trim(),
      city: city.trim() || undefined, state: state.trim() || undefined, status: effStatus,
    });
    onClose();
  }

  return (
    <ModalShell icon={MapPin} title="Edit Location" subtitle="Update this branch or operating office" onClose={onClose}>
      <div className="px-6 py-4 space-y-4">
        {activeCompanies.length > 1 && (
          <Labeled label="Company" required>
            <UiSelect value={companyId} onChange={setCompanyId}
              options={activeCompanies.map(c => ({ value: c.id, label: c.name }))} />
          </Labeled>
        )}
        <Labeled label="Location Name" required>
          <TextInput value={name} onChange={setName} placeholder="e.g. Aiken Branch" />
        </Labeled>
        <div className="grid grid-cols-2 gap-3">
          <Labeled label="City"><TextInput value={city} onChange={setCity} placeholder="e.g. Aiken" /></Labeled>
          <Labeled label="State"><TextInput value={state} onChange={setState} placeholder="e.g. SC" /></Labeled>
        </div>
        <Labeled label="Status">
          <StatusToggle value={effStatus} onChange={setStatus} activeDisabled={!companyActive} />
          {!companyActive && (
            <p className="text-xs mt-1.5" style={{ color: "var(--text-muted)" }}>
              Can&apos;t activate — the parent company is inactive. Reactivate the company first.
            </p>
          )}
        </Labeled>
      </div>
      <FooterButtons onCancel={onClose} onSave={handleSave} disabled={!canSave} label="Save Changes" />
    </ModalShell>
  );
}

// ─── Add Service Area ─────────────────────────────────────
export function AddServiceAreaModal({ open, onClose, defaultLocationId }: {
  open: boolean; onClose: () => void; defaultLocationId?: string;
}) {
  const { allLocations, allCompanies, addServiceArea } = useHierarchy();
  const activeLocations = allLocations.filter(l => l.status === "active");
  const [locationId, setLocationId] = useState(defaultLocationId ?? activeLocations[0]?.id ?? "");
  const [name, setName] = useState("");

  if (!open) return null;
  const canSave = Boolean(locationId && name.trim());
  const locLabel = (l: Location) => {
    const co = allCompanies.find(c => c.id === l.companyId);
    return co ? `${co.name} · ${l.name}` : l.name;
  };

  function handleSave() {
    if (!canSave) return;
    addServiceArea({ locationId, name });
    onClose();
  }

  return (
    <ModalShell icon={Map} title="Add Service Area" subtitle="A territory or market under a location" onClose={onClose}>
      <div className="px-6 py-4 space-y-4">
        <Labeled label="Location" required>
          <UiSelect value={locationId} onChange={setLocationId}
            options={activeLocations.map(l => ({ value: l.id, label: locLabel(l) }))} />
        </Labeled>
        <Labeled label="Service Area Name" required>
          <TextInput value={name} onChange={setName} placeholder="e.g. Aiken, SC" />
        </Labeled>
      </div>
      <FooterButtons onCancel={onClose} onSave={handleSave} disabled={!canSave} label="Add Service Area" />
    </ModalShell>
  );
}

// ─── Edit Service Area ────────────────────────────────────
export function EditServiceAreaModal({ serviceArea, open, onClose }: {
  serviceArea: ServiceArea; open: boolean; onClose: () => void;
}) {
  const { allLocations, allCompanies, editServiceArea } = useHierarchy();
  const activeLocations = allLocations.filter(l => l.status === "active" || l.id === serviceArea.locationId);
  const [locationId, setLocationId] = useState(serviceArea.locationId);
  const [name, setName]   = useState(serviceArea.name);
  const [status, setStatus] = useState<Status>(serviceArea.status);
  const [initial] = useState(() => JSON.stringify({ locationId: serviceArea.locationId, name: serviceArea.name, status: serviceArea.status }));

  if (!open) return null;
  const locLabel = (l: Location) => {
    const co = allCompanies.find(c => c.id === l.companyId);
    return co ? `${co.name} · ${l.name}` : l.name;
  };
  // A service area can't be active unless its branch AND company are active.
  const parentLoc = allLocations.find(l => l.id === locationId);
  const parentActive = !!parentLoc && parentLoc.status === "active"
    && allCompanies.find(c => c.id === parentLoc.companyId)?.status === "active";
  const effStatus: Status = parentActive ? status : "inactive";
  const dirty = JSON.stringify({ locationId, name, status: effStatus }) !== initial;
  const canSave = Boolean(locationId && name.trim()) && dirty;

  function handleSave() {
    if (!canSave) return;
    const co = allLocations.find(l => l.id === locationId)?.companyId;
    editServiceArea(serviceArea.id, { locationId, companyId: co ?? serviceArea.companyId, name: name.trim(), status: effStatus });
    onClose();
  }

  return (
    <ModalShell icon={Map} title="Edit Service Area" subtitle="Update this territory or market" onClose={onClose}>
      <div className="px-6 py-4 space-y-4">
        <Labeled label="Location" required>
          <UiSelect value={locationId} onChange={setLocationId}
            options={activeLocations.map(l => ({ value: l.id, label: locLabel(l) }))} />
        </Labeled>
        <Labeled label="Service Area Name" required>
          <TextInput value={name} onChange={setName} placeholder="e.g. Aiken, SC" />
        </Labeled>
        <Labeled label="Status">
          <StatusToggle value={effStatus} onChange={setStatus} activeDisabled={!parentActive} />
          {!parentActive && (
            <p className="text-xs mt-1.5" style={{ color: "var(--text-muted)" }}>
              Can&apos;t activate — its branch or company is inactive. Reactivate those first.
            </p>
          )}
        </Labeled>
      </div>
      <FooterButtons onCancel={onClose} onSave={handleSave} disabled={!canSave} label="Save Changes" />
    </ModalShell>
  );
}
