"use client";

import { useState, useEffect } from "react";
import {
  Sun, Moon, Building2, MapPin, Map, Check,
  Globe, Users, Shield, ShieldCheck, Megaphone, MessageSquare,
  Puzzle, Factory, Sliders, CreditCard, ArrowUpDown,
  TrendingUp, Briefcase, ClipboardList, Image as ImageIcon,
  FileText, ChevronRight, Plus, Pencil, LayoutDashboard,
  Settings2, ArrowLeft, CalendarClock,
  Package, Tag, Percent, FileStack, FilePen, Lock,
} from "lucide-react";
import { useTheme } from "@/components/providers/ThemeProvider";
import { useHierarchy } from "@/components/providers/HierarchyProvider";
import dynamic from "next/dynamic";

// Heavy admin sections are lazy-loaded: only one renders at a time (see
// renderSection), so each is split into its own chunk that loads on demand.
// This keeps the initial /settings bundle small and the route fast to open.
const SectionLoading = () => (
  <div className="p-6 text-sm" style={{ color: "var(--text-muted)" }}>Loading…</div>
);
const CustomFieldsSection       = dynamic(() => import("@/components/settings/CustomFieldsSection"),       { loading: SectionLoading, ssr: false });
const DashboardsSettingsSection = dynamic(() => import("@/components/settings/DashboardsSettingsSection"), { loading: SectionLoading, ssr: false });
const PipelinesSection          = dynamic(() => import("@/components/settings/PipelinesSection"),          { loading: SectionLoading, ssr: false });
const JobConfigSection          = dynamic(() => import("@/components/settings/JobConfigSection"),          { loading: SectionLoading, ssr: false });
const WorkOrderTemplatesSection = dynamic(() => import("@/components/settings/WorkOrderTemplatesSection"), { loading: SectionLoading, ssr: false });
const PhotoCategoriesSection    = dynamic(() => import("@/components/settings/PhotoCategoriesSection"),    { loading: SectionLoading, ssr: false });
const IndustryDefaultsSection   = dynamic(() => import("@/components/settings/IndustryDefaultsSection"),   { loading: SectionLoading, ssr: false });
const CalendarDispatchSection   = dynamic(() => import("@/components/settings/CalendarDispatchSection"),   { loading: SectionLoading, ssr: false });
const ItemsCategoriesSection    = dynamic(() => import("@/components/settings/ItemsCategoriesSection"),    { loading: SectionLoading, ssr: false });
const QuoteSettingsSection      = dynamic(() => import("@/components/settings/QuoteSettingsSection"),      { loading: SectionLoading, ssr: false });
const QuoteTemplatesSection     = dynamic(() => import("@/components/settings/QuoteTemplatesSection"),     { loading: SectionLoading, ssr: false });
const TermsConditionsSection    = dynamic(() => import("@/components/settings/TermsConditionsSection"),    { loading: SectionLoading, ssr: false });
const TaxesFeesSection          = dynamic(() => import("@/components/settings/TaxesFeesSection"),          { loading: SectionLoading, ssr: false });
const AgreementsSettingsSection = dynamic(() => import("@/components/settings/AgreementsSettingsSection"), { loading: SectionLoading, ssr: false });
const ProposalBuilderSection    = dynamic(() => import("@/components/settings/ProposalBuilderSection"),    { loading: SectionLoading, ssr: false });
const MarketingSettingsSection  = dynamic(() => import("@/components/settings/MarketingSettingsSection"),  { loading: SectionLoading, ssr: false });
const UsersSection              = dynamic(() => import("@/components/settings/UsersSection"),              { loading: SectionLoading, ssr: false });
const RolesSection              = dynamic(() => import("@/components/settings/RolesSection"),              { loading: SectionLoading, ssr: false });
import {
  AddCompanyModal, AddLocationModal, AddServiceAreaModal,
  EditCompanyModal, EditLocationModal, EditServiceAreaModal,
} from "@/components/hierarchy/HierarchyModals";
import type { Company, Location, ServiceArea } from "@/lib/hierarchy/types";
import type { HierarchyMode } from "@/lib/hierarchy/types";
import { SettingsScopeProvider } from "@/components/providers/SettingsScopeProvider";
import SectionGate from "@/components/settings/SectionGate";
import EditingScopeHeader from "@/components/settings/EditingScopeHeader";
import { SettingsActionsProvider, SettingsSaveSlot } from "@/components/settings/SettingsActions";
import type { SectionLayers } from "@/lib/settings-scope/types";
import HoverInfo, { Pill } from "@/components/shared/HoverInfo";

// ─── Navigation structure ─────────────────────────────────
type SectionKey =
  | "appearance" | "business_structure"
  | "organization" | "companies" | "locations" | "service_areas"
  | "pipelines" | "job_types" | "work_orders" | "photo_categories" | "calendar_dispatch" | "agreements"
  | "items_categories" | "quote_settings" | "quote_templates" | "proposal_builder" | "terms_conditions" | "taxes_fees"
  | "users" | "roles" | "security"
  | "marketing" | "communication"
  | "integrations" | "industry" | "custom_fields" | "dashboards" | "billing" | "import_export";

type CategoryKey =
  | "general" | "organization" | "operations" | "sales_catalog"
  | "customization" | "users_security" | "communication" | "system";

// View modes — drives what the right panel renders
type View =
  | { mode: "home" }
  | { mode: "category"; category: CategoryKey }
  | { mode: "section"; category: CategoryKey; section: SectionKey };

interface SettingItem {
  key:         SectionKey;
  label:       string;
  description: string;
  icon:        typeof Globe;
  phase?:      string;
}

interface Category {
  key:         CategoryKey;
  label:       string;
  description: string;
  icon:        typeof Globe;
  items:       SettingItem[];
}

const CATEGORIES: Category[] = [
  {
    key: "general", label: "General",
    description: "Theme, appearance, and business structure",
    icon: Settings2,
    items: [
      { key: "appearance",         label: "Appearance",         description: "Color theme and display preferences",               icon: Sun },
      { key: "business_structure", label: "Business Structure", description: "Hierarchy mode, enabled modules, and feature flags", icon: Building2 },
    ],
  },
  {
    key: "organization", label: "Organization",
    description: "Companies, locations, and service territories",
    icon: Globe,
    items: [
      { key: "organization",  label: "Organization",  description: "Top-level org name and settings",            icon: Globe },
      { key: "companies",     label: "Companies",     description: "Business units, brands, and divisions",      icon: Building2 },
      { key: "locations",     label: "Locations",     description: "Branch offices and operating locations",     icon: MapPin },
      { key: "service_areas", label: "Service Areas", description: "Territories, zones, and routing areas",      icon: Map },
    ],
  },
  {
    key: "operations", label: "Operations",
    description: "Pipelines, job types, work orders, and agreements",
    icon: Briefcase,
    items: [
      { key: "pipelines",        label: "Pipelines",            description: "Lead pipeline stages and order",                 icon: TrendingUp },
      { key: "job_types",        label: "Job Types & Statuses", description: "Job categories and status labels",               icon: Briefcase },
      { key: "work_orders",      label: "Work Orders",          description: "Checklist templates and field instructions",     icon: ClipboardList },
      { key: "photo_categories", label: "Photo Categories",     description: "Categories for job and property photos",         icon: ImageIcon },
      { key: "calendar_dispatch",label: "Calendar / Dispatch",  description: "Default view, hours, service blocks, and boards", icon: CalendarClock },
      { key: "agreements",       label: "Agreements",           description: "Plan templates, types, visit & billing rules, benefits, terms", icon: FileText },
    ],
  },
  {
    key: "sales_catalog", label: "Sales & Catalog",
    description: "Items, quote behavior, templates, terms, and taxes",
    icon: Package,
    items: [
      { key: "items_categories", label: "Items & Categories", description: "Catalog item types, categories, and item defaults", icon: Tag },
      { key: "quote_settings",   label: "Quote Settings",     description: "Numbering, expiration, and quote workflow rules",   icon: FilePen },
      { key: "quote_templates",  label: "Quote Templates",    description: "Default quote structures and section toggles",      icon: FileStack },
      { key: "proposal_builder", label: "Proposal Builder",   description: "Proposal templates, section library, terms, and branding", icon: FilePen },
      { key: "terms_conditions", label: "Terms & Conditions", description: "Reusable terms blocks for quotes and invoices",     icon: FileText },
      { key: "taxes_fees",       label: "Taxes & Fees",       description: "Default tax rate, taxable types, and fees",         icon: Percent },
    ],
  },
  {
    key: "customization", label: "Customization",
    description: "Custom fields, dashboards, and industry templates",
    icon: Sliders,
    items: [
      { key: "industry",       label: "Industry Defaults",    description: "Default pipeline, job types, and fields by industry", icon: Factory },
      { key: "custom_fields",  label: "Custom Fields",        description: "Add custom fields to any record type",                icon: Sliders },
      { key: "dashboards",     label: "Dashboards & Widgets", description: "Widget library, layouts, and custom widgets",         icon: LayoutDashboard },
    ],
  },
  {
    key: "users_security", label: "Users & Security",
    description: "Team members, roles, and access control",
    icon: Users,
    items: [
      { key: "users",    label: "Users & Roles",       description: "Invite team members and assign roles",          icon: Users,       phase: "Phase 1" },
      { key: "roles",    label: "Roles & Permissions",  description: "Create roles and set what each can access",      icon: ShieldCheck, phase: "Phase 1" },
      { key: "security", label: "Security",             description: "Two-factor auth, sessions, and audit logging",  icon: Shield,      phase: "Phase 1" },
    ],
  },
  {
    key: "communication", label: "Communication",
    description: "Email, SMS, and messaging integrations",
    icon: MessageSquare,
    items: [
      { key: "marketing",     label: "Marketing",           description: "Campaign types, audiences, templates, and sender branding", icon: Megaphone },
      { key: "communication", label: "Communication",       description: "Email, SMS, and phone provider connections", icon: MessageSquare, phase: "Phase 6" },
    ],
  },
  {
    key: "system", label: "System",
    description: "Integrations, billing, and data management",
    icon: Puzzle,
    items: [
      { key: "integrations",  label: "Integrations",    description: "Google, Zapier, Stripe, and other connections", icon: Puzzle,     phase: "Phase 6" },
      { key: "billing",       label: "Billing & Plan",  description: "Subscription plan and payment management",      icon: CreditCard, phase: "Phase 1" },
      { key: "import_export", label: "Import / Export", description: "CSV import, export, and data backup",           icon: ArrowUpDown,phase: "Phase 6" },
    ],
  },
];

// ─── Which hierarchy layer each section is edited at ──────
// Drives the scope-aware behavior: at a layer not listed here, the section shows
// a read-only "managed at X" notice (see SectionGate). "any" = personal/global.
const SECTION_LAYERS: Record<SectionKey, SectionLayers> = {
  appearance:         "any",
  business_structure: ["org"],
  organization:       ["org"],
  companies:          ["org"],
  locations:          ["org"],
  service_areas:      ["org"],
  pipelines:          ["org", "company", "location"],
  job_types:          ["org", "company", "location"],
  work_orders:        ["org", "company"],
  photo_categories:   ["org", "company"],
  calendar_dispatch:  ["org", "company", "location"],
  agreements:         ["org", "company"],
  items_categories:   ["org", "company"],
  quote_settings:     ["org", "company", "location"],
  quote_templates:    ["org", "company"],
  proposal_builder:   ["org", "company"],
  terms_conditions:   ["org", "company"],
  taxes_fees:         ["org", "company", "location"],
  users:              ["org"],
  roles:              ["org"],
  security:           ["org"],
  marketing:          ["org", "company"],
  communication:      ["org", "company"],
  integrations:       ["org"],
  industry:           ["org", "company"],
  custom_fields:      ["org", "company"],
  dashboards:         "any",
  billing:            ["org"],
  import_export:      ["org"],
};

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
      style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
      {children}
    </div>
  );
}

function ComingSoon({ label, phase, features }: { label: string; phase: string; features: string[] }) {
  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{label}</p>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
          style={{ backgroundColor: "#e0e7ff", color: "#4f46e5" }}>{phase}</span>
      </div>
      <ul className="space-y-1.5">
        {features.map(f => (
          <li key={f} className="flex items-start gap-2">
            <div className="w-1 h-1 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: "var(--text-muted)" }} />
            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{f}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// ─── Appearance ───────────────────────────────────────────
function AppearanceSection() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="space-y-4">
      <SectionHeader title="Appearance" subtitle="Choose your preferred color theme." />
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

// ─── Toggle component ─────────────────────────────────────
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

// ─── Toggle row ───────────────────────────────────────────
function ToggleRow({
  label, description, enabled, onChange, tag, disabled, lockedReason,
}: {
  label: string; description: string; enabled: boolean;
  onChange: (v: boolean) => void; tag?: string; disabled?: boolean; lockedReason?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3"
      style={{ borderBottom: "1px solid var(--border-subtle)" }}>
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

// ─── Business structure section ───────────────────────────
function BusinessStructureSection() {
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

  // A mode is locked when picking it would collapse a layer that data still
  // depends on (the ratchet — grow freely, shrink only when safe).
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
        title="Business Structure"
        subtitle="Controls which hierarchy layers and modules are active for your organization."
      />

      {/* ── Mode presets ─────────────────────────────────── */}
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
                    <span className="w-4 h-4 rounded-full bg-indigo-600 flex items-center justify-center">
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

      {/* ── Hierarchy layer toggles ───────────────────────── */}
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

      {/* ── Module toggles ────────────────────────────────── */}
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
            tag="Phase 4"
          />
          <ToggleRow
            label="Marketing"
            description="Email and SMS campaigns, follow-up sequences, and review requests."
            enabled={orgSettings.marketingEnabled}
            onChange={v => setOrgSetting("marketingEnabled", v)}
            tag="Phase 5"
          />
        </div>
        <p className="text-[11px] mt-3 pt-3" style={{ borderTop: "1px solid var(--border-subtle)", color: "var(--text-muted)" }}>
          Changes take effect immediately. Module settings are stored per organization and will persist across sessions in production.
        </p>
      </Card>

      {/* ── Preferences ───────────────────────────────────── */}
      <Card>
        <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>
          Preferences
        </p>
        <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
          Optional workflow tweaks for how your team works day to day.
        </p>
        <div className="divide-y-0">
          <ToggleRow
            label="Customer Quick Add"
            description="Add a fast name + phone entry option to the New Customer screen. Off by default — new customers go through the full setup wizard."
            enabled={orgSettings.customerQuickAdd}
            onChange={v => setOrgSetting("customerQuickAdd", v)}
          />
        </div>
      </Card>
    </div>
  );
}

// ─── Organization ─────────────────────────────────────────
function OrganizationSection() {
  const { organization, orgSettings, updateOrganization } = useHierarchy();
  const [name, setName]   = useState(organization.name);
  const [saved, setSaved] = useState(false);

  // Keep the field in sync if the stored org name loads/changes after mount.
  useEffect(() => { setName(organization.name); }, [organization.name]);

  const dirty = name.trim() !== organization.name && name.trim().length > 0;

  function handleSave() {
    if (!dirty) return;
    updateOrganization({ name: name.trim() });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="space-y-4">
      <SectionHeader title="Organization" subtitle="Top-level account settings for your organization." />
      <Card>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Organization Name</label>
            <input value={name} onChange={e => setName(e.target.value)}
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
          <div className="flex justify-end pt-2">
            <button onClick={handleSave} disabled={!dirty && !saved}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-40"
              style={{ backgroundColor: saved ? "#10b981" : "#4f46e5" }}>
              {saved ? "Saved ✓" : "Save Changes"}
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ─── Companies ────────────────────────────────────────────
function CompaniesSection() {
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
function LocationsSection() {
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
function ServiceAreasSection() {
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

// ─── Settings nav components ──────────────────────────────

function SettingCard({ item, onClick }: { item: SettingItem; onClick: () => void }) {
  const Icon = item.icon;
  return (
    <button onClick={onClick}
      className="flex items-start gap-3 p-4 rounded-xl text-left w-full transition-all group hover:shadow-md"
      style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors"
        style={{ backgroundColor: "var(--bg-surface-2)" }}>
        <Icon className="w-4 h-4" style={{ color: "#4f46e5" }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{item.label}</p>
          {item.phase && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide"
              style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>
              {item.phase}
            </span>
          )}
        </div>
        <p className="text-xs mt-0.5 leading-snug" style={{ color: "var(--text-muted)" }}>{item.description}</p>
      </div>
      <ChevronRight className="w-4 h-4 shrink-0 mt-0.5 opacity-0 group-hover:opacity-40 transition-opacity"
        style={{ color: "var(--text-muted)" }} />
    </button>
  );
}

function SettingsHome({ onNavigate }: {
  onNavigate: (category: CategoryKey, section: SectionKey) => void;
}) {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>Settings</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
          Manage your organization, team, workflow, and integrations.
        </p>
      </div>
      {CATEGORIES.map(cat => (
        <div key={cat.key}>
          <div className="flex items-center gap-2 mb-3">
            <cat.icon className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
            <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{cat.label}</h2>
          </div>
          {/* Responsive auto-fit grid — cards fill the available width and wrap down */}
          <div
            className="grid gap-3"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}
          >
            {cat.items.map(item => (
              <SettingCard key={item.key} item={item} onClick={() => onNavigate(cat.key, item.key)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function CategoryHome({ category, onSelect, onBack }: {
  category: CategoryKey;
  onSelect: (section: SectionKey) => void;
  onBack: () => void;
}) {
  const cat = CATEGORIES.find(c => c.key === category)!;
  const CatIcon = cat.icon;
  return (
    <div className="space-y-6 max-w-3xl">
      <button onClick={onBack}
        className="flex items-center gap-1.5 text-sm transition-colors hover:opacity-80"
        style={{ color: "var(--text-secondary)" }}>
        <ArrowLeft className="w-4 h-4" /> Settings
      </button>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border-subtle)" }}>
          <CatIcon className="w-5 h-5" style={{ color: "#4f46e5" }} />
        </div>
        <div>
          <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>{cat.label}</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>{cat.description}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {cat.items.map(item => (
          <SettingCard key={item.key} item={item} onClick={() => onSelect(item.key)} />
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────
export default function SettingsPage() {
  const [view, setView] = useState<View>({ mode: "home" });

  // ── Navigation helpers ────────────────────────────────────
  function goHome()                                             { setView({ mode: "home" }); }
  function goCategory(c: CategoryKey)                          { setView({ mode: "category", category: c }); }
  function goSection(c: CategoryKey, s: SectionKey)            { setView({ mode: "section", category: c, section: s }); }

  // ── Section renderer ──────────────────────────────────────
  function renderSection(s: SectionKey) {
    switch (s) {
      case "appearance":         return <AppearanceSection />;
      case "business_structure": return <BusinessStructureSection />;
      case "organization":       return <OrganizationSection />;
      case "companies":          return <CompaniesSection />;
      case "locations":          return <LocationsSection />;
      case "service_areas":      return <ServiceAreasSection />;
      case "pipelines":          return <PipelinesSection />;
      case "job_types":          return <JobConfigSection />;
      case "photo_categories":   return <PhotoCategoriesSection />;
      case "calendar_dispatch":  return <CalendarDispatchSection />;
      case "items_categories":   return <ItemsCategoriesSection />;
      case "quote_settings":     return <QuoteSettingsSection />;
      case "quote_templates":    return <QuoteTemplatesSection />;
      case "proposal_builder":   return <ProposalBuilderSection />;
      case "terms_conditions":   return <TermsConditionsSection />;
      case "taxes_fees":         return <TaxesFeesSection />;
      case "dashboards":         return <DashboardsSettingsSection />;
      case "custom_fields":      return <CustomFieldsSection />;
      case "work_orders":    return <WorkOrderTemplatesSection />;
      case "agreements":     return <AgreementsSettingsSection />;
      case "users":          return <UsersSection />;
      case "roles":          return <RolesSection />;
      case "security":       return <ComingSoon label="Security" phase="Phase 1"
        features={["Two-factor authentication","Session management","Audit log","Password policies"]} />;
      case "marketing":      return <MarketingSettingsSection />;
      case "communication":  return <ComingSoon label="Communication" phase="Phase 6"
        features={["Email provider connection","SMS provider connection","Phone system integration","Conversation inbox"]} />;
      case "integrations":   return <ComingSoon label="Integrations" phase="Phase 6"
        features={["Google Ads & LSA","Google Business Profile","Zapier / Make","Payment processing (Stripe)"]} />;
      case "industry":       return <IndustryDefaultsSection />;
      case "billing":        return <ComingSoon label="Billing & Plan" phase="Phase 1"
        features={["Subscription plan and seat count","Billing history","Payment method management","Usage limits"]} />;
      case "import_export":  return <ComingSoon label="Import / Export" phase="Phase 6"
        features={["CSV import for customers, leads, jobs","Export to CSV / Excel","Data backup","Migration from other CRMs"]} />;
      default:               return null;
    }
  }

  // ── Active category for sidebar highlight ──────────────────
  const activeCategory = view.mode !== "home" ? view.category : null;

  // ── Right panel content ───────────────────────────────────
  function renderContent() {
    if (view.mode === "home") {
      return <SettingsHome onNavigate={goSection} />;
    }
    if (view.mode === "category") {
      return (
        <CategoryHome
          category={view.category}
          onSelect={s => goSection(view.category, s)}
          onBack={goHome}
        />
      );
    }
    // Section view — with breadcrumb
    const cat = CATEGORIES.find(c => c.key === view.category)!;
    const item = cat.items.find(i => i.key === view.section)!;
    return (
      <div className="space-y-5">
        {/* Breadcrumb row — Save action sits inline on the right */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-sm min-w-0" style={{ color: "var(--text-muted)" }}>
            <button onClick={goHome}
              className="hover:underline transition-colors"
              style={{ color: "var(--text-secondary)" }}>
              Settings
            </button>
            <ChevronRight className="w-3.5 h-3.5 shrink-0" />
            <button onClick={() => goCategory(view.category)}
              className="hover:underline transition-colors"
              style={{ color: "var(--text-secondary)" }}>
              {cat.label}
            </button>
            <ChevronRight className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate" style={{ color: "var(--text-primary)" }}>{item?.label}</span>
          </div>
          <SettingsSaveSlot />
        </div>
        <EditingScopeHeader sectionLayers={SECTION_LAYERS[view.section] ?? "any"} />
        <SectionGate layers={SECTION_LAYERS[view.section] ?? "any"} title={item?.label ?? "This setting"}>
          {renderSection(view.section)}
        </SectionGate>
      </div>
    );
  }

  return (
    <SettingsScopeProvider>
    <SettingsActionsProvider>
    <div className="flex h-full" style={{ backgroundColor: "var(--bg-page)" }}>
      {/* ── Condensed sidebar — 7 categories only ── */}
      <div
        className="w-44 shrink-0 overflow-y-auto py-5 px-2 flex flex-col gap-0.5"
        style={{ backgroundColor: "var(--bg-surface)", borderRight: "1px solid var(--border-subtle)" }}
      >
        {/* Home / Settings label */}
        <button
          onClick={goHome}
          className="flex items-center gap-2 px-3 py-2 rounded-lg mb-2 w-full text-left transition-colors"
          style={{
            backgroundColor: view.mode === "home" ? "var(--bg-surface-2)" : "transparent",
            color: view.mode === "home" ? "#4f46e5" : "var(--text-muted)",
          }}>
          <Settings2 className="w-3.5 h-3.5 shrink-0" />
          <span className="text-xs font-semibold">Settings</span>
        </button>

        <div className="h-px mx-3 mb-2" style={{ backgroundColor: "var(--border-subtle)" }} />

        {CATEGORIES.map(cat => {
          const isActive = activeCategory === cat.key;
          const Icon = cat.icon;
          return (
            <button key={cat.key} onClick={() => goCategory(cat.key)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors"
              style={{
                backgroundColor: isActive ? "var(--bg-surface-2)" : "transparent",
                color:            isActive ? "#4f46e5"             : "var(--text-secondary)",
              }}>
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span className="text-xs truncate">{cat.label}</span>
              {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />}
            </button>
          );
        })}
      </div>

      {/* ── Right content ── (layer switching lives inside each section's
          Editing Scope header now, not in a global top bar) ── */}
      <div className="flex-1 overflow-y-auto flex flex-col">
        <div className="p-6">
          {renderContent()}
        </div>
      </div>
    </div>
    </SettingsActionsProvider>
    </SettingsScopeProvider>
  );
}
