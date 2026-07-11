"use client";

// ─── Salesbook Studio — step-by-step proposal-template builder ──
// Full-screen, wizard-style (same spirit as the marketing Campaign Studio):
// a numbered step rail on the left, ONE focused editor panel per step in the
// middle, and the real customer-facing proposal (sample customer data) building
// itself in real time on the right. Every edit lands in the live document
// immediately, and publishing gates on the same validation as before.
//
// This edits the company-owned COPY — never the CRM master template.

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { pingSaved } from "@/components/shared/SavedPill";
import {
  ArrowLeft, ArrowRight, X, Plus, Eye, EyeOff, Trash2, Copy, Check,
  ChevronUp, ChevronDown, ChevronRight, Star, AlertTriangle, CheckCircle2, Send,
  Package, Palette, CreditCard, ShieldCheck, Image as ImageIcon, Info, FileText,
} from "lucide-react";
import UiSelect from "@/components/ui/Select";
import NumberStepper from "@/components/ui/NumberStepper";
import OptionImageInput from "@/components/quotes/OptionImageInput";
import ProposalFamilyDocument from "@/components/quotes/family/ProposalFamilyDocument";
import { QuoteDesignThumbnail } from "@/components/settings/QuoteDesignsManager";
import { OfferGroupPicker } from "@/components/settings/OfferLibrarySection";
import { MediaPickerModal } from "@/components/settings/MediaLibrarySection";
import { ContentBlockPicker } from "@/components/settings/ContentBlocksSection";
import type { ContentBlockType } from "@/lib/content-blocks/data";
import { snapshotOfferOptions, type OfferGroup } from "@/lib/offers/data";
import { getSectionBlock, type SectionKey } from "@/lib/proposals/data";
import { buildProposalDoc, type ProposalDocData } from "@/lib/quotes/proposalDoc";
import {
  getQuoteDesign, getQuoteDesigns, resolveQuoteDesign, designFamilyLabel,
  designSupportsMode, defaultQuoteDesignId, type QuoteDesign, type QuoteDesignMode,
} from "@/lib/quotes/quoteDesigns";
import type { LineItem, QuoteOption, QuoteSection } from "@/lib/quotes/data";
import {
  getCompanySalesbook, updateCompanySalesbook, blankSalesbookOption, blankSalesbookSection,
  blankSalesbookMedia, ensureSectionLayout, sectionsFromLayout, salesbookStatus, defaultSectionLayout,
  validateSalesbookForPublish, salesbookDesignId,
  PROPOSAL_TYPE_LABELS, MEDIA_CATEGORY_LABELS,
  type SalesbookOption, type SalesbookSection, type SalesbookMedia, type SalesbookMediaCategory,
  type SalesbookIndustry, type SalesbookProposalType, type SalesbookStatus,
} from "@/lib/salesbooks/data";

const ACCENT = "#0f8578";
const DOC_W = 816;   // ProposalFamilyDocument's own max width

const inputCls = "w-full rounded-lg px-2.5 py-2 text-sm outline-none";
const inputStyle: React.CSSProperties = { border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" };

// ─── Sample data for the live document ────────────────────
const SAMPLE = {
  customerName: "Jordan & Casey Rivera",
  propertyLabel: "1846 Magnolia Ridge Dr, Evans, GA 30809",
  assignedTo: "Alex Morgan",
  quoteNumber: "Q-2026-0148",
  createdAt: "Jun 20, 2026",
  expiresAt: "Jul 20, 2026",
};
const SAMPLE_LINE_ITEMS: LineItem[] = [
  { id: "s1", name: "Equipment & materials", description: "Per the recommended solution", quantity: 1, unitPrice: 9200, total: 9200, taxable: true },
  { id: "s2", name: "Installation & labor", description: "Includes haul-away, startup & test", quantity: 1, unitPrice: 2400, total: 2400, taxable: false },
];

// ─── Draft state (same contract as the old tabbed editor) ─
interface DraftState {
  name: string;
  bestFor: string;
  industry: SalesbookIndustry;
  proposalType: SalesbookProposalType;
  status: SalesbookStatus;
  quoteDesignId: string;
  sectionLayout: SalesbookSection[];
  offerGroupIds: string[];
  options: SalesbookOption[];
  media: SalesbookMedia[];
  coverImageId?: string;
  showMonthly: boolean;
  monthlyEnabled: boolean;
  financingNote: string;
  financingDisclaimer: string;
  warranty: string;
  workmanship: string;
  validityDays: number;
  depositTerms: string;
  terms: string;
  exclusions: string;
}

function initDraft(o: NonNullable<ReturnType<typeof getCompanySalesbook>>): DraftState {
  return {
    name: o.name ?? "",
    bestFor: o.bestFor ?? "",
    industry: o.industry,
    proposalType: o.proposalType,
    status: salesbookStatus(o),
    quoteDesignId: salesbookDesignId(o),
    sectionLayout: ensureSectionLayout(o),
    offerGroupIds: o.offerGroupIds ?? [],
    options: o.options ?? [],
    media: o.media ?? [],
    coverImageId: o.coverImageId,
    showMonthly: o.showMonthly ?? !!o.financingNote,
    monthlyEnabled: o.monthlyEnabled ?? true,
    financingNote: o.financingNote ?? "",
    financingDisclaimer: o.financingDisclaimer ?? "",
    warranty: o.warranty ?? "",
    workmanship: o.workmanship ?? "",
    validityDays: o.validityDays ?? 30,
    depositTerms: o.depositTerms ?? "",
    terms: o.terms ?? "",
    exclusions: o.exclusions ?? "",
  };
}

function nowStamp(): string {
  return new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// Resolve the draft's visible sections into customer-facing proposal sections,
// folding the dedicated financing / warranty / terms wording into their bodies.
function previewSections(sb: DraftState): QuoteSection[] {
  return sb.sectionLayout.filter(s => s.visible).map(s => {
    let body = s.body ?? getSectionBlock(s.key)?.defaultBody ?? "";
    if (s.key === "financing_note") body = [sb.financingNote || body, sb.financingDisclaimer].filter(Boolean).join("\n\n");
    else if (s.key === "warranty")  body = [sb.warranty || body, sb.workmanship].filter(Boolean).join("\n\n");
    else if (s.key === "terms")     body = [sb.terms || body, sb.depositTerms, sb.exclusions ? `Exclusions: ${sb.exclusions}` : ""].filter(Boolean).join("\n\n");
    return { key: s.key, label: s.label, body, visible: true };
  });
}

function previewDoc(sb: DraftState): ProposalDocData {
  const options: QuoteOption[] = sb.options.map(o => ({
    ...o,
    monthlyPrice: sb.monthlyEnabled ? o.monthlyPrice : undefined,
  }));
  return buildProposalDoc({
    quoteNumber: SAMPLE.quoteNumber, title: sb.name || "Proposal",
    customerName: SAMPLE.customerName, propertyLabel: SAMPLE.propertyLabel,
    assignedTo: SAMPLE.assignedTo, createdAt: SAMPLE.createdAt,
    expiresAt: SAMPLE.expiresAt,
    sections: previewSections(sb), lineItems: SAMPLE_LINE_ITEMS, options,
    subtotal: 11600, taxRatePct: 7, tax: 812, total: 12412,
  });
}

// ─── Steps ────────────────────────────────────────────────
// No Sections step: the Quote Design brings its own section layout, and the
// studio auto-manages the content-driven ones (options → gbb_options section,
// financing wording → financing_note section). Sections stay on the record for
// the quote-creation contract — they're just not a user-facing concept here.
type StepKey = "basics" | "design" | "content" | "options" | "financing" | "warranty" | "media" | "review";

// Labels stay short — the stepper lives in the header (Campaign Studio pattern).
const STEPS: { key: StepKey; label: string; icon: typeof Info; optional?: boolean }[] = [
  { key: "basics",    label: "Basics",    icon: Info },
  { key: "design",    label: "Design",    icon: Palette },
  { key: "content",   label: "Content",   icon: FileText },
  { key: "options",   label: "Options",   icon: Package },
  { key: "financing", label: "Financing", icon: CreditCard, optional: true },
  { key: "warranty",  label: "Warranty",  icon: ShieldCheck },
  { key: "media",     label: "Media",     icon: ImageIcon, optional: true },
  { key: "review",    label: "Publish",   icon: Send },
];

// ─── Content slots ────────────────────────────────────────
// The design's TEXT sections are the template's content slots — each syncs with
// a Content Block type, so "Insert saved wording" only offers blocks that belong
// in that slot. Slots come FROM the design; the template just fills them.
const SLOT_BLOCK_TYPE: Partial<Record<SectionKey, ContentBlockType>> = {
  problem_need: "problem_need",
  recommended_solution: "recommended_solution",
  scope_of_work: "scope_of_work",
  custom_text: "custom",
  optional_addons: "addon_explanation",
  // inspection_findings has no dedicated block type — the picker opens unfiltered
};
const SLOT_KEYS: SectionKey[] = [
  "problem_need", "inspection_findings", "recommended_solution", "scope_of_work", "custom_text", "optional_addons",
];
const contentSlots = (sb: DraftState) => sb.sectionLayout.filter(s => SLOT_KEYS.includes(s.key));
const slotFilled = (s: SalesbookSection) => !!(s.body ?? getSectionBlock(s.key)?.defaultBody ?? "").trim();

// Make sure `key` exists (and is visible) in the layout — inserted before the
// first of `before` that's present, else appended. This is how the studio
// manages sections now that they're derived instead of hand-edited.
function ensureSection(layout: SalesbookSection[], key: SectionKey, before: SectionKey[]): SalesbookSection[] {
  const existing = layout.find(s => s.key === key);
  if (existing) return existing.visible ? layout : layout.map(s => s.key === key ? { ...s, visible: true } : s);
  const sec = blankSalesbookSection(key);
  const i = layout.findIndex(s => before.includes(s.key));
  return i >= 0 ? [...layout.slice(0, i), sec, ...layout.slice(i)] : [...layout, sec];
}

// Section layout for a chosen design: the design's default skeleton, carrying
// over any wording/labels the previous layout had for the same section keys,
// plus the options section when options already exist.
function layoutForDesign(d: QuoteDesign, prev: SalesbookSection[], hasOptions: boolean): SalesbookSection[] {
  const prevByKey = new Map(prev.map(s => [s.key, s]));
  let next = defaultSectionLayout([...d.defaultSections]).map(fresh => {
    const old = prevByKey.get(fresh.key);
    return old ? { ...fresh, label: old.label, body: old.body, contentBlockId: old.contentBlockId } : fresh;
  });
  if (hasOptions) next = ensureSection(next, "gbb_options", ["line_items", "financing_note", "warranty", "terms", "approval"]);
  return next;
}

// ─── Design ↔ content correlation ─────────────────────────
// What the template's content needs from a design: a Good/Better/Best proposal
// type or multiple options need a design that renders multi-option; everything
// else renders as a single offer. Quote Designs already declare supportedModes —
// the studio just has to read them.
function wantedMode(sb: DraftState): QuoteDesignMode {
  return sb.proposalType === "good_better_best" || sb.options.length > 1 ? "multi_option" : "single_offer";
}

// Inline mismatch warning shown on the Design and Options steps, with a one-click
// switch to a design that fits the content.
function DesignFitCallout({ sb, patch }: { sb: DraftState; patch: (p: Partial<DraftState>) => void }) {
  const design = getQuoteDesign(sb.quoteDesignId);
  const mode = wantedMode(sb);

  if (!designSupportsMode(design, mode)) {
    const target = getQuoteDesign(mode === "multi_option" ? defaultQuoteDesignId("good_better_best") : defaultQuoteDesignId(sb.proposalType));
    return (
      <Callout
        text={mode === "multi_option"
          ? `${design.name} can't display multiple options — your ${sb.options.length > 1 ? `${sb.options.length} options` : "Good/Better/Best options"} would fall back to a single-offer layout.`
          : `${design.name} is built for side-by-side options and this template renders a single offer.`}
        action={target.id !== design.id ? { label: `Switch to ${target.name}`, onClick: () => patch({ quoteDesignId: target.id }) } : undefined} />
    );
  }
  // The inverse trap: a comparison-only design with fewer than 2 options to compare.
  if (!designSupportsMode(design, "single_offer") && sb.options.length < 2) {
    return <Callout text={`${design.name} shows options side by side and needs at least 2 — add another option in the Options step.`} />;
  }
  return null;
}

function Callout({ text, action }: { text: string; action?: { label: string; onClick: () => void } }) {
  return (
    <div className="rounded-xl p-3 flex items-start gap-2" style={{ backgroundColor: "var(--warning-soft-bg)", border: "1px solid var(--warning-soft-border)" }}>
      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "var(--warning-icon)" }} />
      <div className="min-w-0 flex-1">
        <p className="text-xs leading-snug" style={{ color: "var(--warning-text)" }}>{text}</p>
        {action && (
          <button onClick={action.onClick} className="mt-1.5 text-xs font-semibold underline underline-offset-2" style={{ color: "var(--warning-text)" }}>
            {action.label}
          </button>
        )}
      </div>
    </div>
  );
}

// A step is "done" when its part of the template carries real content — this
// drives the checkmarks in the rail, not any gating (every step is always open).
function stepDone(k: StepKey, sb: DraftState, checkOk: boolean): boolean {
  switch (k) {
    case "basics":    return !!sb.name.trim() && !!sb.bestFor.trim();
    case "design":    return !!sb.quoteDesignId;
    case "content":   { const slots = contentSlots(sb); return slots.length > 0 && slots.every(slotFilled); }
    case "options":   return sb.options.length > 0;
    case "financing": return sb.showMonthly || !!sb.financingNote.trim();
    case "warranty":  return !!sb.terms.trim();
    case "media":     return sb.media.length > 0 || sb.options.some(o => o.image);
    case "review":    return checkOk && sb.status === "published";
  }
}

// ─── Studio ───────────────────────────────────────────────
export default function SalesbookStudio({ sbId, onBack }: { sbId: string; onBack: () => void }) {
  const original = useMemo(() => getCompanySalesbook(sbId), [sbId]);
  const [sb, setSb] = useState<DraftState | null>(() => original ? initDraft(original) : null);
  // Fresh drafts start on Basics; existing templates open on Options (the meat).
  const [step, setStep] = useState<StepKey>(() => original && (original.bestFor ?? "") !== "" ? "options" : "basics");
  const lastSnap = useRef<string | null>(null);

  const patch = (p: Partial<DraftState>) => setSb(s => s ? { ...s, ...p } : s);
  const check = useMemo(() => sb ? validateSalesbookForPublish(sb) : { ok: false, issues: [] }, [sb]);

  // Auto-save on real changes only (snapshot-guarded, like the old editor).
  useEffect(() => {
    if (!sb) return;
    const snap = JSON.stringify(sb);
    if (lastSnap.current === null) { lastSnap.current = snap; return; }
    if (lastSnap.current === snap) return;
    lastSnap.current = snap;
    const t = setTimeout(() => save(), 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sb]);

  // ── Live preview scale-to-fit ──
  const previewRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.75);
  useLayoutEffect(() => {
    const el = previewRef.current; if (!el) return;
    const fit = () => setScale(Math.min(1, Math.max(0.35, (el.clientWidth - 48) / DOC_W)));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (!original || !sb) {
    return (
      <div className="space-y-4">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm" style={{ color: "var(--text-secondary)" }}><ArrowLeft className="w-4 h-4" /> Proposal Templates</button>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>Template not found.</p>
      </div>
    );
  }

  function save(next?: Partial<DraftState>) {
    const draft = next ? { ...sb!, ...next } : sb!;
    updateCompanySalesbook(sbId, {
      name: draft.name.trim() || original!.name,
      bestFor: draft.bestFor,
      industry: draft.industry,
      proposalType: draft.proposalType,
      status: draft.status,
      quoteDesignId: draft.quoteDesignId,
      sectionLayout: draft.sectionLayout,
      sections: sectionsFromLayout(draft.sectionLayout),   // keep quote-creation contract in sync
      offerGroupIds: draft.offerGroupIds,
      options: draft.options,
      media: draft.media,
      coverImageId: draft.coverImageId,
      showMonthly: draft.showMonthly,
      monthlyEnabled: draft.monthlyEnabled,
      financingNote: draft.financingNote,
      financingDisclaimer: draft.financingDisclaimer,
      warranty: draft.warranty,
      workmanship: draft.workmanship,
      validityDays: draft.validityDays,
      depositTerms: draft.depositTerms,
      terms: draft.terms,
      exclusions: draft.exclusions,
      updatedAt: nowStamp(),
    });
    pingSaved();
  }

  const doc = previewDoc(sb);
  const { family, variant } = resolveQuoteDesign(sb.quoteDesignId);
  const stepIdx = STEPS.findIndex(s => s.key === step);
  const setStatus = (status: SalesbookStatus) => { patch({ status }); save({ status }); };

  return (
    <div className="fixed inset-0 z-[70] flex flex-col" style={{ backgroundColor: "var(--bg-page)" }}>
      {/* ── Header: back + name · centered stepper (Campaign Studio pattern) · publish ── */}
      <header className="flex items-center gap-4 px-4 h-14 shrink-0" style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--bg-surface)" }}>
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm font-medium shrink-0" style={{ color: "var(--text-secondary)" }}>
          <ArrowLeft className="w-4 h-4" /> Templates
        </button>
        <div className="h-5 w-px shrink-0" style={{ backgroundColor: "var(--border)" }} />
        {/* Fixed width — the name grows as you type in Basics; without a hard
            width the centered stepper would shift with every keystroke. */}
        <div className="flex items-center gap-2 w-[240px] shrink-0">
          <p className="text-base font-semibold truncate min-w-0" style={{ color: "var(--text-primary)" }}>{sb.name || "Untitled Proposal Template"}</p>
          <StatusPill status={sb.status} />
        </div>

        <div className="flex-1 flex items-center justify-center gap-1 min-w-0">
          {STEPS.map((s, i) => {
            const active = s.key === step;
            const done = stepDone(s.key, sb, check.ok);
            return (
              <div key={s.key} className="flex items-center gap-1">
                {i > 0 && <div className="w-5 h-px shrink-0" style={{ backgroundColor: done || active ? ACCENT : "var(--border)" }} />}
                <button onClick={() => setStep(s.key)}
                  title={s.optional && !done ? `${s.label} (optional)` : s.label}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                  style={{ backgroundColor: active ? ACCENT + "14" : "transparent", color: active ? ACCENT : done ? "var(--text-primary)" : "var(--text-muted)" }}>
                  <span className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] shrink-0"
                    style={{ backgroundColor: done ? ACCENT : active ? ACCENT + "22" : "var(--bg-input)", color: done ? "#fff" : active ? ACCENT : "var(--text-muted)" }}>
                    {done ? <Check className="w-2.5 h-2.5" /> : i + 1}
                  </span>
                  <span className="hidden lg:inline">{s.label}</span>
                </button>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {sb.status === "published" ? (
            <button onClick={() => setStatus("draft")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
              <EyeOff className="w-3.5 h-3.5" /> Unpublish
            </button>
          ) : (
            <button onClick={() => setStatus("published")} disabled={!check.ok}
              title={check.ok ? "Make this template selectable during quote creation" : `${check.issues.length} requirement${check.issues.length === 1 ? "" : "s"} left — see Publish`}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium text-white disabled:opacity-40" style={{ backgroundColor: ACCENT }}>
              <Send className="w-4 h-4" /> Publish
            </button>
          )}
          <button onClick={onBack} aria-label="Close" className="p-1.5 rounded-lg hover:bg-[var(--bg-surface-2)]" style={{ color: "var(--text-muted)" }}><X className="w-4 h-4" /></button>
        </div>
      </header>

      {/* ── Body: step editor · live preview ── */}
      <div className="flex-1 flex min-h-0">
        {/* Step editor */}
        <section className="w-[440px] shrink-0 flex flex-col min-h-0" style={{ borderRight: "1px solid var(--border)", backgroundColor: "var(--bg-surface)" }}>
          <div className="flex-1 overflow-y-auto thin-scroll-y p-5">
            {step === "basics"    && <BasicsStep    sb={sb} patch={patch} />}
            {step === "design"    && <DesignStep    sb={sb} patch={patch} />}
            {step === "content"   && <ContentStep   sb={sb} patch={patch} onJumpDesign={() => setStep("design")} />}
            {step === "options"   && <OptionsStep   sb={sb} patch={patch} />}
            {step === "financing" && <FinancingStep sb={sb} patch={patch} />}
            {step === "warranty"  && <WarrantyStep  sb={sb} patch={patch} />}
            {step === "media"     && <MediaStep     sb={sb} patch={patch} />}
            {step === "review"    && <ReviewStep    sb={sb} check={check} onPublish={() => setStatus("published")} onUnpublish={() => setStatus("draft")} onJump={setStep} />}
          </div>
          {/* Back / Continue — reinforce the flow without gating it */}
          <div className="flex items-center justify-between gap-2 px-5 py-3 shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
            <button onClick={() => stepIdx > 0 && setStep(STEPS[stepIdx - 1].key)} disabled={stepIdx === 0}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-30"
              style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
            <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>Step {stepIdx + 1} of {STEPS.length}</span>
            {stepIdx < STEPS.length - 1 ? (
              <button onClick={() => setStep(STEPS[stepIdx + 1].key)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: ACCENT }}>
                Continue <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <span className="w-[104px]" />
            )}
          </div>
        </section>

        {/* Live preview — the template building itself in real time */}
        <div ref={previewRef} className="flex-1 min-w-0 overflow-y-auto thin-scroll-y relative" style={{ backgroundColor: "var(--bg-page)" }}>
          <div className="sticky top-0 z-10 flex items-center gap-2 px-4 py-2"
            style={{ backgroundColor: "color-mix(in srgb, var(--bg-page) 88%, transparent)", backdropFilter: "blur(8px)", borderBottom: "1px solid var(--border)" }}>
            <Eye className="w-3.5 h-3.5" style={{ color: "var(--accent-text)" }} />
            <p className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Live preview — updates as you build</p>
            <p className="text-[11px] ml-auto" style={{ color: "var(--text-muted)" }}>Sample customer · {SAMPLE.customerName}</p>
          </div>
          <div className="flex justify-center py-6 px-6">
            <div style={{ width: DOC_W * scale, height: "max-content" }}>
              <div style={{ width: DOC_W, transform: `scale(${scale})`, transformOrigin: "top left" }}>
                <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)", boxShadow: "0 16px 48px -16px rgba(0,0,0,0.35)" }}>
                  <ProposalFamilyDocument data={doc} family={family} variant={variant} shadow={false} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Step: Basics ─────────────────────────────────────────
function BasicsStep({ sb, patch }: { sb: DraftState; patch: (p: Partial<DraftState>) => void }) {
  // Changing the proposal type keeps a hand-picked design that still fits, but
  // swaps an incompatible one for the type's default (e.g. Good/Better/Best →
  // Comparison Modern) so design and content stay correlated.
  function setType(v: SalesbookProposalType) {
    const mode: QuoteDesignMode = v === "good_better_best" || sb.options.length > 1 ? "multi_option" : "single_offer";
    if (designSupportsMode(getQuoteDesign(sb.quoteDesignId), mode)) { patch({ proposalType: v }); return; }
    const target = getQuoteDesign(defaultQuoteDesignId(v));
    patch({ proposalType: v, quoteDesignId: target.id, sectionLayout: layoutForDesign(target, sb.sectionLayout, sb.options.length > 0) });
  }
  return (
    <div className="space-y-4">
      <StepHeader icon={Info} title="Basics" sub="What reps see when picking this template during quote creation." />
      <Field label="Template name *">
        <input value={sb.name} onChange={e => patch({ name: e.target.value })} className={inputCls} style={inputStyle} placeholder="e.g. HVAC Good / Better / Best Replacement" />
      </Field>
      <Field label="Best-for description *">
        <textarea value={sb.bestFor} onChange={e => patch({ bestFor: e.target.value })} rows={2} className={`${inputCls} resize-none`} style={inputStyle} placeholder="e.g. Full system replacement proposals with tiered options." />
      </Field>
      {/* Industry dropdown removed — HVAC focus; the field stays on the record. */}
      <Field label="Proposal type">
        <UiSelect value={sb.proposalType} onChange={v => setType(v as SalesbookProposalType)}
          options={(Object.keys(PROPOSAL_TYPE_LABELS) as SalesbookProposalType[]).map(k => ({ value: k, label: PROPOSAL_TYPE_LABELS[k] }))} />
      </Field>
    </div>
  );
}

// ─── Step: Quote Design ───────────────────────────────────
function DesignStep({ sb, patch }: { sb: DraftState; patch: (p: Partial<DraftState>) => void }) {
  const designs = getQuoteDesigns();
  const mode = wantedMode(sb);
  const recommendedId = defaultQuoteDesignId(sb.proposalType);
  return (
    <div className="space-y-4">
      <StepHeader icon={Palette} title="Quote Design" sub="The complete customer-facing proposal — its layout, style, and sections. Pick the one that fits, then just add your options, wording, and media." />
      <DesignFitCallout sb={sb} patch={patch} />
      <div className="grid grid-cols-2 gap-2.5">
        {designs.map(d => {
          const active = d.id === sb.quoteDesignId;
          const fits = designSupportsMode(d, mode);
          return (
            <button key={d.id} disabled={!fits}
              onClick={() => fits && patch({ quoteDesignId: d.id, sectionLayout: layoutForDesign(d, sb.sectionLayout, sb.options.length > 0) })}
              title={fits ? undefined : "Doesn't fit this template's content"}
              className="rounded-xl p-2 text-left transition-all hover:shadow-md disabled:cursor-not-allowed disabled:hover:shadow-none"
              style={{
                border: active ? `2px solid ${ACCENT}` : "1px solid var(--border)",
                backgroundColor: "var(--bg-surface-2)",
                opacity: fits ? 1 : 0.45,
              }}>
              <QuoteDesignThumbnail design={d} height={84} />
              <div className="flex items-center gap-1.5 mt-1.5 min-w-0">
                <p className="text-xs font-semibold truncate flex-1" style={{ color: "var(--text-primary)" }}>{d.name}</p>
                {d.id === recommendedId && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0" style={{ backgroundColor: ACCENT + "1a", color: ACCENT }}>Best match</span>
                )}
              </div>
              <p className="text-[10px] mt-0.5 truncate" style={{ color: fits ? "var(--text-muted)" : "var(--warning-text)" }}>
                {fits ? designFamilyLabel(d) : mode === "multi_option" ? "Won't show multiple options" : "Needs 2+ options"}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Step: Content — fill the design's typed slots ────────
function ContentStep({ sb, patch, onJumpDesign }: {
  sb: DraftState; patch: (p: Partial<DraftState>) => void; onJumpDesign: () => void;
}) {
  const slots = contentSlots(sb);
  const update = (id: string, body: string) =>
    patch({ sectionLayout: sb.sectionLayout.map(s => s.id === id ? { ...s, body: body || undefined } : s) });

  return (
    <div className="space-y-4">
      <StepHeader icon={FileText} title="Content" sub="The design's content slots — fill each with saved wording from Content Blocks, or write your own. Slots come from the Quote Design; the design controls where they sit." />
      {slots.length === 0 ? (
        <div className="rounded-xl p-4 text-center space-y-2" style={{ border: "1px dashed var(--border)", backgroundColor: "var(--bg-surface-2)" }}>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>This design has no content slots.</p>
          <button onClick={onJumpDesign} className="text-xs font-medium" style={{ color: ACCENT }}>
            Pick a design with narrative sections — or build your own in Quote Designs →
          </button>
        </div>
      ) : slots.map(s => (
        <div key={s.id} className="rounded-xl p-3 space-y-2" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)" }}>
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
              {s.label}
              {slotFilled(s) && <Check className="w-3 h-3" style={{ color: ACCENT }} />}
            </p>
            <BlockInsertButton type={SLOT_BLOCK_TYPE[s.key]} onInsert={t => update(s.id, t)} />
          </div>
          <textarea value={s.body ?? ""} onChange={e => update(s.id, e.target.value)} rows={3}
            placeholder={getSectionBlock(s.key)?.defaultBody || "Wording copied into every quote built from this template…"}
            className={`${inputCls} resize-none`} style={inputStyle} />
        </div>
      ))}
    </div>
  );
}

// ─── Step: Options & Pricing ──────────────────────────────
function OptionsStep({ sb, patch }: { sb: DraftState; patch: (p: Partial<DraftState>) => void }) {
  const options = sb.options;
  const set = (next: SalesbookOption[]) => patch({ options: next });
  const update = (id: string, p: Partial<SalesbookOption>) => set(options.map(o => o.id === id ? { ...o, ...p } : o));
  const [openId, setOpenId] = useState<string | null>(null);
  const [offerPick, setOfferPick] = useState(false);
  const numOr = (s: string) => (s === "" ? 0 : parseFloat(s) || 0);

  const move = (i: number, dir: -1 | 1) => { const a = [...options]; const j = i + dir; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; set(a); };
  const feature = (id: string) => set(options.map(o => ({ ...o, featured: o.id === id ? !o.featured : false })));

  // Options render inside the "Good / Better / Best Options" section — the moment
  // options exist, make sure that section exists and is visible so nobody has to
  // know the section/options pairing.
  const withGbbSection = (layout: SalesbookSection[]) =>
    ensureSection(layout, "gbb_options", ["line_items", "financing_note", "warranty", "terms", "approval"]);
  function add() {
    const o = blankSalesbookOption();
    patch({ options: [...options, o], sectionLayout: withGbbSection(sb.sectionLayout) });
    setOpenId(o.id);
  }
  function duplicate(id: string) {
    const i = options.findIndex(o => o.id === id);
    if (i < 0) return;
    const dup = { ...options[i], id: `opt-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, name: `${options[i].name} (copy)`, featured: false };
    set([...options.slice(0, i + 1), dup, ...options.slice(i + 1)]);
  }
  // Snapshot-copy an Offer Library group so edits here never change the master.
  function addOfferGroup(g: OfferGroup) {
    const copied: SalesbookOption[] = snapshotOfferOptions(g).map(s => ({
      id: s.id, tier: s.tier, name: s.name, brand: s.brand, description: s.description,
      price: s.price, monthlyPrice: s.monthlyPrice, warranty: s.warranty, category: s.category,
      includes: s.includes, image: s.image, featured: s.featured,
    }));
    patch({
      options: [...sb.options, ...copied],
      sectionLayout: withGbbSection(sb.sectionLayout),
      offerGroupIds: sb.offerGroupIds.includes(g.id) ? sb.offerGroupIds : [...sb.offerGroupIds, g.id],
    });
    setOfferPick(false);
  }

  return (
    <div className="space-y-4">
      <StepHeader icon={Package} title="Options & Pricing" sub="The Good / Better / Best tiers or packages the customer chooses from. The options section is added to the proposal automatically." />
      <DesignFitCallout sb={sb} patch={patch} />
      <div className="flex items-center gap-3">
        <button onClick={add} className="flex items-center gap-1 text-xs font-medium" style={{ color: ACCENT }}><Plus className="w-3.5 h-3.5" /> Add option</button>
        <button onClick={() => setOfferPick(true)} className="flex items-center gap-1 text-xs font-medium" style={{ color: ACCENT }}><Package className="w-3.5 h-3.5" /> Add from Offer Library</button>
      </div>
      <div className="space-y-1.5">
        {options.map((o, i) => {
          const open = openId === o.id;
          return (
            <div key={o.id} className="rounded-xl overflow-hidden" style={{ border: open ? `1px solid ${ACCENT}66` : o.featured ? `1.5px solid ${ACCENT}` : "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)" }}>
              <div className="flex items-center gap-2 px-2.5 py-2 cursor-pointer" onClick={() => setOpenId(open ? null : o.id)}>
                {o.tier
                  ? <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded shrink-0" style={{ backgroundColor: ACCENT + "1a", color: ACCENT }}>{o.tier}</span>
                  : <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: "var(--text-muted)" }} />}
                <span className="flex-1 min-w-0 truncate text-sm font-medium" style={{ color: "var(--text-primary)" }}>{o.name || "Untitled option"}</span>
                {o.featured && <Star className="w-3 h-3 shrink-0" fill={ACCENT} style={{ color: ACCENT }} />}
                <span className="text-xs shrink-0 tabular-nums font-medium" style={{ color: "var(--text-secondary)" }}>${o.price.toLocaleString()}</span>
                <button onClick={e => { e.stopPropagation(); move(i, -1); }} disabled={i === 0} className="disabled:opacity-20 p-0.5" style={{ color: "var(--text-muted)" }}><ChevronUp className="w-3.5 h-3.5" /></button>
                <button onClick={e => { e.stopPropagation(); move(i, 1); }} disabled={i === options.length - 1} className="disabled:opacity-20 p-0.5" style={{ color: "var(--text-muted)" }}><ChevronDown className="w-3.5 h-3.5" /></button>
                <ChevronRight className="w-3.5 h-3.5 shrink-0 transition-transform" style={{ color: "var(--text-muted)", transform: open ? "rotate(90deg)" : undefined }} />
              </div>
              {open && (
                <div className="px-3 pb-3 pt-2 space-y-2" style={{ borderTop: "1px solid var(--border)" }}>
                  <div className="flex items-center gap-1.5">
                    <UiSelect size="sm" value={o.tier ?? ""} onChange={v => update(o.id, { tier: (v || undefined) as SalesbookOption["tier"] })}
                      className="w-24" options={[{ value: "", label: "No tier" }, { value: "good", label: "Good" }, { value: "better", label: "Better" }, { value: "best", label: "Best" }]} />
                    <button onClick={() => feature(o.id)} title="Mark recommended"
                      className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-lg"
                      style={o.featured ? { backgroundColor: ACCENT + "1a", color: ACCENT } : { border: "1px solid var(--border)", color: "var(--text-muted)" }}>
                      <Star className="w-3 h-3" fill={o.featured ? ACCENT : "none"} /> Recommended
                    </button>
                    <span className="ml-auto flex items-center gap-1">
                      <button onClick={() => duplicate(o.id)} title="Duplicate" className="p-1" style={{ color: "var(--text-muted)" }}><Copy className="w-3.5 h-3.5" /></button>
                      <button onClick={() => { set(options.filter(x => x.id !== o.id)); setOpenId(null); }} title="Delete" className="p-1" style={{ color: "var(--text-muted)" }}><Trash2 className="w-3.5 h-3.5" /></button>
                    </span>
                  </div>
                  <OptionImageInput value={o.image} onChange={v => update(o.id, { image: v })} accent={ACCENT} />
                  {sb.media.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Library:</span>
                      {sb.media.slice(0, 8).map(m => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={m.id} src={m.url} alt={m.caption ?? ""} onClick={() => update(o.id, { image: m.url })} title="Use this image"
                          className="w-7 h-7 rounded object-cover cursor-pointer" style={{ border: o.image === m.url ? `2px solid ${ACCENT}` : "1px solid var(--border)" }} />
                      ))}
                    </div>
                  )}
                  <input value={o.name} onChange={e => update(o.id, { name: e.target.value })} placeholder="Option title" className={inputCls} style={inputStyle} />
                  <div className="flex gap-2">
                    <input value={o.brand ?? ""} onChange={e => update(o.id, { brand: e.target.value || undefined })} placeholder="Brand" className={`${inputCls} flex-1 min-w-0`} style={inputStyle} />
                    <input value={o.model ?? ""} onChange={e => update(o.id, { model: e.target.value || undefined })} placeholder="Model" className={`${inputCls} flex-1 min-w-0`} style={inputStyle} />
                  </div>
                  <input value={o.description ?? ""} onChange={e => update(o.id, { description: e.target.value || undefined })} placeholder="Short description" className={inputCls} style={inputStyle} />
                  <div className="flex items-center gap-3 flex-wrap">
                    <NumberStepper size="sm" min={0} prefix="$" className="w-28" value={String(o.price)} onChange={v => update(o.id, { price: numOr(v) })} />
                    {sb.monthlyEnabled && (
                      <NumberStepper size="sm" min={0} prefix="$" suffix="/mo" className="w-32" value={o.monthlyPrice != null ? String(o.monthlyPrice) : ""} onChange={v => update(o.id, { monthlyPrice: v === "" ? undefined : numOr(v) })} />
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input value={o.efficiency ?? ""} onChange={e => update(o.id, { efficiency: e.target.value || undefined })} placeholder="Efficiency / spec" className={`${inputCls} flex-1 min-w-0`} style={inputStyle} />
                    <input value={o.warranty ?? ""} onChange={e => update(o.id, { warranty: e.target.value || undefined })} placeholder="Warranty" className={`${inputCls} flex-1 min-w-0`} style={inputStyle} />
                  </div>
                  <textarea value={(o.includes ?? []).join("\n")} onChange={e => update(o.id, { includes: e.target.value.split("\n").map(s => s.trim()).filter(Boolean) })} rows={3} placeholder="Included items (one per line)" className={`${inputCls} resize-none`} style={inputStyle} />
                </div>
              )}
            </div>
          );
        })}
        {options.length === 0 && <p className="text-sm" style={{ color: "var(--text-muted)" }}>No option cards yet — add one, or pull a ready-made group from the Offer Library.</p>}
      </div>
      {offerPick && <OfferGroupPicker industry={sb.industry} onPick={addOfferGroup} onClose={() => setOfferPick(false)} />}
    </div>
  );
}

// ─── Step: Financing ──────────────────────────────────────
function FinancingStep({ sb, patch }: { sb: DraftState; patch: (p: Partial<DraftState>) => void }) {
  // Financing wording renders in the financing_note section — some designs don't
  // include it by default, so writing a note quietly adds the section.
  function patchWithSection(p: Partial<DraftState>) {
    const next = { ...sb, ...p };
    const wants = !!next.financingNote.trim();
    patch(wants ? { ...p, sectionLayout: ensureSection(next.sectionLayout, "financing_note", ["warranty", "terms", "approval"]) } : p);
  }
  return (
    <div className="space-y-4">
      <StepHeader icon={CreditCard} title="Financing" sub="How monthly payments and financing appear on the proposal." />
      <Toggle label="Show monthly payment on the proposal" checked={sb.showMonthly} onChange={v => patch({ showMonthly: v })} />
      <Toggle label="Enable per-option monthly price field" checked={sb.monthlyEnabled} onChange={v => patch({ monthlyEnabled: v })} />
      <Field label="Financing note" action={<BlockInsertButton type="financing" onInsert={t => patchWithSection({ financingNote: t })} />}>
        <textarea value={sb.financingNote} onChange={e => patchWithSection({ financingNote: e.target.value })} rows={2} className={`${inputCls} resize-none`} style={inputStyle} placeholder="e.g. Financing available — as low as $119/mo with approved credit." />
      </Field>
      <Field label="Disclaimer">
        <textarea value={sb.financingDisclaimer} onChange={e => patch({ financingDisclaimer: e.target.value })} rows={2} className={`${inputCls} resize-none`} style={inputStyle} placeholder="e.g. Subject to credit approval. Terms and APR vary." />
      </Field>
    </div>
  );
}

// ─── Step: Warranty & Terms ───────────────────────────────
function WarrantyStep({ sb, patch }: { sb: DraftState; patch: (p: Partial<DraftState>) => void }) {
  return (
    <div className="space-y-4">
      <StepHeader icon={ShieldCheck} title="Warranty & Terms" sub="Default warranty, guarantee, and terms wording copied into quotes." />
      <Field label="Warranty wording" action={<BlockInsertButton type="warranty" onInsert={t => patch({ warranty: t })} />}>
        <textarea value={sb.warranty} onChange={e => patch({ warranty: e.target.value })} rows={2} className={`${inputCls} resize-none`} style={inputStyle} placeholder="e.g. Manufacturer parts warranty plus our workmanship guarantee." />
      </Field>
      <Field label="Workmanship guarantee">
        <input value={sb.workmanship} onChange={e => patch({ workmanship: e.target.value })} className={inputCls} style={inputStyle} placeholder="e.g. 2-year workmanship guarantee on all installs." />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Validity (days)">
          <NumberStepper size="sm" min={1} value={String(sb.validityDays)} onChange={v => patch({ validityDays: parseInt(v) || 0 })} />
        </Field>
        <Field label="Deposit wording">
          <input value={sb.depositTerms} onChange={e => patch({ depositTerms: e.target.value })} className={inputCls} style={inputStyle} placeholder="e.g. 50% deposit to schedule." />
        </Field>
      </div>
      <Field label="Terms & conditions *" action={<BlockInsertButton type="terms" onInsert={t => patch({ terms: t })} />}>
        <textarea value={sb.terms} onChange={e => patch({ terms: e.target.value })} rows={3} className={`${inputCls} resize-none`} style={inputStyle} placeholder="Standard terms applied to every quote built from this template." />
      </Field>
      <Field label="Exclusions" action={<BlockInsertButton type="exclusions" onInsert={t => patch({ exclusions: t })} />}>
        <textarea value={sb.exclusions} onChange={e => patch({ exclusions: e.target.value })} rows={2} className={`${inputCls} resize-none`} style={inputStyle} placeholder="e.g. Permits, drywall repair, and electrical upgrades not included unless noted." />
      </Field>
    </div>
  );
}

// ─── Step: Media ──────────────────────────────────────────
function MediaStep({ sb, patch }: { sb: DraftState; patch: (p: Partial<DraftState>) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [libPick, setLibPick] = useState(false);
  const media = sb.media;

  // Read every dropped/selected image, then append in ONE patch (no stale-closure race).
  function addFiles(files: FileList | File[]) {
    const imgs = Array.from(files).filter(f => f.type.startsWith("image/"));
    Promise.all(imgs.map(f => new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => (typeof r.result === "string" ? res(r.result) : rej(new Error("read")));
      r.onerror = () => rej(new Error("read"));
      r.readAsDataURL(f);
    }))).then(urls => {
      patch({ media: [...sb.media, ...urls.map(u => blankSalesbookMedia(u))] });
    }).catch(() => { /* ignore unreadable files */ });
  }
  const updateItem = (id: string, p: Partial<SalesbookMedia>) => patch({ media: media.map(m => m.id === id ? { ...m, ...p } : m) });
  const remove = (id: string) => patch({ media: media.filter(m => m.id !== id), coverImageId: sb.coverImageId === id ? undefined : sb.coverImageId });

  return (
    <div className="space-y-4">
      <StepHeader icon={ImageIcon} title="Media" sub="Images for option cards and the cover. Attach them to options in the Options step." />
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files); }}
        onClick={() => fileRef.current?.click()}
        className="rounded-xl flex flex-col items-center justify-center gap-1 py-6 cursor-pointer transition-colors"
        style={{ border: `1.5px dashed ${dragOver ? ACCENT : "var(--border)"}`, backgroundColor: dragOver ? ACCENT + "0d" : "var(--bg-surface-2)" }}>
        <ImageIcon className="w-5 h-5" style={{ color: ACCENT }} />
        <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Drop images or click to upload</p>
        <input ref={fileRef} type="file" accept="image/*" multiple onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} className="hidden" />
      </div>
      <button onClick={() => setLibPick(true)} className="flex items-center gap-1 text-xs font-medium" style={{ color: ACCENT }}>
        <ImageIcon className="w-3.5 h-3.5" /> Choose from the company Media Library
      </button>
      {media.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {media.map(m => {
            const isCover = sb.coverImageId === m.id;
            return (
              <div key={m.id} className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: isCover ? `1.5px solid ${ACCENT}` : "1px solid var(--border)" }}>
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.url} alt={m.caption ?? ""} className="w-full h-20 object-cover block" />
                  {isCover && <span className="absolute top-1 left-1 text-[8px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: ACCENT, color: "#fff" }}>COVER</span>}
                  <button onClick={() => remove(m.id)} className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.55)", color: "#fff" }}><X className="w-3 h-3" /></button>
                </div>
                <div className="p-1.5 space-y-1">
                  <UiSelect size="sm" value={m.category} onChange={v => updateItem(m.id, { category: v as SalesbookMediaCategory })}
                    options={(Object.keys(MEDIA_CATEGORY_LABELS) as SalesbookMediaCategory[]).map(k => ({ value: k, label: MEDIA_CATEGORY_LABELS[k] }))} />
                  <button onClick={() => patch({ coverImageId: isCover ? undefined : m.id })}
                    className="w-full text-[10px] font-medium py-1 rounded-lg" style={isCover ? { backgroundColor: ACCENT + "1a", color: ACCENT } : { border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                    {isCover ? "Cover ✓" : "Set as cover"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {libPick && (
        <MediaPickerModal onClose={() => setLibPick(false)}
          onPick={a => {
            const catMap: Record<string, SalesbookMediaCategory> = { equipment: "equipment", cover: "cover", before_after: "before_after", brand_logo: "brand_logo", trust_badge: "benefit", section: "section", asset: "section" };
            patch({ media: [...sb.media, { ...blankSalesbookMedia(a.url, catMap[a.category] ?? "equipment"), caption: a.caption }] });
            setLibPick(false);
          }} />
      )}
    </div>
  );
}

// ─── Step: Review & Publish ───────────────────────────────
function ReviewStep({ sb, check, onPublish, onUnpublish, onJump }: {
  sb: DraftState; check: { ok: boolean; issues: string[] };
  onPublish: () => void; onUnpublish: () => void; onJump: (k: StepKey) => void;
}) {
  const design = getQuoteDesign(sb.quoteDesignId);
  const rows: { label: string; value: string; step: StepKey }[] = [
    { label: "Quote design", value: `${design.name} · ${sb.sectionLayout.filter(s => s.visible).length} sections`, step: "design" },
    { label: "Options", value: `${sb.options.length}`, step: "options" },
    { label: "Monthly pricing", value: sb.showMonthly ? "Shown" : "Hidden", step: "financing" },
    { label: "Images", value: `${sb.media.length + sb.options.filter(o => o.image).length}`, step: "media" },
  ];
  return (
    <div className="space-y-4">
      <StepHeader icon={Send} title="Review & Publish" sub="Publishing makes this template selectable during quote creation." />
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        {rows.map((r, i) => (
          <button key={r.label} onClick={() => onJump(r.step)}
            className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left transition-colors hover:bg-[var(--bg-surface-2)]"
            style={{ borderTop: i > 0 ? "1px solid var(--border)" : undefined }}>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>{r.label}</span>
            <span className="text-xs font-medium flex items-center gap-1" style={{ color: "var(--text-primary)" }}>
              {r.value} <ChevronRight className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
            </span>
          </button>
        ))}
      </div>

      <div className="rounded-xl p-3.5" style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border)" }}>
        <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>Publishing requirements</p>
        {check.ok ? (
          <p className="flex items-center gap-1.5 text-sm font-medium" style={{ color: "#059669" }}>
            <CheckCircle2 className="w-4 h-4" /> All requirements met.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {check.issues.map((iss, i) => (
              <li key={i} className="flex items-start gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#b45309" }} /> {iss}
              </li>
            ))}
          </ul>
        )}
      </div>

      {sb.status === "published" ? (
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
            <CheckCircle2 className="w-3.5 h-3.5" style={{ color: "#059669" }} /> Published — live in quote creation.
          </p>
          <button onClick={onUnpublish} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
            <EyeOff className="w-3.5 h-3.5" /> Unpublish
          </button>
        </div>
      ) : (
        <button onClick={onPublish} disabled={!check.ok}
          className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-40" style={{ backgroundColor: ACCENT }}>
          <Send className="w-4 h-4" /> Publish / Activate
        </button>
      )}
    </div>
  );
}

// ─── Shared bits ──────────────────────────────────────────
function StatusPill({ status }: { status: SalesbookStatus }) {
  const pub = status === "published";
  return (
    <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0"
      style={pub ? { backgroundColor: "#d1fae5", color: "#065f46" } : { backgroundColor: "var(--warning-soft-bg)", color: "var(--warning-text)" }}>
      {pub ? <CheckCircle2 className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
      {pub ? "Published" : "Draft"}
    </span>
  );
}

function StepHeader({ icon: Icon, title, sub }: { icon: typeof Info; title: string; sub: string }) {
  return (
    <div>
      <p className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
        <Icon className="w-4 h-4" style={{ color: ACCENT }} /> {title}
      </p>
      <p className="text-xs mt-1 leading-snug" style={{ color: "var(--text-muted)" }}>{sub}</p>
    </div>
  );
}

function Field({ label, action, children }: { label: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-1">
        <label className="block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{label}</label>
        {action}
      </div>
      {children}
    </div>
  );
}

// "Insert saved wording" — fills a wording field from the Content Blocks library
// (filtered to the matching block type). This is where Content Blocks reach
// templates now that there's no Sections step: they fill fields, not layout.
function BlockInsertButton({ type, onInsert }: { type?: ContentBlockType; onInsert: (text: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="flex items-center gap-1 text-[11px] font-medium shrink-0" style={{ color: ACCENT }}>
        <FileText className="w-3 h-3" /> Insert Content Block
      </button>
      {open && <ContentBlockPicker filterType={type} onPick={b => { onInsert(b.text); setOpen(false); }} onClose={() => setOpen(false)} />}
    </>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg cursor-pointer" style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border)" }}>
      <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{label}</span>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="accent-[#0f8578] w-4 h-4 shrink-0" />
    </label>
  );
}
