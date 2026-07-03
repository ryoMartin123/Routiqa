"use client";

import { useMemo, useState } from "react";
import { FileText, Search, ChevronRight } from "lucide-react";
import MobileHeader from "@/components/mobile/MobileHeader";
import { Card } from "@/components/mobile/ui";
import { getDocuments } from "@/lib/mobile/portal";

const CAT_COLOR: Record<string, string> = { HR: "#a855f7", SOPs: "#2563eb", Safety: "#dc2626", Field: "#16a34a" };

export default function DocumentsPage() {
  const [q, setQ] = useState("");
  const docs = useMemo(() => getDocuments().filter(d => (d.title + d.category).toLowerCase().includes(q.toLowerCase())), [q]);

  return (
    <div>
      <MobileHeader title="Documents & SOPs" back />
      <div className="px-4 space-y-3">
        <div className="flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)" }}>
          <Search className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search documents" className="bg-transparent text-sm outline-none w-full" style={{ color: "var(--text-primary)" }} />
        </div>
        <Card>
          {docs.map((d, i) => {
            const c = CAT_COLOR[d.category] ?? "#6b7280";
            return (
              <button key={d.id} className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-[var(--bg-surface-2)]" style={{ borderTop: i ? "1px solid var(--border)" : "none" }}>
                <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: c + "1a" }}><FileText className="w-4 h-4" style={{ color: c }} /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{d.title}</p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>{d.category} · Updated {d.updated}</p>
                </div>
                <ChevronRight className="w-4 h-4 shrink-0" style={{ color: "var(--text-muted)" }} />
              </button>
            );
          })}
        </Card>
      </div>
    </div>
  );
}
