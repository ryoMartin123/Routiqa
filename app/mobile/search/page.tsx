"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, X, Users, Briefcase, UserPlus, FileText, Receipt, CheckSquare, CornerDownLeft } from "lucide-react";
import MobileHeader from "@/components/mobile/MobileHeader";
import { EmptyState } from "@/components/mobile/ui";
import { searchRoutiqa, SEARCH_TYPE_META, type SearchType } from "@/lib/mobile/search";

const ICON: Record<SearchType, React.ElementType> = {
  customer: Users, job: Briefcase, lead: UserPlus, quote: FileText, invoice: Receipt, task: CheckSquare,
};

export default function MobileSearchPage() {
  const [q, setQ] = useState("");
  const results = useMemo(() => searchRoutiqa(q), [q]);

  return (
    <div>
      <MobileHeader title="Search" back />
      <div className="px-4">
        <div className="flex items-center gap-2 rounded-2xl px-3.5 py-3 mb-4" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", boxShadow: "var(--shadow-card)" }}>
          <Search className="w-5 h-5 shrink-0" style={{ color: "var(--text-muted)" }} />
          <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search customers, jobs, invoices…" className="bg-transparent text-base outline-none w-full" style={{ color: "var(--text-primary)" }} />
          {q && <button onClick={() => setQ("")}><X className="w-4 h-4" style={{ color: "var(--text-muted)" }} /></button>}
        </div>

        {q.trim().length < 2 ? (
          <EmptyState icon={Search} title="Search all of Routiqa" hint="Find any customer, job, lead, quote, invoice, or task in one place." />
        ) : results.length === 0 ? (
          <EmptyState icon={Search} title="No matches" hint={`Nothing found for “${q}”.`} />
        ) : (
          <div className="space-y-2">
            <p className="text-xs px-1" style={{ color: "var(--text-muted)" }}>{results.length} result{results.length === 1 ? "" : "s"}</p>
            {results.map(r => {
              const meta = SEARCH_TYPE_META[r.type]; const Icon = ICON[r.type];
              return (
                <Link key={`${r.type}-${r.id}`} href={r.href} className="flex items-center gap-3 rounded-2xl p-3 active:scale-[0.99] transition-transform" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)" }}>
                  <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: meta.color + "1a" }}><Icon className="w-5 h-5" style={{ color: meta.color }} /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{r.title}</p>
                    <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{r.subtitle}</p>
                  </div>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0" style={{ backgroundColor: meta.color + "1a", color: meta.color }}>{meta.label}</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
