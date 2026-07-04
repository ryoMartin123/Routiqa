"use client";

// ─── Admin · platform structure editors ───────────────────
// These manage the organization hierarchy (org → companies → locations →
// service areas), the business-structure mode, and global appearance. They moved
// OUT of CRM Settings into the Admin app: companies/locations are shared by CRM,
// HR, Accounting, and Documents, so they belong to the platform control center.
//
// Extracted verbatim from the old CRM settings page; they depend only on
// HierarchyProvider + ThemeProvider (both available in the Admin app shell).

import { useState, useEffect } from "react";
import {
  Sun, Moon, Building2, MapPin, Map, Check, Plus, Pencil, Lock,
} from "lucide-react";
import { useTheme } from "@/components/providers/ThemeProvider";
import { useHierarchy } from "@/components/providers/HierarchyProvider";
import {
  AddCompanyModal, AddLocationModal, AddServiceAreaModal,
  EditCompanyModal, EditLocationModal, EditServiceAreaModal,
} from "@/components/hierarchy/HierarchyModals";
import type { Company, Location, ServiceArea, HierarchyMode } from "@/lib/hierarchy/types";
import HoverInfo, { Pill } from "@/components/shared/HoverInfo";

// ─── Shared primitives ────────────────────────────────────
function SectionHeader({ title, subtitle, action }: { title: string; subtitle: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>{title}</h2>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-5"
      style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
      {children}
    </div>
  );
}

// ─── Appearance ───────────────────────────────────────────
export function AppearanceSection() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="space-y-4">
      <SectionHeader title="Appearance" subtitle="Global color theme and display preferences." />
      <Card>
        <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>Color Theme</p>
        <div className="flex gap-3">
          {([
            { key: "light" as const, label: "Light", Icon: Sun },
            { key: "dark"  as const, label: "Dark",  Icon: Moon },
          ]).map(({ key, label, Icon }) => {
            const active = theme === key;
            return (
              <button key={key} onClick={() => setTheme(key)}
                className="flex-1 flex flex-col items-center gap-3 py-5 rounded-xl transition-all"
                style={{ border: `2px solid ${active ? "#4f46e5" : "var(--border)"}`, backgroundColor: "var(--bg-surface-2)" }}>
                <Icon className="w-5 h-5" style={{ color: active ? "#4f46e5" : "var(--text-muted)" }} />
                <span className="text-sm font-medium" style={{ color: active ? "#4f46e5" : "var(--text-secondary)" }}>{label}</span>
              </button>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

// ─── Business structure ───────────────────────────────────
const MODES: {
  key: HierarchyMode; label: string; description: string;
  layers: { icon: typeof Building2; label: string; enabled: boolean }[];
}[] = [
  { key: "simple",             label: "Simple",             description: "One company, one location. No selectors shown.",
    layers: [{ icon: Building2, label: "Company", enabled: false }, { icon: MapPin, label: "Location", enabled: false }, { icon: Map, label: "Service Areas", enabled: false }] },
  { key: "multi_location",     label: "Multi-Location",     description: "One company, multiple branches or offices.",
    layers: [{ icon: Building2, label: "Company", enabled: false }, { icon: MapPin, label: "Location", enabled: true  }, { icon: Map, label: "Service Areas", enabled: false }] },
  { key: "multi_company",      label: "Multi-Company",      description: "Multiple brands or business units under one organization.",
    layers: [{ icon: Building2, label: "Company", enabled: true  }, { icon: MapPin, label: "Location", enabled: true  }, { icon: Map, label: "Service Areas", enabled: false }] },
  { key: "advanced_territory", label: "Advanced Territory", description: "Full hierarchy with service area management.",
    layers: [{ icon: Building2, label: "Company", enabled: true  }, { icon: MapPin, label: "Location", enabled: true  }, { icon: Map, label: "Service Areas", enabled: true  }] },
];

function Toggle({ enabled, onChange, disabled }: { enabled: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      onClick={() => { if (!disabled) onChange(!enabled); }}
      disabled={disabled}
      className="relative w-10 h-5 rounded-full transition-colors shrink-0"
      style={{ backgroundColor: enabled ? "#4f46e5" : "var(--bg-input)", border: "1px solid var(--border)", opacity: disabled ? 0.55 : 1, cursor: disabled ? "not-allowed" : "pointer" }}
      role="switch"
      aria-checked={enabled}
    >
      <span
        className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform"
        style={{ transform: enabled ? "translateX(20px)" : "translateX(0)" }}
      />
    </button>
  );
}

function ToggleRow({
  label, description, enabled, onChange, tag, disabled, lockedReason,
}: {
  label: string; description: string; enabled: boolean;
  onChange: (v: boolean) => void; tag?: string; disabled?: boolean; lockedReason?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3"
      style={{ borderBottom: "1px solid var(--border)" }}>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{label}</p>
          {tag && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide"
              style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>{tag}</span>
          )}
          {disabled && lockedReason && (
            <span className="flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide"
              style={{ backgroundColor: "#fef3c7", color: "#92400e" }}>
              <Lock className="w-2.5 h-2.5" /> Locked
            </span>
          )}
        </div>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{disabled && lockedReason ? lockedReason : description}</p>
      </div>
      <Toggle enabled={enabled} onChange={onChange} disabled={disabled} />
    </div>
  );
}

export function BusinessStructureSection() {
  const {
    orgSettings, setOrgMode, setOrgSetting,
    canDisableMultiCompany, canDisableMultiLocation,
    allCompanies, allLocations,
  } = useHierarchy();

  const activeCompanies = allCompanies.filter(c => c.status === "active").length;
  const activeLocations = allLocations.filter(l => l.status === "active").length;

  const modeMatchesPreset = MODES.find(m =>
    m.layers[0].enabled === orgSettings.multiCompany &&
    m.layers[1].enabled === orgSettings.multiLocation &&
    m.layers[2].enabled === orgSettings.serviceAreasEnabled
  );

  function modeLock(mode: typeof MODES[number]): string | null {
    if (!mode.layers[0].enabled && !canDisableMultiCompany)
      return `Has ${activeCompanies} active companies — remove all but one first.`;
    if (!mode.layers[1].enabled && !canDisableMultiLocation)
      return `Has ${activeLocations} active locations — remove all but one first.`;
    return null;
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Structure Mode & Modules"
        subtitle="How the hierarchy selectors and optional modules behave. The actual companies, locations, and service areas are managed in Admin → Business Structure."
      />

      <Card>
        <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>
          Structure Mode
        </p>
        <div className="grid grid-cols-2 gap-3">
          {MODES.map(mode => {
            const active = orgSettings.mode === mode.key && Boolean(modeMatchesPreset);
            const lock = modeLock(mode);
            const locked = Boolean(lock) && !active;
            return (
              <button key={mode.key} onClick={() => { if (!locked) setOrgMode(mode.key); }}
                disabled={locked}
                title={locked ? lock! : undefined}
                className="flex flex-col text-left p-4 rounded-xl transition-all"
                style={{
                  border: `2px solid ${active ? "#4f46e5" : "var(--border)"}`,
                  backgroundColor: active ? "#f5f3ff" : "var(--bg-surface-2)",
                  opacity: locked ? 0.6 : 1,
                  cursor: locked ? "not-allowed" : "pointer",
                }}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-semibold" style={{ color: active ? "#4f46e5" : "var(--text-primary)" }}>
                    {mode.label}
                  </span>
                  {active && (
                    <span className="w-4 h-4 rounded-full bg-[#e5e0db] flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 text-white" />
                    </span>
                  )}
                  {locked && <Lock className="w-3 h-3" style={{ color: "#92400e" }} />}
                </div>
                <p className="text-[11px] mb-3" style={{ color: "var(--text-secondary)" }}>{mode.description}</p>
                <div className="flex flex-col gap-1">
                  {mode.layers.map(({ icon: Icon, label, enabled }) => (
                    <div key={label} className="flex items-center gap-1.5">
                      <Icon className="w-3 h-3 shrink-0" style={{ color: enabled ? "#10b981" : "var(--text-muted)" }} />
                      <span className="text-[10px]"
                        style={{ color: enabled ? "var(--text-secondary)" : "var(--text-muted)", textDecoration: enabled ? "none" : "line-through" }}>
                        {label}
                      </span>
                    </div>
                  ))}
                </div>
                {locked && (
                  <p className="text-[10px] mt-2 leading-snug" style={{ color: "#92400e" }}>{lock}</p>
                )}
              </button>
            );
          })}
        </div>
        {!modeMatchesPreset && (
          <div className="mt-3 px-3 py-2 rounded-lg text-xs" style={{ backgroundColor: "#fef3c7", color: "#92400e" }}>
            Custom configuration — toggles below don&apos;t match a standard preset.
          </div>
        )}
      </Card>

      <Card>
        <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>
          Hierarchy Layers
        </p>
        <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
          Controls which selectors appear in the top bar and which data filters are available.
        </p>
        <div className="divide-y-0">
          <ToggleRow
            label="Multiple Companies"
            description="Show company selector in the top bar. Use when managing multiple brands or business units."
            enabled={orgSettings.multiCompany}
            onChange={v => setOrgSetting("multiCompany", v)}
            disabled={orgSettings.multiCompany && !canDisableMultiCompany}
            lockedReason={`Can't turn off — you have ${activeCompanies} active companies. Deactivate all but one first.`}
          />
          <ToggleRow
            label="Multiple Locations"
            description="Show location/branch selector in the top bar. Use when you have more than one operating branch."
            enabled={orgSettings.multiLocation}
            onChange={v => setOrgSetting("multiLocation", v)}
            disabled={orgSettings.multiLocation && !canDisableMultiLocation}
            lockedReason={`Can't turn off — you have ${activeLocations} active locations. Deactivate all but one first.`}
          />
          <ToggleRow
            label="Service Areas"
            description="Enable territory-level filtering for leads, jobs, and campaigns."
            enabled={orgSettings.serviceAreasEnabled}
            onChange={v => setOrgSetting("serviceAreasEnabled", v)}
            tag="Advanced"
          />
        </div>
      </Card>

      <Card>
        <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>
          Module Availability
        </p>
        <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
          Enable or disable modules across your organization. Disabled modules are hidden from the sidebar.
        </p>
        <div className="divide-y-0">
          <ToggleRow
            label="Projects"
            description="Multi-phase work with timelines, milestones, and grouped jobs."
            enabled={orgSettings.projectsEnabled}
            onChange={v => setOrgSetting("projectsEnabled", v)}
          />
          <ToggleRow
            label="Agreements"
            description="Recurring service plans, maintenance agreements, and renewal billing."
            enabled={orgSettings.agreementsEnabled}
            onChange={v => setOrgSetting("agreementsEnabled", v)}
          />
          <ToggleRow
            label="Marketing"
            description="Email and SMS campaigns, follow-up sequences, and review requests."
            enabled={orgSettings.marketingEnabled}
            onChange={v => setOrgSetting("marketingEnabled", v)}
          />
        </div>
      </Card>
    </div>
  );
}

// ─── Organization ─────────────────────────────────────────
export function OrganizationSection() {
  const { organization, orgSettings, updateOrganization } = useHierarchy();
  const [name, setName] = useState(organization.name);

  useEffect(() => { setName(organization.name); }, [organization.name]);

  // Auto-save: commit the name when the field loses focus (or on Enter). No Save
  // button — edits persist immediately, matching the rest of the admin sections.
  function commit() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === organization.name) { setName(organization.name); return; }
    updateOrganization({ name: trimmed });
  }

  return (
    <div className="space-y-4">
      <SectionHeader title="Organization" subtitle="Top-level account settings for your organization." />
      <Card>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Organization Name</label>
            <input value={name} onChange={e => setName(e.target.value)} onBlur={commit}
              onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)", color: "var(--text-primary)" }} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Organization ID</label>
              <p className="text-sm font-mono px-3 py-2 rounded-lg"
                style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>{organization.id}</p>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Business Mode</label>
              <p className="text-sm px-3 py-2 rounded-lg capitalize"
                style={{ backgroundColor: "var(--bg-input)", color: "var(--text-secondary)" }}>
                {orgSettings.mode.replace(/_/g, " ")}
              </p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ─── Companies ────────────────────────────────────────────
export function CompaniesSection() {
  const { allCompanies, allLocations } = useHierarchy();
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const industryColors: Record<string, string> = { hvac: "#6366f1", roofing: "#0891b2", plumbing: "#0d9488", electrical: "#d97706", restoration: "#dc2626", property_maintenance: "#059669", consulting: "#7c3aed" };
  return (
    <div className="space-y-4">
      <AddCompanyModal open={addOpen} onClose={() => setAddOpen(false)} />
      {editing && <EditCompanyModal company={editing} open onClose={() => setEditing(null)} />}
      <SectionHeader
        title="Companies"
        subtitle="Business units and brands within your organization."
        action={
          <button onClick={() => setAddOpen(true)} className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors">
            <Plus className="w-4 h-4" /> Add Company
          </button>
        }
      />
      <div className="space-y-3">
        {allCompanies.map(co => {
          const coLocations = allLocations.filter(l => l.companyId === co.id);
          const color = industryColors[co.industry ?? ""] ?? "#6b7280";
          return (
            <Card key={co.id}>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: color + "20" }}>
                    <Building2 className="w-5 h-5" style={{ color }} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{co.name}</p>
                      <HoverInfo rows={[
                        ...(co.industry ? [{ label: "Type", node: <Pill text={co.industry.toUpperCase()} style={{ backgroundColor: color + "20", color }} /> }] : []),
                        { label: "Status", node: <Pill text={co.status} style={{ backgroundColor: co.status === "active" ? "#d1fae5" : "var(--bg-input)", color: co.status === "active" ? "#065f46" : "var(--text-muted)" }} /> },
                      ]} />
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                      {coLocations.length} {coLocations.length === 1 ? "location" : "locations"} · {co.id}
                    </p>
                  </div>
                </div>
                <button onClick={() => setEditing(co)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs"
                  style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                  <Pencil className="w-3 h-3" /> Edit
                </button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ─── Locations ────────────────────────────────────────────
export function LocationsSection() {
  const { allCompanies, allLocations } = useHierarchy();
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Location | null>(null);
  return (
    <div className="space-y-4">
      <AddLocationModal open={addOpen} onClose={() => setAddOpen(false)} />
      {editing && <EditLocationModal location={editing} open onClose={() => setEditing(null)} />}
      <SectionHeader
        title="Locations"
        subtitle="Branch offices and operating units under each company."
        action={
          <button onClick={() => setAddOpen(true)} className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors">
            <Plus className="w-4 h-4" /> Add Location
          </button>
        }
      />
      {allCompanies.map(co => {
        const coLocations = allLocations.filter(l => l.companyId === co.id);
        return (
          <div key={co.id}>
            <p className="text-xs font-semibold uppercase tracking-widest mb-2 px-1"
              style={{ color: "var(--text-muted)" }}>{co.name}</p>
            <div className="space-y-2">
              {coLocations.map(loc => (
                <Card key={loc.id}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                        <MapPin className="w-4 h-4 text-indigo-600" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{loc.name}</p>
                        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                          {loc.city}, {loc.state} · {loc.id}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: loc.status === "active" ? "#d1fae5" : "var(--bg-input)", color: loc.status === "active" ? "#065f46" : "var(--text-muted)" }}>
                        {loc.status}
                      </span>
                      <button onClick={() => setEditing(loc)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs"
                        style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                        <Pencil className="w-3 h-3" /> Edit
                      </button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Service Areas ────────────────────────────────────────
export function ServiceAreasSection() {
  const { allCompanies, allLocations, allServiceAreas } = useHierarchy();
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceArea | null>(null);
  return (
    <div className="space-y-4">
      <AddServiceAreaModal open={addOpen} onClose={() => setAddOpen(false)} />
      {editing && <EditServiceAreaModal serviceArea={editing} open onClose={() => setEditing(null)} />}
      <SectionHeader
        title="Service Areas"
        subtitle="Territories and markets served under each location."
        action={
          <button onClick={() => setAddOpen(true)} className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors">
            <Plus className="w-4 h-4" /> Add Service Area
          </button>
        }
      />
      {allLocations.map(loc => {
        const areas = allServiceAreas.filter(sa => sa.locationId === loc.id);
        const co = allCompanies.find(c => c.id === loc.companyId);
        return (
          <div key={loc.id}>
            <p className="text-xs font-semibold uppercase tracking-widest mb-2 px-1"
              style={{ color: "var(--text-muted)" }}>{loc.name} — {co?.name}</p>
            {areas.length === 0 ? (
              <p className="text-xs px-1 pb-1" style={{ color: "var(--text-muted)" }}>No service areas yet.</p>
            ) : (
            <div className="space-y-2">
              {areas.map(sa => (
                <Card key={sa.id}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                        <Map className="w-3.5 h-3.5 text-indigo-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{sa.name}</p>
                        <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{sa.id}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: sa.status === "active" ? "#d1fae5" : "var(--bg-input)", color: sa.status === "active" ? "#065f46" : "var(--text-muted)" }}>
                        {sa.status}
                      </span>
                      <button onClick={() => setEditing(sa)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs"
                        style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                        <Pencil className="w-3 h-3" /> Edit
                      </button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
