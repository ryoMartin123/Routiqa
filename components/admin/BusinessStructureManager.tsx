"use client";

// ─── Admin · Business Structure manager ───────────────────
// A clean structure manager (not a dashboard) for the organization hierarchy:
// companies, locations, and service areas. Two panels — the hierarchy tree on
// the left, the selected item's full detail on the right. The quick actions
// (Edit · Assign Users · More) live in the detail header; everything is local
// mock/session state, managed via the existing guided Add/Edit modals.

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2, MapPin, Map, Globe, Plus, ChevronRight, ChevronDown, Users,
} from "lucide-react";
import { useHierarchy } from "@/components/providers/HierarchyProvider";
import {
  AddCompanyModal, AddLocationModal, AddServiceAreaModal,
  EditCompanyModal, EditLocationModal, EditServiceAreaModal,
} from "@/components/hierarchy/HierarchyModals";
import { StatCard } from "@/components/platform/ui";
import ModuleViewToggle, { type ModuleView } from "@/components/shared/ModuleViewToggle";
import { CenterDetail, type Selection } from "@/components/admin/StructureDetailPanel";
import { assignedUserCount } from "@/lib/admin/structureMeta";

const ACTIVE = "#10b981";

export default function BusinessStructureManager() {
  const {
    organization, allCompanies, allLocations, allServiceAreas,
    editCompany, editLocation, editServiceArea,
  } = useHierarchy();
  const router = useRouter();

  // Default landing: the org root, with every company expanded.
  const [selection, setSelection] = useState<Selection>({ type: "org", id: organization.id });
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set<string>([`org:${organization.id}`, ...allCompanies.map((c) => `company:${c.id}`)]),
  );

  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [addModal, setAddModal] = useState<null | "company" | "location" | "serviceArea">(null);
  const [editing, setEditing] = useState(false);
  // Structure = the working manager (default); Overview = the KPI cards.
  const [view, setView] = useState<ModuleView>("list");

  function toggleExpand(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  // ── Summary counts ──
  const activeCompanies = allCompanies.filter((c) => c.status === "active").length;
  const activeLocations = allLocations.filter((l) => l.status === "active").length;
  const activeAreas = allServiceAreas.filter((s) => s.status === "active").length;

  // ── Selected record status (drives the deactivate/activate action) ──
  const selectedActive =
    selection.type === "org" ? true
    : selection.type === "company" ? allCompanies.find((c) => c.id === selection.id)?.status === "active"
    : selection.type === "location" ? allLocations.find((l) => l.id === selection.id)?.status === "active"
    : allServiceAreas.find((s) => s.id === selection.id)?.status === "active";

  function handleToggleStatus() {
    const next = selectedActive ? "inactive" : "active";
    if (selection.type === "company") editCompany(selection.id, { status: next });
    else if (selection.type === "location") editLocation(selection.id, { status: next });
    else if (selection.type === "serviceArea") editServiceArea(selection.id, { status: next });
  }

  const detailActions = {
    active: Boolean(selectedActive),
    onEdit: () => { if (selection.type === "org") router.push("/admin/organization"); else setEditing(true); },
    onAssignUsers: () => router.push("/admin/users"),
    onToggleStatus: handleToggleStatus,
  };

  return (
    <div className="flex flex-col gap-6 h-full min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 shrink-0">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>Business Structure</h1>
          <p className="text-sm mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
            Manage companies, branches, service areas, and operating structure across every app.
          </p>
        </div>
        <ModuleViewToggle view={view} onChange={setView} listLabel="Structure" />
        <div className="flex-1 flex justify-end">
          {view === "list" && (
            <AddMenu
              open={addMenuOpen}
              setOpen={setAddMenuOpen}
              onPick={(kind) => { setAddMenuOpen(false); setAddModal(kind); }}
            />
          )}
        </div>
      </div>

      {/* Overview — KPI cards (kept off the main Structure view) */}
      {view === "overview" && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
          <StatCard label="Companies" value={String(activeCompanies)} hint="Active" icon={Building2} accent="#6366f1" />
          <StatCard label="Locations" value={String(activeLocations)} hint="Active" icon={MapPin} accent="#0ea5e9" />
          <StatCard label="Service Areas" value={String(activeAreas)} hint="Active" icon={Map} accent="#0d9488" />
          <StatCard label="Users Assigned" value={String(assignedUserCount())} hint="Across structure" icon={Users} accent="#f59e0b" />
        </div>
      )}

      {/* Manager — two panels: tree (left) · detail (right) */}
      {view === "list" && (
      <div className="rounded-2xl overflow-hidden flex-1 min-h-0" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
        <div className="grid lg:grid-cols-[300px_1fr] h-full min-h-0">
          {/* Left — hierarchy tree */}
          <div className="p-4 border-b lg:border-b-0 lg:border-r overflow-y-auto min-h-0" style={{ borderColor: "var(--border-subtle)" }}>
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-3 px-1" style={{ color: "var(--text-muted)" }}>Hierarchy</p>
            <div className="space-y-0.5">
              {/* Org root */}
              <TreeRow
                depth={0} icon={Globe} name={organization.name} accent="#a855f7"
                active={organization.status === "active"}
                hasChildren={allCompanies.length > 0}
                expanded={expanded.has(`org:${organization.id}`)}
                selected={selection.type === "org"}
                onToggle={() => toggleExpand(`org:${organization.id}`)}
                onSelect={() => setSelection({ type: "org", id: organization.id })}
              />
              {expanded.has(`org:${organization.id}`) && allCompanies.map((co) => {
                const coLocs = allLocations.filter((l) => l.companyId === co.id);
                const coKey = `company:${co.id}`;
                return (
                  <div key={co.id}>
                    <TreeRow
                      depth={1} icon={Building2} name={co.name} accent="#6366f1"
                      active={co.status === "active"}
                      hasChildren={coLocs.length > 0}
                      expanded={expanded.has(coKey)}
                      selected={selection.type === "company" && selection.id === co.id}
                      onToggle={() => toggleExpand(coKey)}
                      onSelect={() => setSelection({ type: "company", id: co.id })}
                    />
                    {expanded.has(coKey) && (
                      coLocs.length === 0 ? (
                        <p className="text-[11px] italic pl-12 py-1" style={{ color: "var(--text-muted)" }}>No locations yet</p>
                      ) : coLocs.map((loc) => {
                        const areas = allServiceAreas.filter((s) => s.locationId === loc.id);
                        const locKey = `location:${loc.id}`;
                        return (
                          <div key={loc.id}>
                            <TreeRow
                              depth={2} icon={MapPin} name={loc.name} accent="#0ea5e9"
                              active={loc.status === "active"}
                              hasChildren={areas.length > 0}
                              expanded={expanded.has(locKey)}
                              selected={selection.type === "location" && selection.id === loc.id}
                              onToggle={() => toggleExpand(locKey)}
                              onSelect={() => setSelection({ type: "location", id: loc.id })}
                            />
                            {expanded.has(locKey) && areas.map((sa) => (
                              <TreeRow
                                key={sa.id} depth={3} icon={Map} name={sa.name} accent="#0d9488"
                                active={sa.status === "active"} hasChildren={false}
                                selected={selection.type === "serviceArea" && selection.id === sa.id}
                                onSelect={() => setSelection({ type: "serviceArea", id: sa.id })}
                              />
                            ))}
                          </div>
                        );
                      })
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right — selected item detail */}
          <div className="p-6 min-w-0 overflow-y-auto min-h-0" style={{ backgroundColor: "var(--bg-surface)" }}>
            <CenterDetail selection={selection} onSelect={setSelection} actions={detailActions} />
          </div>
        </div>
      </div>
      )}

      {/* Add modals */}
      <AddCompanyModal open={addModal === "company"} onClose={() => setAddModal(null)} />
      <AddLocationModal open={addModal === "location"} onClose={() => setAddModal(null)} />
      <AddServiceAreaModal open={addModal === "serviceArea"} onClose={() => setAddModal(null)} />

      {/* Edit modals (driven from the detail header quick action) */}
      {editing && selection.type === "company" && (() => {
        const co = allCompanies.find((c) => c.id === selection.id);
        return co ? <EditCompanyModal company={co} open onClose={() => setEditing(false)} /> : null;
      })()}
      {editing && selection.type === "location" && (() => {
        const loc = allLocations.find((l) => l.id === selection.id);
        return loc ? <EditLocationModal location={loc} open onClose={() => setEditing(false)} /> : null;
      })()}
      {editing && selection.type === "serviceArea" && (() => {
        const sa = allServiceAreas.find((s) => s.id === selection.id);
        return sa ? <EditServiceAreaModal serviceArea={sa} open onClose={() => setEditing(false)} /> : null;
      })()}
    </div>
  );
}

// ─── + Add dropdown ───────────────────────────────────────
function AddMenu({ open, setOpen, onPick }: {
  open: boolean; setOpen: (v: boolean) => void;
  onPick: (kind: "company" | "location" | "serviceArea") => void;
}) {
  const items: { kind: "company" | "location" | "serviceArea"; label: string; icon: typeof Building2 }[] = [
    { kind: "company", label: "Add Company", icon: Building2 },
    { kind: "location", label: "Add Location", icon: MapPin },
    { kind: "serviceArea", label: "Add Service Area", icon: Map },
  ];
  return (
    <div className="relative shrink-0">
      <button onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-3.5 py-2 rounded-lg transition-colors">
        <Plus className="w-4 h-4" /> Add
        <ChevronDown className="w-3.5 h-3.5 opacity-80" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1.5 w-52 rounded-xl overflow-hidden z-50 py-1"
            style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 12px 32px rgba(0,0,0,0.2)" }}>
            {items.map(({ kind, label, icon: Icon }) => (
              <button key={kind} onClick={() => onPick(kind)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:opacity-80"
                style={{ color: "var(--text-primary)" }}>
                <Icon className="w-4 h-4" style={{ color: "var(--text-muted)" }} /> {label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Tree row ─────────────────────────────────────────────
function TreeRow({
  depth, icon: Icon, name, accent, active,
  hasChildren, expanded, selected, onToggle, onSelect,
}: {
  depth: number; icon: typeof Building2; name: string; accent: string;
  active: boolean; hasChildren?: boolean; expanded?: boolean;
  selected: boolean; onToggle?: () => void; onSelect: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      className="group flex items-center gap-1.5 pr-2 py-1.5 rounded-lg cursor-pointer transition-colors"
      style={{
        paddingLeft: 6 + depth * 16,
        backgroundColor: selected ? accent + "1f" : "transparent",
      }}
      onMouseEnter={(e) => { if (!selected) e.currentTarget.style.backgroundColor = "var(--bg-surface-2)"; }}
      onMouseLeave={(e) => { if (!selected) e.currentTarget.style.backgroundColor = "transparent"; }}
    >
      {hasChildren ? (
        <button
          onClick={(e) => { e.stopPropagation(); onToggle?.(); }}
          className="w-4 h-4 flex items-center justify-center shrink-0 rounded"
          style={{ color: "var(--text-muted)" }}
        >
          {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>
      ) : (
        <span className="w-4 shrink-0" />
      )}
      <Icon className="w-4 h-4 shrink-0" style={{ color: accent }} />
      <span className="text-sm font-medium flex-1 truncate" style={{ color: selected ? "var(--text-primary)" : "var(--text-secondary)" }}>
        {name}
      </span>
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: active ? ACTIVE : "var(--text-muted)" }} title={active ? "Active" : "Inactive"} />
    </div>
  );
}
