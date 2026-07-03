"use client";

// ─── In-place global search popup ─────────────────────────
// Opened from the command bar's search pill — a command-palette-style popup over
// the CURRENT page (no navigation): dimmed/blurred backdrop so you stay oriented,
// search field pinned at the top, results in a card just below. Results route to
// the matching mobile screen.

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Users, Briefcase, UserPlus, FileText, Receipt, CheckSquare } from "lucide-react";
import { searchRoutiqa, SEARCH_TYPE_META, type SearchType } from "@/lib/mobile/search";

const ICON: Record<SearchType, React.ElementType> = {
  customer: Users, job: Briefcase, lead: UserPlus, quote: FileText, invoice: Receipt, task: CheckSquare,
};
const CARD: React.CSSProperties = { backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 16px 40px -10px rgba(0,0,0,0.4)" };

export default function MobileSearchPanel({ open, onClose, inputRef: externalRef }: { open: boolean; onClose: () => void; inputRef?: React.RefObject<HTMLInputElement | null> }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const internalRef = useRef<HTMLInputElement>(null);
  const inputRef = externalRef ?? internalRef;   // parent focuses this in the open gesture (iOS keyboard)
  const results = useMemo(() => searchRoutiqa(q), [q]);

  useEffect(() => {
    if (open) { const t = setTimeout(() => inputRef.current?.focus(), 130); return () => clearTimeout(t); }
    setQ("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const go = (href: string) => { onClose(); router.push(href); };
  const active = q.trim().length >= 2;

  return (
    <div className={`fixed inset-0 z-[70] ${open ? "" : "pointer-events-none"}`} aria-hidden={!open}>
      {/* Dimmed, blurred backdrop — current page stays faintly visible */}
      <div onClick={onClose} className="absolute inset-0 transition-opacity duration-200"
        style={{ backgroundColor: "rgba(0,0,0,0.4)", backdropFilter: "blur(7px)", WebkitBackdropFilter: "blur(7px)", opacity: open ? 1 : 0 }} />

      {/* Top popup — search field + results card */}
      <div className="absolute top-0 left-0 right-0 px-3 transition-all duration-200"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.6rem)", transform: open ? "translateY(0)" : "translateY(-14px)", opacity: open ? 1 : 0 }}>
        <div className="flex items-center gap-2.5 rounded-2xl px-3.5 py-3" style={CARD}>
          <Search className="w-5 h-5 shrink-0" style={{ color: "var(--text-muted)" }} />
          <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)} placeholder="Search customers, jobs, invoices…" className="bg-transparent text-base outline-none w-full" style={{ color: "var(--text-primary)" }} />
          {q && <button onClick={() => setQ("")} aria-label="Clear"><X className="w-4 h-4" style={{ color: "var(--text-muted)" }} /></button>}
        </div>

        {active && (
          <div className="mt-2 rounded-2xl overflow-hidden" style={CARD}>
            <div className="max-h-[62vh] overflow-y-auto">
              {results.length === 0 ? (
                <p className="text-sm text-center py-8" style={{ color: "var(--text-muted)" }}>No matches for “{q}”.</p>
              ) : (
                <>
                  <p className="text-[11px] px-4 pt-3 pb-1" style={{ color: "var(--text-muted)" }}>{results.length} result{results.length === 1 ? "" : "s"}</p>
                  {results.map((r, i) => {
                    const meta = SEARCH_TYPE_META[r.type]; const Icon = ICON[r.type];
                    return (
                      <button key={`${r.type}-${r.id}`} onClick={() => go(r.href)} className="w-full flex items-center gap-3 px-4 py-2.5 text-left active:bg-[var(--bg-surface-2)]" style={{ borderTop: i ? "1px solid var(--border)" : "none" }}>
                        <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: meta.color + "1a" }}><Icon className="w-4 h-4" style={{ color: meta.color }} /></span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{r.title}</p>
                          <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{r.subtitle}</p>
                        </div>
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0" style={{ backgroundColor: meta.color + "1a", color: meta.color }}>{meta.label}</span>
                      </button>
                    );
                  })}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
