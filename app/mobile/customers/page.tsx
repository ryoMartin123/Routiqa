"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, ChevronRight, Building2, Home } from "lucide-react";
import MobileHeader from "@/components/mobile/MobileHeader";
import { Card, EmptyState, ACCENT } from "@/components/mobile/ui";
import { getAllCustomers } from "@/lib/customers/data";

export default function MobileCustomersPage() {
  const [q, setQ] = useState("");
  const customers = useMemo(() => {
    const all = getAllCustomers();
    const s = q.trim().toLowerCase();
    return (s ? all.filter(c => `${c.name} ${c.phone} ${c.city} ${c.email ?? ""}`.toLowerCase().includes(s)) : all).slice(0, 60);
  }, [q]);

  return (
    <div>
      <MobileHeader title="Customers" subtitle={`${getAllCustomers().length} accounts`} />
      <div className="px-4 space-y-3">
        <div className="flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)" }}>
          <Search className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search customers" className="bg-transparent text-sm outline-none w-full" style={{ color: "var(--text-primary)" }} />
        </div>
        {customers.length === 0 ? (
          <EmptyState icon={Search} title="No customers" hint="Try a different search." />
        ) : (
          <Card>
            {customers.map((c, i) => (
              <Link key={c.id} href={`/mobile/customers/${c.id}`} className="flex items-center gap-3 px-4 py-3 active:bg-[var(--bg-surface-2)]" style={{ borderTop: i ? "1px solid var(--border)" : "none" }}>
                <span className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0" style={{ backgroundColor: ACCENT }}>{c.initials}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{c.name}</p>
                  <p className="text-xs truncate flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
                    {c.type === "Commercial" ? <Building2 className="w-3 h-3" /> : <Home className="w-3 h-3" />}{c.type} · {c.city}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 shrink-0" style={{ color: "var(--text-muted)" }} />
              </Link>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}
