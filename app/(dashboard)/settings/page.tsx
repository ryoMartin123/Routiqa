"use client";

import { Sun, Moon, Building2, MapPin, Map, Check } from "lucide-react";
import { useTheme } from "@/components/providers/ThemeProvider";
import { useHierarchy } from "@/components/providers/HierarchyProvider";
import type { HierarchyMode, OrgSettings } from "@/lib/hierarchy/types";

// ─── Business structure mode definitions ──────────────────
const MODES: {
  key: HierarchyMode;
  label: string;
  description: string;
  features: string[];
  layers: { icon: typeof Building2; label: string; enabled: boolean }[];
}[] = [
  {
    key: "simple",
    label: "Simple",
    description: "One company, one location. No selectors shown.",
    features: ["Ideal for solo operators and single-office businesses"],
    layers: [
      { icon: Building2, label: "Company",      enabled: false },
      { icon: MapPin,    label: "Location",     enabled: false },
      { icon: Map,       label: "Service Areas", enabled: false },
    ],
  },
  {
    key: "multi_location",
    label: "Multi-Location",
    description: "One company, multiple branches or offices.",
    features: ["Location selector shown in top bar", "Filter data by branch"],
    layers: [
      { icon: Building2, label: "Company",      enabled: false },
      { icon: MapPin,    label: "Location",     enabled: true  },
      { icon: Map,       label: "Service Areas", enabled: false },
    ],
  },
  {
    key: "multi_company",
    label: "Multi-Company",
    description: "Multiple brands or business units under one organization.",
    features: ["Company + location selectors shown", "Separate dashboards per company"],
    layers: [
      { icon: Building2, label: "Company",      enabled: true  },
      { icon: MapPin,    label: "Location",     enabled: true  },
      { icon: Map,       label: "Service Areas", enabled: false },
    ],
  },
  {
    key: "advanced_territory",
    label: "Advanced Territory",
    description: "Full hierarchy with service areas and territory management.",
    features: ["All selectors active", "Territory-level filtering for leads, jobs, and campaigns"],
    layers: [
      { icon: Building2, label: "Company",      enabled: true },
      { icon: MapPin,    label: "Location",     enabled: true },
      { icon: Map,       label: "Service Areas", enabled: true },
    ],
  },
];

const SETTING_SECTIONS = [
  "Organization",
  "Companies & Locations",
  "Users & Roles",
  "Notifications",
  "Integrations",
];

export default function SettingsPage() {
  const { theme, setTheme }         = useTheme();
  const { orgSettings, setOrgMode } = useHierarchy();

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>
          Settings
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
          Manage your organization and preferences
        </p>
      </div>

      {/* ── Appearance ─────────────────────────────────── */}
      <Section title="Appearance" subtitle="Choose your preferred color theme">
        <div className="flex gap-3">
          {(
            [
              { key: "light", label: "Light", Icon: Sun },
              { key: "dark",  label: "Dark",  Icon: Moon },
            ] as const
          ).map(({ key, label, Icon }) => {
            const active = theme === key;
            return (
              <button
                key={key}
                onClick={() => setTheme(key)}
                className="flex-1 flex flex-col items-center gap-3 py-5 rounded-xl transition-all"
                style={{
                  border: `2px solid ${active ? "#4f46e5" : "var(--border)"}`,
                  backgroundColor: "var(--bg-surface-2)",
                }}
              >
                <Icon className="w-5 h-5" style={{ color: active ? "#4f46e5" : "var(--text-muted)" }} />
                <span
                  className="text-sm font-medium"
                  style={{ color: active ? "#4f46e5" : "var(--text-secondary)" }}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </Section>

      {/* ── Business Structure ──────────────────────────── */}
      <Section
        title="Business Structure"
        subtitle="Controls which hierarchy layers are visible in the context selector. Change this as your organization grows."
      >
        <div className="grid grid-cols-2 gap-3">
          {MODES.map((mode) => {
            const active = orgSettings.mode === mode.key;
            return (
              <button
                key={mode.key}
                onClick={() => setOrgMode(mode.key)}
                className="flex flex-col text-left p-4 rounded-xl transition-all"
                style={{
                  border: `2px solid ${active ? "#4f46e5" : "var(--border)"}`,
                  backgroundColor: active ? "#f5f3ff" : "var(--bg-surface-2)",
                }}
              >
                {/* Mode header */}
                <div className="flex items-center justify-between mb-2">
                  <span
                    className="text-sm font-semibold"
                    style={{ color: active ? "#4f46e5" : "var(--text-primary)" }}
                  >
                    {mode.label}
                  </span>
                  {active && (
                    <span className="w-4 h-4 rounded-full bg-indigo-600 flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 text-white" />
                    </span>
                  )}
                </div>

                {/* Description */}
                <p className="text-xs mb-3" style={{ color: "var(--text-secondary)" }}>
                  {mode.description}
                </p>

                {/* Layer indicators */}
                <div className="flex flex-col gap-1">
                  {mode.layers.map(({ icon: Icon, label, enabled }) => (
                    <div key={label} className="flex items-center gap-1.5">
                      <Icon
                        className="w-3 h-3 shrink-0"
                        style={{ color: enabled ? "#10b981" : "var(--text-muted)" }}
                      />
                      <span
                        className="text-[10px]"
                        style={{
                          color: enabled ? "var(--text-secondary)" : "var(--text-muted)",
                          textDecoration: enabled ? "none" : "line-through",
                        }}
                      >
                        {label}
                      </span>
                    </div>
                  ))}
                </div>
              </button>
            );
          })}
        </div>

        <p className="text-[11px] mt-3" style={{ color: "var(--text-muted)" }}>
          The context selector in the top bar adapts immediately. In production, this setting is stored per organization and respects user access grants.
        </p>
      </Section>

      {/* ── Placeholder sections ────────────────────────── */}
      {SETTING_SECTIONS.map((s) => (
        <Section key={s} title={s} subtitle="Coming in Phase 1">
          <div />
        </Section>
      ))}
    </div>
  );
}

// ─── Reusable section wrapper ─────────────────────────────
function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl p-6"
      style={{
        backgroundColor: "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <h2 className="text-sm font-semibold mb-0.5" style={{ color: "var(--text-primary)" }}>
        {title}
      </h2>
      <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
        {subtitle}
      </p>
      {children}
    </div>
  );
}
