"use client";

// ─── Team Workspace · Settings → Channel roles ────────────
// Assign per-channel member roles. A Channel Admin can post updates/announcements,
// pin messages, and manage members; a Member can read and post regular messages.
// Mock/local state — picks a channel, then manages its roster + roles.

import { useMemo, useState } from "react";
import { ShieldCheck, User, Plus, Trash2, Check, MessagesSquare } from "lucide-react";
import UiSelect from "@/components/ui/Select";
import { PageHeader } from "@/components/platform/ui";
import {
  getAllChannels, getChannelMembers, setChannelMemberRole, addChannelMember, removeChannelMember,
  CHANNEL_ROLE_LABELS, CHANNEL_ROLE_CAPS,
  type ChannelRole,
} from "@/lib/team-workspace/data";

const ACCENT = "#2563eb";
const ROLE_OPTIONS = (Object.keys(CHANNEL_ROLE_LABELS) as ChannelRole[]).map(r => ({ value: r, label: CHANNEL_ROLE_LABELS[r] }));

export default function ChannelSettings() {
  const [tick, setTick] = useState(0);
  const refresh = () => setTick(t => t + 1);
  const channels = useMemo(() => getAllChannels().filter(c => c.status === "active"), [tick]);
  const [selectedId, setSelectedId] = useState<string>(() => getAllChannels()[0]?.id ?? "");
  const selected = channels.find(c => c.id === selectedId) ?? channels[0] ?? null;
  const members = useMemo(() => selected ? getChannelMembers(selected.id) : [], [selected, tick]);

  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<ChannelRole>("member");
  function add() {
    if (!selected || !newName.trim()) return;
    addChannelMember(selected.id, newName, newRole);
    setNewName(""); setNewRole("member"); refresh();
  }

  return (
    <div className="p-6 space-y-5">
      <PageHeader title="Settings" subtitle="Assign channel roles and permissions for your team members." />

      {/* Role legend */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <RoleCard role="admin" icon={ShieldCheck} accent={ACCENT} />
        <RoleCard role="member" icon={User} accent="var(--text-muted)" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
        {/* Channel picker */}
        <div className="rounded-xl overflow-hidden h-fit" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
          <p className="text-[10px] font-semibold uppercase tracking-widest px-3 py-2.5" style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>Channels</p>
          <div className="p-1.5 max-h-[420px] overflow-y-auto thin-scroll-y">
            {channels.map(c => {
              const on = c.id === selected?.id;
              return (
                <button key={c.id} onClick={() => setSelectedId(c.id)} className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md mb-0.5 text-left transition-colors" style={{ backgroundColor: on ? ACCENT + "1f" : "transparent" }}>
                  <span className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 text-[10px] font-bold text-white" style={{ backgroundColor: c.accent }}>{c.name.replace(/[^a-zA-Z]/g, "").slice(0, 2).toUpperCase() || "CH"}</span>
                  <span className="text-sm font-medium truncate flex-1" style={{ color: on ? "var(--text-primary)" : "var(--text-secondary)" }}>{c.name}</span>
                  <span className="text-[10px] shrink-0" style={{ color: "var(--text-muted)" }}>{c.members.length}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Members + roles */}
        <div className="rounded-xl" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
          {!selected ? (
            <div className="p-10 text-center text-sm" style={{ color: "var(--text-muted)" }}>No channel selected.</div>
          ) : (
            <>
              <div className="flex items-center gap-2.5 px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
                <span className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 text-[11px] font-bold text-white" style={{ backgroundColor: selected.accent }}>{selected.name.replace(/[^a-zA-Z]/g, "").slice(0, 2).toUpperCase() || "CH"}</span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{selected.name}</p>
                  <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{members.length} member{members.length === 1 ? "" : "s"}</p>
                </div>
              </div>

              <div className="divide-y" style={{ borderColor: "var(--border-subtle)" }}>
                {members.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>No members yet — add one below.</p>
                ) : members.map(m => (
                  <div key={m.name} className="flex items-center gap-3 px-4 py-2.5" style={{ borderTop: "1px solid var(--border)" }}>
                    <span className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0" style={{ backgroundColor: "#6b7280" }}>{initials(m.name)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{m.name}</p>
                      {m.role === "admin" && <p className="text-[11px] flex items-center gap-1" style={{ color: ACCENT }}><ShieldCheck className="w-3 h-3" /> Channel Admin</p>}
                    </div>
                    <div className="w-40 shrink-0"><UiSelect size="sm" value={m.role} onChange={v => { setChannelMemberRole(selected.id, m.name, v as ChannelRole); refresh(); }} options={ROLE_OPTIONS} /></div>
                    <button onClick={() => { removeChannelMember(selected.id, m.name); refresh(); }} title="Remove from channel" className="p-1.5 rounded-md shrink-0" style={{ color: "var(--text-muted)" }}><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>

              {/* Add member */}
              <div className="flex items-center gap-2 px-4 py-3" style={{ borderTop: "1px solid var(--border)" }}>
                <input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => { if (e.key === "Enter") add(); }} placeholder="Add a member by name…" className="flex-1 rounded-lg px-3 py-2 text-sm outline-none" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)", color: "var(--text-primary)" }} />
                <div className="w-36 shrink-0"><UiSelect size="sm" value={newRole} onChange={v => setNewRole(v as ChannelRole)} options={ROLE_OPTIONS} /></div>
                <button onClick={add} disabled={!newName.trim()} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40 shrink-0" style={{ backgroundColor: ACCENT }}><Plus className="w-3.5 h-3.5" /> Add</button>
              </div>
            </>
          )}
        </div>
      </div>

      <p className="text-[11px] flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
        <MessagesSquare className="w-3.5 h-3.5" /> Roles are per-channel and local for now — they&apos;ll connect to the org-wide roles &amp; permissions model in a later phase.
      </p>
    </div>
  );
}

function RoleCard({ role, icon: Icon, accent }: { role: ChannelRole; icon: typeof ShieldCheck; accent: string }) {
  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
      <div className="flex items-center gap-2 mb-2.5">
        <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: accent === "var(--text-muted)" ? "var(--bg-surface-2)" : accent + "22" }}>
          <Icon className="w-4 h-4" style={{ color: accent }} />
        </span>
        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{CHANNEL_ROLE_LABELS[role]}</p>
      </div>
      <ul className="space-y-1.5">
        {CHANNEL_ROLE_CAPS[role].map(cap => (
          <li key={cap} className="flex items-start gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
            <Check className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: accent === "var(--text-muted)" ? "var(--text-muted)" : accent }} /> {cap}
          </li>
        ))}
      </ul>
    </div>
  );
}

function initials(name: string): string {
  const p = name.trim().split(/\s+/);
  return (p.length >= 2 ? p[0][0] + p[p.length - 1][0] : name.slice(0, 2)).toUpperCase();
}
