"use client";

// ─── App switcher ─────────────────────────────────────────
// Lives in the top bar of every app. Shows the current app and lets the user
// jump to any other app they have access to — no logout. Access is resolved from
// the *acting* user (so View-as previews another user's app set too). A link back
// to the launcher sits at the bottom.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check, ChevronDown, Grid3x3, Lock } from "lucide-react";
import { usePermissionContext } from "@/components/providers/PermissionProvider";
import { appAccessForUser } from "@/lib/platform/access";
import { PLATFORM_APPS, currentAppFromPath } from "@/lib/platform/apps";

export default function AppSwitcher() {
  const pathname = usePathname();
  const { actingUser } = usePermissionContext();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const access = appAccessForUser(actingUser);
  const current = currentAppFromPath(pathname);

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors hover:bg-[var(--bg-surface-2)]"
        style={{ color: "var(--text-primary)", border: "1px solid var(--border)" }}
      >
        <Grid3x3 className="w-4 h-4 shrink-0" style={{ color: "var(--accent-icon)" }} />
        <span className="truncate max-w-[160px]">{current?.name ?? "Platform"}</span>
        <ChevronDown className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
      </button>

      {open && (
        <div
          className="absolute left-0 mt-1.5 w-72 rounded-xl overflow-hidden z-50 py-1.5"
          style={{
            backgroundColor: "var(--bg-surface)",
            border: "1px solid var(--border)",
            boxShadow: "0 12px 32px rgba(0,0,0,0.22)",
          }}
        >
          <p className="text-[10px] font-semibold uppercase tracking-widest px-3 py-1.5" style={{ color: "var(--text-muted)" }}>
            Switch app
          </p>
          {PLATFORM_APPS.map((app) => {
            const allowed = access[app.id];
            const active = current?.id === app.id;
            const Icon = app.icon;
            if (!allowed) {
              return (
                <div
                  key={app.id}
                  className="w-full flex items-center gap-3 px-3 py-2 opacity-45 cursor-not-allowed"
                  title="No access"
                >
                  <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--bg-surface-2)" }}>
                    <Icon className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
                  </span>
                  <span className="text-sm flex-1 truncate" style={{ color: "var(--text-secondary)" }}>{app.name}</span>
                  <Lock className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
                </div>
              );
            }
            return (
              <Link
                key={app.id}
                href={app.href}
                onClick={() => setOpen(false)}
                className="w-full flex items-center gap-3 px-3 py-2 transition-colors hover:bg-[var(--bg-surface-2)]"
              >
                <span
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: app.accent + "22" }}
                >
                  <Icon className="w-4 h-4" style={{ color: app.accent }} />
                </span>
                <span className="text-sm flex-1 truncate" style={{ color: "var(--text-primary)" }}>{app.name}</span>
                {active && <Check className="w-4 h-4 shrink-0" style={{ color: "var(--accent-text)" }} />}
              </Link>
            );
          })}
          <div className="mt-1 pt-1" style={{ borderTop: "1px solid var(--border-subtle)" }}>
            <Link
              href="/welcome"
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-xs font-medium transition-colors hover:bg-[var(--bg-surface-2)]"
              style={{ color: "var(--text-muted)" }}
            >
              Back to launcher
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
