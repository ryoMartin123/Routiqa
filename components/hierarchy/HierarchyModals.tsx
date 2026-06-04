"use client";

// Guided Add Company / Add Location modals.
//
// These are the "grow when ready" entry points. Adding the second location
// flips multi-location on automatically (handled in HierarchyProvider.addLocation);
// these modals just surface that as a celebratory confirmation so the admin
// understands their structure just leveled up.

import { useState } from "react";
import { X, MapPin, Building2, CheckCircle, Sparkles } from "lucide-react";
import { useHierarchy } from "@/components/providers/HierarchyProvider";
import UiSelect from "@/components/ui/Select";

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
