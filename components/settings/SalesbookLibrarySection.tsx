"use client";

// Salesbook Library (Settings → Sales & Catalog).
// A premium template gallery of CRM-provided salesbooks the user can preview and
// copy ("Use This Salesbook") into their own company workspace. Installed copies
// are company-owned and editable without affecting the CRM master template.
//
// Phase 1: gallery + preview drawer + install flow + installed list. Spreadsheet
// import and the company-salesbook editor land later.

import { useMemo, useState } from "react";
import {
  BookOpen, Eye, Check, Download, Trash2, X, Layers, Package,
  CreditCard, ShieldCheck, FileText, Sparkles, Pencil, Palette, ChevronRight,
  Image as ImageIcon, Upload, Tag, Sliders,
} from "lucide-react";
import UiSelect from "@/components/ui/Select";
import CompanySalesbookEditor from "@/components/settings/CompanySalesbookEditor";
import QuoteDesignsManager from "@/components/settings/QuoteDesignsManager";
import OfferLibrarySection from "@/components/settings/OfferLibrarySection";
import MediaLibrarySection from "@/components/settings/MediaLibrarySection";
import ContentBlocksSection from "@/components/settings/ContentBlocksSection";
import ProposalBrandingSection from "@/components/settings/ProposalBrandingSection";
import ProposalDefaultsSection from "@/components/settings/ProposalDefaultsSection";
import { useHierarchy } from "@/components/providers/HierarchyProvider";
import { SECTION_LABELS, type SectionKey } from "@/lib/proposals/data";
import {
  getSalesbookTemplates, getCompanySalesbooks, isTemplateInstalled,
  installSalesbook, uninstallSalesbook,
  INDUSTRY_LABELS, PROPOSAL_TYPE_LABELS, COMPLEXITY_LABELS, INDUSTRY_ACCENT,
  type SalesbookTemplate, type SalesbookOption,
} from "@/lib/salesbooks/data";

// The section is a HUB (like Agreements): a landing grid of cards that each drill
// one level deeper into a module. The settings page owns the open-module state +
// breadcrumb and passes it in via HubProps.
type ModuleKey =
  | "installed" | "library" | "designs" | "offer_library" | "media_library"
  | "content_blocks" | "defaults" | "import_center";
interface SbModule { key: ModuleKey; label: string; description: string; icon: typeof BookOpen }
// The single source of truth for reusable proposal/salesbook setup. (The old
// Proposal Builder settings page folded into these cards — templates → Salesbook
// Templates / Quote Designs, sections & terms → Content Blocks, branding & defaults
// → their own cards.)
const MODULES: SbModule[] = [
  { key: "installed",        label: "Proposal Templates",  description: "Your company-owned proposal templates — edit them or quote from them.",                icon: Check },
  { key: "library",          label: "Starter Templates",   description: "Browse premium starter templates and copy them into your company.",                    icon: BookOpen },
  { key: "designs",          label: "Quote Designs",       description: "Choose what your customer-facing quote looks like — the complete layout & style.",     icon: Palette },
  { key: "offer_library",    label: "Offer Library",       description: "Reusable packages, options, equipment cards, pricing blocks, and Good/Better/Best groups.", icon: Package },
  { key: "media_library",    label: "Media Library",       description: "Reusable images: equipment, covers, before/after, logos, and warranty icons.",          icon: ImageIcon },
  { key: "content_blocks",   label: "Content Blocks",      description: "Reusable wording: recommended solution, scope, warranty, financing, terms, and exclusions.", icon: FileText },
  { key: "defaults",         label: "Defaults",            description: "Branding, default designs by quote type, expiration, terms, financing, and pricing display.", icon: Sliders },
  { key: "import_center",    label: "Import Center",       description: "Bulk-upload spreadsheets, equipment data, pricing, images, and documents.",             icon: Upload },
];

export default function SalesbookLibrarySection({ activeModule, onOpen, onBack }: {
  activeModule: string | null;
  onOpen: (key: string, label: string) => void;
  onBack: () => void;
}) {
  const { allCompanies, allLocations, effectiveCompanyId } = useHierarchy();

  const [tick, setTick] = useState(0);          // bump to re-read after install/uninstall
  const refresh = () => setTick(t => t + 1);

  const [previewId, setPreviewId] = useState<string | null>(null);
  const [installId, setInstallId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const templates = getSalesbookTemplates();
  const installed = useMemo(() => getCompanySalesbooks(), [tick]);

  const previewTmpl = templates.find(t => t.id === previewId) ?? null;
  const installTmpl = templates.find(t => t.id === installId) ?? null;

  // Editing an installed company salesbook takes over the whole section.
  if (editingId) {
    return <CompanySalesbookEditor sbId={editingId} onBack={() => { setEditingId(null); refresh(); }} />;
  }

  // ── Hub (cards) ──
  if (!activeModule) {
    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <BookOpen className="w-5 h-5" style={{ color: "#0f8578" }} /> Proposal Library
          </h2>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            The single place for reusable proposal setup — templates, designs, content, branding, and defaults. Pick one to manage it.
          </p>
        </div>
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
          {MODULES.map(m => {
            const Icon = m.icon;
            const badge = m.key === "installed" && installed.length > 0 ? installed.length : null;
            return (
              <button key={m.key} onClick={() => onOpen(m.key, m.label)}
                className="flex items-start gap-3 p-4 rounded-xl text-left w-full transition-all group hover:shadow-md cursor-pointer"
                style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--bg-surface-2)" }}>
                  <Icon className="w-4 h-4" style={{ color: "#0f8578" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{m.label}</p>
                    {badge != null && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-surface-2)", color: "var(--text-muted)" }}>{badge}</span>}
                  </div>
                  <p className="text-xs mt-0.5 leading-snug" style={{ color: "var(--text-muted)" }}>{m.description}</p>
                </div>
                <ChevronRight className="w-4 h-4 shrink-0 mt-0.5 opacity-0 group-hover:opacity-40 transition-opacity" style={{ color: "var(--text-muted)" }} />
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Module page (one level deeper) ──
  const mod = MODULES.find(m => m.key === activeModule);
  if (!mod) { onBack(); return null; }

  return (
    <div className="space-y-5">
      {/* Offer Library owns its own workspace header — avoid the duplicate heading. */}
      {mod.key !== "offer_library" && (
        <div>
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>{mod.label}</h2>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>{mod.description}</p>
        </div>
      )}

      {mod.key === "library" && (
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
          {templates.map(t => (
            <SalesbookCard key={t.id} t={t} installed={isTemplateInstalled(t.id)}
              onPreview={() => setPreviewId(t.id)} onUse={() => setInstallId(t.id)} />
          ))}
        </div>
      )}

      {mod.key === "installed" && <InstalledList installed={installed} onRefresh={refresh} onEdit={setEditingId} />}

      {mod.key === "designs" && <QuoteDesignsManager />}

      {mod.key === "offer_library" && <OfferLibrarySection />}

      {mod.key === "media_library" && <MediaLibrarySection />}

      {mod.key === "content_blocks" && <ContentBlocksSection />}

      {mod.key === "defaults" && (
        <div className="space-y-8">
          <ProposalDefaultsSection />
          {/* Proposal Branding now lives inside Defaults (its standalone card was removed). */}
          <div>
            <h3 className="text-sm font-semibold mb-4 pt-5 flex items-center gap-2" style={{ color: "var(--text-primary)", borderTop: "1px solid var(--border)" }}>
              <Palette className="w-4 h-4" style={{ color: "#0f8578" }} /> Proposal Branding
            </h3>
            <ProposalBrandingSection />
          </div>
        </div>
      )}

      {mod.key === "import_center" && <ImportCenter />}

      {previewTmpl && <PreviewDrawer t={previewTmpl} installed={isTemplateInstalled(previewTmpl.id)}
        onClose={() => setPreviewId(null)} onUse={() => { setPreviewId(null); setInstallId(previewTmpl.id); }} />}

      {installTmpl && <InstallModal t={installTmpl} companies={allCompanies} locations={allLocations}
        defaultCompanyId={effectiveCompanyId ?? allCompanies[0]?.id ?? ""}
        onClose={() => setInstallId(null)} onInstalled={() => { setInstallId(null); refresh(); onOpen("installed", "Proposal Templates"); }} />}
    </div>
  );
}

// ─── Import Center (utility) ──────────────────────────────
function ImportCenter() {
  const KINDS: { icon: typeof Upload; label: string; hint: string }[] = [
    { icon: Tag,         label: "Pricing spreadsheet", hint: "CSV / XLSX of items, costs & prices" },
    { icon: Package,     label: "Equipment data",      hint: "Brands, models, efficiency & warranty" },
    { icon: ImageIcon,   label: "Images",              hint: "Equipment, covers & before/after photos" },
    { icon: FileText,    label: "Documents",           hint: "Terms, warranties & spec sheets" },
  ];
  return (
    <div className="space-y-4">
      <LibraryToolbar icon={Upload} text="Bulk-load your catalog and assets. Drop a file to get started — mapping & preview land next." />
      <div className="rounded-xl flex flex-col items-center justify-center gap-1.5 py-10" style={{ border: "1.5px dashed var(--border)", backgroundColor: "var(--bg-surface-2)" }}>
        <Upload className="w-6 h-6" style={{ color: "var(--accent-text)" }} />
        <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Drag &amp; drop a spreadsheet, image set, or document</p>
        <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Guided import &amp; column mapping coming soon</p>
      </div>
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
        {KINDS.map(k => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="rounded-xl p-3.5 flex items-start gap-3" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
              <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--bg-surface-2)" }}><Icon className="w-4 h-4" style={{ color: "var(--accent-text)" }} /></span>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{k.label}</p>
                  <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>Soon</span>
                </div>
                <p className="text-[11px] mt-0.5 leading-snug" style={{ color: "var(--text-muted)" }}>{k.hint}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Shared library bits ──────────────────────────────────
function LibraryToolbar({ icon: Icon, text }: { icon: typeof Package; text: string }) {
  return (
    <div className="rounded-xl p-3.5 flex items-start gap-2.5" style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border)" }}>
      <Icon className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "var(--accent-text)" }} />
      <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>{text}</p>
    </div>
  );
}

// ─── Gallery card ─────────────────────────────────────────
function SalesbookCard({ t, installed, onPreview, onUse }: { t: SalesbookTemplate; installed: boolean; onPreview: () => void; onUse: () => void }) {
  const accent = INDUSTRY_ACCENT[t.industry];
  return (
    <div className="rounded-2xl overflow-hidden flex flex-col transition-all hover:shadow-md"
      style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
      {/* Visual header */}
      <div className="px-4 pt-4 pb-3 relative" style={{ background: `linear-gradient(135deg, ${accent}14, transparent)` }}>
        <div className="flex items-start justify-between gap-2">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: accent + "1f" }}>
            <BookOpen className="w-5 h-5" style={{ color: accent }} />
          </div>
          {installed ? (
            <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full" style={{ backgroundColor: "#d1fae5", color: "#065f46" }}>
              <Check className="w-3 h-3" /> Installed
            </span>
          ) : (
            <span className="text-[10px] font-semibold px-2 py-1 rounded-full" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>{t.styleBadge}</span>
          )}
        </div>
        <p className="text-sm font-semibold mt-2.5 leading-snug" style={{ color: "var(--text-primary)" }}>{t.name}</p>
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          <Badge color={accent}>{INDUSTRY_LABELS[t.industry]}</Badge>
          <Badge>{PROPOSAL_TYPE_LABELS[t.proposalType]}</Badge>
          <Badge>{COMPLEXITY_LABELS[t.complexity]}</Badge>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-3 flex-1">
        <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>{t.bestFor}</p>
        <div className="flex items-center gap-4 mt-3">
          <span className="flex items-center gap-1 text-[11px]" style={{ color: "var(--text-muted)" }}><Layers className="w-3.5 h-3.5" /> {t.sections.length} sections</span>
          <span className="flex items-center gap-1 text-[11px]" style={{ color: "var(--text-muted)" }}><Package className="w-3.5 h-3.5" /> {t.options.length} option{t.options.length === 1 ? "" : "s"}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="px-4 py-3 flex items-center gap-2" style={{ borderTop: "1px solid var(--border)" }}>
        <button onClick={onPreview} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium"
          style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
          <Eye className="w-3.5 h-3.5" /> Preview
        </button>
        <button onClick={onUse} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-white"
          style={{ backgroundColor: installed ? "var(--text-muted)" : accent }}>
          {installed ? <><Download className="w-3.5 h-3.5" /> Install again</> : <><Download className="w-3.5 h-3.5" /> Use This Template</>}
        </button>
      </div>
    </div>
  );
}

function Badge({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
      style={{ backgroundColor: color ? color + "1a" : "var(--bg-input)", color: color ?? "var(--text-muted)" }}>{children}</span>
  );
}

// ─── Preview drawer ───────────────────────────────────────
function PreviewDrawer({ t, installed, onClose, onUse }: { t: SalesbookTemplate; installed: boolean; onClose: () => void; onUse: () => void }) {
  const accent = INDUSTRY_ACCENT[t.industry];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.5)" }} onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl overflow-hidden" onClick={e => e.stopPropagation()}
        style={{ backgroundColor: "var(--bg-surface)", boxShadow: "0 24px 70px rgba(0,0,0,0.4)" }}>
        {/* Cover / header style */}
        <div className="px-6 py-6 relative shrink-0" style={{ background: `linear-gradient(135deg, ${accent}, ${accent}cc)` }}>
          <button onClick={onClose} className="absolute top-4 right-4 text-white/80 hover:text-white"><X className="w-5 h-5" /></button>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-white/80">{INDUSTRY_LABELS[t.industry]} Template</p>
          <p className="text-xl font-bold text-white mt-1">{t.name}</p>
          <p className="text-sm text-white/85 mt-1.5">{t.bestFor}</p>
          <div className="flex items-center gap-2 mt-3">
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/20 text-white">{PROPOSAL_TYPE_LABELS[t.proposalType]}</span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/20 text-white">{COMPLEXITY_LABELS[t.complexity]}</span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/20 text-white">{t.styleBadge}</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto thin-scroll-y p-6 space-y-6">
          {/* Section list */}
          <PreviewBlock icon={Layers} title={`Proposal sections (${t.sections.length})`}>
            <div className="grid grid-cols-2 gap-1.5">
              {t.sections.map((k, i) => (
                <div key={k} className="flex items-center gap-2 text-sm px-2.5 py-1.5 rounded-lg" style={{ backgroundColor: "var(--bg-surface-2)" }}>
                  <span className="text-[10px] font-mono w-4 text-center shrink-0" style={{ color: "var(--text-muted)" }}>{i + 1}</span>
                  <span className="truncate" style={{ color: "var(--text-secondary)" }}>{SECTION_LABELS[k as SectionKey] ?? k}</span>
                </div>
              ))}
            </div>
          </PreviewBlock>

          {/* Sample option cards */}
          {t.options.length > 0 && (
            <PreviewBlock icon={Package} title={`Sample option cards (${t.options.length})`}>
              <div className="space-y-2.5">
                {t.options.map(o => <OptionCard key={o.id} o={o} accent={accent} />)}
              </div>
            </PreviewBlock>
          )}

          {/* Financing */}
          {t.financingNote && (
            <PreviewBlock icon={CreditCard} title="Financing">
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{t.financingNote}</p>
            </PreviewBlock>
          )}
          {/* Warranty / terms */}
          {(t.warranty || t.terms) && (
            <PreviewBlock icon={ShieldCheck} title="Warranty & terms">
              {t.warranty && <p className="text-sm mb-1.5" style={{ color: "var(--text-secondary)" }}>{t.warranty}</p>}
              {t.terms && <p className="text-xs" style={{ color: "var(--text-muted)" }}>{t.terms}</p>}
            </PreviewBlock>
          )}

          <div className="rounded-xl p-3 flex items-start gap-2" style={{ backgroundColor: "var(--bg-surface-2)", border: "1px dashed var(--border)" }}>
            <Sparkles className="w-4 h-4 shrink-0 mt-0.5" style={{ color: accent }} />
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              When you install this, everything above is copied into your company workspace. You can rename it, edit option pricing, swap images, and adjust terms — the master template stays untouched.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 px-6 py-4 flex items-center justify-between" style={{ backgroundColor: "var(--bg-surface)", borderTop: "1px solid var(--border)" }}>
          <button onClick={onClose} className="text-sm px-3 py-2 rounded-lg" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Close</button>
          <button onClick={onUse} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: accent }}>
            <Download className="w-4 h-4" /> {installed ? "Install again" : "Use This Template"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PreviewBlock({ icon: Icon, title, children }: { icon: typeof Layers; title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>
        <Icon className="w-3.5 h-3.5" /> {title}
      </p>
      {children}
    </div>
  );
}

function OptionCard({ o, accent }: { o: SalesbookOption; accent: string }) {
  const tierLabel = o.tier ? o.tier[0].toUpperCase() + o.tier.slice(1) : null;
  return (
    <div className="rounded-xl p-3.5" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
      {o.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={o.image} alt={o.name} className="w-full rounded-lg mb-3" style={{ height: "120px", objectFit: "cover" }} />
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {tierLabel && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase" style={{ backgroundColor: accent + "1a", color: accent }}>{tierLabel}</span>}
            <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{o.name}</p>
          </div>
          {(o.brand || o.model) && <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>{[o.brand, o.model].filter(Boolean).join(" · ")}</p>}
          {o.description && <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>{o.description}</p>}
        </div>
        <div className="text-right shrink-0">
          <p className="text-base font-bold" style={{ color: "var(--text-primary)" }}>${o.price.toLocaleString()}</p>
          {o.monthlyPrice ? <p className="text-[11px]" style={{ color: accent }}>${o.monthlyPrice}/mo</p> : null}
        </div>
      </div>
      <div className="flex items-center gap-2 mt-2 flex-wrap">
        {o.efficiency && <Badge>{o.efficiency}</Badge>}
        {o.warranty && <Badge>{o.warranty}</Badge>}
      </div>
      {o.includes && o.includes.length > 0 && (
        <ul className="mt-2 space-y-1">
          {o.includes.map((inc, i) => (
            <li key={i} className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--text-secondary)" }}>
              <Check className="w-3 h-3 shrink-0" style={{ color: accent }} /> {inc}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Install modal ────────────────────────────────────────
function InstallModal({ t, companies, locations, defaultCompanyId, onClose, onInstalled }: {
  t: SalesbookTemplate;
  companies: { id: string; name: string }[];
  locations: { id: string; name: string; companyId: string }[];
  defaultCompanyId: string;
  onClose: () => void;
  onInstalled: () => void;
}) {
  const accent = INDUSTRY_ACCENT[t.industry];
  const [companyId, setCompanyId] = useState(defaultCompanyId);
  const [locationId, setLocationId] = useState("");
  const [name, setName] = useState(t.name);
  const [includeOptions, setIncludeOptions] = useState(true);
  const [includeImages, setIncludeImages] = useState(true);
  const [includeTerms, setIncludeTerms] = useState(true);

  const companyLocations = locations.filter(l => l.companyId === companyId);

  function doInstall() {
    if (!companyId) return;
    installSalesbook(t.id, {
      companyId, locationId: locationId || undefined,
      name, includeOptions, includeImages, includeTerms,
    });
    onInstalled();
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden" onClick={e => e.stopPropagation()}
        style={{ backgroundColor: "var(--bg-surface)", boxShadow: "0 16px 48px rgba(0,0,0,0.28)" }}>
        <div className="px-6 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <p className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Use This Template</p>
          <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>Copy “{t.name}” into your company workspace.</p>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Company *</label>
              <UiSelect value={companyId} onChange={v => { setCompanyId(v); setLocationId(""); }}
                options={companies.map(c => ({ value: c.id, label: c.name }))} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Location <span style={{ color: "var(--text-muted)" }}>(opt.)</span></label>
              <UiSelect value={locationId} onChange={setLocationId} placeholder="All locations"
                options={[{ value: "", label: "All locations" }, ...companyLocations.map(l => ({ value: l.id, label: l.name }))]} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Template name</label>
            <input value={name} onChange={e => setName(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
          </div>
          <div className="space-y-2">
            <CheckRow label="Include sample items / options" checked={includeOptions} onChange={setIncludeOptions} />
            <CheckRow label="Include sample images" checked={includeImages} onChange={setIncludeImages} />
            <CheckRow label="Include default terms" checked={includeTerms} onChange={setIncludeTerms} />
          </div>
        </div>
        <div className="px-6 py-4 flex justify-end gap-2" style={{ borderTop: "1px solid var(--border)" }}>
          <button onClick={onClose} className="px-3 py-2 rounded-lg text-sm" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
          <button onClick={doInstall} disabled={!companyId} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40" style={{ backgroundColor: accent }}>
            <Download className="w-4 h-4" /> Create Proposal Template
          </button>
        </div>
      </div>
    </div>
  );
}

function CheckRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg cursor-pointer" style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border)" }}>
      <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{label}</span>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="accent-[#0f8578] w-4 h-4" />
    </label>
  );
}

// ─── Installed list ───────────────────────────────────────
function InstalledList({ installed, onRefresh, onEdit }: { installed: ReturnType<typeof getCompanySalesbooks>; onRefresh: () => void; onEdit: (id: string) => void }) {
  if (installed.length === 0) {
    return (
      <div className="rounded-xl py-16 text-center" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
        <BookOpen className="w-8 h-8 mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
        <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>No proposal templates yet</p>
        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Browse Starter Templates and choose “Use This Template” to copy one in.</p>
      </div>
    );
  }
  return (
    <div className="space-y-2.5">
      {installed.map(sb => {
        const accent = INDUSTRY_ACCENT[sb.industry];
        return (
          <div key={sb.id} className="rounded-xl p-4 flex items-center gap-3" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: accent + "1a" }}>
              <BookOpen className="w-4 h-4" style={{ color: accent }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{sb.name}</p>
              <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>
                {INDUSTRY_LABELS[sb.industry]} · {PROPOSAL_TYPE_LABELS[sb.proposalType]} · {sb.sections.length} sections · {sb.options.length} options · installed {sb.installedAt}
              </p>
            </div>
            <span className="hidden sm:flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full shrink-0" style={{ backgroundColor: "#d1fae5", color: "#065f46" }}>
              <Check className="w-3 h-3" /> Company-owned
            </span>
            <button onClick={() => onEdit(sb.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium shrink-0" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
              <Pencil className="w-3.5 h-3.5" /> Edit
            </button>
            <button onClick={() => { uninstallSalesbook(sb.id); onRefresh(); }} title="Remove" className="p-2 rounded-lg shrink-0" style={{ color: "var(--text-muted)" }}>
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        );
      })}
      <div className="flex items-center gap-1.5 text-[11px] px-1 pt-1" style={{ color: "var(--text-muted)" }}>
        <FileText className="w-3.5 h-3.5" /> Edit a proposal template to tune its sections, option pricing, and terms. Spreadsheet import is coming next.
      </div>
    </div>
  );
}
