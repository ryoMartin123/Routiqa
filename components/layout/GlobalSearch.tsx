"use client";

// "Search anything" command bar. Searches across customers, jobs, leads, quotes,
// invoices, projects, and agreements; results navigate straight to the record.
// ⌘K / Ctrl+K focuses it from anywhere; ↑/↓ move, Enter opens, Esc closes.

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Users, Briefcase, TrendingUp, FileText, Receipt, FolderKanban, FilePen, ClipboardList, MessageSquare } from "lucide-react";
import { searchAll, type SearchGroup, type SearchResult } from "@/lib/search/global";

// One icon per module — the SAME icons the sidebar sections use.
const GROUP_ICON: Record<SearchGroup, typeof Users> = {
  Customers: Users, Jobs: Briefcase, "Work Orders": ClipboardList, Leads: TrendingUp,
  Quotes: FilePen, Invoices: Receipt, Projects: FolderKanban, Agreements: FileText,
  Comments: MessageSquare,
};

export default function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen]   = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => (query.trim() ? searchAll(query) : []), [query]);

  // ⌘K / Ctrl+K focuses the bar from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault(); inputRef.current?.focus(); setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => { setActive(0); }, [query]);

  function go(r: SearchResult) {
    router.push(r.href);
    setOpen(false); setQuery("");
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") { setOpen(false); inputRef.current?.blur(); return; }
    if (!results.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive(a => Math.min(a + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); const r = results[active]; if (r) go(r); }
  }

  const showDrop = open && query.trim().length > 0;

  return (
    <div ref={wrapRef} className="relative w-full">
      <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ backgroundColor: "var(--bg-input)" }}>
        <Search className="w-4 h-4 shrink-0" style={{ color: "var(--text-muted)" }} />
        <input
          ref={inputRef} type="text" value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search for anything…"
          className="bg-transparent text-sm outline-none flex-1 min-w-0"
          style={{ color: "var(--text-primary)" }}
        />
        <span className="text-xs shrink-0 border rounded px-1.5 py-0.5 font-mono"
          style={{ color: "var(--text-muted)", backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}>
          ⌘K
        </span>
      </div>

      {showDrop && (
        <div className="absolute left-0 right-0 top-full mt-2 z-50 rounded-xl overflow-hidden max-h-[70vh] overflow-y-auto"
          style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 12px 32px rgba(0,0,0,0.18)" }}>
          {results.length === 0 ? (
            <p className="text-sm px-4 py-6 text-center" style={{ color: "var(--text-muted)" }}>No matches for &ldquo;{query}&rdquo;</p>
          ) : (
            results.map((r, i) => {
              const Icon = GROUP_ICON[r.group];
              const firstOfGroup = i === 0 || results[i - 1].group !== r.group;
              return (
                <div key={`${r.group}-${r.id}`}>
                  {firstOfGroup && (
                    <p className="text-[10px] font-semibold uppercase tracking-widest px-3 pt-2.5 pb-1" style={{ color: "var(--text-muted)" }}>{r.group}</p>
                  )}
                  <button
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(r)}
                    className="w-full flex items-center gap-3 px-3 py-2 text-left transition-colors"
                    style={{ backgroundColor: i === active ? "var(--bg-surface-2)" : "transparent" }}>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-[10px] font-bold"
                      style={{ backgroundColor: "var(--accent-soft-bg)", color: "var(--accent-text)" }}>
                      {r.initials ?? <Icon className="w-3.5 h-3.5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{r.title}</p>
                      {r.subtitle && <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>{r.subtitle}</p>}
                    </div>
                    <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
