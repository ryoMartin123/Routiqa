"use client";

// ─── Technician bottom nav (floating) ─────────────────────
// A detached, glassy pill that floats above the safe area, with an expanding
// active state, plus a separate circular action button that opens a field
// quick-action sheet. Premium mobile-app feel, not a web footer.

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home, Briefcase, MessageSquare, Menu, Plus, X, FileText,
  StickyNote, Camera, Package, CheckSquare, AlertTriangle, PhoneCall, Map,
} from "lucide-react";
import { getCurrentJob, getMobileCaps } from "@/lib/mobile/data";

const ACCENT = "#0f8578";

// Tabs follow the SAME permissions the CRM declares: photos need files access,
// messages need communications — a tech without them gets their SOP library.
function tabsForCaps() {
  const caps = getMobileCaps();
  const tabs: { href: string; label: string; icon: React.ElementType }[] = [
    { href: "/mobile/today", label: "Today", icon: Home },
    { href: "/mobile/jobs", label: "Jobs", icon: Briefcase },
  ];
  if (caps.photos) tabs.push({ href: "/mobile/photos", label: "Photos", icon: Camera });
  if (caps.messages) tabs.push({ href: "/mobile/messages", label: "Messages", icon: MessageSquare });
  else if (caps.documents) tabs.push({ href: "/mobile/more/documents", label: "SOPs", icon: FileText });
  tabs.push({ href: "/mobile/more", label: "More", icon: Menu });
  return tabs;
}

export default function BottomNav() {
  const pathname = usePathname();
  const [sheet, setSheet] = useState(false);
  const TABS = useMemo(() => tabsForCaps(), []);

  return (
    <>
      <div className="fixed left-0 right-0 z-50 flex items-end justify-center gap-2.5 px-4 pointer-events-none"
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 12px)" }}>
        {/* Floating glass pill */}
        <nav className="pointer-events-auto flex items-center gap-1 rounded-full p-1.5"
          style={{ backgroundColor: "color-mix(in srgb, var(--bg-surface) 82%, transparent)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", border: "1px solid var(--border)", boxShadow: "0 10px 34px -8px rgba(0,0,0,0.4)" }}>
          {TABS.map(t => {
            const active = pathname === t.href || pathname.startsWith(t.href + "/");
            return (
              <Link key={t.href} href={t.href} aria-label={t.label}
                className="flex items-center gap-1.5 rounded-full transition-all active:scale-95"
                style={{ padding: active ? "0.55rem 0.85rem" : "0.55rem", backgroundColor: active ? ACCENT + "1f" : "transparent" }}>
                <t.icon className="w-[22px] h-[22px] shrink-0" style={{ color: active ? ACCENT : "var(--text-muted)" }} strokeWidth={active ? 2.4 : 2} />
                {active && <span className="text-[13px] font-semibold pr-0.5" style={{ color: ACCENT }}>{t.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Separate circular action button */}
        <button onClick={() => setSheet(true)} aria-label="Quick actions" aria-expanded={sheet}
          className="plus-glow pointer-events-auto w-[52px] h-[52px] rounded-full flex items-center justify-center shrink-0"
          style={{ backgroundColor: ACCENT }}>
          <Plus className="w-6 h-6 text-white" />
        </button>
      </div>

      <QuickActionSheet open={sheet} onClose={() => setSheet(false)} />
    </>
  );
}

function QuickActionSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const job = getCurrentJob();
  const jobHref = job ? `/mobile/jobs/${job.id}` : "/mobile/jobs";
  const go = (href: string) => { onClose(); router.push(href); };

  const ACTIONS: { icon: React.ElementType; label: string; color: string; onClick: () => void }[] = [
    { icon: StickyNote, label: "Add note", color: "#0f8578", onClick: () => go(jobHref) },
    { icon: Map, label: "Map", color: "#2563eb", onClick: () => go("/mobile/map") },
    { icon: Package, label: "Add material", color: "#f59e0b", onClick: () => go(jobHref) },
    { icon: CheckSquare, label: "Create task", color: "#16a34a", onClick: () => go("/mobile/tasks") },
    { icon: AlertTriangle, label: "Log issue", color: "#dc2626", onClick: () => go(jobHref) },
    { icon: PhoneCall, label: "Contact office", color: "#a855f7", onClick: () => go("/mobile/messages") },
  ];

  return (
    <div className={`fixed inset-0 z-[60] flex flex-col justify-end ${open ? "" : "pointer-events-none"}`} onClick={onClose}>
      <div className="absolute inset-0 transition-opacity duration-300 ease-out" style={{ backgroundColor: "rgba(0,0,0,0.45)", opacity: open ? 1 : 0 }} />
      <div onClick={e => e.stopPropagation()} className="relative rounded-t-3xl p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] transition-transform duration-300"
        style={{ transform: open ? "translateY(0)" : "translateY(110%)", transitionTimingFunction: open ? "cubic-bezier(0.22,1,0.36,1)" : "cubic-bezier(0.55,0,1,0.45)", backgroundColor: "var(--bg-surface)", borderTop: "1px solid var(--border)", boxShadow: "0 -16px 48px rgba(0,0,0,0.35)" }}>
        {/* Grab handle */}
        <div className="w-9 h-1 rounded-full mx-auto mb-3" style={{ backgroundColor: "var(--border)" }} />
        <div className="flex items-center justify-between mb-3">
          <p className="text-base font-bold" style={{ color: "var(--text-primary)" }}>Quick actions</p>
          <button onClick={onClose} className="p-1.5 rounded-full active:bg-[var(--bg-surface-2)]"><X className="w-5 h-5" style={{ color: "var(--text-muted)" }} /></button>
        </div>
        {job && <p className="text-xs mb-3 -mt-1" style={{ color: "var(--text-muted)" }}>For {job.customerName}</p>}
        <div className="grid grid-cols-3 gap-2.5">
          {ACTIONS.map(a => (
            <button key={a.label} onClick={a.onClick} className="flex flex-col items-center gap-2 py-3.5 rounded-2xl active:scale-[0.97] transition-transform"
              style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border)" }}>
              <span className="w-11 h-11 rounded-full flex items-center justify-center" style={{ backgroundColor: a.color + "1a" }}><a.icon className="w-5 h-5" style={{ color: a.color }} /></span>
              <span className="text-[11px] font-medium text-center leading-tight" style={{ color: "var(--text-primary)" }}>{a.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
