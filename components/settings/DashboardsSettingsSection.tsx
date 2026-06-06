"use client";

import { useState } from "react";
import {
  LayoutDashboard, Library, Puzzle, Users,
  Eye, EyeOff, CheckCircle, ShieldCheck, Clock,
} from "lucide-react";
import { useHierarchy } from "@/components/providers/HierarchyProvider";
import CustomWidgetsManager from "@/components/settings/custom-widgets/CustomWidgetsManager";
import {
  WIDGET_REGISTRY, CATEGORY_LABELS, CONTEXT_LABELS,
  type WidgetDef, type WidgetCategory, type ContextLevel,
} from "@/lib/dashboard/registry";

// ─── Sub-section types ────────────────────────────────────
type SubSection = "library" | "defaults" | "custom" | "roles";

const SUB_TABS: { key: SubSection; label: string; icon: typeof LayoutDashboard }[] = [
  { key: "library",  label: "Widget Library",     icon: Library },
  { key: "defaults", label: "Dashboard Defaults", icon: LayoutDashboard },
  { key: "custom",   label: "Custom Widgets",      icon: Puzzle },
  { key: "roles",    label: "Role-Based Layouts", icon: Users },
];

// ─── Context level pills ──────────────────────────────────
const CTX_STYLE: Record<ContextLevel, { bg: string; color: string }> = {
  org:          { bg: "#ede9fe", color: "#5b21b6" },
  company:      { bg: "#e0e7ff", color: "#3730a3" },
  location:     { bg: "#dbeafe", color: "#1e40af" },
  service_area: { bg: "#d1fae5", color: "#065f46" },
};

const SIZE_LABEL: Record<string, string> = {
  full: "Full", wide: "Wide", narrow: "Narrow",
};

// ─── Phase 2 placeholder ──────────────────────────────────
function Phase2Card({ title, features }: { title: string; features: string[] }) {
  return (
    <div className="rounded-xl p-5 space-y-4"
      style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{title}</p>
        <span className="flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-full"
          style={{ backgroundColor: "var(--bg-surface-2)", color: "var(--text-muted)", border: "1px solid var(--border-subtle)" }}>
          <Clock className="w-3 h-3" /> Coming in Phase 2
        </span>
      </div>
      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
        This feature is planned and will be built in Phase 2. You have the required permissions to use it when ready.
      </p>
      <ul className="space-y-1.5 pt-1" style={{ borderTop: "1px solid var(--border-subtle)" }}>
        {features.map(f => (
          <li key={f} className="flex items-start gap-2 pt-1.5">
            <div className="w-1 h-1 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: "var(--text-muted)" }} />
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{f}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Widget Library ───────────────────────────────────────
const CATEGORY_ORDER: WidgetCategory[] = ["operations", "sales", "financial", "activity"];

function WidgetLibraryTab() {
  const [disabledIds, setDisabledIds] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setDisabledIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const grouped = CATEGORY_ORDER.reduce<Partial<Record<WidgetCategory, WidgetDef[]>>>((acc, cat) => {
    acc[cat] = WIDGET_REGISTRY.filter(w => w.category === cat);
    return acc;
  }, {});

  const enabledCount  = WIDGET_REGISTRY.length - disabledIds.size;
  const disabledCount = disabledIds.size;

  return (
    <div className="space-y-4">
      {/* Clear admin confirmation — not a warning */}
      <div className="rounded-xl px-4 py-3 flex items-center justify-between gap-4"
        style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-4 h-4 shrink-0" style={{ color: "#10b981" }} />
          <div>
            <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
              You are managing this library as Organization Admin
            </p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              Disable widgets here to remove them from the Add Widget panel for all users.
            </p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs font-semibold" style={{ color: "#4f46e5" }}>{enabledCount} active</p>
          {disabledCount > 0 && (
            <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{disabledCount} disabled</p>
          )}
        </div>
      </div>

      {/* Widget groups */}
      {CATEGORY_ORDER.map(cat => {
        const widgets = grouped[cat] ?? [];
        if (widgets.length === 0) return null;
        return (
          <div key={cat} className="rounded-xl overflow-hidden"
            style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
            <div className="px-4 py-2.5"
              style={{ borderBottom: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-surface-2)" }}>
              <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                {CATEGORY_LABELS[cat]}
              </p>
            </div>
            <div className="grid px-4 py-2 text-[10px] font-semibold uppercase tracking-wider"
              style={{ gridTemplateColumns: "2fr 3fr 1fr 2fr 1fr 0.8fr", color: "var(--text-muted)", borderBottom: "1px solid var(--border-subtle)" }}>
              <span>Widget</span>
              <span>Description</span>
              <span>Size</span>
              <span>Contexts</span>
              <span>Roles</span>
              <span className="text-center">Active</span>
            </div>
            {widgets.map((w, i) => {
              const isDisabled = disabledIds.has(w.id);
              return (
                <div key={w.id}
                  className="grid px-4 py-3 items-center hover:bg-[var(--bg-surface-2)] transition-colors"
                  style={{
                    gridTemplateColumns: "2fr 3fr 1fr 2fr 1fr 0.8fr",
                    borderBottom: i < widgets.length - 1 ? "1px solid var(--border-subtle)" : "none",
                    opacity: isDisabled ? 0.45 : 1,
                  }}>
                  <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{w.title}</p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>{w.description}</p>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full inline-block w-fit"
                    style={{ backgroundColor: "var(--bg-input)", color: "var(--text-secondary)" }}>
                    {SIZE_LABEL[w.defaultSize]}
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {w.allowedContexts.map(ctx => {
                      const s = CTX_STYLE[ctx];
                      return (
                        <span key={ctx} className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
                          style={{ backgroundColor: s.bg, color: s.color }}>
                          {CONTEXT_LABELS[ctx]}
                        </span>
                      );
                    })}
                  </div>
                  <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                    {w.allowedRoles.length === 0 ? "All roles" : w.allowedRoles.map(r =>
                      r === "org_admin" ? "Admin" :
                      r === "branch_manager" ? "Branch Mgr" :
                      r === "location_manager" ? "Manager" : r
                    ).join(", ")}
                  </span>
                  <div className="flex justify-center">
                    <button onClick={() => toggle(w.id)}
                      className="p-1.5 rounded-lg transition-colors hover:bg-[var(--bg-input)]"
                      title={isDisabled ? "Enable widget" : "Disable widget"}
                      style={{ color: isDisabled ? "var(--text-muted)" : "#4f46e5" }}>
                      {isDisabled ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// ─── Section ──────────────────────────────────────────────
export default function DashboardsSettingsSection() {
  const { userName, userRole, userInitials } = useHierarchy();
  const [sub, setSub] = useState<SubSection>("library");

  return (
    <div className="space-y-5">
      {/* Header with confirmed role */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
            Dashboards &amp; Widgets
          </h2>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            Manage the widget library, dashboard defaults, and custom widget creation.
          </p>
        </div>
        {/* Confirmed role badge */}
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl shrink-0"
          style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
          <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
            {userInitials}
          </div>
          <div className="text-right">
            <p className="text-[10px] font-semibold" style={{ color: "var(--text-primary)" }}>{userName}</p>
            <p className="text-[10px] flex items-center gap-1" style={{ color: "#10b981" }}>
              <CheckCircle className="w-3 h-3" /> {userRole}
            </p>
          </div>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex items-center gap-1 border-b" style={{ borderColor: "var(--border-subtle)" }}>
        {SUB_TABS.map(t => {
          const active = sub === t.key;
          const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => setSub(t.key)}
              className="relative flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors"
              style={{ color: active ? "#4f46e5" : "var(--text-muted)" }}>
              <Icon className="w-3.5 h-3.5 shrink-0" />
              {t.label}
              {active && <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t bg-indigo-600" />}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {sub === "library" && <WidgetLibraryTab />}

      {sub === "defaults" && (
        <Phase2Card
          title="Dashboard Defaults"
          features={[
            "Set the default widget layout per user role",
            "Org admin → executive overview with company performance",
            "Location manager → today's jobs, urgent items, technician schedule",
            "Employee → my jobs, my tasks, my open work orders",
            "Defaults apply to new users who haven't customized their layout yet",
          ]}
        />
      )}

      {sub === "custom" && <CustomWidgetsManager />}

      {sub === "roles" && (
        <Phase2Card
          title="Role-Based Layouts"
          features={[
            "Assign a specific default dashboard layout to each role",
            "Org admin: executive overview — company performance, revenue, pipeline",
            "Company admin: location performance, open quotes, revenue snapshot",
            "Location manager: today's jobs, work orders, tasks, urgent items",
            "Employee: my jobs today, my tasks, my assigned work orders",
            "Users can still personalize their layout within the approved widget library",
          ]}
        />
      )}
    </div>
  );
}
