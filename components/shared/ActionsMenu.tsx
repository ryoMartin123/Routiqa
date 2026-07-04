"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

// Our own "more actions" mark instead of the generic vertical kebab: a rounded
// 2×2 module grid (on-brand for the modular CRM). It animates — rotating into a
// diamond on hover and locking into an indigo diamond while the menu is open —
// so the affordance feels alive. One distinctive trigger shared across every
// record detail header.
export function MoreActionsGlyph({ open, className = "w-[18px] h-[18px]" }: { open: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" fill="currentColor"
      className={cn(
        className,
        "transition-transform duration-300 ease-out",
        open ? "rotate-45 scale-110" : "rotate-0 group-hover:rotate-45 group-hover:scale-105",
      )}>
      <rect x="2.6" y="2.6" width="4.2" height="4.2" rx="1.4" />
      <rect x="9.2" y="2.6" width="4.2" height="4.2" rx="1.4" />
      <rect x="2.6" y="9.2" width="4.2" height="4.2" rx="1.4" />
      <rect x="9.2" y="9.2" width="4.2" height="4.2" rx="1.4" />
    </svg>
  );
}

export interface ActionItem {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  onClick?: () => void;
  href?: string;
  danger?: boolean;
  // Renders a divider ABOVE this item (e.g. to separate destructive actions).
  separated?: boolean;
  // Greys the item out and blocks the click (keeps a gated action visible).
  disabled?: boolean;
  // Native tooltip — handy to explain why a disabled item is unavailable.
  title?: string;
}

// A "⋮" trigger that opens a dropdown of every action available for the current
// record. One consistent affordance across job / project / lead / customer
// detail headers. Falsy entries are ignored so callers can inline-conditional.
export default function ActionsMenu({ actions, label = "Actions", size = "md" }: {
  actions: (ActionItem | false | null | undefined)[];
  label?: string;
  size?: "sm" | "md";
}) {
  const items = actions.filter(Boolean) as ActionItem[];
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);

  if (items.length === 0) return null;

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen(o => !o)}
        aria-label={label} aria-haspopup="menu" aria-expanded={open}
        className={cn(
          "group flex items-center justify-center rounded-lg transition-all duration-200 active:scale-90",
          size === "sm" ? "w-7 h-7" : "w-9 h-9",
          open ? "text-[#4f46e5]" : "text-[var(--text-secondary)] hover:text-[#4f46e5] hover:bg-[var(--bg-surface-2)]",
        )}
        style={{ border: `1px solid ${open ? "#4f46e5" : "var(--border)"}` }}
      >
        <MoreActionsGlyph open={open} className={size === "sm" ? "w-[15px] h-[15px]" : "w-[18px] h-[18px]"} />
      </button>

      {open && (
        <div role="menu" className="absolute right-0 top-full mt-1.5 z-50 w-52 rounded-xl overflow-hidden py-1"
          style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 12px 32px rgba(0,0,0,0.18)" }}>
          {items.map((it, i) => {
            const cls = "flex items-center gap-2.5 w-full px-3 py-2 text-sm text-left transition-colors";
            const color = it.danger ? "#dc2626" : "var(--text-primary)";
            const hover = it.danger ? "hover:bg-red-50" : "hover:bg-[var(--bg-surface-2)]";
            const Icon = it.icon;
            const body = (
              <>
                {Icon && <Icon className="w-3.5 h-3.5 shrink-0" />}
                <span className="truncate">{it.label}</span>
              </>
            );
            return (
              <div key={it.label}>
                {(it.separated && i > 0) && <div className="my-1 h-px" style={{ backgroundColor: "var(--border-subtle)" }} />}
                {it.disabled ? (
                  <div className={`${cls} opacity-40 cursor-not-allowed`} style={{ color }} title={it.title} aria-disabled>
                    {body}
                  </div>
                ) : it.href ? (
                  <Link href={it.href} onClick={() => setOpen(false)} className={`${cls} ${hover}`} style={{ color }} title={it.title} role="menuitem">
                    {body}
                  </Link>
                ) : (
                  <button onClick={() => { setOpen(false); it.onClick?.(); }} className={`${cls} ${hover}`} style={{ color }} title={it.title} role="menuitem">
                    {body}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
