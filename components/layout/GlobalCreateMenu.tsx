"use client";

// Global "Create" button + dropdown in the top bar. Hosts the operational
// create modals (Customer / Job / Quote) so a new record can be started from
// anywhere, not just that record's list page. The modals are fixed overlays,
// so mounting them here (always-present in the top bar) works on every route.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, ChevronDown, UserPlus, Briefcase, FileText } from "lucide-react";
import NewCustomerModal from "@/components/customers/NewCustomerModal";
import JobWizard from "@/components/jobs/JobWizard";
import QuickCreateQuoteModal from "@/components/quotes/QuickCreateQuoteModal";

type CreateKind = "customer" | "job" | "quote";

const ITEMS: { kind: CreateKind; label: string; sublabel: string; icon: typeof UserPlus }[] = [
  { kind: "customer", label: "Customer",       sublabel: "Account or prospect", icon: UserPlus },
  { kind: "job",      label: "Job",            sublabel: "Schedule or dispatch", icon: Briefcase },
  { kind: "quote",    label: "Quote / Estimate", sublabel: "Build a proposal",   icon: FileText },
];

export default function GlobalCreateMenu() {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [active, setActive]     = useState<CreateKind | null>(null);

  function choose(kind: CreateKind) {
    setMenuOpen(false);
    setActive(kind);
  }

  return (
    <>
      <div className="relative">
        <button
          onClick={() => setMenuOpen(o => !o)}
          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          <Plus className="w-4 h-4" />
          Create
          <ChevronDown className="w-3.5 h-3.5 opacity-80" style={{ transform: menuOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
        </button>

        {menuOpen && (
          <>
            {/* click-away backdrop */}
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
            <div
              role="menu"
              className="absolute right-0 mt-1.5 w-60 rounded-xl overflow-hidden z-50 py-1"
              style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "0 12px 32px rgba(0,0,0,0.18)" }}
            >
              <p className="text-[10px] font-semibold uppercase tracking-widest px-3 pt-2 pb-1" style={{ color: "var(--text-muted)" }}>
                Create new
              </p>
              {ITEMS.map(item => (
                <button
                  key={item.kind}
                  role="menuitem"
                  onClick={() => choose(item.kind)}
                  className="w-full flex items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-[var(--bg-surface-2)]"
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "#e0e7ff" }}>
                    <item.icon className="w-4 h-4" style={{ color: "#4f46e5" }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{item.label}</p>
                    <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{item.sublabel}</p>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Hosted create modals */}
      <NewCustomerModal open={active === "customer"} onClose={() => setActive(null)} />

      {active === "job" && (
        <JobWizard
          onClose={() => setActive(null)}
          onCreated={(id) => { setActive(null); router.push(`/jobs/${id}`); }}
        />
      )}

      {active === "quote" && (
        <QuickCreateQuoteModal
          onClose={() => setActive(null)}
          onContinue={(id) => { setActive(null); router.push(`/quotes/${id}/builder`); }}
        />
      )}
    </>
  );
}
