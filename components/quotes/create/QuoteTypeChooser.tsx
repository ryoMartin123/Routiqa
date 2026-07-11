"use client";

// Quote creation entry point. Replaces the old "always build a full proposal"
// flow with a 3-path chooser. All three paths create the SAME core Quote record
// (differing only by quoteMode + how prefilled it is), then route to the editor
// that fits the path:
//   quick    → /quotes/[id]/quick      (simple catalog quote)
//   template → /quotes/[id]/proposal   (proposal workspace, prefilled from a salesbook)
//   custom   → /quotes/[id]/custom     (proposal studio; pricing calculator lives inside)

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  X, ArrowRight, ArrowLeft, Zap, LayoutTemplate, SlidersHorizontal,
  Check, BookOpen, Settings2,
} from "lucide-react";
import UiSelect from "@/components/ui/Select";
import AccountSearchSelect from "@/components/customers/AccountSearchSelect";
import { getAllCustomers, getProperties, getLeads, getJobs } from "@/lib/customers/data";
import { ALL_PROJECTS } from "@/lib/projects/data";
import { createQuote, type QuoteSection, type QuoteOption } from "@/lib/quotes/data";
import type { QuoteMode } from "@/lib/quotes/types";
import { buildSectionsFromKeys } from "@/lib/proposals/data";
import { getInstalledForCompany, getSalesbookTemplate, salesbookDesignId, INDUSTRY_LABELS, PROPOSAL_TYPE_LABELS, type CompanySalesbook } from "@/lib/salesbooks/data";
import { getDefaultDesignIdForQuickQuote, getDefaultDesignIdForCustom } from "@/lib/quotes/quoteDesigns";

type RelatedKind = "none" | "lead" | "job" | "project";
type Step = "type" | "details";

export interface QuoteTypeChooserPreset {
  customerId?: string;
  propertyId?: string;
  leadId?: string;
  jobId?: string;
  projectId?: string;
  lockCustomer?: boolean;
}

// Default section sets for the non-template paths.
const QUICK_SECTIONS  = ["cover_header", "customer_info", "property_info", "line_items", "approval"] as const;

const CARDS: { mode: QuoteMode; title: string; subtitle: string; bestFor: string; icon: typeof Zap; accent: string }[] = [
  { mode: "quick",    title: "Quick Quote",            subtitle: "Simple branded quote from catalog items.",        bestFor: "Repairs, add-ons, standard services, simple line-item quotes.", icon: Zap,              accent: "#0f8578" },
  { mode: "template", title: "Proposal from Salesbook",  subtitle: "Pick a salesbook — the quote is built and opened instantly.", bestFor: "Good/Better/Best options, equipment replacements, packages, maintenance plans.", icon: LayoutTemplate, accent: "#0891b2" },
  { mode: "custom",   title: "Custom Proposal",        subtitle: "Build pricing, scope, photos, and layout from scratch.", bestFor: "Complex jobs, custom scopes, margin-based pricing, large installs, commercial.", icon: SlidersHorizontal, accent: "#7c3aed" },
];

export default function QuoteTypeChooser({ preset, onClose }: {
  preset?: QuoteTypeChooserPreset;
  onClose: () => void;
}) {
  const router = useRouter();
  const customers = getAllCustomers();

  const [step, setStep] = useState<Step>("type");
  const [mode, setMode] = useState<QuoteMode>("quick");

  const [customerId, setCustomerId] = useState(preset?.customerId ?? customers[0]?.id ?? "");
  // A quote is anchored to a property by default — auto-select the account's first
  // property (the rep can change it). Falls back to none only when the account has
  // no properties at all (new lead, B2B/no site).
  const [propertyId, setPropertyId] = useState(
    preset?.propertyId ?? getProperties(preset?.customerId ?? customers[0]?.id ?? "")[0]?.id ?? "");
  const [relatedKind, setRelatedKind] = useState<RelatedKind>(
    preset?.leadId ? "lead" : preset?.jobId ? "job" : preset?.projectId ? "project" : "none");
  const [relatedId, setRelatedId] = useState(preset?.leadId ?? preset?.jobId ?? preset?.projectId ?? "");
  const [title, setTitle] = useState("");

  // Template-path source: a company salesbook ("sb:<id>") or proposal template ("pt:<id>").
  const installed = useMemo(() => {
    const customer = customers.find(c => c.id === (preset?.customerId ?? customerId));
    return getInstalledForCompany(customer?.companyId);
  }, [customers, customerId, preset?.customerId]);
  const [sourceKey, setSourceKey] = useState<string>("");

  const customer = customers.find(c => c.id === customerId);
  const properties = useMemo(() => (customerId ? getProperties(customerId) : []), [customerId]);
  const leads = useMemo(() => (customerId ? getLeads(customerId) : []), [customerId]);
  const jobs = useMemo(() => (customerId ? getJobs(customerId) : []), [customerId]);
  const projects = useMemo(() => ALL_PROJECTS.filter(p => p.accountId === customerId), [customerId]);

  function relatedOptions() {
    if (relatedKind === "lead") return leads.map(l => ({ value: l.id, label: l.title }));
    if (relatedKind === "job") return jobs.map(j => ({ value: j.id, label: j.title }));
    if (relatedKind === "project") return projects.map(p => ({ value: p.id, label: p.name }));
    return [];
  }
  function linkFields() {
    if (relatedKind === "none" || !relatedId) return {};
    if (relatedKind === "lead") { const l = leads.find(x => x.id === relatedId); return { leadId: relatedId, linkedType: "lead" as const, linkedId: relatedId, linkedLabel: l ? `Lead: ${l.title}` : "Lead" }; }
    if (relatedKind === "job") { const j = jobs.find(x => x.id === relatedId); return { jobId: relatedId, linkedType: "job" as const, linkedId: relatedId, linkedLabel: j ? `Job: ${j.title}` : "Job" }; }
    const p = projects.find(x => x.id === relatedId); return { projectId: relatedId, linkedType: "project" as const, linkedId: relatedId, linkedLabel: p ? `Project: ${p.name}` : "Project" };
  }

  const selProperty = properties.find(p => p.id === propertyId);
  const propertyLabel = selProperty ? `${selProperty.label ? selProperty.label + " — " : ""}${selProperty.address}, ${selProperty.city}` : undefined;

  // Resolve the chosen template source into a default title + snapshot-copied
  // sections + option cards. Everything is COPIED so editing the quote later
  // never changes the master salesbook/template.
  function resolveTemplateSource(): { sections: QuoteSection[]; options: QuoteOption[]; defaultTitle: string; salesbookId?: string; proposalTemplateId?: string; quoteDesignId?: string; expirationDays: number } | null {
    if (!sourceKey) return null;
    const [kind, id] = sourceKey.split(":");
    if (kind === "sb") {
      const sb = installed.find(s => s.id === id);
      if (!sb) return null;
      // Use the COMPANY copy's own (editable) sections + options so edits made in
      // the salesbook editor flow into new quotes. The master proposal template is
      // kept only as a layout reference link.
      const master = sb.copiedFromTemplateId ? getSalesbookTemplate(sb.copiedFromTemplateId) : undefined;
      const ptId = master?.proposalTemplateId;
      const sections = buildSectionsFromKeys(sb.sections).map(s => ({ key: s.key, label: s.label, body: s.body, visible: s.visible }));
      const options: QuoteOption[] = sb.options.map((o, i) => ({ ...o, id: `qopt-${Date.now()}-${i}` }));
      // Snapshot the salesbook's Quote Design so the customer-facing layout follows
      // it (the quote can override it later).
      return { sections, options, defaultTitle: sb.name, salesbookId: sb.id, proposalTemplateId: ptId, quoteDesignId: salesbookDesignId(sb), expirationDays: 30 };
    }
    // Salesbook Library is the only source for the Template path.
    return null;
  }

  // A quote depends on a property whenever the account has one; only accounts with
  // no properties at all may continue without one.
  const hasProperties = properties.length > 0;
  const canContinue = (mode === "template" ? Boolean(customerId && sourceKey) : Boolean(customerId))
    && (!hasProperties || Boolean(propertyId));

  function defaultExpiry(days: number): string {
    const exp = new Date(); exp.setDate(exp.getDate() + days);
    return exp.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  function handleCreate() {
    if (!customer) return;
    const link = linkFields();
    const base = {
      customerId, customerName: customer.name, customerInitials: customer.initials, locationName: customer.locationName,
      companyId: customer.companyId, locationId: customer.locationId, serviceAreaId: customer.serviceAreaId,
      propertyId: propertyId || undefined, propertyLabel,
      lineItems: [], taxRate: 0,
      ...link,
    };

    if (mode === "template") {
      const src = resolveTemplateSource();
      if (!src) return;
      const q = createQuote({
        ...base, quoteMode: "template",
        title: title.trim() || src.defaultTitle,
        expiresAt: defaultExpiry(src.expirationDays),
        sections: src.sections, options: src.options,
        salesbookId: src.salesbookId, proposalTemplateId: src.proposalTemplateId,
        // The salesbook carries its own Quote Design; the quote renders as a
        // salesbook proposal (the design adapts/falls back if it must).
        quoteDesignId: src.quoteDesignId, renderMode: "salesbook",
      });
      onClose();
      router.push(`/quotes/${q.id}`);
      return;
    }

    // Quick quotes get their fixed section set; CUSTOM starts with NO sections —
    // the builder's start chooser (blank / starter / from a Quote Design) owns
    // the structure decision, so pre-seeding here would defeat it.
    const sections: QuoteSection[] = mode === "quick"
      ? buildSectionsFromKeys([...QUICK_SECTIONS]).map(s => ({ key: s.key, label: s.label, body: s.body, visible: s.visible }))
      : [];
    const q = createQuote({
      ...base, quoteMode: mode,
      title: title.trim() || (mode === "quick" ? "Quick Quote" : "Custom Proposal"),
      expiresAt: defaultExpiry(30), sections,
      // Each quote type starts from its own default Quote Design (Settings →
      // Salesbook Library → Defaults). A new custom quote with one thing renders as
      // a single offer; quick quotes render the quick-quote layout.
      quoteDesignId: mode === "quick" ? getDefaultDesignIdForQuickQuote() : getDefaultDesignIdForCustom(),
      renderMode: mode === "quick" ? "quick_quote" : "single_offer",
    });
    onClose();
    router.push(mode === "quick" ? `/quotes/${q.id}/quick` : `/quotes/${q.id}/custom`);
  }

  const activeCard = CARDS.find(c => c.mode === mode)!;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl overflow-hidden" onClick={e => e.stopPropagation()}
        style={{ backgroundColor: "var(--bg-surface)", boxShadow: "0 16px 48px rgba(0,0,0,0.28)" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2 min-w-0">
            {step === "details" && (
              <button onClick={() => setStep("type")} className="mr-1" style={{ color: "var(--text-muted)" }}><ArrowLeft className="w-4 h-4" /></button>
            )}
            <div className="min-w-0">
              <p className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
                {step === "type" ? "Create Quote" : activeCard.title}
              </p>
              <p className="text-[11px] mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
                {step === "type" ? "Choose how you want to build this quote." : activeCard.subtitle}
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ color: "var(--text-muted)" }}><X className="w-4 h-4" /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto thin-scroll-y px-6 py-5">
          {step === "type" ? (
            <div className="grid gap-3">
              {CARDS.map(card => {
                const Icon = card.icon;
                return (
                  <button key={card.mode}
                    onClick={() => { setMode(card.mode); setStep("details"); }}
                    className="group flex items-start gap-4 p-4 rounded-xl text-left transition-all hover:shadow-md"
                    style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)" }}>
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: card.accent + "1a" }}>
                      <Icon className="w-5 h-5" style={{ color: card.accent }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{card.title}</p>
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>{card.subtitle}</p>
                      <p className="text-[11px] mt-1.5" style={{ color: "var(--text-muted)" }}>
                        <span className="font-medium">Best for:</span> {card.bestFor}
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 shrink-0 mt-1 opacity-0 group-hover:opacity-60 transition-opacity" style={{ color: card.accent }} />
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Customer */}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Customer / Account *</label>
                <AccountSearchSelect customers={customers} value={customerId}
                  onChange={v => { setCustomerId(v); setPropertyId(getProperties(v)[0]?.id ?? ""); setRelatedId(""); setSourceKey(""); }} disabled={Boolean(preset?.lockCustomer)} />
              </div>
              {/* Property — the quote is anchored to it. Required when the account has one. */}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                  Property{hasProperties ? " *" : <span style={{ color: "var(--text-muted)" }}> (optional)</span>}
                </label>
                {hasProperties ? (
                  <UiSelect value={propertyId} onChange={setPropertyId} placeholder="Select a property…"
                    options={properties.map(p => ({ value: p.id, label: `${p.label ? p.label + " — " : ""}${p.address}, ${p.city}` }))} />
                ) : (
                  <div className="rounded-lg px-3 py-2 text-xs" style={{ border: "1px dashed var(--border)", color: "var(--text-muted)" }}>
                    This account has no properties yet — the quote won&apos;t be tied to a specific property.
                  </div>
                )}
              </div>
              {/* Optional extra pipeline link — the property is the primary anchor. */}
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Also link to <span style={{ color: "var(--text-muted)" }}>(optional)</span></label>
                <div className="flex items-center rounded-lg overflow-hidden w-fit mb-2" style={{ border: "1px solid var(--border)" }}>
                  {(["none", "lead", "job", "project"] as RelatedKind[]).map(k => {
                    const active = relatedKind === k;
                    return (
                      <button key={k} onClick={() => { setRelatedKind(k); setRelatedId(""); }}
                        className="px-3 py-1.5 text-xs font-medium capitalize transition-colors"
                        style={{ backgroundColor: active ? "#0f8578" : "var(--bg-surface)", color: active ? "#fff" : "var(--text-secondary)" }}>
                        {k === "none" ? "None" : k}
                      </button>
                    );
                  })}
                </div>
                {relatedKind !== "none" && (
                  relatedOptions().length > 0
                    ? <UiSelect value={relatedId} onChange={setRelatedId} placeholder={`Select a ${relatedKind}…`} options={relatedOptions()} />
                    : <p className="text-xs" style={{ color: "var(--text-muted)" }}>No {relatedKind}s for this customer.</p>
                )}
              </div>

              {/* Template-path source picker */}
              {mode === "template" && (
                <TemplateSourcePicker installed={installed}
                  value={sourceKey} onChange={setSourceKey} onBrowseLibrary={() => { onClose(); router.push("/settings"); }} />
              )}

              {/* Title */}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Title <span style={{ color: "var(--text-muted)" }}>(optional)</span></label>
                <input value={title} onChange={e => setTitle(e.target.value)}
                  placeholder={mode === "quick" ? "e.g. Capacitor Replacement" : mode === "custom" ? "e.g. Rooftop Unit Replacement" : "e.g. HVAC System Replacement"}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {step === "details" && (
          <div className="px-6 py-4 flex items-center justify-between shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
            <span className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
              <activeCard.icon className="w-3.5 h-3.5" />
              {mode === "quick" ? "Opens the Quick Quote editor" : mode === "template" ? "Builds the quote from your salesbook and opens it" : "Opens the Pricing Wizard"}
            </span>
            <button onClick={handleCreate} disabled={!canContinue}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40" style={{ backgroundColor: activeCard.accent }}>
              Continue <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Template-path source picker ──────────────────────────
function TemplateSourcePicker({ installed, value, onChange, onBrowseLibrary }: {
  installed: CompanySalesbook[];
  value: string;
  onChange: (v: string) => void;
  onBrowseLibrary: () => void;
}) {
  return (
    <div className="rounded-xl p-3.5 space-y-3" style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Choose a Salesbook</p>
        <button onClick={onBrowseLibrary} className="flex items-center gap-1 text-[11px] font-medium" style={{ color: "#0f8578" }}>
          <BookOpen className="w-3 h-3" /> Salesbook Library
        </button>
      </div>

      {installed.length === 0 ? (
        <div className="rounded-lg px-3 py-3 text-center" style={{ border: "1px dashed var(--border)" }}>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>No salesbooks installed yet.</p>
          <button onClick={onBrowseLibrary} className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium" style={{ color: "#0f8578" }}>
            <Settings2 className="w-3 h-3" /> Install one from the Salesbook Library
          </button>
        </div>
      ) : (
        <div className="grid gap-2">
          {installed.map(sb => {
            const active = value === `sb:${sb.id}`;
            return (
              <button key={sb.id} onClick={() => onChange(`sb:${sb.id}`)}
                className="flex items-center gap-3 p-2.5 rounded-lg text-left transition-all"
                style={{ border: `1px solid ${active ? "#0f8578" : "var(--border-subtle)"}`, backgroundColor: active ? "var(--accent-soft-bg)" : "var(--bg-surface)" }}>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "#0891b21a" }}>
                  <LayoutTemplate className="w-3.5 h-3.5" style={{ color: "#0891b2" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{sb.name}</p>
                  <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>
                    {INDUSTRY_LABELS[sb.industry]} · {PROPOSAL_TYPE_LABELS[sb.proposalType]} · {sb.sections.length} sections
                  </p>
                </div>
                {active && <Check className="w-4 h-4 shrink-0" style={{ color: "#0f8578" }} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
