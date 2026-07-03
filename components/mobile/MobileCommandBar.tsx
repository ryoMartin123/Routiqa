"use client";

// ─── Full-permissions command bar ─────────────────────────
// Floating, glassy bottom bar: a search pill in the middle (→ global search) and
// a circular plus on the right that opens quick actions. Replaces the hamburger
// drawer for broad-access users; safe-area aware.

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Plus, X, Briefcase, UserPlus, Camera, CheckSquare, Receipt, Megaphone } from "lucide-react";
import MobileSearchPanel from "@/components/mobile/MobileSearchPanel";

const ACCENT = "#4f46e5";
const GLASS: React.CSSProperties = {
  backgroundColor: "color-mix(in srgb, var(--bg-surface) 82%, transparent)",
  backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
  border: "1px solid var(--border)", boxShadow: "0 10px 34px -8px rgba(0,0,0,0.4)",
};

export default function MobileCommandBar() {
  const [sheet, setSheet] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Open AND focus the input in the same tap so iOS raises the keyboard
  // immediately (a deferred focus won't — it must happen in the user gesture).
  const openSearch = () => { setSearchOpen(true); searchInputRef.current?.focus(); };

  return (
    <>
      <div className="fixed left-0 right-0 z-50 flex items-center gap-2.5 px-4 pointer-events-none" style={{ bottom: "calc(env(safe-area-inset-bottom) + 12px)" }}>
        <button onClick={openSearch} className="pointer-events-auto flex-1 flex items-center gap-2.5 rounded-full px-4 py-3.5 active:scale-[0.99] transition-transform" style={GLASS}>
          <Search className="w-5 h-5 shrink-0" style={{ color: "var(--text-muted)" }} />
          <span className="text-sm" style={{ color: "var(--text-muted)" }}>Search all of Routiqa…</span>
        </button>
        <button onClick={() => setSheet(true)} aria-label="Quick actions" aria-expanded={sheet} className="plus-glow pointer-events-auto w-[52px] h-[52px] rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: ACCENT }}>
          <Plus className="w-6 h-6 text-white" />
        </button>
      </div>

      <MobileSearchPanel open={searchOpen} onClose={() => setSearchOpen(false)} inputRef={searchInputRef} />
      <QuickActions open={sheet} onClose={() => setSheet(false)} />
    </>
  );
}

function QuickActions({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const go = (href: string) => { onClose(); router.push(href); };
  const ACTIONS = [
    { icon: Briefcase, label: "New job", color: "#4f46e5", href: "/mobile/jobs" },
    { icon: UserPlus, label: "New customer", color: "#0891b2", href: "/mobile/customers" },
    { icon: Camera, label: "Take photo", color: "#16a34a", href: "/mobile/photos" },
    { icon: CheckSquare, label: "Create task", color: "#f59e0b", href: "/mobile/tasks" },
    { icon: Receipt, label: "Accounting", color: "#a855f7", href: "/mobile/accounting" },
    { icon: Megaphone, label: "Marketing", color: "#e11d48", href: "/mobile/marketing" },
  ];
  return (
    <div className={`fixed inset-0 z-[60] flex flex-col justify-end ${open ? "" : "pointer-events-none"}`} onClick={onClose}>
      <div className="absolute inset-0 transition-opacity duration-300 ease-out" style={{ backgroundColor: "rgba(0,0,0,0.45)", opacity: open ? 1 : 0 }} />
      <div onClick={e => e.stopPropagation()} className="relative rounded-t-3xl p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] transition-transform duration-300"
        style={{ transform: open ? "translateY(0)" : "translateY(110%)", transitionTimingFunction: open ? "cubic-bezier(0.22,1,0.36,1)" : "cubic-bezier(0.55,0,1,0.45)", backgroundColor: "var(--bg-surface)", borderTop: "1px solid var(--border)", boxShadow: "0 -16px 48px rgba(0,0,0,0.35)" }}>
        <div className="w-9 h-1 rounded-full mx-auto mb-3" style={{ backgroundColor: "var(--border)" }} />
        <div className="flex items-center justify-between mb-3">
          <p className="text-base font-bold" style={{ color: "var(--text-primary)" }}>Quick actions</p>
          <button onClick={onClose} className="p-1.5 rounded-full active:bg-[var(--bg-surface-2)]"><X className="w-5 h-5" style={{ color: "var(--text-muted)" }} /></button>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          {ACTIONS.map(a => (
            <button key={a.label} onClick={() => go(a.href)} className="flex flex-col items-center gap-2 py-3.5 rounded-2xl active:scale-[0.97] transition-transform" style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border)" }}>
              <span className="w-11 h-11 rounded-full flex items-center justify-center" style={{ backgroundColor: a.color + "1a" }}><a.icon className="w-5 h-5" style={{ color: a.color }} /></span>
              <span className="text-[11px] font-medium text-center leading-tight" style={{ color: "var(--text-primary)" }}>{a.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
