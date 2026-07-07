"use client";

// Offer Library — reusable sales offers (Offer Groups) built from catalog items,
// equipment details, images, and pricing. Each group holds option/tier cards.
// Salesbooks add offer groups; quotes copy the offer data so they stay stable.
//
// Exports:
//   • OfferLibrarySection — Settings page (summary + group cards + editor + preview)
//   • OfferGroupPicker     — reusable "Add from Offer Library" (used by the Salesbook editor)
//   • OfferGroupPreview    — customer-facing preview of an offer group's options

import { useEffect, useMemo, useRef, useState } from "react";
import { pingSaved } from "@/components/shared/SavedPill";
import {
  Package, Plus, Upload, Eye, Pencil, Copy, Archive, X, ArrowLeft, Check, Star,
  Trash2, ChevronUp, ChevronDown, Image as ImageIcon, Search, Layers, CreditCard, Settings2, Wrench, ListChecks,
  MoreHorizontal, MoreVertical, LayoutGrid, List, AlertTriangle, FileText, History, FolderOpen,
} from "lucide-react";
import UiSelect from "@/components/ui/Select";
import StatusTabs from "@/components/shared/StatusTabs";
import { MediaPickerModal } from "@/components/settings/MediaLibrarySection";
import { getAllItems } from "@/lib/items/data";
import { getCompanySalesbooks } from "@/lib/salesbooks/data";
import {
  getOfferGroups, getAllOfferGroups, getOfferGroup, createOfferGroup, updateOfferGroup, duplicateOfferGroup, archiveOfferGroup,
  blankOption, offerPriceRange,
  OFFER_TIER_LABELS, OFFER_TIERS, OFFER_LAYOUT_LABELS, OFFER_LAYOUTS, PRICE_DISPLAY_LABELS, PRICE_DISPLAYS,
  INDUSTRY_LABELS,
  type OfferGroup, type OfferOption, type OfferStatus, type OfferTier, type OfferDisplayLayout,
  type PriceDisplay, type OfferImage, type OfferIncludedItem, type OfferEquipment, type SalesbookIndustry, type OfferFieldToggles,
} from "@/lib/offers/data";

const fmtMoney = (n: number) => `$${n.toLocaleString()}`;
const STATUS_STYLE: Record<OfferStatus, { bg: string; color: string; label: string }> = {
  draft: { bg: "#fef3c7", color: "#92400e", label: "Draft" },
  active: { bg: "#d1fae5", color: "#065f46", label: "Active" },
  archived: { bg: "var(--bg-input)", color: "var(--text-muted)", label: "Archived" },
};

// ─── Page ─────────────────────────────────────────────────
// Offer Library workspace (lives under Proposal Library). Owns its own header so
// the parent module page suppresses the generic one — no duplicated heading.
type OfferView = "cards" | "table";

// A group "needs attention" when any option is missing a price or an image.
function attentionFor(g: OfferGroup) {
  const missingPrices = g.options.filter(o => !(o.price > 0)).length;
  const missingImages = g.options.filter(o => o.images.length === 0).length;
  return { missingPrices, missingImages, needs: missingPrices > 0 || missingImages > 0 };
}
const fmtPriceRange = (g: OfferGroup): string => {
  const r = offerPriceRange(g);
  return r ? (r.min === r.max ? fmtMoney(r.min) : `${fmtMoney(r.min)}–${fmtMoney(r.max)}`) : "—";
};

export default function OfferLibrarySection() {
  const [tick, setTick] = useState(0);
  const refresh = () => setTick(t => t + 1);
  const [editId, setEditId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);

  // Filters + view
  const [view, setView] = useState<OfferView>("cards");
  const [q, setQ] = useState("");
  const [fIndustry, setFIndustry] = useState("all");
  const [fCategory, setFCategory] = useState("all");
  const [fStatus, setFStatus] = useState("all");
  const [fUsed, setFUsed] = useState("all");          // all | used | unused
  const [fNeeds, setFNeeds] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const allGroups = useMemo(() => getAllOfferGroups(), [tick]);
  const groups = useMemo(() => showArchived ? allGroups : allGroups.filter(g => g.status !== "archived"), [allGroups, showArchived]);
  const salesbooks = useMemo(() => getCompanySalesbooks(), [tick]);
  const usageCount = (gid: string) => salesbooks.filter(sb => (sb.offerGroupIds ?? []).includes(gid)).length;

  const categories = useMemo(() => [...new Set(groups.map(g => g.category).filter(Boolean))].sort(), [groups]);

  if (editId) {
    return <OfferGroupEditor groupId={editId} onBack={() => { setEditId(null); refresh(); }} />;
  }

  // Summary (over the visible, non-filtered set)
  const totalOptions = groups.reduce((n, g) => n + g.options.length, 0);
  const missingPrices = groups.reduce((n, g) => n + g.options.filter(o => !(o.price > 0)).length, 0);
  const missingImages = groups.reduce((n, g) => n + g.options.filter(o => o.images.length === 0).length, 0);
  const activeGroups = groups.filter(g => g.status === "active").length;
  const usedInProposals = groups.reduce((n, g) => n + usageCount(g.id), 0);

  const ql = q.trim().toLowerCase();
  const filtered = groups.filter(g => {
    if (ql && !`${g.name} ${g.category} ${g.systemType ?? ""} ${g.tags.join(" ")} ${INDUSTRY_LABELS[g.industry]}`.toLowerCase().includes(ql)) return false;
    if (fIndustry !== "all" && g.industry !== fIndustry) return false;
    if (fCategory !== "all" && g.category !== fCategory) return false;
    if (fStatus !== "all" && g.status !== fStatus) return false;
    const used = usageCount(g.id) > 0;
    if (fUsed === "used" && !used) return false;
    if (fUsed === "unused" && used) return false;
    if (fNeeds && !attentionFor(g).needs) return false;
    return true;
  });

  const previewGroup = groups.find(g => g.id === previewId) ?? null;
  const activeFilters = [fIndustry !== "all", fCategory !== "all", fStatus !== "all", fUsed !== "all", fNeeds].filter(Boolean).length;
  function clearFilters() { setFIndustry("all"); setFCategory("all"); setFStatus("all"); setFUsed("all"); setFNeeds(false); }

  function create() { const g = createOfferGroup(); refresh(); setEditId(g.id); }

  return (
    <div className="space-y-5">
      {/* Workspace header — title · subtitle · actions */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <Package className="w-5 h-5" style={{ color: "var(--accent-text)" }} /> Offer Library
          </h2>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>Reusable offer groups, packages, equipment options, pricing, and monthly payments.</p>
        </div>
        <div className="flex items-center gap-2">
          <button disabled className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium opacity-50" style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}><Upload className="w-4 h-4" /> Import Offers</button>
          <button onClick={create} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: "var(--accent-text)" }}><Plus className="w-4 h-4" /> Create Offer Group</button>
          <MoreMenu align="right" items={[
            { label: showArchived ? "Hide archived" : "Show archived", icon: Archive, onClick: () => setShowArchived(s => !s) },
            { label: "Import from spreadsheet", icon: Upload, onClick: () => {}, disabled: true },
          ]}>
            <button className="p-2 rounded-lg" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}><MoreHorizontal className="w-4 h-4" /></button>
          </MoreMenu>
        </div>
      </div>

      {/* Summary — 4 cards */}
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
        <SummaryCard label="Active Offer Groups" value={activeGroups} icon={Package} />
        <SummaryCard label="Options / Packages" value={totalOptions} icon={Layers} />
        <SummaryCard label="Needs Attention" value={missingImages + missingPrices} icon={AlertTriangle}
          warn sub={`${missingImages} missing images · ${missingPrices} missing prices`} />
        <SummaryCard label="Used in Proposals" value={usedInProposals} icon={FileText} />
      </div>

      {/* Filter row */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2 rounded-lg px-3 py-1.5" style={{ backgroundColor: "var(--bg-input)" }}>
          <Search className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search offer groups..." className="bg-transparent text-sm outline-none w-44" style={{ color: "var(--text-primary)" }} />
        </div>
        <div className="w-36"><UiSelect size="sm" value={fIndustry} onChange={setFIndustry} options={[{ value: "all", label: "Any industry" }, ...(Object.keys(INDUSTRY_LABELS) as SalesbookIndustry[]).map(k => ({ value: k, label: INDUSTRY_LABELS[k] }))]} /></div>
        <div className="w-40"><UiSelect size="sm" value={fCategory} onChange={setFCategory} options={[{ value: "all", label: "Any category" }, ...categories.map(c => ({ value: c, label: c }))]} /></div>
        <div className="w-32"><UiSelect size="sm" value={fStatus} onChange={setFStatus} options={[{ value: "all", label: "Any status" }, { value: "active", label: "Active" }, { value: "draft", label: "Draft" }, ...(showArchived ? [{ value: "archived", label: "Archived" }] : [])]} /></div>
        <div className="w-32"><UiSelect size="sm" value={fUsed} onChange={setFUsed} options={[{ value: "all", label: "Used / Unused" }, { value: "used", label: "Used in proposals" }, { value: "unused", label: "Not used" }]} /></div>
        <button onClick={() => setFNeeds(v => !v)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors"
          style={{ border: `1px solid ${fNeeds ? "#fcd34d" : "var(--border)"}`, backgroundColor: fNeeds ? "#fef3c7" : "var(--bg-surface)", color: fNeeds ? "#92400e" : "var(--text-secondary)" }}>
          <AlertTriangle className="w-3.5 h-3.5" /> Needs attention
        </button>
        {activeFilters > 0 && <button onClick={clearFilters} className="text-xs px-2 py-1.5" style={{ color: "var(--accent-text)" }}>Clear</button>}
        <div className="ml-auto flex items-center rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          {([["cards", LayoutGrid], ["table", List]] as const).map(([k, Icon]) => {
            const on = view === k;
            return (
              <button key={k} onClick={() => setView(k)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm capitalize transition-colors"
                style={{ backgroundColor: on ? "#0f8578" : "var(--bg-surface)", color: on ? "#fff" : "var(--text-secondary)" }}>
                <Icon className="w-3.5 h-3.5" /> {k}
              </button>
            );
          })}
        </div>
      </div>

      {groups.length === 0 ? (
        <EmptyState />
      ) : filtered.length === 0 ? (
        <div className="rounded-xl py-14 text-center" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>No offer groups match the current filters.</p>
        </div>
      ) : view === "cards" ? (
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
          {filtered.map(g => (
            <GroupCard key={g.id} g={g} usedIn={usageCount(g.id)}
              onOpen={() => setEditId(g.id)} onPreview={() => setPreviewId(g.id)}
              onDuplicate={() => { duplicateOfferGroup(g.id); refresh(); }}
              onArchive={() => { archiveOfferGroup(g.id); refresh(); }} />
          ))}
        </div>
      ) : (
        <OfferTable groups={filtered} usageCount={usageCount}
          onOpen={id => setEditId(id)} onPreview={id => setPreviewId(id)}
          onDuplicate={id => { duplicateOfferGroup(id); refresh(); }}
          onArchive={id => { archiveOfferGroup(id); refresh(); }} />
      )}

      {previewGroup && <OfferGroupPreviewModal group={previewGroup} onClose={() => setPreviewId(null)} />}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl py-16 text-center" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
      <Package className="w-8 h-8 mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
      <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>No offer groups yet</p>
      <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Create one to build reusable Good / Better / Best offers and packages.</p>
    </div>
  );
}

function SummaryCard({ label, value, icon: Icon, warn, sub }: { label: string; value: number; icon: typeof Package; warn?: boolean; sub?: string }) {
  const danger = warn && value > 0;
  return (
    <div className="rounded-xl p-3.5" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>{label}</p>
        <Icon className="w-4 h-4" style={{ color: danger ? "#b45309" : "var(--text-muted)" }} />
      </div>
      <p className="text-2xl font-bold mt-1" style={{ color: danger ? "#b45309" : "var(--text-primary)" }}>{value}</p>
      {sub && <p className="text-[11px] mt-0.5 truncate" style={{ color: danger ? "#b45309" : "var(--text-muted)" }}>{sub}</p>}
    </div>
  );
}

// Tier preview — the option tiers present, in order (Budget / Good / Better / Best…).
function TierPreview({ g }: { g: OfferGroup }) {
  const tiers = [...g.options].sort((a, b) => a.order - b.order).map(o => o.tier).filter(Boolean) as OfferTier[];
  if (tiers.length === 0) return null;
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {tiers.map((t, i) => (
        <span key={i} className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-secondary)" }}>{OFFER_TIER_LABELS[t]}</span>
      ))}
    </div>
  );
}

function NeedsAttentionPill({ g, compact }: { g: OfferGroup; compact?: boolean }) {
  const a = attentionFor(g);
  if (!a.needs) return compact ? <span className="text-xs" style={{ color: "var(--text-muted)" }}>—</span> : null;
  const parts = [a.missingImages > 0 && `${a.missingImages} img`, a.missingPrices > 0 && `${a.missingPrices} price`].filter(Boolean).join(" · ");
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ backgroundColor: "#fef3c7", color: "#92400e" }} title="Missing images or prices">
      <AlertTriangle className="w-3 h-3" /> {parts}
    </span>
  );
}

function GroupCard({ g, usedIn, onOpen, onPreview, onDuplicate, onArchive }: {
  g: OfferGroup; usedIn: number; onOpen: () => void; onPreview: () => void; onDuplicate: () => void; onArchive: () => void;
}) {
  const st = STATUS_STYLE[g.status];
  return (
    <div className="rounded-2xl overflow-hidden flex flex-col" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
      <div className="px-4 pt-3.5 pb-3 flex-1">
        <div className="flex items-start justify-between gap-2">
          <button onClick={onOpen} className="text-sm font-semibold leading-snug text-left hover:underline" style={{ color: "var(--text-primary)" }}>{g.name}</button>
          <div className="flex items-center gap-1.5 shrink-0">
            <NeedsAttentionPill g={g} />
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: st.bg, color: st.color }}>{st.label}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          <Chip>{INDUSTRY_LABELS[g.industry]}</Chip>
          <Chip subtle>{g.category}</Chip>
          {g.size && <Chip subtle>{g.size}</Chip>}
        </div>
        {g.description && <p className="text-xs mt-2 leading-snug" style={{ color: "var(--text-muted)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{g.description}</p>}
        <div className="mt-2.5"><TierPreview g={g} /></div>
      </div>
      <div className="px-4 py-2.5 grid grid-cols-3 gap-2 text-center" style={{ borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
        <Stat label="Options" value={`${g.options.length}`} />
        <Stat label="Price range" value={fmtPriceRange(g)} />
        <Stat label="Used in" value={`${usedIn}`} />
      </div>
      {/* Cleaner action row — Open (primary) · Preview (secondary) · More */}
      <div className="px-3 py-2.5 flex items-center gap-1.5">
        <button onClick={onOpen} className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium" style={{ border: "1px solid var(--accent-text)", color: "var(--accent-text)" }}><FolderOpen className="w-3.5 h-3.5" /> Open</button>
        <button onClick={onPreview} className="flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}><Eye className="w-3.5 h-3.5" /> Preview</button>
        <MoreMenu align="right" items={[
          { label: "Duplicate", icon: Copy, onClick: onDuplicate },
          { label: "Archive", icon: Archive, onClick: onArchive, danger: true },
        ]}>
          <button title="More" className="p-1.5 rounded-lg" style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}><MoreVertical className="w-3.5 h-3.5" /></button>
        </MoreMenu>
      </div>
    </div>
  );
}

// ─── Table view (better for managing many groups) ─────────
function OfferTable({ groups, usageCount, onOpen, onPreview, onDuplicate, onArchive }: {
  groups: OfferGroup[]; usageCount: (id: string) => number;
  onOpen: (id: string) => void; onPreview: (id: string) => void; onDuplicate: (id: string) => void; onArchive: (id: string) => void;
}) {
  return (
    <div className="rounded-xl overflow-hidden overflow-x-auto thin-scroll-x" style={{ border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
      <table className="w-full text-sm" style={{ backgroundColor: "var(--bg-surface)", minWidth: 980 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border)" }}>
            {["Offer Group", "Industry", "Category", "Options", "Price Range", "Used In", "Status", "Needs Attention", "Last Updated", ""].map((h, i) => (
              <th key={i} className="text-left font-semibold px-3 py-2.5 text-[11px] uppercase tracking-wide whitespace-nowrap" style={{ color: "var(--text-muted)" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map(g => {
            const st = STATUS_STYLE[g.status];
            return (
              <tr key={g.id} className="transition-[background-color] hover:bg-[var(--bg-surface-2)]" style={{ borderBottom: "1px solid var(--border)" }}>
                <td className="px-3 py-2.5">
                  <button onClick={() => onOpen(g.id)} className="font-medium text-left hover:underline" style={{ color: "var(--text-primary)" }}>{g.name}</button>
                  {g.size && <span className="ml-1.5 text-[11px]" style={{ color: "var(--text-muted)" }}>· {g.size}</span>}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>{INDUSTRY_LABELS[g.industry]}</td>
                <td className="px-3 py-2.5 whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>{g.category}</td>
                <td className="px-3 py-2.5" style={{ color: "var(--text-secondary)" }}>{g.options.length}</td>
                <td className="px-3 py-2.5 whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>{fmtPriceRange(g)}</td>
                <td className="px-3 py-2.5" style={{ color: "var(--text-secondary)" }}>{usageCount(g.id)}</td>
                <td className="px-3 py-2.5"><span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: st.bg, color: st.color }}>{st.label}</span></td>
                <td className="px-3 py-2.5"><NeedsAttentionPill g={g} compact /></td>
                <td className="px-3 py-2.5 whitespace-nowrap" style={{ color: "var(--text-muted)" }}>{g.updatedAt}</td>
                <td className="px-3 py-2.5 text-right whitespace-nowrap">
                  <div className="inline-flex items-center gap-1">
                    <button onClick={() => onOpen(g.id)} className="px-2 py-1 rounded-lg text-xs" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Open</button>
                    <button onClick={() => onPreview(g.id)} title="Preview" className="p-1.5 rounded-lg" style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}><Eye className="w-3.5 h-3.5" /></button>
                    <MoreMenu align="right" items={[
                      { label: "Duplicate", icon: Copy, onClick: () => onDuplicate(g.id) },
                      { label: "Archive", icon: Archive, onClick: () => onArchive(g.id), danger: true },
                    ]}>
                      <button title="More" className="p-1.5 rounded-lg" style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}><MoreVertical className="w-3.5 h-3.5" /></button>
                    </MoreMenu>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div><p className="text-sm font-bold truncate" style={{ color: "var(--text-primary)" }}>{value}</p><p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{label}</p></div>;
}
function Chip({ children, subtle }: { children: React.ReactNode; subtle?: boolean }) {
  return <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={subtle ? { backgroundColor: "var(--bg-input)", color: "var(--text-muted)" } : { backgroundColor: "var(--accent-soft-bg)", color: "var(--accent-text)" }}>{children}</span>;
}

// ─── Lightweight dropdown menu ────────────────────────────
interface MenuItemDef { label: string; icon: typeof Copy; onClick: () => void; danger?: boolean; disabled?: boolean }
function MoreMenu({ items, children, align = "right" }: { items: MenuItemDef[]; children: React.ReactNode; align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <div onClick={() => setOpen(o => !o)}>{children}</div>
      {open && (
        <div className={`absolute ${align === "right" ? "right-0" : "left-0"} top-full mt-1 z-50 w-44 rounded-xl overflow-hidden py-1`}
          style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 12px 32px rgba(0,0,0,0.18)" }}>
          {items.map((it, i) => (
            <button key={i} disabled={it.disabled} onClick={() => { if (it.disabled) return; setOpen(false); it.onClick(); }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm transition-colors hover:bg-[var(--bg-surface-2)] disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ color: it.danger ? "#dc2626" : "var(--text-primary)" }}>
              <it.icon className="w-3.5 h-3.5" /> {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Group editor ─────────────────────────────────────────
type EditorTab = "overview" | "options" | "included" | "equipment" | "images" | "pricing" | "display" | "usage" | "activity";
const EDITOR_TABS: { key: EditorTab; label: string; icon: typeof Package }[] = [
  { key: "overview", label: "Overview", icon: Settings2 },
  { key: "options", label: "Options / Tiers", icon: Layers },
  { key: "included", label: "Included Items", icon: ListChecks },
  { key: "equipment", label: "Equipment Details", icon: Wrench },
  { key: "images", label: "Images", icon: ImageIcon },
  { key: "pricing", label: "Pricing & Financing", icon: CreditCard },
  { key: "display", label: "Display Settings", icon: Eye },
  { key: "usage", label: "Usage", icon: Package },
  { key: "activity", label: "Activity", icon: History },
];

function OfferGroupEditor({ groupId, onBack }: { groupId: string; onBack: () => void }) {
  const original = useMemo(() => getOfferGroup(groupId), [groupId]);
  const [g, setG] = useState<OfferGroup | null>(original ?? null);
  const [tab, setTab] = useState<EditorTab>("overview");
  const [activeOptId, setActiveOptId] = useState<string>(original?.options[0]?.id ?? "");
  const [previewOpen, setPreviewOpen] = useState(false);
  const lastSnap = useRef<string | null>(null);

  // Auto-save on real changes only. Snapshot-guarded so the initial mount (and
  // StrictMode's dev double-invoke) never fires a spurious "Saved".
  useEffect(() => {
    if (!g) return;
    const snap = JSON.stringify(g);
    if (lastSnap.current === null) { lastSnap.current = snap; return; }
    if (lastSnap.current === snap) return;
    lastSnap.current = snap;
    const t = setTimeout(() => { updateOfferGroup(g.id, g); pingSaved(); }, 500);
    return () => clearTimeout(t);
  }, [g]);

  if (!g) return <div className="space-y-4"><button onClick={onBack} className="flex items-center gap-1.5 text-sm" style={{ color: "var(--text-secondary)" }}><ArrowLeft className="w-4 h-4" /> Offer Library</button><p className="text-sm" style={{ color: "var(--text-muted)" }}>Offer group not found.</p></div>;

  const patch = (p: Partial<OfferGroup>) => setG(s => s ? { ...s, ...p } : s);
  const setOptions = (options: OfferOption[]) => patch({ options });
  const updateOption = (id: string, p: Partial<OfferOption>) => setOptions(g.options.map(o => o.id === id ? { ...o, ...p } : o));

  const activeOpt = g.options.find(o => o.id === activeOptId) ?? g.options[0] ?? null;
  const optionSelector = (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Editing option:</span>
      <div className="w-60"><UiSelect size="sm" value={activeOpt?.id ?? ""} onChange={setActiveOptId} placeholder="Select an option" options={g.options.map(o => ({ value: o.id, label: o.title || "Untitled" }))} /></div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <button onClick={onBack} className="flex items-center gap-1.5 text-sm mb-2" style={{ color: "var(--text-secondary)" }}><ArrowLeft className="w-4 h-4" /> Offer Library</button>
          <h3 className="text-base font-semibold flex items-center gap-2" style={{ color: "var(--text-primary)" }}><Package className="w-4.5 h-4.5" style={{ color: "var(--accent-text)" }} /> {g.name || "Untitled offer group"}</h3>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setPreviewOpen(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}><Eye className="w-4 h-4" /> Preview</button>
        </div>
      </div>

      <div className="pb-2" style={{ borderBottom: "1px solid var(--border)" }}>
        <StatusTabs active={tab} onChange={k => setTab(k as EditorTab)}
          tabs={EDITOR_TABS.map(t => ({ key: t.key, label: t.label, icon: t.icon }))} />
      </div>

      <div className="rounded-xl p-5" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
        {tab === "overview" && <OverviewTab g={g} patch={patch} />}
        {tab === "options" && <OptionsTab g={g} setOptions={setOptions} onEditDetails={(id) => { setActiveOptId(id); setTab("included"); }} />}
        {tab === "included" && (g.options.length === 0 ? <Empty msg="Add options first." /> : <>{optionSelector}{activeOpt && <IncludedItemsEditor opt={activeOpt} onChange={p => updateOption(activeOpt.id, p)} />}</>)}
        {tab === "equipment" && (g.options.length === 0 ? <Empty msg="Add options first." /> : <>{optionSelector}{activeOpt && <EquipmentEditor opt={activeOpt} onChange={p => updateOption(activeOpt.id, p)} />}</>)}
        {tab === "images" && (g.options.length === 0 ? <Empty msg="Add options first." /> : <>{optionSelector}{activeOpt && <ImagesEditor opt={activeOpt} onChange={p => updateOption(activeOpt.id, p)} />}</>)}
        {tab === "pricing" && <PricingTab g={g} patch={patch} updateOption={updateOption} />}
        {tab === "display" && <DisplayTab g={g} patch={patch} />}
        {tab === "usage" && <UsageTab g={g} />}
        {tab === "activity" && <ActivityTab g={g} />}
      </div>

      {previewOpen && <OfferGroupPreviewModal group={g} onClose={() => setPreviewOpen(false)} />}
    </div>
  );
}

function Empty({ msg }: { msg: string }) { return <p className="text-sm" style={{ color: "var(--text-muted)" }}>{msg}</p>; }

// Overview
function OverviewTab({ g, patch }: { g: OfferGroup; patch: (p: Partial<OfferGroup>) => void }) {
  return (
    <div className="space-y-4 max-w-2xl">
      <Field label="Offer group name *"><input value={g.name} onChange={e => patch({ name: e.target.value })} className={inp} style={inpStyle} placeholder="e.g. 3 Ton Split System Options" /></Field>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Industry"><UiSelect value={g.industry} onChange={v => patch({ industry: v as SalesbookIndustry })} options={(Object.keys(INDUSTRY_LABELS) as SalesbookIndustry[]).map(k => ({ value: k, label: INDUSTRY_LABELS[k] }))} /></Field>
        <Field label="Category"><input value={g.category} onChange={e => patch({ category: e.target.value })} className={inp} style={inpStyle} placeholder="e.g. System Replacement" /></Field>
        <Field label="System / service type"><input value={g.systemType ?? ""} onChange={e => patch({ systemType: e.target.value || undefined })} className={inp} style={inpStyle} placeholder="e.g. Split System" /></Field>
        <Field label="Size / capacity (optional)"><input value={g.size ?? ""} onChange={e => patch({ size: e.target.value || undefined })} className={inp} style={inpStyle} placeholder="e.g. 3 Ton" /></Field>
      </div>
      <Field label="Description"><textarea value={g.description ?? ""} onChange={e => patch({ description: e.target.value || undefined })} rows={2} className={inp + " resize-none"} style={inpStyle} /></Field>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Status"><UiSelect value={g.status} onChange={v => patch({ status: v as OfferStatus })} options={(["draft", "active", "archived"] as OfferStatus[]).map(s => ({ value: s, label: STATUS_STYLE[s].label }))} /></Field>
        <Field label="Tags (comma separated)"><input value={g.tags.join(", ")} onChange={e => patch({ tags: e.target.value.split(",").map(t => t.trim()).filter(Boolean) })} className={inp} style={inpStyle} /></Field>
      </div>
    </div>
  );
}

// Options / Tiers
function OptionsTab({ g, setOptions, onEditDetails }: { g: OfferGroup; setOptions: (o: OfferOption[]) => void; onEditDetails: (id: string) => void }) {
  const opts = [...g.options].sort((a, b) => a.order - b.order);
  const add = () => setOptions([...g.options, blankOption(g.options.length)]);
  const update = (id: string, p: Partial<OfferOption>) => setOptions(g.options.map(o => o.id === id ? { ...o, ...p } : o));
  const remove = (id: string) => setOptions(g.options.filter(o => o.id !== id));
  const feature = (id: string) => setOptions(g.options.map(o => ({ ...o, recommended: o.id === id ? !o.recommended : false })));
  const move = (id: string, dir: -1 | 1) => {
    const arr = [...opts]; const i = arr.findIndex(o => o.id === id); const j = i + dir; if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]]; setOptions(arr.map((o, idx) => ({ ...o, order: idx })));
  };
  const numOr = (s: string) => s === "" ? 0 : parseFloat(s) || 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>Each tier is a card the customer compares. Mark one recommended.</p>
        <button onClick={add} className="flex items-center gap-1 text-xs font-medium" style={{ color: "var(--accent-text)" }}><Plus className="w-3.5 h-3.5" /> Add option</button>
      </div>
      {opts.length === 0 ? <Empty msg="No options yet — add one." /> : (
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
          {opts.map((o, i) => {
            const primary = o.primaryImageId ? o.images.find(im => im.id === o.primaryImageId) : o.images[0];
            const missing = [!(o.price > 0) && "price", o.images.length === 0 && "image", !o.title.trim() && "title"].filter(Boolean) as string[];
            return (
            <div key={o.id} className="rounded-xl p-3 space-y-2" style={{ backgroundColor: "var(--bg-surface-2)", border: o.recommended ? "1.5px solid var(--accent-text)" : "1px solid var(--border)" }}>
              <div className="flex items-center gap-1.5">
                {/* Primary image thumbnail */}
                {primary ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={primary.url} alt="" className="w-8 h-8 rounded-md object-cover shrink-0" style={{ border: "1px solid var(--border)" }} />
                ) : (
                  <span className="w-8 h-8 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--bg-input)" }}><ImageIcon className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} /></span>
                )}
                <div className="flex-1 min-w-0"><UiSelect size="sm" value={o.tier ?? ""} onChange={v => update(o.id, { tier: (v || undefined) as OfferTier })} placeholder="No tier" options={[{ value: "", label: "No tier" }, ...OFFER_TIERS.map(t => ({ value: t, label: OFFER_TIER_LABELS[t] }))]} /></div>
                <button onClick={() => feature(o.id)} title="Recommended" className="p-1" style={{ color: o.recommended ? "var(--accent-text)" : "var(--text-muted)" }}><Star className="w-3.5 h-3.5" fill={o.recommended ? "currentColor" : "none"} /></button>
                <div className="flex items-center gap-0.5">
                  <button onClick={() => move(o.id, -1)} disabled={i === 0} className="disabled:opacity-20 p-0.5" style={{ color: "var(--text-muted)" }}><ChevronUp className="w-3.5 h-3.5" /></button>
                  <button onClick={() => move(o.id, 1)} disabled={i === opts.length - 1} className="disabled:opacity-20 p-0.5" style={{ color: "var(--text-muted)" }}><ChevronDown className="w-3.5 h-3.5" /></button>
                  <button onClick={() => remove(o.id)} className="p-0.5" style={{ color: "var(--text-muted)" }}><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              <input value={o.title} onChange={e => update(o.id, { title: e.target.value })} placeholder="Option title" className={inpSm} style={inpStyle} />
              <input value={o.brand ?? ""} onChange={e => update(o.id, { brand: e.target.value || undefined })} placeholder="Brand" className={inpSm} style={inpStyle} />
              <input value={o.description ?? ""} onChange={e => update(o.id, { description: e.target.value || undefined })} placeholder="Short description" className={inpSm} style={inpStyle} />
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1"><span className="text-[10px]" style={{ color: "var(--text-muted)" }}>$</span><input type="number" min={0} value={o.price} onChange={e => update(o.id, { price: numOr(e.target.value) })} className="w-24 rounded-lg px-2 py-1 text-xs outline-none" style={inpStyle} /></div>
                <div className="flex items-center gap-1"><span className="text-[10px]" style={{ color: "var(--text-muted)" }}>$/mo</span><input type="number" min={0} value={o.monthlyPrice ?? ""} onChange={e => update(o.id, { monthlyPrice: e.target.value === "" ? undefined : numOr(e.target.value) })} className="w-20 rounded-lg px-2 py-1 text-xs outline-none" style={inpStyle} /></div>
              </div>
              <div className="flex items-center justify-between gap-2 pt-1">
                <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{o.includedItems.length} items · {o.images.length} images</span>
                <button onClick={() => onEditDetails(o.id)} className="text-[11px] font-medium shrink-0" style={{ color: "var(--accent-text)" }}>Edit details →</button>
              </div>
              {missing.length > 0 && (
                <div className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded" style={{ backgroundColor: "#fef3c7", color: "#92400e" }}>
                  <AlertTriangle className="w-3 h-3 shrink-0" /> Missing: {missing.join(", ")}
                </div>
              )}
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Included Items (per option, with catalog pull)
function IncludedItemsEditor({ opt, onChange }: { opt: OfferOption; onChange: (p: Partial<OfferOption>) => void }) {
  const [pickCatalog, setPickCatalog] = useState(false);
  const items = opt.includedItems;
  const set = (next: OfferIncludedItem[]) => onChange({ includedItems: next });
  const addCustom = () => set([...items, { id: `inc-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, name: "New item", showToCustomer: true, custom: true }]);
  const update = (id: string, p: Partial<OfferIncludedItem>) => set(items.map(it => it.id === id ? { ...it, ...p } : it));
  const remove = (id: string) => set(items.filter(it => it.id !== id));

  return (
    <div className="space-y-2 max-w-2xl">
      <div className="flex items-center justify-between">
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>Pull from your catalog or add custom lines. Hide internal components to show a package price.</p>
        <div className="flex items-center gap-2">
          <button onClick={() => setPickCatalog(true)} className="flex items-center gap-1 text-xs font-medium" style={{ color: "var(--accent-text)" }}><Plus className="w-3.5 h-3.5" /> Catalog item</button>
          <button onClick={addCustom} className="flex items-center gap-1 text-xs font-medium" style={{ color: "var(--text-secondary)" }}><Plus className="w-3.5 h-3.5" /> Custom</button>
        </div>
      </div>
      {items.length === 0 ? <Empty msg="No included items yet." /> : (
        <div className="space-y-1.5">
          {items.map(it => (
            <div key={it.id} className="flex items-center gap-2 rounded-lg px-2.5 py-1.5" style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border)" }}>
              <input value={it.name} onChange={e => update(it.id, { name: e.target.value })} className="flex-1 min-w-0 bg-transparent text-sm outline-none" style={{ color: "var(--text-primary)" }} />
              {it.itemId && <span className="text-[9px] px-1.5 py-0.5 rounded shrink-0" style={{ backgroundColor: "var(--accent-soft-bg)", color: "var(--accent-text)" }}>Catalog</span>}
              <div className="flex items-center gap-1 shrink-0"><span className="text-[10px]" style={{ color: "var(--text-muted)" }}>$</span><input type="number" min={0} value={it.price ?? ""} onChange={e => update(it.id, { price: e.target.value === "" ? undefined : parseFloat(e.target.value) || 0 })} className="w-20 rounded px-1.5 py-0.5 text-xs outline-none" style={inpStyle} /></div>
              <button onClick={() => update(it.id, { showToCustomer: !it.showToCustomer })} title={it.showToCustomer ? "Shown to customer" : "Hidden from customer"} className="p-1 shrink-0" style={{ color: it.showToCustomer ? "var(--accent-text)" : "var(--text-muted)" }}>{it.showToCustomer ? <Eye className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5 opacity-40" />}</button>
              <button onClick={() => remove(it.id)} className="p-1 shrink-0" style={{ color: "var(--text-muted)" }}><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
        </div>
      )}
      {pickCatalog && <CatalogPicker onPick={it => { set([...items, it]); setPickCatalog(false); }} onClose={() => setPickCatalog(false)} />}
    </div>
  );
}

function CatalogPicker({ onPick, onClose }: { onPick: (it: OfferIncludedItem) => void; onClose: () => void }) {
  const all = useMemo(() => getAllItems().filter(i => i.active), []);
  const [q, setQ] = useState("");
  const filtered = all.filter(i => !q || `${i.name} ${i.category} ${i.sku ?? ""}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="fixed inset-0 z-[80] bg-black/45 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[80vh] flex flex-col rounded-2xl overflow-hidden" onClick={e => e.stopPropagation()} style={{ backgroundColor: "var(--bg-surface)", boxShadow: "0 24px 70px rgba(0,0,0,0.4)" }}>
        <div className="flex items-center justify-between px-5 py-3.5 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Add from Items &amp; Services</p>
          <button onClick={onClose} style={{ color: "var(--text-muted)" }}><X className="w-5 h-5" /></button>
        </div>
        <div className="px-5 py-3 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="relative"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search items…" className="w-full rounded-lg pl-9 pr-3 py-2 text-sm outline-none" style={inpStyle} autoFocus /></div>
        </div>
        <div className="flex-1 overflow-y-auto thin-scroll-y p-2">
          {filtered.length === 0 ? <p className="text-sm text-center py-8" style={{ color: "var(--text-muted)" }}>No items found.</p> : filtered.map(i => (
            <button key={i.id} onClick={() => onPick({ id: `inc-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, name: i.name, itemId: i.id, price: i.unitPrice, showToCustomer: true })}
              className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-left hover:bg-[var(--bg-surface-2)]">
              <div className="min-w-0"><p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{i.name}</p><p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>{i.category}</p></div>
              <span className="text-sm font-semibold shrink-0" style={{ color: "var(--text-secondary)" }}>{fmtMoney(i.unitPrice)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// Equipment Details (per option)
function EquipmentEditor({ opt, onChange }: { opt: OfferOption; onChange: (p: Partial<OfferOption>) => void }) {
  const eq = opt.equipment ?? {};
  const set = (p: Partial<OfferEquipment>) => onChange({ equipment: { ...eq, ...p } });
  const F = (label: string, key: keyof OfferEquipment, placeholder?: string) => (
    <Field label={label}><input value={(eq[key] as string) ?? ""} onChange={e => set({ [key]: e.target.value || undefined } as Partial<OfferEquipment>)} className={inp} style={inpStyle} placeholder={placeholder} /></Field>
  );
  return (
    <div className="space-y-4 max-w-2xl">
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>Equipment specs for <span style={{ fontWeight: 600, color: "var(--text-secondary)" }}>{opt.title}</span>. Shown when the offer&apos;s &quot;technical specs&quot; toggle is on.</p>
      <div className="grid sm:grid-cols-2 gap-3">
        {F("Outdoor unit", "outdoorUnit", "e.g. 24VNA9 19 SEER2")}
        {F("Indoor unit", "indoorUnit", "e.g. Variable-speed air handler")}
        {F("Thermostat", "thermostat", "e.g. Smart Wi-Fi")}
        {F("Heat kit", "heatKit", "e.g. 10kW")}
        {F("SEER2 rating", "seer2", "e.g. 19")}
        {F("Tonnage", "tonnage", "e.g. 3")}
        {F("Fuel type", "fuelType", "e.g. Electric / Gas")}
        {F("System type", "systemType", "e.g. Split System")}
      </div>
      <Field label="Accessories (one per line)"><textarea value={(eq.accessories ?? []).join("\n")} onChange={e => set({ accessories: e.target.value.split("\n").map(s => s.trim()).filter(Boolean) })} rows={3} className={inp + " resize-none"} style={inpStyle} /></Field>
      <Field label="Warranty"><input value={eq.warranty ?? ""} onChange={e => set({ warranty: e.target.value || undefined })} className={inp} style={inpStyle} placeholder="e.g. 10-yr parts + labor" /></Field>
    </div>
  );
}

// Images (per option) — Media Library + upload + primary + reorder + caption
function ImagesEditor({ opt, onChange }: { opt: OfferOption; onChange: (p: Partial<OfferOption>) => void }) {
  const [pick, setPick] = useState(false);
  const imgs = opt.images;
  const set = (next: OfferImage[]) => onChange({ images: next });
  const remove = (id: string) => { const next = imgs.filter(im => im.id !== id); onChange({ images: next, primaryImageId: opt.primaryImageId === id ? next[0]?.id : opt.primaryImageId }); };
  const move = (id: string, dir: -1 | 1) => { const arr = [...imgs]; const i = arr.findIndex(im => im.id === id); const j = i + dir; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; set(arr); };
  const primaryId = opt.primaryImageId ?? imgs[0]?.id;

  return (
    <div className="space-y-3 max-w-2xl">
      <div className="flex items-center justify-between">
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>Images for <span style={{ fontWeight: 600, color: "var(--text-secondary)" }}>{opt.title}</span>. Uploads are saved to the Media Library.</p>
        <button onClick={() => setPick(true)} className="flex items-center gap-1 text-xs font-medium" style={{ color: "var(--accent-text)" }}><ImageIcon className="w-3.5 h-3.5" /> Add image</button>
      </div>
      {imgs.length === 0 ? <Empty msg="No images yet." /> : (
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>
          {imgs.map((im, i) => {
            const isPrimary = im.id === primaryId;
            return (
              <div key={im.id} className="rounded-xl overflow-hidden flex flex-col" style={{ backgroundColor: "var(--bg-surface-2)", border: isPrimary ? "1.5px solid var(--accent-text)" : "1px solid var(--border)" }}>
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={im.url} alt={im.caption ?? ""} style={{ width: "100%", height: "100px", objectFit: "cover", display: "block" }} />
                  {isPrimary && <span className="absolute top-1 left-1 text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--accent-text)", color: "#fff" }}>PRIMARY</span>}
                  <button onClick={() => remove(im.id)} className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.55)", color: "#fff" }}><X className="w-3 h-3" /></button>
                </div>
                <div className="p-1.5 space-y-1">
                  <input value={im.caption ?? ""} onChange={e => set(imgs.map(x => x.id === im.id ? { ...x, caption: e.target.value || undefined } : x))} placeholder="Caption" className="w-full rounded px-1.5 py-0.5 text-[11px] outline-none" style={inpStyle} />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-0.5">
                      <button onClick={() => move(im.id, -1)} disabled={i === 0} className="disabled:opacity-20 p-0.5" style={{ color: "var(--text-muted)" }}><ChevronUp className="w-3 h-3" /></button>
                      <button onClick={() => move(im.id, 1)} disabled={i === imgs.length - 1} className="disabled:opacity-20 p-0.5" style={{ color: "var(--text-muted)" }}><ChevronDown className="w-3 h-3" /></button>
                    </div>
                    {!isPrimary && <button onClick={() => onChange({ primaryImageId: im.id })} className="text-[10px] font-medium" style={{ color: "var(--accent-text)" }}>Set primary</button>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {pick && <MediaPickerModal title="Add image to option" onClose={() => setPick(false)}
        onPick={a => { const ni: OfferImage = { id: `oi-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, mediaId: a.id, url: a.url, caption: a.caption }; const next = [...imgs, ni]; onChange({ images: next, primaryImageId: opt.primaryImageId ?? ni.id }); setPick(false); }} />}
    </div>
  );
}

// Pricing & Financing
function PricingTab({ g, patch, updateOption }: { g: OfferGroup; patch: (p: Partial<OfferGroup>) => void; updateOption: (id: string, p: Partial<OfferOption>) => void }) {
  return (
    <div className="space-y-4 max-w-2xl">
      <Field label="Price display"><UiSelect value={g.priceDisplay} onChange={v => patch({ priceDisplay: v as PriceDisplay })} options={PRICE_DISPLAYS.map(p => ({ value: p, label: PRICE_DISPLAY_LABELS[p] }))} /></Field>
      <Field label="Financing note"><textarea value={g.financingNote ?? ""} onChange={e => patch({ financingNote: e.target.value || undefined })} rows={2} className={inp + " resize-none"} style={inpStyle} placeholder="e.g. Financing available — as low as $119/mo with approved credit." /></Field>
      <div>
        <p className="text-xs font-medium mb-2" style={{ color: "var(--text-secondary)" }}>Per-option pricing</p>
        <div className="space-y-1.5">
          {g.options.map(o => (
            <div key={o.id} className="flex items-center gap-3 rounded-lg px-3 py-2" style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border)" }}>
              <span className="flex-1 text-sm truncate" style={{ color: "var(--text-primary)" }}>{o.title}</span>
              <span className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>{fmtMoney(o.price)}{o.monthlyPrice ? ` · ${fmtMoney(o.monthlyPrice)}/mo` : ""}</span>
              <label className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: "var(--text-muted)" }}>
                <input type="checkbox" checked={o.taxable ?? false} onChange={e => updateOption(o.id, { taxable: e.target.checked })} className="accent-[#0f8578] w-3.5 h-3.5" /> Taxable
              </label>
            </div>
          ))}
          {g.options.length === 0 && <Empty msg="Add options to set pricing." />}
        </div>
      </div>
    </div>
  );
}

// Display Settings
function DisplayTab({ g, patch }: { g: OfferGroup; patch: (p: Partial<OfferGroup>) => void }) {
  const t = g.toggles;
  const setT = (p: Partial<OfferFieldToggles>) => patch({ toggles: { ...t, ...p } });
  const TOGGLES: { key: keyof OfferFieldToggles; label: string }[] = [
    { key: "showBrand", label: "Show brand" }, { key: "showModels", label: "Show model numbers" },
    { key: "showImages", label: "Show images" }, { key: "showMonthly", label: "Show monthly payment" },
    { key: "showIncluded", label: "Show included items" }, { key: "showWarranty", label: "Show warranty" },
    { key: "showRecommended", label: "Show recommended badge" }, { key: "showSpecs", label: "Show technical specs" },
    { key: "showPrice", label: "Show price" },
  ];
  return (
    <div className="space-y-4 max-w-2xl">
      <Field label="Display layout">
        <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
          {OFFER_LAYOUTS.map(l => { const on = g.displayLayout === l; return (
            <button key={l} onClick={() => patch({ displayLayout: l as OfferDisplayLayout })} className="text-left rounded-lg px-3 py-2 text-xs font-medium" style={on ? { border: "1.5px solid var(--accent-text)", backgroundColor: "var(--accent-soft-bg)", color: "var(--accent-text)" } : { border: "1px solid var(--border)", color: "var(--text-secondary)" }}>{OFFER_LAYOUT_LABELS[l]}</button>
          ); })}
        </div>
      </Field>
      <div>
        <p className="text-xs font-medium mb-2" style={{ color: "var(--text-secondary)" }}>Field toggles</p>
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1 rounded-lg p-3" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)" }}>
          {TOGGLES.map(tog => (
            <label key={tog.key} className="flex items-center justify-between py-1.5 cursor-pointer">
              <span className="text-sm" style={{ color: "var(--text-primary)" }}>{tog.label}</span>
              <input type="checkbox" checked={t[tog.key]} onChange={e => setT({ [tog.key]: e.target.checked })} className="accent-[#0f8578] w-4 h-4" />
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

// Usage — where this offer group is used (proposal templates now; quotes & kits later)
function UsageTab({ g }: { g: OfferGroup }) {
  const using = useMemo(() => getCompanySalesbooks().filter(sb => (sb.offerGroupIds ?? []).includes(g.id)), [g.id]);
  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>Proposal templates · {using.length}</p>
        {using.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>Not added to any proposal template yet. Open a template&apos;s Offer Library tab and choose &quot;Add from Offer Library.&quot;</p>
        ) : (
          <div className="space-y-1.5">
            {using.map(sb => (
              <div key={sb.id} className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border)" }}>
                <Package className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
                <span className="text-sm" style={{ color: "var(--text-primary)" }}>{sb.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>Quotes created from it</p>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>Quote-level usage tracking is coming soon. Quotes copy this offer&apos;s data at creation time.</p>
      </div>
      <div className="rounded-lg px-3 py-2.5 flex items-start gap-2" style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border)" }}>
        <Copy className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: "var(--text-muted)" }} />
        <p className="text-[11px] leading-snug" style={{ color: "var(--text-muted)" }}>When a proposal or quote uses this offer group, its data is <strong>copied</strong> into that proposal/quote — so older quotes never change when you edit this master offer group later.</p>
      </div>
    </div>
  );
}

// Activity — mock audit trail derived from the group's timestamps + state.
function ActivityTab({ g }: { g: OfferGroup }) {
  const events: { icon: typeof Package; label: string; when: string }[] = [
    { icon: Package, label: "Offer group created", when: g.createdAt },
    { icon: Layers, label: `${g.options.length} option${g.options.length === 1 ? "" : "s"} configured`, when: g.updatedAt },
    ...(g.status === "active" ? [{ icon: Check, label: "Marked active", when: g.updatedAt }] : []),
    ...(attentionFor(g).needs ? [{ icon: AlertTriangle, label: "Needs attention — missing images or prices", when: g.updatedAt }] : []),
    { icon: Pencil, label: "Last updated", when: g.updatedAt },
  ];
  return (
    <div className="max-w-2xl">
      {events.map((e, i) => (
        <div key={i} className="flex gap-3">
          <div className="flex flex-col items-center">
            <span className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border)" }}>
              <e.icon className="w-3.5 h-3.5" style={{ color: "var(--text-secondary)" }} />
            </span>
            {i < events.length - 1 && <span className="w-px flex-1 my-1" style={{ backgroundColor: "var(--border-subtle)" }} />}
          </div>
          <div className="pb-4 min-w-0">
            <p className="text-sm" style={{ color: "var(--text-primary)" }}>{e.label}</p>
            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{e.when}</p>
          </div>
        </div>
      ))}
      <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Detailed change history will be recorded once activity logging is connected.</p>
    </div>
  );
}

// ─── Offer group preview ──────────────────────────────────
export function OfferGroupPreview({ group }: { group: OfferGroup }) {
  const t = group.toggles;
  const opts = [...group.options].sort((a, b) => a.order - b.order);
  const accent = "#0f8578";
  const showTotal = group.priceDisplay !== "hidden" && group.priceDisplay !== "monthly_only" && t.showPrice;
  const showMonthly = t.showMonthly && (group.priceDisplay === "monthly_only" || group.priceDisplay === "total_and_monthly" || group.priceDisplay === "as_low_as");
  const asLowAs = group.priceDisplay === "as_low_as";

  const price = (o: OfferOption) => (
    <div>
      {showTotal && <p style={{ fontSize: "20px", fontWeight: 800, color: "#111827", lineHeight: 1 }}>{fmtMoney(o.price)}</p>}
      {showMonthly && o.monthlyPrice ? <p style={{ fontSize: "12px", fontWeight: 700, color: accent, marginTop: "2px" }}>{asLowAs ? "as low as " : ""}{fmtMoney(o.monthlyPrice)}/mo</p> : null}
      {group.priceDisplay === "hidden" && <p style={{ fontSize: "11px", color: "#6b7280", fontStyle: "italic" }}>Pricing at quote</p>}
    </div>
  );

  const table = group.displayLayout === "comparison_table" || group.displayLayout === "spec_table";

  const card = (o: OfferOption) => {
    const primary = o.primaryImageId ? o.images.find(im => im.id === o.primaryImageId) : o.images[0];
    return (
      <div key={o.id} style={{ border: `1.5px solid ${o.recommended && t.showRecommended ? accent : "#e5e7eb"}`, borderRadius: "12px", overflow: "hidden", backgroundColor: "#fff", display: "flex", flexDirection: "column", boxShadow: o.recommended ? `0 8px 24px ${accent}22` : "0 1px 3px rgba(0,0,0,0.05)" }}>
        {o.recommended && t.showRecommended && <div style={{ backgroundColor: accent, color: "#fff", fontSize: "10px", fontWeight: 800, letterSpacing: "0.08em", textAlign: "center", padding: "4px 0", textTransform: "uppercase" }}>Recommended</div>}
        {t.showImages && primary && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={primary.url} alt={o.title} style={{ width: "100%", height: "120px", objectFit: "cover" }} />
        )}
        <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", flex: 1 }}>
          {o.tier && <p style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: accent }}>{OFFER_TIER_LABELS[o.tier]}</p>}
          <p style={{ fontSize: "15px", fontWeight: 700, color: "#111827", lineHeight: 1.2, marginTop: "2px" }}>{o.title}</p>
          {t.showBrand && o.brand && <p style={{ fontSize: "11px", color: "#6b7280", marginTop: "1px" }}>{o.brand}</p>}
          {o.description && <p style={{ fontSize: "12px", color: "#374151", marginTop: "6px" }}>{o.description}</p>}
          <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: "1px solid #e5e7eb" }}>{price(o)}</div>
          {t.showWarranty && o.warranty && <p style={{ fontSize: "11px", color: "#6b7280", marginTop: "8px" }}>Warranty: {o.warranty}</p>}
          {t.showIncluded && o.includedItems.filter(it => it.showToCustomer).length > 0 && (
            <ul style={{ listStyle: "none", padding: 0, margin: "10px 0 0" }}>
              {o.includedItems.filter(it => it.showToCustomer).map(it => (
                <li key={it.id} style={{ fontSize: "11.5px", color: "#374151", padding: "3px 0 3px 16px", position: "relative" }}><span style={{ position: "absolute", left: 0, color: accent, fontWeight: 800 }}>✓</span>{it.name}</li>
              ))}
            </ul>
          )}
          {t.showSpecs && o.equipment && (
            <div style={{ marginTop: "10px", fontSize: "10.5px", color: "#6b7280" }}>
              {[o.equipment.seer2 && `${o.equipment.seer2} SEER2`, o.equipment.tonnage && `${o.equipment.tonnage} Ton`, o.equipment.systemType].filter(Boolean).join(" · ")}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ backgroundColor: "#fff", borderRadius: "12px", padding: "24px", maxWidth: "860px", margin: "0 auto", fontFamily: "'Inter', system-ui, sans-serif", boxShadow: "0 8px 32px rgba(0,0,0,0.12)" }}>
      <p style={{ fontSize: "20px", fontWeight: 800, color: "#111827" }}>{group.name}</p>
      {group.description && <p style={{ fontSize: "13px", color: "#374151", marginTop: "4px" }}>{group.description}</p>}
      {opts.length === 0 ? <p style={{ fontSize: "13px", color: "#9ca3af", marginTop: "16px", fontStyle: "italic" }}>No options yet.</p> : table ? (
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "16px", fontSize: "12.5px" }}>
          <thead><tr style={{ backgroundColor: "#f9fafb" }}>
            <th style={th("left")}>Option</th>{t.showBrand && <th style={th("left")}>Brand</th>}{t.showSpecs && <th style={th("left")}>Specs</th>}{t.showPrice && <th style={th("right")}>Price</th>}{t.showMonthly && <th style={th("right")}>Monthly</th>}
          </tr></thead>
          <tbody>
            {opts.map(o => (
              <tr key={o.id}>
                <td style={td()}><span style={{ fontWeight: 600 }}>{o.title}</span>{o.recommended && t.showRecommended && <span style={{ marginLeft: "6px", fontSize: "9px", fontWeight: 800, color: accent }}>★</span>}</td>
                {t.showBrand && <td style={td()}>{o.brand ?? "—"}</td>}
                {t.showSpecs && <td style={td()}>{[o.equipment?.seer2 && `${o.equipment.seer2} SEER2`, o.equipment?.tonnage && `${o.equipment.tonnage}T`].filter(Boolean).join(" · ") || "—"}</td>}
                {t.showPrice && <td style={{ ...td(), textAlign: "right", fontWeight: 700 }}>{fmtMoney(o.price)}</td>}
                {t.showMonthly && <td style={{ ...td(), textAlign: "right", color: accent }}>{o.monthlyPrice ? `${fmtMoney(o.monthlyPrice)}/mo` : "—"}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: group.displayLayout === "stacked" || group.displayLayout === "package_stack" || group.displayLayout === "compact_list" ? "1fr" : `repeat(${Math.min(opts.length, 3)}, 1fr)`, gap: "12px", marginTop: "16px" }}>
          {opts.map(card)}
        </div>
      )}
      {group.financingNote && <p style={{ fontSize: "12px", color: accent, marginTop: "14px", fontWeight: 600 }}>{group.financingNote}</p>}
    </div>
  );
}

function OfferGroupPreviewModal({ group, onClose }: { group: OfferGroup; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[80] flex flex-col" style={{ backgroundColor: "rgba(17,24,39,0.7)" }}>
      <div className="flex items-center justify-between gap-3 px-5 py-3 shrink-0" style={{ backgroundColor: "var(--bg-surface)", borderBottom: "1px solid var(--border)" }}>
        <p className="text-sm font-semibold flex items-center gap-2 min-w-0" style={{ color: "var(--text-primary)" }}><Eye className="w-4 h-4 shrink-0" style={{ color: "var(--accent-text)" }} /> <span className="truncate">{group.name} — Preview</span></p>
        <button onClick={onClose} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)", backgroundColor: "var(--bg-surface)" }}><X className="w-4 h-4" /> Close</button>
      </div>
      <div className="flex-1 overflow-y-auto thin-scroll-y" style={{ backgroundColor: "#e5e7eb" }}>
        <div className="py-8 px-4"><OfferGroupPreview group={group} /></div>
      </div>
    </div>
  );
}

// ─── Reusable picker (Salesbook "Add from Offer Library") ──
export function OfferGroupPicker({ industry, onPick, onClose }: { industry?: SalesbookIndustry; onPick: (g: OfferGroup) => void; onClose: () => void }) {
  const groups = useMemo(() => getOfferGroups(), []);
  const [q, setQ] = useState("");
  const [previewId, setPreviewId] = useState<string | null>(null);
  const filtered = groups.filter(g => {
    if (q) { const hay = `${g.name} ${g.category} ${g.tags.join(" ")} ${INDUSTRY_LABELS[g.industry]}`.toLowerCase(); if (!hay.includes(q.toLowerCase())) return false; }
    return true;
  }).sort((a, b) => (a.industry === industry ? -1 : 0) - (b.industry === industry ? -1 : 0));
  const previewGroup = groups.find(g => g.id === previewId) ?? null;

  return (
    <div className="fixed inset-0 z-[70] bg-black/45 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-4xl max-h-[88vh] flex flex-col rounded-2xl overflow-hidden" onClick={e => e.stopPropagation()} style={{ backgroundColor: "var(--bg-surface)", boxShadow: "0 24px 70px rgba(0,0,0,0.4)" }}>
        <div className="flex items-center justify-between px-5 py-3.5 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <p className="text-base font-semibold flex items-center gap-2" style={{ color: "var(--text-primary)" }}><Package className="w-4 h-4" style={{ color: "var(--accent-text)" }} /> Add from Offer Library</p>
          <button onClick={onClose} style={{ color: "var(--text-muted)" }}><X className="w-5 h-5" /></button>
        </div>
        <div className="px-5 py-3 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="relative"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search offer groups…" className="w-full rounded-lg pl-9 pr-3 py-2 text-sm outline-none" style={inpStyle} /></div>
        </div>
        <div className="flex-1 overflow-y-auto thin-scroll-y p-5">
          {filtered.length === 0 ? <p className="text-sm text-center py-10" style={{ color: "var(--text-muted)" }}>No offer groups — create one in the Offer Library.</p> : (
            <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
              {filtered.map(g => {
                const range = offerPriceRange(g);
                return (
                  <div key={g.id} className="rounded-xl p-3.5 flex flex-col" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
                    <div className="flex items-center gap-1.5 flex-wrap"><p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{g.name}</p></div>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap"><Chip>{INDUSTRY_LABELS[g.industry]}</Chip><Chip subtle>{g.options.length} options</Chip>{range && <Chip subtle>{range.min === range.max ? fmtMoney(range.min) : `${fmtMoney(range.min)}–${fmtMoney(range.max)}`}</Chip>}</div>
                    {g.description && <p className="text-[11px] mt-1.5 leading-snug" style={{ color: "var(--text-muted)" }}>{g.description}</p>}
                    <div className="flex items-center gap-2 mt-3">
                      <button onClick={() => setPreviewId(g.id)} className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}><Eye className="w-3.5 h-3.5" /> Preview</button>
                      <button onClick={() => onPick(g)} className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: "var(--accent-text)" }}><Check className="w-3.5 h-3.5" /> Add</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      {previewGroup && <OfferGroupPreviewModal group={previewGroup} onClose={() => setPreviewId(null)} />}
    </div>
  );
}

// ─── bits ─────────────────────────────────────────────────
const inp = "w-full rounded-lg px-3 py-2 text-sm outline-none";
const inpSm = "w-full rounded-lg px-2.5 py-1.5 text-sm outline-none";
const inpStyle: React.CSSProperties = { border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" };
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>{label}</label>{children}</div>;
}
const th = (align: "left" | "right"): React.CSSProperties => ({ textAlign: align, padding: "8px 10px", color: "#6b7280", fontSize: "10px", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", borderBottom: "1px solid #e5e7eb" });
const td = (): React.CSSProperties => ({ padding: "8px 10px", color: "#111827", borderBottom: "1px solid #f3f4f6" });
