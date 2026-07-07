"use client";

// ─── DetailActionButton ───────────────────────────────────
// The standard "add / action" button used inside detail-page cards (matches the
// project Materials & Vendors sections): accent-colored label with a small
// tinted circle holding the icon — not a filled pill. One shared affordance.

import { Plus } from "lucide-react";

const ACCENT = "#0f8578";

export default function DetailActionButton({ onClick, disabled, icon: Icon = Plus, active = false, children }: {
  onClick?: () => void;
  disabled?: boolean;
  icon?: React.ElementType;
  /** Keeps the icon rotated 45° (e.g. while the button's dropdown is open). */
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="group flex items-center gap-1.5 text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      style={{ color: ACCENT }}>
      <span className="w-4 h-4 rounded-full flex items-center justify-center transition-colors group-hover:brightness-95 shrink-0" style={{ backgroundColor: ACCENT + "1a" }}>
        <Icon className={`w-3 h-3 transition-transform duration-200 ${active ? "rotate-45" : ""}`} />
      </span>
      {children}
    </button>
  );
}
