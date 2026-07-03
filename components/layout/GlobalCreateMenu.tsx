"use client";

// Global "Create" button — a minimalist icon trigger in the top bar that opens a
// centered popup to create any primary record. Records with a modal creator
// (customer, job, quote, invoice, agreement) open it in place from any route;
// the rest jump to their section to create there.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, X, UserPlus, Briefcase, FileText, Receipt, FileCheck,
  TrendingUp, FolderKanban, ListChecks,
} from "lucide-react";
import NewCustomerModal from "@/components/customers/NewCustomerModal";
import JobWizard from "@/components/jobs/JobWizard";
import LeadWizard from "@/components/leads/LeadWizard";
import ProjectWizard from "@/components/projects/ProjectWizard";
import QuoteTypeChooser from "@/components/quotes/create/QuoteTypeChooser";
import InvoiceWizard from "@/components/quotes/InvoiceWizard";

type ModalKind = "customer" | "lead" | "job" | "project" | "quote" | "invoice";

const MODAL_ITEMS: { kind: ModalKind; label: string; sublabel: string; icon: typeof UserPlus }[] = [
  { kind: "customer",  label: "Customer",         sublabel: "Account or prospect",  icon: UserPlus },
  { kind: "lead",      label: "Lead",             sublabel: "Sales pipeline",       icon: TrendingUp },
  { kind: "job",       label: "Job",              sublabel: "Schedule or dispatch", icon: Briefcase },
  { kind: "project",   label: "Project",          sublabel: "Multi-job work",       icon: FolderKanban },
  { kind: "quote",     label: "Quote / Estimate", sublabel: "Build a proposal",     icon: FileText },
  { kind: "invoice",   label: "Invoice",          sublabel: "Bill a customer",      icon: Receipt },
];

const NAV_ITEMS: { label: string; sublabel: string; href: string; icon: typeof UserPlus }[] = [
  { label: "Agreement", sublabel: "Maintenance plan",  href: "/agreements/new", icon: FileCheck },
  { label: "Task",      sublabel: "Follow-up / to-do", href: "/tasks",          icon: ListChecks },
];

export default function GlobalCreateMenu() {
  const router = useRouter();
  const [open, setOpen]     = useState(false);
  const [active, setActive] = useState<ModalKind | null>(null);

  // Escape closes the popup.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Create"
        className="plus-glow flex items-center justify-center w-9 h-9 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
        aria-haspopup="dialog" aria-expanded={open}
      >
        <Plus className="w-5 h-5" />
      </button>

      {/* Centered popup */}
      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div role="dialog" aria-modal="true" className="w-full max-w-lg rounded-2xl overflow-hidden" onClick={e => e.stopPropagation()}
            style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 16px 48px rgba(0,0,0,0.24)" }}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
              <p className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Create new</p>
              <button onClick={() => setOpen(false)} style={{ color: "var(--text-muted)" }}><X className="w-4 h-4" /></button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-5">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>Records</p>
                <div className="grid grid-cols-2 gap-2.5">
                  {MODAL_ITEMS.map(item => (
                    <Tile key={item.kind} icon={item.icon} label={item.label} sublabel={item.sublabel}
                      onClick={() => { setOpen(false); setActive(item.kind); }} />
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>Open to create</p>
                <div className="grid grid-cols-3 gap-2.5">
                  {NAV_ITEMS.map(item => (
                    <Tile key={item.href} icon={item.icon} label={item.label} sublabel={item.sublabel}
                      onClick={() => { setOpen(false); router.push(item.href); }} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hosted create modals */}
      <NewCustomerModal open={active === "customer"} onClose={() => setActive(null)} />

      {active === "lead" && (
        <LeadWizard onClose={() => setActive(null)} onCreated={(id) => { setActive(null); router.push(`/leads/${id}`); }} />
      )}
      {active === "job" && (
        <JobWizard onClose={() => setActive(null)} onCreated={(id) => { setActive(null); router.push(`/jobs/${id}`); }} />
      )}
      {active === "project" && (
        <ProjectWizard onClose={() => setActive(null)} onCreated={(id) => { setActive(null); router.push(`/projects/${id}`); }} />
      )}
      {active === "quote" && (
        <QuoteTypeChooser onClose={() => setActive(null)} />
      )}
      {active === "invoice" && (
        <InvoiceWizard onClose={() => setActive(null)} onCreated={(id) => { setActive(null); router.push(`/invoices/${id}`); }} />
      )}
    </>
  );
}

function Tile({ icon: Icon, label, sublabel, onClick }: { icon: typeof UserPlus; label: string; sublabel: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-3 p-3 rounded-xl text-left transition-colors hover:bg-[var(--bg-surface-2)]"
      style={{ border: "1px solid var(--border)" }}>
      <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--accent-soft-bg)" }}>
        <Icon className="w-4 h-4" style={{ color: "var(--accent-text)" }} />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{label}</p>
        <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>{sublabel}</p>
      </div>
    </button>
  );
}
