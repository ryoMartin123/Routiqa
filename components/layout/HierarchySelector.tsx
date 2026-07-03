"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Globe, Building2, MapPin, Map, ChevronDown, Check } from "lucide-react";
import { useHierarchy } from "@/components/providers/HierarchyProvider";
import type { SelectionValue } from "@/lib/hierarchy/types";

// ─── Pages that show the full context selector ────────────
const OPERATIONAL_PREFIXES = [
  "/dashboard", "/inbox", "/customers", "/leads", "/jobs", "/projects",
  "/quotes", "/invoices", "/items",
  "/tasks", "/dispatching", "/calendar", "/files", "/agreements", "/marketing", "/analytics",
  // Platform apps that filter by the active company/location context. Portal
  // (self-service) and Admin (platform-wide management) intentionally omitted.
  "/hr", "/accounting", "/documents", "/team-workspace", "/inventory",
];

function isOperational(pathname: string) {
  return OPERATIONAL_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
}

// ─── Panel section ────────────────────────────────────────
function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Building2;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ borderBottom: "1px solid var(--border)" }}>
      <div
        className="flex items-center gap-1.5 px-4 py-2"
        style={{ backgroundColor: "var(--bg-surface-2)" }}
      >
        <Icon className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
        <span
          className="text-[10px] font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-muted)" }}
        >
          {title}
        </span>
      </div>
      <div className="py-0.5">{children}</div>
    </div>
  );
}

// ─── Single option row ────────────────────────────────────
function Option({
  value,
  current,
  label,
  onSelect,
}: {
  value: SelectionValue;
  current: SelectionValue;
  label: string;
  onSelect: (v: SelectionValue) => void;
}) {
  const active = value === current;
  return (
    <button
      onClick={() => onSelect(value)}
      className="w-full flex items-center justify-between px-4 py-1.5 text-sm transition-colors"
      style={{
        color: active ? "#4f46e5" : "var(--text-primary)",
        backgroundColor: active ? "var(--bg-surface-2)" : "transparent",
      }}
    >
      <span style={{ fontWeight: active ? 600 : 400 }}>{label}</span>
      {active && <Check className="w-3.5 h-3.5 shrink-0 text-indigo-600" />}
    </button>
  );
}

// ─── Main export ──────────────────────────────────────────
export default function HierarchySelector() {
  const pathname  = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const {
    organization,
    company, location, serviceArea,
    setCompany, setLocation, setServiceArea,
    companyOptions, locationOptions, serviceAreaOptions,
    showCompanySelector, showLocationSelector, showServiceAreaSelector,
  } = useHierarchy();

  // Close panel on outside click
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Hide entirely on non-operational pages (settings, profile, billing, etc.)
  if (!isOperational(pathname)) return null;

  // ── Simple mode: no selectors — show a static context label ───
  const noSelectors = !showCompanySelector && !showLocationSelector && !showServiceAreaSelector;
  if (noSelectors) {
    const singleCompany  = companyOptions[0];
    const singleLocation = locationOptions[0];
    const label = singleLocation?.name ?? singleCompany?.name ?? organization.name;
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 min-w-0">
        <Globe className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
        <span className="text-[10px] font-semibold shrink-0" style={{ color: "var(--text-muted)" }}>Viewing</span>
        <span className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{label}</span>
      </div>
    );
  }

  // ── Build breadcrumb label ─────────────────────────────
  const selectedCompany     = companyOptions.find((c) => c.id === company);
  const selectedLocation    = locationOptions.find((l) => l.id === location);
  const selectedServiceArea = serviceAreaOptions.find((s) => s.id === serviceArea);

  // Each crumb: { label, dim } — dim=true when it's an "All …" placeholder
  type Crumb = { label: string; dim: boolean };
  const crumbs: Crumb[] = [];

  if (showCompanySelector) {
    crumbs.push(
      selectedCompany
        ? { label: selectedCompany.name, dim: false }
        : { label: "All Companies", dim: true }
    );
  }
  if (showLocationSelector) {
    crumbs.push(
      selectedLocation
        ? { label: selectedLocation.name, dim: false }
        : { label: "All Locations", dim: true }
    );
  }
  if (selectedServiceArea) {
    crumbs.push({ label: selectedServiceArea.name, dim: false });
  }

  // Fall back to org name when user can't narrow anything
  const isEmpty = crumbs.length === 0;

  return (
    <div ref={ref} className="relative min-w-0">
      {/* ── Trigger button ────────────────────────────── */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all min-w-0 max-w-full overflow-hidden"
        style={{
          backgroundColor: open ? "var(--bg-surface-2)" : "var(--bg-input)",
          border: `1px solid ${open ? "var(--border)" : "transparent"}`,
        }}
      >
        <Globe className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />

        <span
          className="text-[10px] font-semibold mr-0.5"
          style={{ color: "var(--text-muted)" }}
        >
          Viewing
        </span>

        {/* Breadcrumb path */}
        {isEmpty ? (
          <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            {organization.name}
          </span>
        ) : (
          <span className="flex items-center gap-1 min-w-0 whitespace-nowrap overflow-hidden">
            {crumbs.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && (
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    ›
                  </span>
                )}
                <span
                  className="text-sm"
                  style={{
                    color: crumb.dim ? "var(--text-muted)" : "var(--text-primary)",
                    fontWeight: i === crumbs.length - 1 && !crumb.dim ? 600 : 400,
                  }}
                >
                  {crumb.label}
                </span>
              </span>
            ))}
          </span>
        )}

        <ChevronDown
          className="w-3.5 h-3.5 shrink-0 transition-transform"
          style={{
            color: "var(--text-muted)",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        />
      </button>

      {/* ── Dropdown panel ────────────────────────────── */}
      {open && (
        <div
          className="absolute top-full left-0 mt-2 rounded-xl overflow-hidden z-50"
          style={{
            width: "280px",
            backgroundColor: "var(--bg-surface)",
            border: "1px solid var(--border)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.14)",
          }}
        >
          {/* Organization — fixed header, not selectable */}
          <div
            className="flex items-center gap-2.5 px-4 py-3"
            style={{
              borderBottom: "1px solid var(--border)",
              backgroundColor: "var(--bg-surface-2)",
            }}
          >
            <Globe className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
            <div>
              <p
                className="text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: "var(--text-muted)" }}
              >
                Organization
              </p>
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                {organization.name}
              </p>
            </div>
          </div>

          {/* Company */}
          {showCompanySelector && (
            <Section icon={Building2} title="Company">
              <Option value="all" current={company} label="All Companies" onSelect={setCompany} />
              {companyOptions.map((c) => (
                <Option key={c.id} value={c.id} current={company} label={c.name} onSelect={setCompany} />
              ))}
            </Section>
          )}

          {/* Location */}
          {showLocationSelector && (
            <Section icon={MapPin} title="Location">
              <Option value="all" current={location} label="All Locations" onSelect={setLocation} />
              {locationOptions.map((l) => (
                <Option key={l.id} value={l.id} current={location} label={l.name} onSelect={setLocation} />
              ))}
            </Section>
          )}

          {/* Service Area — only appears when a specific location is pinned */}
          {showServiceAreaSelector && (
            <Section icon={Map} title="Service Area">
              <Option value="all" current={serviceArea} label="All Service Areas" onSelect={setServiceArea} />
              {serviceAreaOptions.map((s) => (
                <Option key={s.id} value={s.id} current={serviceArea} label={s.name} onSelect={setServiceArea} />
              ))}
            </Section>
          )}

          {/* Footer */}
          <div
            className="px-4 py-2.5 text-[10px]"
            style={{
              backgroundColor: "var(--bg-surface-2)",
              color: "var(--text-muted)",
            }}
          >
            Context applies to all operational views
          </div>
        </div>
      )}
    </div>
  );
}
