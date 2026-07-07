"use client";

// ─── Notifications bell + glossy popup ────────────────────
// Replaces the inbox in the full-view header. Tapping the bell opens a frosted,
// Apple-style popup that scales out from the header bubble (transform-origin
// top-right). Fed by real activity events.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import type { ActivityEvent } from "@/lib/activity/types";
import { activityMeta, activityLabel } from "@/lib/mobile/activityMeta";

// iOS-style frosted glass — semi-transparent tint heavily blurred, a white edge
// highlight, a glossy top gradient + inner highlight, and a large soft shadow so
// it floats. The header lifts this above the activity cards (z-index), so the
// content behind reads as soft frost rather than sharp icons.
const PANEL: React.CSSProperties = {
  backgroundColor: "color-mix(in srgb, var(--bg-surface) 94%, transparent)",
  backgroundImage: "linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 38%)",
  backdropFilter: "blur(36px) saturate(180%)",
  WebkitBackdropFilter: "blur(36px) saturate(180%)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: "18px",
  boxShadow: "0 28px 70px -14px rgba(0,0,0,0.6), 0 8px 24px -8px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.18)",
};

export default function NotificationsBell({ events }: { events: ActivityEvent[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const items = events.slice(0, 10);
  const unread = Math.min(items.length, 3); // newest few count as unread

  // While open, ANY click outside the panel just closes it (and is swallowed, so
  // it never navigates). A document-level capture listener handles this regardless
  // of z-index/stacking — more reliable than a catch-layer overlay.
  useEffect(() => {
    if (!open) return;
    const onClickCapture = (e: MouseEvent) => {
      if (panelRef.current?.contains(e.target as Node)) return; // taps inside the panel work
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
    };
    document.addEventListener("click", onClickCapture, true);
    return () => document.removeEventListener("click", onClickCapture, true);
  }, [open]);

  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)} aria-label="Notifications" aria-expanded={open}
        className="relative w-9 h-9 rounded-full flex items-center justify-center active:scale-95 transition-transform">
        <Bell className="w-5 h-5" style={{ color: "var(--text-secondary)" }} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center text-[9px] font-bold text-white" style={{ backgroundColor: "#ef4444", border: "2px solid var(--bg-surface)" }}>{unread}</span>
        )}
      </button>

      <div ref={panelRef} className="absolute right-0 top-full mt-2 z-50 w-[19rem] rounded-2xl overflow-hidden origin-top-right"
        style={{
          ...PANEL,
          // Grows out of the glass pill (top-right) and shrinks back into it on close.
          transform: open ? "scale(1) translateY(0)" : "scale(0.2) translateY(-12px)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "transform 0.3s cubic-bezier(0.22,1,0.36,1), opacity 0.2s ease",
        }}>
        {/* Dark scrim — a separate layer (not panel opacity) so content stays crisp
            while the blurred background reads as frost, not readable text. */}
        <div aria-hidden className="absolute inset-0" style={{ backgroundColor: "color-mix(in srgb, var(--bg-surface) 75%, transparent)" }} />
        <div className="relative">
        <div className="flex items-center justify-between px-4 pt-3 pb-2" style={{ backgroundColor: "color-mix(in srgb, var(--bg-surface) 38%, transparent)" }}>
          <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Notifications</p>
          {unread > 0 && <button onClick={() => setOpen(false)} className="text-[11px] font-semibold" style={{ color: "#0f8578" }}>Mark all read</button>}
        </div>
        <div className="max-h-[60vh] overflow-y-auto pb-1">
          {items.length === 0 ? (
            <p className="text-xs text-center py-6" style={{ color: "var(--text-muted)" }}>You’re all caught up.</p>
          ) : items.map((e, i) => {
            const m = activityMeta(e.eventType); const Icon = m.icon;
            return (
              <button key={e.id} onClick={() => { setOpen(false); router.push(`/mobile/customers/${e.customerId}`); }}
                className="w-full flex items-start gap-3 px-4 py-2.5 text-left active:bg-[var(--bg-surface-2)]" style={{ borderTop: "1px solid color-mix(in srgb, var(--border-subtle) 60%, transparent)" }}>
                <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: m.color + "22" }}><Icon className="w-4 h-4" style={{ color: m.color }} /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-[13px] font-semibold truncate" style={{ color: "var(--text-primary)" }}>{activityLabel(e.eventType)}</p>
                    {i < unread && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: "#ef4444" }} />}
                  </div>
                  <p className="text-xs leading-snug truncate" style={{ color: "var(--text-muted)" }}>{e.title}</p>
                </div>
                <span className="text-[10px] shrink-0 mt-0.5" style={{ color: "var(--text-muted)" }}>{e.displayDate}</span>
              </button>
            );
          })}
        </div>
        </div>
      </div>
    </div>
  );
}
