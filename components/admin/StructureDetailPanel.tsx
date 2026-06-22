"use client";

// ─── Business Structure — selected item detail ────────────
// The right panel of the two-panel structure manager. Renders the full profile
// of the selected node (organization / company / location / service area), with
// the quick actions (Edit · Assign Users · More) folded into the detail header
// and a compact "Used Across Apps" section instead of a separate right rail.

import { useState } from "react";
import {
  Building2, MapPin, Map, Globe, Pencil, UserPlus, MoreHorizontal,
  Power, SlidersHorizontal, ExternalLink,
} from "lucide-react";
import { useHierarchy } from "@/components/providers/HierarchyProvider";
import StatusBadge from "@/components/shared/StatusBadge";
import {
  COMPANY_META, LOCATION_META, SERVICE_AREA_META, APPS_USING_STRUCTURE,
  usersForCompany, usersForLocation,
} from "@/lib/admin/structureMeta";
import { getUsers, type AppUser } from "@/lib/users/data";

export type NodeType = "org" | "company" | "location" | "serviceArea";
export interface Selection { type: NodeType; id: string }

const ACTIVE = "#10b981";
const dotColor = (active: boolean) => (active ? ACTIVE : "var(--text-muted)");

const TYPE_META: Record<NodeType, { label: string; icon: typeof Building2; accent: string }> = {
  org:         { label: "Organization", icon: Globe,     accent: "#a855f7" },
  company:     { label: "Company",      icon: Building2,  accent: "#6366f1" },
  location:    { label: "Location",     icon: MapPin,     accent: "#0ea5e9" },
  serviceArea: { label: "Service Area", icon: Map,        accent: "#0d9488" },
};

export interface DetailActions {
  active: boolean;
  onEdit: () => void;
  onAssignUsers: () => void;
  onToggleStatus: () => void;
}

// ─── Field primitives ─────────────────────────────────────
function Field({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>{label}</p>
      {value ? (
        <p className={`text-sm break-words ${mono ? "font-mono text-xs" : ""}`} style={{ color: "var(--text-primary)" }}>{value}</p>
      ) : (
        <p className="text-sm italic" style={{ color: "var(--text-muted)" }}>Not set</p>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--text-secondary)" }}>{title}</p>
      {children}
    </div>
  );
}

function Divider() {
  return <div style={{ borderTop: "1px solid var(--border-subtle)" }} />;
}

function Avatars({ users }: { users: AppUser[] }) {
  const shown = users.slice(0, 6);
  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-2">
        {shown.map((u) => (
          <span key={u.id} title={u.fullName}
            className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold"
            style={{ backgroundColor: "#e0e7ff", color: "#4f46e5", boxShadow: "0 0 0 2px var(--bg-surface)" }}>
            {u.initials}
          </span>
        ))}
        {users.length === 0 && (
          <span className="text-sm italic" style={{ color: "var(--text-muted)" }}>No users assigned</span>
        )}
      </div>
      {users.length > 0 && (
        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
          {users.length} {users.length === 1 ? "user" : "users"}
          {users.length > shown.length ? ` (+${users.length - shown.length})` : ""}
        </span>
      )}
    </div>
  );
}

function ChildRow({ icon: Icon, name, sub, active, onClick }: {
  icon: typeof MapPin; name: string; sub?: string; active: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors hover:opacity-90"
      style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border-subtle)" }}>
      <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
      <span className="text-sm font-medium flex-1 truncate" style={{ color: "var(--text-primary)" }}>{name}</span>
      {sub && <span className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>{sub}</span>}
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: dotColor(active) }} />
    </button>
  );
}

function Chips({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((t) => (
        <span key={t} className="text-[11px] px-2 py-1 rounded-md" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-secondary)" }}>{t}</span>
      ))}
    </div>
  );
}

// Compact "Used Across Apps" — replaces the old right-rail "Used In" panel.
function UsedAcrossApps() {
  return (
    <Section title="Used Across Apps">
      <div className="flex flex-wrap gap-1.5">
        {APPS_USING_STRUCTURE.map((a) => (
          <span key={a.id} title={a.uses.join(" · ")}
            className="text-[11px] font-semibold px-2 py-1 rounded-md" style={{ backgroundColor: a.accent + "1f", color: a.accent }}>
            {a.name}
          </span>
        ))}
      </div>
      <p className="text-[11px] mt-2 leading-relaxed" style={{ color: "var(--text-muted)" }}>
        CRM, HR, Accounting, and Documents consume this scope as their working context.
      </p>
    </Section>
  );
}

// ─── Detail header with inline quick actions ──────────────
function DetailHeader({ type, name, actions }: { type: NodeType; name: string; actions: DetailActions }) {
  const { icon: Icon, label, accent } = TYPE_META[type];
  const isOrg = type === "org";
  const typeLabel = label.toLowerCase();
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-start gap-3 min-w-0">
        <span className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: accent + "1f" }}>
          <Icon className="shrink-0" style={{ color: accent, width: 22, height: 22 }} />
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-semibold truncate" style={{ color: "var(--text-primary)" }}>{name}</h2>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide" style={{ backgroundColor: accent + "1f", color: accent }}>{label}</span>
          </div>
          <div className="mt-1">
            <StatusBadge label={actions.active ? "Active" : "Inactive"} color={actions.active ? ACTIVE : "var(--text-muted)"} />
          </div>
        </div>
      </div>

      {/* Quick actions — everything folded into the More (⋯) menu */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="relative">
          <button onClick={() => setMoreOpen((o) => !o)} aria-label="More actions"
            className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors"
            style={{ border: "1px solid var(--border)", color: "var(--text-secondary)", backgroundColor: "var(--bg-surface)" }}>
            <MoreHorizontal className="w-4 h-4" />
          </button>
          {moreOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMoreOpen(false)} />
              <div role="menu" className="absolute right-0 mt-1.5 w-52 rounded-xl overflow-hidden z-50 py-1"
                style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 12px 32px rgba(0,0,0,0.2)" }}>
                <button onClick={() => { setMoreOpen(false); actions.onEdit(); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-[var(--bg-surface-2)]"
                  style={{ color: "var(--text-primary)" }}>
                  <Pencil className="w-4 h-4" /> Edit {typeLabel}
                </button>
                <button onClick={() => { setMoreOpen(false); actions.onAssignUsers(); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-[var(--bg-surface-2)]"
                  style={{ color: "var(--text-primary)" }}>
                  <UserPlus className="w-4 h-4" /> Assign users
                </button>
                <div className="my-1" style={{ borderTop: "1px solid var(--border-subtle)" }} />
                {!isOrg && (
                  <button onClick={() => { setMoreOpen(false); actions.onToggleStatus(); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-[var(--bg-surface-2)]"
                    style={{ color: actions.active ? "#dc2626" : "var(--text-primary)" }}>
                    <Power className="w-4 h-4" /> {actions.active ? `Deactivate ${typeLabel}` : `Activate ${typeLabel}`}
                  </button>
                )}
                <button disabled
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm cursor-default" style={{ color: "var(--text-muted)" }}>
                  <SlidersHorizontal className="w-4 h-4" /> Set defaults
                  <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide" style={{ backgroundColor: "var(--bg-input)" }}>Soon</span>
                </button>
                <button disabled
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm cursor-default" style={{ color: "var(--text-muted)" }}>
                  <ExternalLink className="w-4 h-4" /> View related records
                  <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide" style={{ backgroundColor: "var(--bg-input)" }}>Soon</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Selected item detail ─────────────────────────────────
export function CenterDetail({ selection, onSelect, actions }: {
  selection: Selection; onSelect: (s: Selection) => void; actions: DetailActions;
}) {
  const { organization, orgSettings, allCompanies, allLocations, allServiceAreas } = useHierarchy();

  // ── Organization ──
  if (selection.type === "org") {
    const activeCo = allCompanies.filter((c) => c.status === "active").length;
    const activeLoc = allLocations.filter((l) => l.status === "active").length;
    const activeUsers = getUsers().filter((u) => u.status !== "inactive");
    return (
      <div className="space-y-6">
        <DetailHeader type="org" name={organization.name} actions={actions} />
        <Divider />
        <Section title="Organization">
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <Field label="Organization ID" value={organization.id} mono />
            <Field label="Business Mode" value={orgSettings.mode.replace(/_/g, " ")} />
            <Field label="Active Companies" value={String(activeCo)} />
            <Field label="Active Locations" value={String(activeLoc)} />
          </div>
        </Section>
        <Divider />
        <Section title="Companies">
          <div className="space-y-2">
            {allCompanies.map((co) => (
              <ChildRow key={co.id} icon={Building2} name={co.name}
                sub={`${allLocations.filter((l) => l.companyId === co.id).length} loc`}
                active={co.status === "active"}
                onClick={() => onSelect({ type: "company", id: co.id })} />
            ))}
          </div>
        </Section>
        <Divider />
        <Section title="Active Users"><Avatars users={activeUsers} /></Section>
        <Divider />
        <UsedAcrossApps />
      </div>
    );
  }

  // ── Company ──
  if (selection.type === "company") {
    const co = allCompanies.find((c) => c.id === selection.id);
    if (!co) return <Empty />;
    const meta = COMPANY_META[co.id] ?? {};
    const coLocations = allLocations.filter((l) => l.companyId === co.id);
    const users = usersForCompany(co.id);
    return (
      <div className="space-y-6">
        <DetailHeader type="company" name={co.name} actions={actions} />
        <Divider />
        <Section title="Company Details">
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <Field label="Display / Brand Name" value={meta.displayName ?? co.name} />
            <Field label="Legal Name" value={meta.legalName} />
            <Field label="Industry" value={co.industry ? co.industry.replace(/_/g, " ").toUpperCase() : undefined} />
            <Field label="Company Manager" value={meta.manager} />
            <Field label="Phone" value={meta.phone} />
            <Field label="Email" value={meta.email} />
            <Field label="Website" value={meta.website} />
            <Field label="Timezone" value={meta.timezone} />
            <div className="col-span-2"><Field label="Address" value={meta.address} /></div>
          </div>
        </Section>
        <Divider />
        <Section title="Assigned Users"><Avatars users={users} /></Section>
        <Divider />
        <Section title={`Locations (${coLocations.length})`}>
          {coLocations.length === 0 ? (
            <p className="text-sm italic" style={{ color: "var(--text-muted)" }}>No locations yet.</p>
          ) : (
            <div className="space-y-2">
              {coLocations.map((l) => (
                <ChildRow key={l.id} icon={MapPin} name={l.name}
                  sub={[l.city, l.state].filter(Boolean).join(", ")}
                  active={l.status === "active"}
                  onClick={() => onSelect({ type: "location", id: l.id })} />
              ))}
            </div>
          )}
        </Section>
        <Divider />
        <UsedAcrossApps />
      </div>
    );
  }

  // ── Location ──
  if (selection.type === "location") {
    const loc = allLocations.find((l) => l.id === selection.id);
    if (!loc) return <Empty />;
    const co = allCompanies.find((c) => c.id === loc.companyId);
    const meta = LOCATION_META[loc.id] ?? {};
    const areas = allServiceAreas.filter((sa) => sa.locationId === loc.id);
    const users = usersForLocation(loc.id, loc.companyId);
    return (
      <div className="space-y-6">
        <DetailHeader type="location" name={loc.name} actions={actions} />
        <Divider />
        <Section title="Location Details">
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <Field label="Parent Company" value={co?.name} />
            <Field label="Location Type" value={meta.type} />
            <Field label="Manager" value={meta.manager} />
            <Field label="Timezone" value={meta.timezone} />
            <Field label="Phone" value={meta.phone} />
            <Field label="Email" value={meta.email} />
            <div className="col-span-2"><Field label="Address" value={meta.address ?? [loc.city, loc.state].filter(Boolean).join(", ")} /></div>
          </div>
        </Section>
        <Divider />
        <Section title="Dispatch Defaults">
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <Field label="Operating Hours" value={meta.hours} />
            <Field label="Default Dispatch Board" value={meta.dispatchBoard} />
            <div className="col-span-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: "var(--text-muted)" }}>Assigned Teams</p>
              {meta.teams && meta.teams.length > 0 ? <Chips items={meta.teams} /> : <p className="text-sm italic" style={{ color: "var(--text-muted)" }}>None</p>}
            </div>
            <Field label="Warehouse / Inventory" value={meta.warehouse} />
          </div>
        </Section>
        <Divider />
        <Section title="Assigned Users"><Avatars users={users} /></Section>
        <Divider />
        <Section title={`Service Areas (${areas.length})`}>
          {areas.length === 0 ? (
            <p className="text-sm italic" style={{ color: "var(--text-muted)" }}>No service areas yet.</p>
          ) : (
            <div className="space-y-2">
              {areas.map((sa) => (
                <ChildRow key={sa.id} icon={Map} name={sa.name} active={sa.status === "active"}
                  onClick={() => onSelect({ type: "serviceArea", id: sa.id })} />
              ))}
            </div>
          )}
        </Section>
        <Divider />
        <UsedAcrossApps />
      </div>
    );
  }

  // ── Service area ──
  const sa = allServiceAreas.find((s) => s.id === selection.id);
  if (!sa) return <Empty />;
  const co = allCompanies.find((c) => c.id === sa.companyId);
  const loc = allLocations.find((l) => l.id === sa.locationId);
  const meta = SERVICE_AREA_META[sa.id] ?? {};
  return (
    <div className="space-y-6">
      <DetailHeader type="serviceArea" name={sa.name} actions={actions} />
      <Divider />
      <Section title="Territory">
        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          <Field label="Parent Company" value={co?.name} />
          <Field label="Parent Location" value={loc?.name} />
          <div className="col-span-2"><Field label="Cities / Counties / Zips" value={meta.coverage} /></div>
        </div>
      </Section>
      <Divider />
      <Section title="Routing">
        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          <Field label="Default Dispatch Board" value={meta.dispatchBoard} />
          <Field label="Travel / Zone Fee" value={meta.feeZone} />
          <div className="col-span-2"><Field label="Routing Notes" value={meta.notes} /></div>
        </div>
      </Section>
    </div>
  );
}

function Empty() {
  return <p className="text-sm italic" style={{ color: "var(--text-muted)" }}>This record no longer exists. Pick another item from the tree.</p>;
}
