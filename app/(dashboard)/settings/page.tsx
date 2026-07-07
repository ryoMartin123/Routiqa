"use client";

import { useState } from "react";
import Link from "next/link";
import {
  TrendingUp, Briefcase, FolderKanban, ClipboardList,
  FileText, Image as ImageIcon, MessageSquare,
  Sliders, ChevronRight, Settings2, ArrowLeft,
  CalendarClock, ListChecks, Package, Tag, Percent, BookOpen, Factory, Gauge,
  ShieldCheck, ExternalLink, Navigation, LayoutDashboard,
} from "lucide-react";
import dynamic from "next/dynamic";

// Heavy sections are lazy-loaded: only one renders at a time (see renderSection),
// so each is split into its own chunk that loads on demand. This keeps the
// initial /settings bundle small and the route fast to open.
//
// NOTE: This page is now CRM WORKFLOW configuration only. Platform-wide
// administration — organization, companies, locations, users, roles,
// permissions, security, billing, and platform integrations — moved to the
// Admin app (see the banner on the settings home).
const SectionLoading = () => (
  <div className="p-6 text-sm" style={{ color: "var(--text-muted)" }}>Loading…</div>
);
const CustomFieldsSection       = dynamic(() => import("@/components/settings/CustomFieldsSection"),       { loading: SectionLoading, ssr: false });
const PipelinesSection          = dynamic(() => import("@/components/settings/PipelinesSection"),          { loading: SectionLoading, ssr: false });
const JobConfigSection          = dynamic(() => import("@/components/settings/JobConfigSection"),          { loading: SectionLoading, ssr: false });
const ProjectsSection           = dynamic(() => import("@/components/settings/ProjectsSection"),           { loading: SectionLoading, ssr: false });
const WorkOrderTemplatesSection = dynamic(() => import("@/components/settings/WorkOrderTemplatesSection"), { loading: SectionLoading, ssr: false });
const PhotoCategoriesSection    = dynamic(() => import("@/components/settings/PhotoCategoriesSection"),    { loading: SectionLoading, ssr: false });
const IndustryDefaultsSection   = dynamic(() => import("@/components/settings/IndustryDefaultsSection"),   { loading: SectionLoading, ssr: false });
const CalendarDispatchSection   = dynamic(() => import("@/components/settings/CalendarDispatchSection"),   { loading: SectionLoading, ssr: false });
const TrackingSection           = dynamic(() => import("@/components/settings/TrackingSection"),           { loading: SectionLoading, ssr: false });
const DashboardLayoutsSection   = dynamic(() => import("@/components/settings/DashboardLayoutsSection"),   { loading: SectionLoading, ssr: false });
const TasksSettingsSection      = dynamic(() => import("@/components/settings/TasksSettingsSection"),      { loading: SectionLoading, ssr: false });
const ItemsCategoriesSection    = dynamic(() => import("@/components/settings/ItemsCategoriesSection"),    { loading: SectionLoading, ssr: false });
const SalesbookLibrarySection   = dynamic(() => import("@/components/settings/SalesbookLibrarySection"),   { loading: SectionLoading, ssr: false });
const TermsConditionsSection    = dynamic(() => import("@/components/settings/TermsConditionsSection"),    { loading: SectionLoading, ssr: false });
const TaxesFeesSection          = dynamic(() => import("@/components/settings/TaxesFeesSection"),          { loading: SectionLoading, ssr: false });
const AgreementsSettingsSection = dynamic(() => import("@/components/settings/AgreementsSettingsSection"), { loading: SectionLoading, ssr: false });
const ReferenceSection          = dynamic(() => import("@/components/settings/ReferenceSection"),          { loading: SectionLoading, ssr: false });
const UsageSection              = dynamic(() => import("@/components/settings/UsageSection"),              { loading: SectionLoading, ssr: false });
import { SettingsScopeProvider } from "@/components/providers/SettingsScopeProvider";
import SectionGate from "@/components/settings/SectionGate";
import EditingScopeHeader from "@/components/settings/EditingScopeHeader";
import { SettingsActionsProvider } from "@/components/settings/SettingsActions";
import type { SectionLayers } from "@/lib/settings-scope/types";
import Commentable from "@/components/comments/Commentable";

// ─── Navigation structure (CRM workflow only) ─────────────
type SectionKey =
  | "pipelines" | "job_types" | "projects" | "work_orders" | "tasks" | "photo_categories" | "calendar_dispatch" | "tracking" | "agreements"
  | "items_categories" | "salesbook_library" | "terms_conditions" | "taxes_fees"
  | "communication"
  | "industry" | "custom_fields" | "dashboard_layouts" | "reference" | "usage";

type CategoryKey =
  | "operations" | "sales_catalog" | "customization" | "communication" | "account";

// View modes — drives what the right panel renders
type View =
  | { mode: "home" }
  | { mode: "category"; category: CategoryKey }
  | { mode: "section"; category: CategoryKey; section: SectionKey; sub?: { key: string; label: string } | null };

// Props a hub section needs to drive its container/module sub-navigation.
type HubProps = { activeModule: string | null; onOpen: (key: string, label: string) => void; onBack: () => void };

interface SettingItem {
  key:         SectionKey;
  label:       string;
  description: string;
  icon:        typeof TrendingUp;
}

interface Category {
  key:         CategoryKey;
  label:       string;
  description: string;
  icon:        typeof TrendingUp;
  items:       SettingItem[];
}

const CATEGORIES: Category[] = [
  {
    key: "operations", label: "Operations",
    description: "Pipelines, job types, work orders, and agreements",
    icon: Briefcase,
    items: [
      { key: "pipelines",        label: "Pipelines",            description: "Lead pipeline stages and order",                 icon: TrendingUp },
      { key: "job_types",        label: "Job Types",            description: "Job categories, colors, and work-order policy",  icon: Briefcase },
      { key: "projects",         label: "Projects",             description: "Project pipeline stages, types, templates, and defaults", icon: FolderKanban },
      { key: "work_orders",      label: "Work Orders",          description: "Checklist templates and field instructions",     icon: ClipboardList },
      { key: "tasks",            label: "Tasks & Comments",     description: "Task types, defaults, and contextual-comment behavior", icon: ListChecks },
      { key: "photo_categories", label: "Photo Categories",     description: "Categories for job and property photos",         icon: ImageIcon },
      { key: "calendar_dispatch",label: "Calendar / Dispatch",  description: "Default view, hours, service blocks, and boards", icon: CalendarClock },
      { key: "tracking",         label: "Tracking",             description: "Technician GPS routes and location history (last 30 days)", icon: Navigation },
      { key: "agreements",       label: "Agreements",           description: "Plan templates, types, visit & billing rules, benefits, terms", icon: FileText },
    ],
  },
  {
    key: "sales_catalog", label: "Sales & Catalog",
    description: "Items, quote behavior, templates, terms, and taxes",
    icon: Package,
    items: [
      { key: "items_categories", label: "Items & Categories", description: "Catalog item types, categories, and item defaults", icon: Tag },
      { key: "salesbook_library",label: "Proposal Library",   description: "Proposal templates, designs, offers, media, content blocks, branding & defaults", icon: BookOpen },
      { key: "terms_conditions", label: "Terms & Conditions", description: "Reusable terms blocks for quotes and invoices",     icon: FileText },
      { key: "taxes_fees",       label: "Taxes & Fees",       description: "Default tax rate, taxable types, and fees",         icon: Percent },
    ],
  },
  {
    key: "customization", label: "Customization",
    description: "Custom fields and industry templates",
    icon: Sliders,
    items: [
      { key: "industry",       label: "Industry Defaults",    description: "Default pipeline, job types, and fields by industry", icon: Factory },
      { key: "custom_fields",  label: "Custom Fields",        description: "Add custom fields to any record type",                icon: Sliders },
      { key: "dashboard_layouts", label: "Dashboard Layouts", description: "Save, apply, and import dashboard layout templates",  icon: LayoutDashboard },
      { key: "reference",       label: "Reference",            description: "How the system works — job status lifecycle and record model", icon: BookOpen },
    ],
  },
  {
    key: "communication", label: "Communication",
    description: "CRM email, SMS, and phone messaging",
    icon: MessageSquare,
    items: [
      { key: "communication", label: "Communication",       description: "CRM email, SMS, and phone usage settings", icon: MessageSquare },
    ],
  },
  {
    key: "account", label: "Account",
    description: "Plan, metered usage, and billing",
    icon: Gauge,
    items: [
      { key: "usage", label: "Plan & Usage", description: "Storage, SMS, voice, email, and AI usage against your plan", icon: Gauge },
    ],
  },
];

// ─── Which hierarchy layer each section is edited at ──────
const SECTION_LAYERS: Record<SectionKey, SectionLayers> = {
  pipelines:          ["org", "company", "location"],
  job_types:          ["org", "company", "location"],
  projects:           ["org", "company", "location"],
  work_orders:        ["org", "company"],
  tasks:              "any",
  photo_categories:   ["org", "company"],
  calendar_dispatch:  ["org", "company", "location"],
  tracking:           "any",
  agreements:         ["org", "company"],
  items_categories:   ["org", "company"],
  salesbook_library:  ["org", "company"],
  terms_conditions:   ["org", "company"],
  taxes_fees:         ["org", "company", "location"],
  communication:      ["org", "company"],
  industry:           ["org", "company"],
  custom_fields:      ["org", "company"],
  dashboard_layouts:  "any",
  reference:          "any",
  usage:              "any",
};

// Sections that render as a hub: a container picker first, then the chosen
// container's tabs.
const HUB_SECTIONS = new Set<SectionKey>(["agreements", "calendar_dispatch", "salesbook_library"]);

// ─── Shared primitives ────────────────────────────────────
function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-5"
      style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
      {children}
    </div>
  );
}

function ComingSoon({ label, features }: { label: string; features: string[] }) {
  return (
    <Card>
      <p className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>{label}</p>
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

// ─── Settings nav components ──────────────────────────────
function SettingCard({ item, onClick }: { item: SettingItem; onClick: () => void }) {
  const Icon = item.icon;
  return (
    <button onClick={onClick}
      className="flex items-start gap-3 p-4 rounded-xl text-left w-full transition-all group hover:shadow-md"
      style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors"
        style={{ backgroundColor: "var(--bg-surface-2)" }}>
        <Icon className="w-4 h-4" style={{ color: "#0f8578" }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{item.label}</p>
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
        <p className="text-[13px] mt-0.5 leading-snug" style={{ color: "var(--text-muted)" }}>
          Configure CRM workflows, templates, statuses, and defaults.
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
    <div className="space-y-6">
      <button onClick={onBack}
        className="flex items-center gap-1.5 text-sm transition-colors hover:opacity-80"
        style={{ color: "var(--text-secondary)" }}>
        <ArrowLeft className="w-4 h-4" /> Settings
      </button>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border)" }}>
          <CatIcon className="w-5 h-5" style={{ color: "#0f8578" }} />
        </div>
        <div>
          <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>{cat.label}</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>{cat.description}</p>
        </div>
      </div>
      {/* Responsive auto-fill grid — cards fill the available width and wrap row by row */}
      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
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
  function goSection(c: CategoryKey, s: SectionKey)            { setView({ mode: "section", category: c, section: s, sub: null }); }

  // ── Section renderer ──────────────────────────────────────
  function renderSection(s: SectionKey, hubProps?: HubProps) {
    switch (s) {
      case "pipelines":          return <PipelinesSection />;
      case "job_types":          return <JobConfigSection />;
      case "projects":           return <ProjectsSection />;
      case "photo_categories":   return <PhotoCategoriesSection />;
      case "calendar_dispatch":  return <CalendarDispatchSection
        activeModule={hubProps?.activeModule ?? null}
        onOpen={hubProps?.onOpen ?? (() => {})}
        onBack={hubProps?.onBack ?? (() => {})} />;
      case "tasks":              return <TasksSettingsSection />;
      case "items_categories":   return <ItemsCategoriesSection />;
      case "salesbook_library":  return <SalesbookLibrarySection
        activeModule={hubProps?.activeModule ?? null}
        onOpen={hubProps?.onOpen ?? (() => {})}
        onBack={hubProps?.onBack ?? (() => {})} />;
      case "terms_conditions":   return <TermsConditionsSection />;
      case "taxes_fees":         return <TaxesFeesSection />;
      case "custom_fields":      return <CustomFieldsSection />;
      case "work_orders":        return <WorkOrderTemplatesSection />;
      case "agreements":         return <AgreementsSettingsSection
        activeModule={hubProps?.activeModule ?? null}
        onOpen={hubProps?.onOpen ?? (() => {})}
        onBack={hubProps?.onBack ?? (() => {})} />;
      case "communication":      return <ComingSoon label="Communication"
        features={["Email provider usage", "SMS provider usage", "Phone / dispatch integration usage", "Conversation inbox"]} />;
      case "tracking":           return <TrackingSection />;
      case "dashboard_layouts":  return <DashboardLayoutsSection />;
      case "industry":           return <IndustryDefaultsSection />;
      case "reference":          return <ReferenceSection />;
      case "usage":              return <UsageSection />;
      default:                   return null;
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
    const sub = view.sub ?? null;
    const clearSub = () => setView(v => v.mode === "section" ? { ...v, sub: null } : v);
    // Hub sections drill into a container — a 4th breadcrumb level + dedicated
    // page. On the picker (no container open) there's nothing scope-specific yet,
    // so the scope header + gate stay hidden.
    const isHub = HUB_SECTIONS.has(view.section);
    const onPicker = isHub && !sub;
    // Read-only viewers (not per-layer config) skip the scope header + edit gate.
    const isViewer = view.section === "tracking" || view.section === "dashboard_layouts";
    const hubProps: HubProps | undefined = isHub ? {
      activeModule: sub?.key ?? null,
      onOpen: (key, label) => setView(v => v.mode === "section" ? { ...v, sub: { key, label } } : v),
      onBack: clearSub,
    } : undefined;
    return (
      <div className="space-y-5">
        {/* Breadcrumb row */}
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
            {sub ? (
              <>
                <button onClick={clearSub} className="hover:underline transition-colors truncate" style={{ color: "var(--text-secondary)" }}>{item?.label}</button>
                <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate" style={{ color: "var(--text-primary)" }}>{sub.label}</span>
              </>
            ) : (
              <span className="truncate" style={{ color: "var(--text-primary)" }}>{item?.label}</span>
            )}
          </div>
        </div>
        {!onPicker && !isViewer && <EditingScopeHeader sectionLayers={SECTION_LAYERS[view.section] ?? "any"} />}
        <Commentable anchor={{ recordType: "settings", recordId: view.section, recordLabel: item?.label ?? "Settings" }}>
          {onPicker || isViewer
            ? renderSection(view.section, hubProps)
            : (
              <SectionGate layers={SECTION_LAYERS[view.section] ?? "any"} title={item?.label ?? "This setting"}>
                {renderSection(view.section, hubProps)}
              </SectionGate>
            )}
        </Commentable>
      </div>
    );
  }

  return (
    <SettingsScopeProvider>
    <SettingsActionsProvider>
    <div className="flex h-full" style={{ backgroundColor: "var(--bg-page)" }}>
      {/* ── Condensed category sidebar ── */}
      <div
        className="w-44 shrink-0 overflow-y-auto py-5 px-2 flex flex-col gap-0.5"
        style={{ backgroundColor: "var(--bg-surface)", borderRight: "1px solid var(--border)" }}
      >
        {/* Home / Settings label */}
        <button
          onClick={goHome}
          className="flex items-center gap-2 px-3 py-2 rounded-lg mb-2 w-full text-left text-xs font-semibold transition-colors"
          style={{
            backgroundColor: view.mode === "home" ? "var(--accent-soft-bg)"     : "transparent",
            color:           view.mode === "home" ? "var(--accent-text-strong)" : "var(--text-muted)",
            border:          `1px solid ${view.mode === "home" ? "var(--accent-soft-border)" : "transparent"}`,
          }}>
          <Settings2 className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">Settings</span>
        </button>

        <div className="h-px mx-3 mb-2" style={{ backgroundColor: "var(--border-subtle)" }} />

        {CATEGORIES.map(cat => {
          const isActive = activeCategory === cat.key;
          const Icon = cat.icon;
          return (
            <button key={cat.key} onClick={() => goCategory(cat.key)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-left transition-colors"
              style={{
                backgroundColor: isActive ? "var(--accent-soft-bg)"      : "transparent",
                color:           isActive ? "var(--accent-text-strong)"  : "var(--text-secondary)",
                border:          `1px solid ${isActive ? "var(--accent-soft-border)" : "transparent"}`,
              }}>
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span className="flex-1 truncate">{cat.label}</span>
            </button>
          );
        })}

        {/* Platform administration lives in the Admin app — quiet pointer at the
            bottom of the rail rather than a banner at the top. */}
        <div className="mt-auto pt-2">
          <div className="h-px mx-3 mb-2" style={{ backgroundColor: "var(--border-subtle)" }} />
          <Link href="/admin"
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-left transition-colors hover:bg-[var(--bg-surface-2)]"
            style={{ color: "var(--text-secondary)" }}>
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" style={{ color: "#a855f7" }} />
            <span className="flex-1 truncate">Platform Admin</span>
            <ExternalLink className="w-3 h-3 shrink-0 opacity-50" />
          </Link>
          <p className="text-[10px] px-3 mt-1 leading-snug" style={{ color: "var(--text-muted)" }}>
            Users, roles, billing &amp; structure
          </p>
        </div>
      </div>

      {/* ── Right content ── */}
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
