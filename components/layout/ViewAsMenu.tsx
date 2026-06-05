"use client";

// ─── View-as menu ─────────────────────────────────────────
// Lets an admin preview the app as any directory user — nav, list scope, action
// buttons, and field masks all re-resolve to that user's roles. A loud pill
// shows when impersonating, with a one-click reset back to yourself.

import { useEffect, useRef, useState } from "react";
import { Eye, Check, X, ChevronDown } from "lucide-react";
import { usePermissionContext } from "@/components/providers/PermissionProvider";
import { ROLE_PRESETS } from "@/lib/roles/presets";

export default function ViewAsMenu() {
  const { users, actingUser, realUser, isImpersonating, setActingUserId, resetActing } = usePermissionContext();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const roleSummary = (u: typeof actingUser) => {
    if (u.isOrgOwner) return "Owner";
    const role = u.assignments[0]?.role;
    const extra = u.assignments.length > 1 ? ` +${u.assignments.length - 1}` : "";
    return role ? ROLE_PRESETS[role].label + extra : "No role";
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
        style={{
          backgroundColor: isImpersonating ? "#fef3c7" : "var(--bg-input)",
          color: isImpersonating ? "#92400e" : "var(--text-secondary)",
          border: `1px solid ${isImpersonating ? "#fcd34d" : "var(--border)"}`,
        }}>
        <Eye className="w-3.5 h-3.5 shrink-0" />
        <span className="truncate max-w-[140px]">
          {isImpersonating ? `Viewing as ${actingUser.fullName}` : "View as"}
        </span>
        {isImpersonating
          ? <X className="w-3.5 h-3.5 shrink-0" onClick={(e) => { e.stopPropagation(); resetActing(); setOpen(false); }} />
          : <ChevronDown className="w-3.5 h-3.5 shrink-0" />}
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-64 rounded-xl overflow-hidden z-50 py-1"
          style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 12px 32px rgba(0,0,0,0.18)" }}>
          <p className="text-[10px] font-semibold uppercase tracking-widest px-3 py-1.5" style={{ color: "var(--text-muted)" }}>
            Preview as user
          </p>
          {users.map(u => {
            const active = u.id === actingUser.id;
            return (
              <button key={u.id} onClick={() => { setActingUserId(u.id); setOpen(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-[var(--bg-surface-2)]">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                  style={{ backgroundColor: u.isOrgOwner ? "#4f46e5" : "#6b7280" }}>{u.initials}</div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                    {u.fullName}{u.id === realUser.id && " (you)"}
                  </p>
                  <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>{roleSummary(u)}</p>
                </div>
                {active && <Check className="w-4 h-4 shrink-0" style={{ color: "#4f46e5" }} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
