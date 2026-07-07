"use client";

// Company Salesbook editor (Settings → Salesbook Library → Installed → Edit).
//
// A premium, tabbed workspace for building/editing a reusable company-owned
// salesbook that reps later select during quote creation. This is NOT a customer
// quote — it's the template the quote is built from. Editing the copy never
// touches the CRM master template it was installed from.
//
// Layout: an 8-section tabbed editor on the left, a compact (read-only) Salesbook
// Summary on the right, and a large full-screen Preview modal opened from the
// header. The preview renders the real customer-facing proposal using sample
// customer data and the salesbook's chosen template style.

import { useMemo, useState, useRef, useEffect } from "react";
import { pingSaved } from "@/components/shared/SavedPill";
import {
  ArrowLeft, BookOpen, Eye, MoreHorizontal, Plus, Trash2, Copy,
  ChevronUp, ChevronDown, Star, X, AlertTriangle, CheckCircle2,
  CreditCard, ShieldCheck, FileText, Layers, Palette, Package, Image as ImageIcon,
  Send, Info, EyeOff, Lock,
} from "lucide-react";
import UiSelect from "@/components/ui/Select";
import StatusTabs from "@/components/shared/StatusTabs";
import OptionImageInput from "@/components/quotes/OptionImageInput";
import ProposalFamilyDocument from "@/components/quotes/family/ProposalFamilyDocument";
import { QuoteDesignPicker, QuoteDesignThumbnail } from "@/components/settings/QuoteDesignsManager";
import { OfferGroupPicker } from "@/components/settings/OfferLibrarySection";
import { MediaPickerModal } from "@/components/settings/MediaLibrarySection";
import { ContentBlockPicker } from "@/components/settings/ContentBlocksSection";
import { snapshotOfferOptions, type OfferGroup } from "@/lib/offers/data";
import { BLOCK_TYPE_SECTION_KEY, type ContentBlock } from "@/lib/content-blocks/data";
import { SECTION_CATALOG, SECTION_LABELS, getSectionBlock, type SectionKey } from "@/lib/proposals/data";
import { buildProposalDoc, type ProposalDocData } from "@/lib/quotes/proposalDoc";
import {
  getQuoteDesign, resolveQuoteDesign, designFamilyLabel, designVariantLabel,
  defaultQuoteDesignId, PRICING_PRESENTATION_LABELS,
} from "@/lib/quotes/quoteDesigns";
import type { LineItem, QuoteOption, QuoteSection } from "@/lib/quotes/data";
import {
  getCompanySalesbook, updateCompanySalesbook, blankSalesbookOption, blankSalesbookSection,
  blankSalesbookMedia, ensureSectionLayout, sectionsFromLayout, salesbookStatus,
  validateSalesbookForPublish, salesbookDesignId,
  INDUSTRY_LABELS, PROPOSAL_TYPE_LABELS, INDUSTRY_ACCENT, MEDIA_CATEGORY_LABELS,
  type SalesbookOption, type SalesbookSection, type SalesbookMedia, type SalesbookMediaCategory,
  type SalesbookIndustry, type SalesbookProposalType, type SalesbookStatus,
} from "@/lib/salesbooks/data";

// ─── Sample data for the customer-facing preview ──────────
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

// ─── Draft state ──────────────────────────────────────────
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
  // financing
  showMonthly: boolean;
  monthlyEnabled: boolean;
  financingNote: string;
  financingDisclaimer: string;
  // warranty & terms
  warranty: string;
  workmanship: string;
  validityDays: number;
  depositTerms: string;
  terms: string;
  exclusions: string;
}

type TabKey =
  | "overview" | "style" | "sections" | "options"
  | "media" | "financing" | "warranty" | "publish";

// Tab order groups the reusable libraries together (Offer = what we sell,
// Content Blocks = what we say, Media = images it uses) so the wording mirrors
// the Salesbook Library modules.
const TABS: { key: TabKey; label: string; icon: typeof BookOpen }[] = [
  { key: "overview",  label: "Overview",          icon: Info },
  { key: "style",     label: "Quote Design",      icon: Palette },
  { key: "options",   label: "Offer Library",     icon: Package },
  { key: "sections",  label: "Content Blocks",    icon: FileText },
  { key: "media",     label: "Media Library",     icon: ImageIcon },
  { key: "financing", label: "Financing",         icon: CreditCard },
  { key: "warranty",  label: "Warranty & Terms",  icon: ShieldCheck },
  { key: "publish",   label: "Preview & Publish", icon: Send },
];

export default function CompanySalesbookEditor({ sbId, onBack }: { sbId: string; onBack: () => void }) {
  const original = useMemo(() => getCompanySalesbook(sbId), [sbId]);

  const [sb, setSb] = useState<DraftState | null>(() => original ? initDraft(original) : null);
  const [tab, setTab] = useState<TabKey>("overview");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const lastSnap = useRef<string | null>(null);

  const patch = (p: Partial<DraftState>) => setSb(s => s ? { ...s, ...p } : s);

  const check = useMemo(() => sb ? validateSalesbookForPublish(sb) : { ok: false, issues: [] }, [sb]);

  // Auto-save on real changes only. Snapshot-guarded so the initial mount (and
  // StrictMode's dev double-invoke) never fires a spurious "Saved". `save` hoisted.
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

  if (!original || !sb) {
    return (
      <div className="space-y-4">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm" style={{ color: "var(--text-secondary)" }}><ArrowLeft className="w-4 h-4" /> Salesbook Library</button>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>Salesbook not found.</p>
      </div>
    );
  }

  const accent = INDUSTRY_ACCENT[sb.industry];

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

  function discard() {
    setSb(initDraft(original!));
    setMenuOpen(false);
  }

  return (
    <div className="space-y-5">
      {/* ── Header ─────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <button onClick={onBack} className="flex items-center gap-1.5 text-sm mb-2" style={{ color: "var(--text-secondary)" }}>
            <ArrowLeft className="w-4 h-4" /> Salesbook Library
          </button>
          <h2 className="text-lg font-semibold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <BookOpen className="w-5 h-5" style={{ color: accent }} /> Edit Salesbook
            <StatusPill status={sb.status} />
          </h2>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            {INDUSTRY_LABELS[sb.industry]} · {PROPOSAL_TYPE_LABELS[sb.proposalType]} · company-owned copy
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => setPreviewOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ border: `1px solid ${accent}`, color: accent, backgroundColor: accent + "0f" }}>
            <Eye className="w-4 h-4" /> Preview
          </button>
          <div className="relative">
            <button onClick={() => setMenuOpen(o => !o)} aria-label="More options"
              className="flex items-center justify-center w-9 h-9 rounded-lg transition-colors hover:bg-[var(--bg-surface-2)]"
              style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
              <MoreHorizontal className="w-4 h-4" />
            </button>
            {menuOpen && (
              <>
                <button aria-hidden tabIndex={-1} onClick={() => setMenuOpen(false)} className="fixed inset-0 z-40 cursor-default" />
                <div className="absolute right-0 top-full mt-2 z-50 w-52 rounded-xl overflow-hidden py-1"
                  style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 12px 32px rgba(0,0,0,0.18)" }}>
                  <MenuItem icon={sb.status === "published" ? EyeOff : Send}
                    label={sb.status === "published" ? "Switch to draft" : "Publish (make active)"}
                    onClick={() => { setMenuOpen(false); const ns: SalesbookStatus = sb.status === "published" ? "draft" : "published"; patch({ status: ns }); save({ status: ns }); }} />
                  <MenuItem icon={ArrowLeft} label="Discard changes" onClick={discard} />
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Tab strip (shared list-page tab style) ─────── */}
      <div className="pb-2" style={{ borderBottom: "1px solid var(--border)" }}>
        <StatusTabs active={tab} onChange={k => setTab(k as TabKey)}
          tabs={TABS.map(t => ({ key: t.key, label: t.label, icon: t.icon }))} />
      </div>

      {/* ── Body: editor + summary ─────────────────────── */}
      <div className="flex gap-5 items-start">
        <div className="flex-1 min-w-0">
          {tab === "overview"  && <OverviewTab  sb={sb} patch={patch} />}
          {tab === "style"     && <QuoteDesignTab sb={sb} patch={patch} onPreview={() => setPreviewOpen(true)} />}
          {tab === "sections"  && <SectionsTab  sb={sb} patch={patch} accent={accent} />}
          {tab === "options"   && <OptionsTab   sb={sb} patch={patch} accent={accent} />}
          {tab === "media"     && <MediaTab     sb={sb} patch={patch} accent={accent} />}
          {tab === "financing" && <FinancingTab sb={sb} patch={patch} />}
          {tab === "warranty"  && <WarrantyTermsTab sb={sb} patch={patch} />}
          {tab === "publish"   && <PublishTab   sb={sb} patch={patch} accent={accent} check={check} onPreview={() => setPreviewOpen(true)} onSave={save} />}
        </div>

        <SummaryPanel sb={sb} original={original} accent={accent} check={check} />
      </div>

      {previewOpen && <PreviewModal sb={sb} onClose={() => setPreviewOpen(false)} />}
    </div>
  );
}

// ─── Draft init / helpers ─────────────────────────────────
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

// ─── Status pill ──────────────────────────────────────────
function StatusPill({ status }: { status: SalesbookStatus }) {
  const pub = status === "published";
  return (
    <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
      style={pub ? { backgroundColor: "#d1fae5", color: "#065f46" } : { backgroundColor: "#fef3c7", color: "#92400e" }}>
      {pub ? <CheckCircle2 className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
      {pub ? "Published" : "Draft"}
    </span>
  );
}

function MenuItem({ icon: Icon, label, onClick }: { icon: typeof Send; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-2 w-full px-3 py-2 text-sm transition-colors hover:bg-[var(--bg-surface-2)]" style={{ color: "var(--text-primary)" }}>
      <Icon className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} /> {label}
    </button>
  );
}

// ─── Summary panel (compact, read-only) ───────────────────
function SummaryPanel({ sb, original, accent, check }: {
  sb: DraftState; original: NonNullable<ReturnType<typeof getCompanySalesbook>>; accent: string; check: { ok: boolean; issues: string[] };
}) {
  const design = getQuoteDesign(sb.quoteDesignId);
  const visibleSections = sb.sectionLayout.filter(s => s.visible).length;
  const imageCount = sb.media.length + sb.options.filter(o => o.image).length;
  const rows: { label: string; value: React.ReactNode }[] = [
    { label: "Status", value: <StatusPill status={sb.status} /> },
    { label: "Quote design", value: design.name },
    { label: "Layout", value: `${designFamilyLabel(design)} · ${designVariantLabel(design)}` },
    { label: "Sections", value: `${visibleSections} visible / ${sb.sectionLayout.length}` },
    { label: "Options", value: `${sb.options.length}` },
    { label: "Images", value: `${imageCount}` },
    { label: "Last edited", value: original.updatedAt ?? original.installedAt },
    { label: "Copied from", value: original.copiedFromTemplateId ? "CRM template" : "Custom" },
    { label: "Used in quotes", value: <span style={{ color: "var(--text-muted)" }}>—</span> },
  ];
  return (
    <aside className="hidden lg:block shrink-0 sticky self-start" style={{ width: "270px", top: "8px" }}>
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
        <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)", background: `linear-gradient(135deg, ${accent}10, transparent)` }}>
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Salesbook Summary</p>
          <p className="text-sm font-semibold mt-1 truncate" style={{ color: "var(--text-primary)" }}>{sb.name || "Untitled salesbook"}</p>
        </div>
        <div className="px-4 py-2">
          {rows.map(r => (
            <div key={r.label} className="flex items-center justify-between gap-2 py-1.5 text-xs" style={{ borderBottom: "1px solid var(--border)" }}>
              <span style={{ color: "var(--text-muted)" }}>{r.label}</span>
              <span className="font-medium text-right" style={{ color: "var(--text-primary)" }}>{r.value}</span>
            </div>
          ))}
        </div>
        <div className="px-4 py-3">
          {check.ok ? (
            <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: "#059669" }}>
              <CheckCircle2 className="w-3.5 h-3.5" /> Ready to publish
            </div>
          ) : (
            <div className="flex items-start gap-1.5 text-xs" style={{ color: "#b45309" }}>
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{check.issues.length} item{check.issues.length === 1 ? "" : "s"} left before publishing</span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

// ─── Overview ─────────────────────────────────────────────
function OverviewTab({ sb, patch }: { sb: DraftState; patch: (p: Partial<DraftState>) => void }) {
  return (
    <Card title="Overview" icon={FileText} subtitle="The basics reps see when picking this salesbook during quote creation.">
      <Field label="Salesbook name *">
        <input value={sb.name} onChange={e => patch({ name: e.target.value })} className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle} placeholder="e.g. HVAC Good / Better / Best Replacement" />
      </Field>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Industry *">
          <UiSelect value={sb.industry} onChange={v => patch({ industry: v as SalesbookIndustry })}
            options={(Object.keys(INDUSTRY_LABELS) as SalesbookIndustry[]).map(k => ({ value: k, label: INDUSTRY_LABELS[k] }))} />
        </Field>
        <Field label="Proposal type *">
          <UiSelect value={sb.proposalType} onChange={v => patch({ proposalType: v as SalesbookProposalType })}
            options={(Object.keys(PROPOSAL_TYPE_LABELS) as SalesbookProposalType[]).map(k => ({ value: k, label: PROPOSAL_TYPE_LABELS[k] }))} />
        </Field>
      </div>
      <Field label="Best-for description *">
        <textarea value={sb.bestFor} onChange={e => patch({ bestFor: e.target.value })} rows={2} className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none" style={inputStyle} placeholder="e.g. Full system replacement proposals with tiered options." />
      </Field>
      <Field label="Status">
        <div className="flex gap-2">
          {(["published", "draft"] as SalesbookStatus[]).map(s => (
            <button key={s} onClick={() => patch({ status: s })}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all"
              style={sb.status === s
                ? { backgroundColor: "var(--accent-soft-bg)", color: "var(--accent-text)", border: "1px solid var(--accent-soft-border)" }
                : { border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
              {s === "published" ? <CheckCircle2 className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              {s === "published" ? "Active / Published" : "Draft"}
            </button>
          ))}
        </div>
      </Field>
    </Card>
  );
}

// ─── Quote Design — one selector for the whole customer-facing layout + style ──
function QuoteDesignTab({ sb, patch, onPreview }: { sb: DraftState; patch: (p: Partial<DraftState>) => void; onPreview: () => void }) {
  const [picking, setPicking] = useState(false);
  const design = getQuoteDesign(sb.quoteDesignId);
  return (
    <Card title="Quote Design" icon={Palette}
      subtitle="The complete customer-facing proposal — its layout, visual style, sections, and pricing presentation. Pick one design; you don't choose a layout family and style separately.">
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        <div className="grid gap-4 p-4" style={{ gridTemplateColumns: "minmax(0, 240px) 1fr" }}>
          <QuoteDesignThumbnail design={design} height={150} />
          <div className="min-w-0 flex flex-col">
            <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Selected design</p>
            <p className="text-lg font-semibold mt-0.5" style={{ color: "var(--text-primary)" }}>{design.name}</p>
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--accent-soft-bg)", color: "var(--accent-text)" }}>{designFamilyLabel(design)}</span>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>{designVariantLabel(design)}</span>
            </div>
            <p className="text-xs mt-2 leading-relaxed" style={{ color: "var(--text-secondary)" }}>{design.description}</p>
            <p className="text-[11px] mt-1.5" style={{ color: "var(--text-muted)" }}>Pricing: {PRICING_PRESENTATION_LABELS[design.pricingPresentation]}</p>
            <div className="flex items-center gap-2 mt-auto pt-3">
              <button onClick={() => setPicking(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: "var(--accent-text)" }}>
                <Palette className="w-4 h-4" /> Change Design
              </button>
              <button onClick={onPreview} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                <Eye className="w-4 h-4" /> Preview Design
              </button>
            </div>
          </div>
        </div>
      </div>
      <p className="text-[11px] mt-1 flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
        <Info className="w-3.5 h-3.5" /> Manage the full Quote Design gallery in Settings → Salesbook Library → Quote Designs.
      </p>

      {picking && (
        <QuoteDesignPicker activeId={sb.quoteDesignId}
          onPick={id => { patch({ quoteDesignId: id }); setPicking(false); }}
          onClose={() => setPicking(false)} />
      )}
    </Card>
  );
}

// ─── Proposal Sections ────────────────────────────────────
function SectionsTab({ sb, patch, accent }: { sb: DraftState; patch: (p: Partial<DraftState>) => void; accent: string }) {
  const layout = sb.sectionLayout;
  const set = (next: SalesbookSection[]) => patch({ sectionLayout: next });
  const updateSection = (id: string, p: Partial<SalesbookSection>) => set(layout.map(s => s.id === id ? { ...s, ...p } : s));
  const remove = (id: string) => set(layout.filter(s => s.id !== id));
  const duplicate = (id: string) => {
    const i = layout.findIndex(s => s.id === id);
    if (i < 0) return;
    const dup: SalesbookSection = { ...layout[i], id: `sbsec-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, label: `${layout[i].label} (copy)`, required: false };
    set([...layout.slice(0, i + 1), dup, ...layout.slice(i + 1)]);
  };
  const move = (i: number, dir: -1 | 1) => { const a = [...layout]; const j = i + dir; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; set(a); };
  const addKey = (k: SectionKey) => { if (k) set([...layout, blankSalesbookSection(k)]); };
  const [blockPick, setBlockPick] = useState(false);

  // Insert a Content Block: copy its wording into a new section and keep a
  // reference. The copy is editable here; quotes copy this text again (no live link).
  function addContentBlock(b: ContentBlock) {
    const sec: SalesbookSection = { ...blankSalesbookSection(BLOCK_TYPE_SECTION_KEY[b.type]), label: b.name, body: b.text, contentBlockId: b.id };
    set([...layout, sec]);
    setBlockPick(false);
  }

  return (
    <Card title="Proposal Sections" icon={Layers}
      subtitle="The default sections copied into every quote built from this salesbook. Reorder, rename, hide, or tune the wording — or pull reusable wording from Content Blocks."
      action={
        <div className="flex items-center gap-3">
          <button onClick={() => setBlockPick(true)} className="flex items-center gap-1 text-xs font-medium shrink-0" style={{ color: accent }}><FileText className="w-3.5 h-3.5" /> Add Content Block</button>
          <div className="w-44">
            <UiSelect size="sm" value="" onChange={v => addKey(v as SectionKey)} placeholder="+ Add section…"
              options={SECTION_CATALOG.map(c => ({ value: c.key, label: c.label }))} />
          </div>
        </div>
      }>
      <div className="space-y-2">
        {layout.map((s, i) => (
          <SectionRow key={s.id} s={s} index={i} total={layout.length} accent={accent}
            onUpdate={p => updateSection(s.id, p)} onMove={d => move(i, d)} onDuplicate={() => duplicate(s.id)} onRemove={() => remove(s.id)} />
        ))}
        {layout.length === 0 && <p className="text-sm" style={{ color: "var(--text-muted)" }}>No sections yet — add one above.</p>}
      </div>
      {blockPick && <ContentBlockPicker onPick={addContentBlock} onClose={() => setBlockPick(false)} />}
    </Card>
  );
}

function SectionRow({ s, index, total, accent, onUpdate, onMove, onDuplicate, onRemove }: {
  s: SalesbookSection; index: number; total: number; accent: string;
  onUpdate: (p: Partial<SalesbookSection>) => void; onMove: (d: -1 | 1) => void; onDuplicate: () => void; onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl" style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border)", opacity: s.visible ? 1 : 0.6 }}>
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="text-[10px] font-mono w-4 text-center shrink-0" style={{ color: "var(--text-muted)" }}>{index + 1}</span>
        <input value={s.label} onChange={e => onUpdate({ label: e.target.value })}
          className="flex-1 min-w-0 bg-transparent text-sm font-medium outline-none" style={{ color: "var(--text-primary)" }} />
        {s.required && <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded" style={{ backgroundColor: accent + "1a", color: accent }}>Required</span>}
        <button onClick={() => onUpdate({ visible: !s.visible })} title={s.visible ? "Hide" : "Show"} className="p-1" style={{ color: "var(--text-muted)" }}>
          {s.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
        </button>
        <button onClick={() => setOpen(o => !o)} title="Edit wording" className="p-1" style={{ color: open ? accent : "var(--text-muted)" }}><FileText className="w-3.5 h-3.5" /></button>
        <button onClick={() => onMove(-1)} disabled={index === 0} className="disabled:opacity-20 p-0.5" style={{ color: "var(--text-muted)" }}><ChevronUp className="w-3.5 h-3.5" /></button>
        <button onClick={() => onMove(1)} disabled={index === total - 1} className="disabled:opacity-20 p-0.5" style={{ color: "var(--text-muted)" }}><ChevronDown className="w-3.5 h-3.5" /></button>
        <button onClick={onDuplicate} title="Duplicate" className="p-1" style={{ color: "var(--text-muted)" }}><Copy className="w-3.5 h-3.5" /></button>
        <button onClick={onRemove} disabled={s.required} title={s.required ? "Required section" : "Delete"} className="disabled:opacity-20 p-1" style={{ color: "var(--text-muted)" }}><Trash2 className="w-3.5 h-3.5" /></button>
      </div>
      {open && (
        <div className="px-3 pb-3 pt-1 space-y-2">
          <textarea value={s.body ?? ""} onChange={e => onUpdate({ body: e.target.value })} rows={3}
            placeholder={getSectionBlock(s.key)?.defaultBody || "Default wording copied into the quote…"}
            className="w-full rounded-lg px-2.5 py-2 text-xs outline-none resize-none" style={inputStyle} />
          <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: "var(--text-secondary)" }}>
            <input type="checkbox" checked={s.required} onChange={e => onUpdate({ required: e.target.checked })} className="accent-[#0f8578] w-3.5 h-3.5" />
            Mark as required (cannot be removed from quotes)
          </label>
        </div>
      )}
    </div>
  );
}

// ─── Options / Packages ───────────────────────────────────
function OptionsTab({ sb, patch, accent }: { sb: DraftState; patch: (p: Partial<DraftState>) => void; accent: string }) {
  const options = sb.options;
  const set = (next: SalesbookOption[]) => patch({ options: next });
  const update = (id: string, p: Partial<SalesbookOption>) => set(options.map(o => o.id === id ? { ...o, ...p } : o));
  const remove = (id: string) => set(options.filter(o => o.id !== id));
  const add = () => set([...options, blankSalesbookOption()]);
  const duplicate = (id: string) => {
    const i = options.findIndex(o => o.id === id);
    if (i < 0) return;
    const dup = { ...options[i], id: `opt-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, name: `${options[i].name} (copy)`, featured: false };
    set([...options.slice(0, i + 1), dup, ...options.slice(i + 1)]);
  };
  const move = (i: number, dir: -1 | 1) => { const a = [...options]; const j = i + dir; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; set(a); };
  // Mark recommended: exactly one featured at a time.
  const feature = (id: string) => set(options.map(o => ({ ...o, featured: o.id === id ? !o.featured : false })));
  const [offerPick, setOfferPick] = useState(false);

  // Add an Offer Library group: snapshot-copy its options into this salesbook so
  // editing here never changes the master offer group. Record the group id for usage.
  function addOfferGroup(g: OfferGroup) {
    const copied: SalesbookOption[] = snapshotOfferOptions(g).map(s => ({
      id: s.id, tier: s.tier, name: s.name, brand: s.brand, description: s.description,
      price: s.price, monthlyPrice: s.monthlyPrice, warranty: s.warranty, category: s.category,
      includes: s.includes, image: s.image, featured: s.featured,
    }));
    patch({
      options: [...sb.options, ...copied],
      offerGroupIds: sb.offerGroupIds.includes(g.id) ? sb.offerGroupIds : [...sb.offerGroupIds, g.id],
    });
    setOfferPick(false);
  }

  return (
    <Card title="Options / Packages" icon={Package}
      subtitle="Equipment, tier, and package cards reps present to the customer. Add your own, or pull a ready-made Offer Group from the Offer Library."
      action={
        <div className="flex items-center gap-3">
          <button onClick={() => setOfferPick(true)} className="flex items-center gap-1 text-xs font-medium" style={{ color: accent }}><Package className="w-3.5 h-3.5" /> Add from Offer Library</button>
          <button onClick={add} className="flex items-center gap-1 text-xs font-medium" style={{ color: accent }}><Plus className="w-3.5 h-3.5" /> Add option</button>
        </div>
      }>
      {options.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>No option cards yet. Add one to offer Good / Better / Best tiers or packages.</p>
      ) : (
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
          {options.map((o, i) => (
            <OptionCardEditor key={o.id} o={o} index={i} total={options.length} accent={accent} monthlyEnabled={sb.monthlyEnabled} media={sb.media}
              onChange={p => update(o.id, p)} onMove={d => move(i, d)} onDuplicate={() => duplicate(o.id)} onFeature={() => feature(o.id)} onRemove={() => remove(o.id)} />
          ))}
        </div>
      )}
      {offerPick && <OfferGroupPicker industry={sb.industry} onPick={addOfferGroup} onClose={() => setOfferPick(false)} />}
    </Card>
  );
}

function OptionCardEditor({ o, index, total, accent, monthlyEnabled, media, onChange, onMove, onDuplicate, onFeature, onRemove }: {
  o: SalesbookOption; index: number; total: number; accent: string; monthlyEnabled: boolean; media: SalesbookMedia[];
  onChange: (p: Partial<SalesbookOption>) => void; onMove: (d: -1 | 1) => void; onDuplicate: () => void; onFeature: () => void; onRemove: () => void;
}) {
  const numOr = (s: string) => (s === "" ? 0 : parseFloat(s) || 0);
  return (
    <div className="rounded-xl p-3 space-y-2" style={{ backgroundColor: "var(--bg-surface-2)", border: o.featured ? `1.5px solid ${accent}` : "1px solid var(--border)" }}>
      {/* top bar: tier + reorder + actions */}
      <div className="flex items-center gap-1.5">
        <UiSelect size="sm" value={o.tier ?? ""} onChange={v => onChange({ tier: (v || undefined) as SalesbookOption["tier"] })}
          className="w-24" options={[{ value: "", label: "No tier" }, { value: "good", label: "Good" }, { value: "better", label: "Better" }, { value: "best", label: "Best" }]} />
        <button onClick={onFeature} title="Mark recommended" className="p-1" style={{ color: o.featured ? accent : "var(--text-muted)" }}>
          <Star className="w-3.5 h-3.5" fill={o.featured ? accent : "none"} />
        </button>
        <div className="ml-auto flex items-center gap-0.5">
          <button onClick={() => onMove(-1)} disabled={index === 0} className="disabled:opacity-20 p-0.5" style={{ color: "var(--text-muted)" }}><ChevronUp className="w-3.5 h-3.5" /></button>
          <button onClick={() => onMove(1)} disabled={index === total - 1} className="disabled:opacity-20 p-0.5" style={{ color: "var(--text-muted)" }}><ChevronDown className="w-3.5 h-3.5" /></button>
          <button onClick={onDuplicate} title="Duplicate" className="p-0.5" style={{ color: "var(--text-muted)" }}><Copy className="w-3.5 h-3.5" /></button>
          <button onClick={onRemove} title="Delete" className="p-0.5" style={{ color: "var(--text-muted)" }}><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      <OptionImageInput value={o.image} onChange={v => onChange({ image: v })} accent={accent} />
      {/* quick-pick from media library */}
      {media.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Library:</span>
          {media.slice(0, 8).map(m => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={m.id} src={m.url} alt={m.caption ?? ""} onClick={() => onChange({ image: m.url })} title="Use this image"
              className="w-7 h-7 rounded object-cover cursor-pointer" style={{ border: o.image === m.url ? `2px solid ${accent}` : "1px solid var(--border)" }} />
          ))}
        </div>
      )}

      <input value={o.category ?? ""} onChange={e => onChange({ category: e.target.value || undefined })} placeholder="Option group (e.g. System Replacement)" className="w-full rounded-lg px-2.5 py-1.5 text-xs outline-none" style={inputStyle} />
      <input value={o.name} onChange={e => onChange({ name: e.target.value })} placeholder="Option title" className="w-full rounded-lg px-2.5 py-1.5 text-sm outline-none" style={inputStyle} />
      <div className="flex gap-2">
        <input value={o.brand ?? ""} onChange={e => onChange({ brand: e.target.value || undefined })} placeholder="Brand" className="flex-1 min-w-0 rounded-lg px-2.5 py-1.5 text-xs outline-none" style={inputStyle} />
        <input value={o.model ?? ""} onChange={e => onChange({ model: e.target.value || undefined })} placeholder="Model" className="flex-1 min-w-0 rounded-lg px-2.5 py-1.5 text-xs outline-none" style={inputStyle} />
      </div>
      <input value={o.description ?? ""} onChange={e => onChange({ description: e.target.value || undefined })} placeholder="Short description" className="w-full rounded-lg px-2.5 py-1.5 text-xs outline-none" style={inputStyle} />
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1"><span className="text-[10px]" style={{ color: "var(--text-muted)" }}>$</span>
          <input type="number" min={0} value={o.price} onChange={e => onChange({ price: numOr(e.target.value) })} className="w-24 rounded-lg px-2 py-1 text-xs outline-none" style={inputStyle} /></div>
        {monthlyEnabled && (
          <div className="flex items-center gap-1"><span className="text-[10px]" style={{ color: "var(--text-muted)" }}>$/mo</span>
            <input type="number" min={0} value={o.monthlyPrice ?? ""} onChange={e => onChange({ monthlyPrice: e.target.value === "" ? undefined : numOr(e.target.value) })} className="w-20 rounded-lg px-2 py-1 text-xs outline-none" style={inputStyle} /></div>
        )}
      </div>
      <div className="flex gap-2">
        <input value={o.efficiency ?? ""} onChange={e => onChange({ efficiency: e.target.value || undefined })} placeholder="Efficiency / spec" className="flex-1 min-w-0 rounded-lg px-2.5 py-1.5 text-xs outline-none" style={inputStyle} />
        <input value={o.warranty ?? ""} onChange={e => onChange({ warranty: e.target.value || undefined })} placeholder="Warranty" className="flex-1 min-w-0 rounded-lg px-2.5 py-1.5 text-xs outline-none" style={inputStyle} />
      </div>
      <textarea value={(o.includes ?? []).join("\n")} onChange={e => onChange({ includes: e.target.value.split("\n").map(s => s.trim()).filter(Boolean) })} rows={3} placeholder="Included items (one per line)" className="w-full rounded-lg px-2.5 py-1.5 text-xs outline-none resize-none" style={inputStyle} />
    </div>
  );
}

// ─── Media Library ────────────────────────────────────────
function MediaTab({ sb, patch, accent }: { sb: DraftState; patch: (p: Partial<DraftState>) => void; accent: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [libPick, setLibPick] = useState(false);
  const media = sb.media;

  // Read every dropped/selected image, then append them in one patch so a
  // multi-file drop doesn't lose images to a stale-closure race.
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
    <Card title="Media Library" icon={ImageIcon} subtitle="Upload images or reuse assets from the company Media Library, then attach them to option cards."
      action={<button onClick={() => setLibPick(true)} className="flex items-center gap-1 text-xs font-medium" style={{ color: accent }}><ImageIcon className="w-3.5 h-3.5" /> Choose from Media Library</button>}>
      {/* Dropzone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files); }}
        onClick={() => fileRef.current?.click()}
        className="rounded-xl flex flex-col items-center justify-center gap-1.5 py-8 cursor-pointer transition-colors"
        style={{ border: `1.5px dashed ${dragOver ? accent : "var(--border)"}`, backgroundColor: dragOver ? accent + "0d" : "var(--bg-surface-2)" }}>
        <ImageIcon className="w-6 h-6" style={{ color: accent }} />
        <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Drag &amp; drop images, or click to upload</p>
        <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>PNG or JPG · stored with this salesbook</p>
        <input ref={fileRef} type="file" accept="image/*" multiple onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} className="hidden" />
      </div>

      {media.length > 0 && (
        <div className="grid gap-3 mt-1" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
          {media.map(m => {
            const isCover = sb.coverImageId === m.id;
            return (
              <div key={m.id} className="rounded-xl overflow-hidden flex flex-col" style={{ backgroundColor: "var(--bg-surface)", border: isCover ? `1.5px solid ${accent}` : "1px solid var(--border)" }}>
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.url} alt={m.caption ?? ""} style={{ width: "100%", height: "110px", objectFit: "cover", display: "block" }} />
                  {isCover && <span className="absolute top-1.5 left-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: accent, color: "#fff" }}>COVER</span>}
                  <button onClick={() => remove(m.id)} className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.55)", color: "#fff" }}><X className="w-3.5 h-3.5" /></button>
                </div>
                <div className="p-2 space-y-1.5">
                  <UiSelect size="sm" value={m.category} onChange={v => updateItem(m.id, { category: v as SalesbookMediaCategory })}
                    options={(Object.keys(MEDIA_CATEGORY_LABELS) as SalesbookMediaCategory[]).map(k => ({ value: k, label: MEDIA_CATEGORY_LABELS[k] }))} />
                  <input value={m.caption ?? ""} onChange={e => updateItem(m.id, { caption: e.target.value || undefined })} placeholder="Caption" className="w-full rounded-lg px-2 py-1 text-[11px] outline-none" style={inputStyle} />
                  <button onClick={() => patch({ coverImageId: isCover ? undefined : m.id })}
                    className="w-full text-[11px] font-medium py-1 rounded-lg" style={isCover ? { backgroundColor: accent + "1a", color: accent } : { border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                    {isCover ? "Cover image ✓" : "Set as cover"}
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
    </Card>
  );
}

// ─── Financing ────────────────────────────────────────────
function FinancingTab({ sb, patch }: { sb: DraftState; patch: (p: Partial<DraftState>) => void }) {
  return (
    <Card title="Financing" icon={CreditCard} subtitle="How monthly payments and financing appear on the proposal.">
      <Toggle label="Show monthly payment on the proposal" checked={sb.showMonthly} onChange={v => patch({ showMonthly: v })} />
      <Toggle label="Enable per-option monthly price field" checked={sb.monthlyEnabled} onChange={v => patch({ monthlyEnabled: v })} />
      <Field label="Default financing note">
        <textarea value={sb.financingNote} onChange={e => patch({ financingNote: e.target.value })} rows={2} className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none" style={inputStyle} placeholder="e.g. Financing available — as low as $119/mo with approved credit." />
      </Field>
      <Field label="Financing disclaimer">
        <textarea value={sb.financingDisclaimer} onChange={e => patch({ financingDisclaimer: e.target.value })} rows={2} className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none" style={inputStyle} placeholder="e.g. Subject to credit approval. Terms and APR vary. Example payment only." />
      </Field>
      <div className="rounded-lg p-3 flex items-start gap-2" style={{ backgroundColor: "var(--bg-surface-2)", border: "1px dashed var(--border)" }}>
        <Info className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "var(--text-muted)" }} />
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Term length and APR fields will be added when a financing provider is connected.</p>
      </div>
    </Card>
  );
}

// ─── Warranty & Terms ─────────────────────────────────────
function WarrantyTermsTab({ sb, patch }: { sb: DraftState; patch: (p: Partial<DraftState>) => void }) {
  return (
    <Card title="Warranty & Terms" icon={ShieldCheck} subtitle="Default warranty, guarantee, and terms wording copied into quotes.">
      <Field label="Default warranty wording">
        <textarea value={sb.warranty} onChange={e => patch({ warranty: e.target.value })} rows={2} className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none" style={inputStyle} placeholder="e.g. Manufacturer parts warranty plus our workmanship guarantee." />
      </Field>
      <Field label="Workmanship guarantee">
        <input value={sb.workmanship} onChange={e => patch({ workmanship: e.target.value })} className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle} placeholder="e.g. 2-year workmanship guarantee on all installs." />
      </Field>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Proposal validity (days)">
          <input type="number" min={1} value={sb.validityDays} onChange={e => patch({ validityDays: parseInt(e.target.value) || 0 })} className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle} />
        </Field>
        <Field label="Deposit wording">
          <input value={sb.depositTerms} onChange={e => patch({ depositTerms: e.target.value })} className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle} placeholder="e.g. 50% deposit required to schedule." />
        </Field>
      </div>
      <Field label="Default terms & conditions *">
        <textarea value={sb.terms} onChange={e => patch({ terms: e.target.value })} rows={3} className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none" style={inputStyle} placeholder="Standard terms applied to every quote built from this salesbook." />
      </Field>
      <Field label="Exclusions">
        <textarea value={sb.exclusions} onChange={e => patch({ exclusions: e.target.value })} rows={2} className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none" style={inputStyle} placeholder="e.g. Permits, drywall repair, and electrical upgrades are not included unless noted." />
      </Field>
    </Card>
  );
}

// ─── Preview & Publish ────────────────────────────────────
function PublishTab({ sb, patch, accent, check, onPreview, onSave }: {
  sb: DraftState; patch: (p: Partial<DraftState>) => void; accent: string;
  check: { ok: boolean; issues: string[] }; onPreview: () => void; onSave: (next?: Partial<DraftState>) => void;
}) {
  return (
    <div className="space-y-4">
      <Card title="Preview & Publish" icon={Send} subtitle="Review the customer-facing proposal, then publish to make this salesbook available in quote creation.">
        <div className="flex flex-wrap gap-2">
          <button onClick={onPreview} className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium" style={{ border: `1px solid ${accent}`, color: accent, backgroundColor: accent + "0f" }}>
            <Eye className="w-4 h-4" /> Full preview (sample customer)
          </button>
        </div>

        {/* Publish checklist */}
        <div className="rounded-xl p-4" style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border)" }}>
          <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>Publishing requirements</p>
          {check.ok ? (
            <div className="flex items-center gap-2 text-sm font-medium" style={{ color: "#059669" }}>
              <CheckCircle2 className="w-4 h-4" /> All requirements met — ready to publish.
            </div>
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
      </Card>

      <Card title="Status" icon={Lock} subtitle="Draft salesbooks are saved but flagged as in-progress. Publishing marks it active.">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <StatusPill status={sb.status} />
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              {sb.status === "published" ? "Active — selectable during quote creation." : "Draft — keep editing until it's ready."}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { patch({ status: "draft" }); onSave({ status: "draft" }); }}
              className="px-3 py-2 rounded-lg text-sm font-medium" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
              Save draft
            </button>
            <button onClick={() => { patch({ status: "published" }); onSave({ status: "published" }); }} disabled={!check.ok}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40" style={{ backgroundColor: accent }}>
              <Send className="w-4 h-4" /> Publish / Activate
            </button>
          </div>
        </div>
        {!check.ok && <p className="text-[11px] mt-2" style={{ color: "var(--text-muted)" }}>Resolve the requirements above to enable publishing.</p>}
      </Card>
    </div>
  );
}

// ─── Full-screen preview modal ────────────────────────────
function PreviewModal({ sb, onClose }: { sb: DraftState; onClose: () => void }) {
  const doc = useMemo(() => previewDoc(sb), [sb]);
  const { design, family, variant } = useMemo(() => resolveQuoteDesign(sb.quoteDesignId), [sb.quoteDesignId]);
  return (
    <div className="fixed inset-0 z-[70] flex flex-col" style={{ backgroundColor: "rgba(17,24,39,0.7)" }}>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 px-5 py-3 shrink-0" style={{ backgroundColor: "var(--bg-surface)", borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2 min-w-0">
          <Eye className="w-4 h-4 shrink-0" style={{ color: "var(--accent-text)" }} />
          <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{sb.name || "Proposal"} — Preview</p>
          <span className="text-[11px] px-2 py-0.5 rounded-full shrink-0" style={{ backgroundColor: "var(--accent-soft-bg)", color: "var(--accent-text)" }}>{design.name} · {designFamilyLabel(design)}</span>
          <span className="hidden sm:inline text-[11px] shrink-0" style={{ color: "var(--text-muted)" }}>Sample customer · {SAMPLE.customerName}</span>
        </div>
        <button onClick={onClose} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)", backgroundColor: "var(--bg-surface)" }}>
          <X className="w-4 h-4" /> Close
        </button>
      </div>
      {/* Document stage */}
      <div className="flex-1 overflow-y-auto thin-scroll-y" style={{ backgroundColor: "#e5e7eb" }}>
        <div className="py-8 px-4">
          <ProposalFamilyDocument data={doc} family={family} variant={variant} />
        </div>
      </div>
    </div>
  );
}

// ─── Shared bits ──────────────────────────────────────────
const inputStyle: React.CSSProperties = { border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" };

function Card({ title, icon: Icon, subtitle, action, children }: { title: string; icon: typeof FileText; subtitle?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-5" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            <Icon className="w-4 h-4" style={{ color: "var(--accent-text)" }} /> {title}
          </p>
          {subtitle && <p className="text-xs mt-1 leading-snug" style={{ color: "var(--text-muted)" }}>{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>{label}</label>{children}</div>;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg cursor-pointer" style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border)" }}>
      <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{label}</span>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="accent-[#0f8578] w-4 h-4" />
    </label>
  );
}
