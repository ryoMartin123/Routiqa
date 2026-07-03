"use client";

// ─── Role detail drawer ───────────────────────────────────
// Right-side slide-over for inspecting/editing one role across six tabs:
// Overview · App Access · Permissions · Data Scope · Sensitive Access · Assigned
// Users. Reuses the shared role controls; the locked Owner role is read-only.

import { useMemo, useState } from "react";
import Link from "next/link";
import { X, Lock, Users, ExternalLink, Shield } from "lucide-react";
import {
  AppBadges, ScopeBadge, TypeBadge, AppAccessCards, DataScopeField,
  PermissionAccordions, SensitiveAccess,
} from "@/components/settings/rolesUi";
import { roleDataScope, sensitiveCount, adminCount } from "@/lib/roles/appmap";
import { upsertRole } from "@/lib/roles/store";
import { getUsers } from "@/lib/users/data";
import type { RoleDefinition } from "@/lib/roles/types";

type Tab = "overview" | "access" | "permissions" | "scope" | "sensitive" | "users";
const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "access", label: "App Access" },
  { key: "permissions", label: "Permissions" },
  { key: "scope", label: "Data Scope" },
  { key: "sensitive", label: "Sensitive" },
  { key: "users", label: "Users" },
];

export default function RoleDrawer({ role, canManage, onClose, onSaved, onEditFull }: {
  role: RoleDefinition; canManage: boolean; onClose: () => void; onSaved: () => void; onEditFull: () => void;
}) {
  const [draft, setDraft] = useState<RoleDefinition>(() => JSON.parse(JSON.stringify(role)));
  const [tab, setTab] = useState<Tab>("overview");
  // System defaults (and the locked Owner) are read-only — duplicate to customize.
  const editable = canManage && !role.locked && !role.system;
  const dirty = JSON.stringify(draft) !== JSON.stringify(role);

  const assigned = useMemo(() => getUsers().filter((u) => u.assignments.some((a) => a.role === role.key)), [role.key]);

  const change = editable ? setDraft : () => {};

  function save() { upsertRole(draft); onSaved(); }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-[520px] h-full flex flex-col" style={{ backgroundColor: "var(--bg-surface)", borderLeft: "1px solid var(--border)", boxShadow: "-16px 0 48px -12px rgba(0,0,0,0.3)" }}>
        {/* Header */}
        <div className="px-5 py-4 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5 min-w-0">
              <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "#e0e7ff" }}>
                <Shield className="w-4 h-4" style={{ color: "#4f46e5" }} />
              </span>
              <div className="min-w-0">
                <p className="text-base font-semibold truncate" style={{ color: "var(--text-primary)" }}>{role.label}</p>
                <div className="flex items-center gap-1.5 mt-1"><TypeBadge role={role} /><ScopeBadge scope={roleDataScope(role)} /></div>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--bg-surface-2)]" style={{ color: "var(--text-secondary)" }}><X className="w-4 h-4" /></button>
          </div>
          {/* Tabs */}
          <div className="flex items-center gap-1 mt-3 overflow-x-auto thin-scroll-x">
            {TABS.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors"
                style={{ backgroundColor: tab === t.key ? "var(--accent-soft-bg)" : "transparent", color: tab === t.key ? "var(--accent-text)" : "var(--text-muted)" }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {!editable && (
          <div className="px-5 py-2.5 flex items-center gap-2" style={{ backgroundColor: "#fffbeb", borderBottom: "1px solid #fde68a" }}>
            <Lock className="w-3.5 h-3.5 shrink-0" style={{ color: "#92400e" }} />
            <p className="text-xs" style={{ color: "#92400e" }}>
              {role.locked ? "The Owner role is locked — its core permissions can't be changed."
                : role.system ? "System default roles are read-only. Duplicate this role to create an editable copy."
                : "You don't have permission to edit this role."}
            </p>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {tab === "overview" && (
            <div className="space-y-3">
              <OvRow label="Description" value={role.description} />
              <OvRow label="Role type" value={role.locked ? "Locked owner" : role.system ? "System Default" : "Custom"} />
              <OvRow label="Editable" value={editable ? "Yes" : role.system ? "No — system default" : "No — locked"} />
              <OvRow label="Default data scope"><ScopeBadge scope={roleDataScope(role)} /></OvRow>
              <OvRow label="Apps enabled"><AppBadges role={role} /></OvRow>
              <OvRow label="Users assigned" value={String(assigned.length)} />
              <OvRow label="Sensitive / Admin" value={`${sensitiveCount(role)} sensitive · ${adminCount(role)} admin`} />
              <OvRow label="Last updated" value={role.system ? "Shipped default" : "—"} />
              {editable && (
                <button onClick={onEditFull} className="w-full mt-2 flex items-center justify-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg"
                  style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                  Open full Role Builder
                </button>
              )}
            </div>
          )}

          {tab === "access" && <Editable editable={editable}><AppAccessCards draft={draft} onChange={change} /></Editable>}
          {tab === "permissions" && <Editable editable={editable}><PermissionAccordions draft={draft} onChange={change} /></Editable>}
          {tab === "scope" && <Editable editable={editable}><DataScopeField draft={draft} onChange={change} /></Editable>}
          {tab === "sensitive" && <Editable editable={editable}><SensitiveAccess draft={draft} onChange={change} /></Editable>}

          {tab === "users" && (
            <div className="space-y-2">
              {assigned.length === 0 ? (
                <div className="rounded-xl p-6 text-center" style={{ border: "1px dashed var(--border)", backgroundColor: "var(--bg-surface-2)" }}>
                  <Users className="w-5 h-5 mx-auto mb-2" style={{ color: "var(--text-muted)" }} />
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>No users are assigned this role yet.</p>
                </div>
              ) : assigned.map((u) => (
                <div key={u.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg" style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border)" }}>
                  <span className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0" style={{ backgroundColor: "#e0e7ff", color: "#4f46e5" }}>{u.initials}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{u.fullName}</p>
                    <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>{u.email}</p>
                  </div>
                  <Link href="/admin/users" className="text-xs flex items-center gap-1" style={{ color: "var(--accent-text)" }}>Open <ExternalLink className="w-3 h-3" /></Link>
                </div>
              ))}
              <Link href="/admin/users" className="w-full mt-1 flex items-center justify-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                <Users className="w-3.5 h-3.5" /> Assign users
              </Link>
            </div>
          )}
        </div>

        {/* Footer */}
        {editable && tab !== "overview" && tab !== "users" && (
          <div className="px-5 py-3 flex items-center justify-end gap-2 shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
            <button onClick={() => setDraft(JSON.parse(JSON.stringify(role)))} disabled={!dirty}
              className="text-sm font-medium px-3 py-2 rounded-lg disabled:opacity-40" style={{ color: "var(--text-secondary)" }}>Discard</button>
            <button onClick={save} disabled={!dirty}
              className="text-sm font-medium px-4 py-2 rounded-lg text-white transition-colors disabled:opacity-40" style={{ backgroundColor: "#4f46e5" }}>Save changes</button>
          </div>
        )}
      </div>
    </div>
  );
}

function Editable({ editable, children }: { editable: boolean; children: React.ReactNode }) {
  return <div style={{ opacity: editable ? 1 : 0.6, pointerEvents: editable ? "auto" : "none" }}>{children}</div>;
}

function OvRow({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2" style={{ borderBottom: "1px solid var(--border)" }}>
      <span className="text-sm shrink-0" style={{ color: "var(--text-muted)" }}>{label}</span>
      <div className="text-right min-w-0">
        {children ?? <span className="text-sm" style={{ color: value ? "var(--text-primary)" : "var(--text-muted)" }}>{value || "—"}</span>}
      </div>
    </div>
  );
}
