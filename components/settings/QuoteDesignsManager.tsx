"use client";

// Quote Designs — the single, unified gallery for "choose what your customer-facing
// quote looks like." Each card is a complete Quote Design (layout family + visual
// style + proposal structure + pricing presentation), shown with a true-to-life
// thumbnail rendered by the real proposal engine. Replaces the old split between
// "Quote Templates" (pick a family + variant) and "Quote Designs" (visual skins).
//
// Exports:
//   • QuoteDesignsManager  — the Settings gallery (sets the company's active design)
//   • QuoteDesignPicker    — a modal gallery the Salesbook editor opens on "Change Design"
//   • QuoteDesignPreviewModal / QuoteDesignThumbnail — reused by both

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Palette, Eye, Check, Star, X, Layers, Info, Plus, Pencil, Trash2 } from "lucide-react";
import ProposalFamilyDocument from "@/components/quotes/family/ProposalFamilyDocument";
import QuoteDesignStudio from "@/components/settings/QuoteDesignStudio";
import { buildSampleProposalDoc, buildSampleProposalDocForMode } from "@/lib/proposals/sampleDoc";
import {
  getQuoteDesigns, getDesignsForMode, getActiveQuoteDesignId, setActiveQuoteDesign,
  resolveQuoteDesign, designFamilyLabel, designVariantLabel,
  designSupportsMode, deleteCustomQuoteDesign,
  PRICING_PRESENTATION_LABELS, PRICING_PRESENTATION_SHORT,
  QUOTE_DESIGN_MODE_LABELS,
  type QuoteDesign, type QuoteDesignMode,
} from "@/lib/quotes/quoteDesigns";

// ─── Settings gallery ─────────────────────────────────────
export default function QuoteDesignsManager() {
  const [activeId, setActiveId] = useState(getActiveQuoteDesignId());
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [tick, setTick] = useState(0);   // re-read after Studio save / delete
  // { id } = edit a custom design; {} = build a new one; null = closed.
  const [studio, setStudio] = useState<{ id?: string } | null>(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- tick forces a re-read after Studio save/delete
  const designs = useMemo(() => getQuoteDesigns(), [tick]);
  const previewDesign = designs.find(d => d.id === previewId) ?? null;

  function use(id: string) { setActiveQuoteDesign(id); setActiveId(id); }

  if (studio) {
    return <QuoteDesignStudio designId={studio.id}
      onClose={() => setStudio(null)}
      onSaved={() => { setStudio(null); setTick(t => t + 1); }} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2.5">
        <div className="flex-1 rounded-xl p-3.5 flex items-start gap-2.5" style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border)" }}>
          <Palette className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "var(--accent-text)" }} />
          <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            Choose what your customer-facing quote looks like. Each Quote Design is a complete proposal — its layout, visual style, sections, and pricing presentation. Your brand color &amp; logo (from <span style={{ fontWeight: 600 }}>Proposal Branding</span>) carry through every design. One design is active by default; salesbooks and quotes can pick their own.
          </p>
        </div>
        <button onClick={() => setStudio({})}
          className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg text-sm font-medium text-white shrink-0 bg-[#0f8578] hover:bg-[#0c6b60] transition-colors">
          <Plus className="w-4 h-4" /> New Design
        </button>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
        {designs.map(d => (
          <DesignCard key={d.id} d={d} active={activeId === d.id}
            onUse={() => use(d.id)} onPreview={() => setPreviewId(d.id)}
            onEdit={d.custom ? () => setStudio({ id: d.id }) : undefined}
            onDelete={d.custom ? () => {
              if (activeId === d.id) return;   // can't delete the active design
              deleteCustomQuoteDesign(d.id); setTick(t => t + 1);
            } : undefined} />
        ))}
      </div>

      {previewDesign && (
        <QuoteDesignPreviewModal design={previewDesign} active={activeId === previewDesign.id}
          onClose={() => setPreviewId(null)} onUse={() => { use(previewDesign.id); setPreviewId(null); }} />
      )}
    </div>
  );
}

// ─── Design card ──────────────────────────────────────────
function DesignCard({ d, active, onUse, onPreview, onEdit, onDelete }: {
  d: QuoteDesign; active: boolean; onUse: () => void; onPreview: () => void;
  onEdit?: () => void; onDelete?: () => void;
}) {
  return (
    <div className="rounded-2xl overflow-hidden flex flex-col transition-all hover:shadow-md"
      style={{ backgroundColor: "var(--bg-surface)", border: `1px solid ${active ? "var(--accent-text)" : "var(--border-subtle)"}`, boxShadow: active ? "0 0 0 3px var(--accent-soft-bg)" : "var(--shadow-card)" }}>
      {/* Thumbnail */}
      <div className="p-3" style={{ backgroundColor: "var(--bg-surface-2)" }}>
        <QuoteDesignThumbnail design={d} height={196} />
      </div>

      {/* Body */}
      <div className="px-4 py-3 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{d.name}</p>
          {active && <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: "#d1fae5", color: "#065f46" }}><Check className="w-3 h-3" /> Active</span>}
          {!active && d.isDefault && <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: "#d3ebe6", color: "#0a5c53" }}><Star className="w-2.5 h-2.5" /> Default</span>}
          {d.custom && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>Custom</span>}
          {(onEdit || onDelete) && (
            <span className="ml-auto flex items-center gap-0.5">
              {onEdit && <button onClick={onEdit} title="Edit in Design Studio" className="p-1" style={{ color: "var(--text-muted)" }}><Pencil className="w-3.5 h-3.5" /></button>}
              {onDelete && <button onClick={onDelete} disabled={active} title={active ? "Active design — pick another first" : "Delete"} className="p-1 disabled:opacity-25" style={{ color: "var(--text-muted)" }}><Trash2 className="w-3.5 h-3.5" /></button>}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          <Badge>{designFamilyLabel(d)}</Badge>
          <Badge subtle>{designVariantLabel(d)}</Badge>
        </div>
        <p className="text-xs leading-relaxed mt-2" style={{ color: "var(--text-secondary)" }}>{d.description}</p>
        <p className="flex items-center gap-1.5 text-[11px] mt-2" style={{ color: "var(--text-muted)" }}>
          <Layers className="w-3.5 h-3.5" /> {PRICING_PRESENTATION_LABELS[d.pricingPresentation]}
        </p>
        <ModeBadges modes={d.supportedModes} />
      </div>

      {/* Actions */}
      <div className="px-4 py-3 flex items-center gap-2" style={{ borderTop: "1px solid var(--border)" }}>
        <button onClick={onPreview} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium"
          style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
          <Eye className="w-3.5 h-3.5" /> Preview
        </button>
        <button onClick={onUse} disabled={active} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-white disabled:opacity-50"
          style={{ backgroundColor: active ? "var(--text-muted)" : "var(--accent-text)" }}>
          {active ? <><Check className="w-3.5 h-3.5" /> In use</> : "Use This Design"}
        </button>
      </div>
    </div>
  );
}

// ─── True-to-life thumbnail (scaled real document) ────────
export function QuoteDesignThumbnail({ design, height = 196 }: { design: QuoteDesign; height?: number }) {
  const { family, variant } = useMemo(() => resolveQuoteDesign(design.id), [design.id]);
  const doc = useMemo(() => buildSampleProposalDoc(design.defaultSections, design.previewTitle), [design.defaultSections, design.previewTitle]);
  return (
    <ScaledDoc height={height}>
      <ProposalFamilyDocument data={doc} family={family} variant={variant} shadow={false} />
    </ScaledDoc>
  );
}

// Fills its width and shows the top `height` slice of an 816px document.
function ScaledDoc({ children, height, docWidth = 816 }: { children: React.ReactNode; height: number; docWidth?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.36);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => { if (el.clientWidth) setScale(el.clientWidth / docWidth); };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [docWidth]);
  return (
    <div ref={ref} style={{ width: "100%", height: `${height}px`, overflow: "hidden", borderRadius: "8px", border: "1px solid var(--border)", backgroundColor: "#e5e7eb" }}>
      <div style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: `${docWidth}px`, pointerEvents: "none" }}>
        {children}
      </div>
    </div>
  );
}

// ─── Full preview modal ───────────────────────────────────
export function QuoteDesignPreviewModal({ design, active, onClose, onUse }: {
  design: QuoteDesign; active: boolean; onClose: () => void; onUse: () => void;
}) {
  const { family, variant } = useMemo(() => resolveQuoteDesign(design.id), [design.id]);
  // "Preview As" — show how this one design adapts to different quote situations.
  // Start on the first mode it supports.
  const [mode, setMode] = useState<QuoteDesignMode>(design.supportedModes[0] ?? "single_offer");
  const { doc, renderMode } = useMemo(() => buildSampleProposalDocForMode(design, mode), [design, mode]);
  const fellBack = renderMode !== mode;
  return (
    <div className="fixed inset-0 z-[80] flex flex-col" style={{ backgroundColor: "rgba(17,24,39,0.7)" }}>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 px-5 py-3 shrink-0" style={{ backgroundColor: "var(--bg-surface)", borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2 min-w-0">
          <Eye className="w-4 h-4 shrink-0" style={{ color: "var(--accent-text)" }} />
          <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{design.name}</p>
          <span className="hidden sm:inline text-[11px] px-2 py-0.5 rounded-full shrink-0" style={{ backgroundColor: "var(--accent-soft-bg)", color: "var(--accent-text)" }}>{designFamilyLabel(design)} · {designVariantLabel(design)}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={onUse} disabled={active} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white disabled:opacity-50" style={{ backgroundColor: active ? "var(--text-muted)" : "var(--accent-text)" }}>
            {active ? <><Check className="w-4 h-4" /> In use</> : "Use This Design"}
          </button>
          <button onClick={onClose} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)", backgroundColor: "var(--bg-surface)" }}>
            <X className="w-4 h-4" /> Close
          </button>
        </div>
      </div>
      {/* Preview As — mode switcher */}
      <div className="flex items-center gap-2 px-5 py-2.5 shrink-0 flex-wrap" style={{ backgroundColor: "var(--bg-surface)", borderBottom: "1px solid var(--border)" }}>
        <span className="text-[11px] font-semibold uppercase tracking-widest shrink-0" style={{ color: "var(--text-muted)" }}>Preview as</span>
        {QUOTE_DESIGN_MODES_ORDER.map(m => {
          const supported = designSupportsMode(design, m);
          const on = mode === m;
          return (
            <button key={m} onClick={() => setMode(m)} title={supported ? undefined : "Not supported — preview shows the fallback layout"}
              className="text-xs font-medium px-2.5 py-1 rounded-lg transition-colors"
              style={{
                backgroundColor: on ? "var(--accent-text)" : "var(--bg-surface-2)",
                color: on ? "#fff" : supported ? "var(--text-secondary)" : "var(--text-muted)",
                border: `1px solid ${on ? "var(--accent-text)" : "var(--border-subtle)"}`,
                opacity: supported ? 1 : 0.6,
              }}>
              {QUOTE_DESIGN_MODE_LABELS[m]}
            </button>
          );
        })}
      </div>
      {fellBack && (
        <div className="flex items-center gap-1.5 px-5 py-1.5 shrink-0 text-[11px]" style={{ backgroundColor: "#fef3c7", color: "#92400e" }}>
          <Info className="w-3.5 h-3.5 shrink-0" /> “{QUOTE_DESIGN_MODE_LABELS[mode]}” isn’t supported by this design — showing the {QUOTE_DESIGN_MODE_LABELS[renderMode]} fallback layout.
        </div>
      )}
      {/* Document stage */}
      <div className="flex-1 overflow-y-auto thin-scroll-y" style={{ backgroundColor: "#e5e7eb" }}>
        <div className="py-8 px-4"><ProposalFamilyDocument data={doc} family={family} variant={variant} /></div>
      </div>
    </div>
  );
}

const QUOTE_DESIGN_MODES_ORDER: QuoteDesignMode[] = ["quick_quote", "single_offer", "multi_option", "salesbook", "custom"];

// ─── Picker modal (used by the Salesbook editor's "Change Design") ──
export function QuoteDesignPicker({ activeId, mode, onPick, onClose }: {
  activeId?: string; mode?: QuoteDesignMode; onPick: (id: string) => void; onClose: () => void;
}) {
  // When a mode is given (e.g. the Quick Quote flow), only show designs that can
  // render that quote situation.
  const designs = useMemo(() => mode ? getDesignsForMode(mode) : getQuoteDesigns(), [mode]);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const previewDesign = designs.find(d => d.id === previewId) ?? null;

  return (
    <div className="fixed inset-0 z-[70] bg-black/45 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-5xl max-h-[92vh] flex flex-col rounded-2xl overflow-hidden" onClick={e => e.stopPropagation()}
        style={{ backgroundColor: "var(--bg-surface)", boxShadow: "0 24px 70px rgba(0,0,0,0.4)" }}>
        <div className="flex items-center justify-between px-5 py-3.5 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2 min-w-0">
            <Palette className="w-4 h-4 shrink-0" style={{ color: "var(--accent-text)" }} />
            <div className="min-w-0">
              <p className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Choose a Quote Design</p>
              <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                {mode
                  ? <>Showing designs that support <span style={{ fontWeight: 600 }}>{QUOTE_DESIGN_MODE_LABELS[mode]}</span> quotes.</>
                  : "This sets the complete customer-facing layout & style for this salesbook."}
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ color: "var(--text-muted)" }}><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto thin-scroll-y p-5">
          <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
            {designs.map(d => {
              const on = activeId === d.id;
              return (
                <div key={d.id} className="rounded-2xl overflow-hidden flex flex-col transition-all hover:shadow-md"
                  style={{ backgroundColor: "var(--bg-surface)", border: `1px solid ${on ? "var(--accent-text)" : "var(--border-subtle)"}`, boxShadow: on ? "0 0 0 3px var(--accent-soft-bg)" : "var(--shadow-card)" }}>
                  <div className="p-3" style={{ backgroundColor: "var(--bg-surface-2)" }}>
                    <QuoteDesignThumbnail design={d} height={170} />
                  </div>
                  <div className="px-3.5 py-2.5 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{d.name}</p>
                      {on && <Check className="w-3.5 h-3.5" style={{ color: "var(--accent-text)" }} />}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      <Badge>{designFamilyLabel(d)}</Badge>
                      <Badge subtle>{designVariantLabel(d)}</Badge>
                    </div>
                    <p className="text-[11px] leading-snug mt-1.5" style={{ color: "var(--text-muted)" }}>{d.description}</p>
                    <p className="text-[10px] mt-1.5" style={{ color: "var(--text-muted)" }}>{PRICING_PRESENTATION_SHORT[d.pricingPresentation]}</p>
                    <ModeBadges modes={d.supportedModes} />
                  </div>
                  <div className="px-3.5 py-2.5 flex items-center gap-2" style={{ borderTop: "1px solid var(--border)" }}>
                    <button onClick={() => setPreviewId(d.id)} className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                      <Eye className="w-3.5 h-3.5" /> Preview
                    </button>
                    <button onClick={() => onPick(d.id)} disabled={on} className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50" style={{ backgroundColor: on ? "var(--text-muted)" : "var(--accent-text)" }}>
                      {on ? "In use" : "Use This Design"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {previewDesign && (
        <QuoteDesignPreviewModal design={previewDesign} active={activeId === previewDesign.id}
          onClose={() => setPreviewId(null)} onUse={() => { onPick(previewDesign.id); setPreviewId(null); }} />
      )}
    </div>
  );
}

// ─── Bits ─────────────────────────────────────────────────
// Supported-mode chips — which quote situations a design can render.
function ModeBadges({ modes }: { modes: QuoteDesignMode[] }) {
  return (
    <div className="flex items-center gap-1 mt-2 flex-wrap">
      {modes.map(m => (
        <span key={m} className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
          style={{ backgroundColor: "var(--bg-input)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
          {QUOTE_DESIGN_MODE_LABELS[m]}
        </span>
      ))}
    </div>
  );
}

function Badge({ children, subtle }: { children: React.ReactNode; subtle?: boolean }) {
  return (
    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
      style={subtle
        ? { backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }
        : { backgroundColor: "var(--accent-soft-bg)", color: "var(--accent-text)" }}>
      {children}
    </span>
  );
}
