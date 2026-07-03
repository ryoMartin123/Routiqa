"use client";

// Media Library — reusable sales assets (equipment, covers, logos, badges, section
// images) shared across salesbooks, offer groups, and quote designs. NOT customer
// Photos & Files. Upload once, reuse everywhere.
//
// Exports:
//   • MediaLibrarySection — the Settings page (grid + filters + detail drawer + upload)
//   • MediaPickerModal     — reusable "choose from Media Library" (used by Offers + Salesbook)

import { useMemo, useRef, useState } from "react";
import {
  ImageIcon, Upload, Search, X, Archive, Trash2, Pencil,
  Link2, Package, BookOpen, Download,
} from "lucide-react";
import UiSelect from "@/components/ui/Select";
import {
  getMediaAssets, getAllMediaAssets, addMediaAsset, updateMediaAsset,
  archiveMediaAsset, deleteMediaAsset,
  MEDIA_CATEGORY_LABELS, MEDIA_CATEGORIES, INDUSTRY_LABELS,
  type MediaAsset, type MediaCategory, type SalesbookIndustry,
} from "@/lib/media/data";
import { getAllOfferGroups, type OfferGroup } from "@/lib/offers/data";
import { getCompanySalesbooks, type CompanySalesbook } from "@/lib/salesbooks/data";

// ─── Usage scanning ───────────────────────────────────────
interface Usage { offers: OfferGroup[]; salesbooks: CompanySalesbook[]; total: number }

function computeUsage(asset: MediaAsset, offers: OfferGroup[], salesbooks: CompanySalesbook[]): Usage {
  const inOffer = (g: OfferGroup) => g.options.some(o => o.images.some(im => im.mediaId === asset.id || im.url === asset.url));
  const inSb = (sb: CompanySalesbook) =>
    (sb.media ?? []).some(m => m.url === asset.url) || sb.options.some(o => o.image === asset.url);
  const o = offers.filter(inOffer);
  const s = salesbooks.filter(inSb);
  return { offers: o, salesbooks: s, total: o.length + s.length };
}

// ─── Settings page ────────────────────────────────────────
export default function MediaLibrarySection() {
  const [tick, setTick] = useState(0);
  const refresh = () => setTick(t => t + 1);
  const fileRef = useRef<HTMLInputElement>(null);

  const assets = useMemo(() => getMediaAssets(), [tick]);
  const offers = useMemo(() => getAllOfferGroups(), [tick]);
  const salesbooks = useMemo(() => getCompanySalesbooks(), [tick]);

  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("");
  const [industry, setIndustry] = useState<string>("");
  const [onlyUnused, setOnlyUnused] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const usageById = useMemo(() => {
    const m = new Map<string, Usage>();
    for (const a of assets) m.set(a.id, computeUsage(a, offers, salesbooks));
    return m;
  }, [assets, offers, salesbooks]);

  const filtered = assets.filter(a => {
    if (cat && a.category !== cat) return false;
    if (industry && a.industry !== industry) return false;
    if (onlyUnused && (usageById.get(a.id)?.total ?? 0) > 0) return false;
    if (q) {
      const hay = `${a.name} ${a.brand ?? ""} ${a.model ?? ""} ${a.tags.join(" ")} ${a.caption ?? ""}`.toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  });

  // Summary
  const equipmentCount = assets.filter(a => a.category === "equipment").length;
  const unusedCount = assets.filter(a => (usageById.get(a.id)?.total ?? 0) === 0).length;
  const missingLinks = assets.filter(a => !a.altText || !a.caption).length;

  function onUpload(files: FileList | null) {
    if (!files?.length) return;
    const imgs = Array.from(files).filter(f => f.type.startsWith("image/"));
    Promise.all(imgs.map(f => new Promise<{ url: string; name: string }>((res, rej) => {
      const r = new FileReader();
      r.onload = () => typeof r.result === "string" ? res({ url: r.result, name: f.name.replace(/\.[^.]+$/, "") }) : rej(new Error("read"));
      r.onerror = () => rej(new Error("read"));
      r.readAsDataURL(f);
    }))).then(items => { items.forEach(it => addMediaAsset({ url: it.url, name: it.name, category: "asset" })); refresh(); })
      .catch(() => { /* ignore */ });
  }

  const openAsset = assets.find(a => a.id === openId) ?? null;

  return (
    <div className="space-y-5">
      {/* Header + actions */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-base font-semibold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <ImageIcon className="w-4.5 h-4.5" style={{ color: "var(--accent-text)" }} /> Media Library
          </h3>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>Reusable images &amp; assets for salesbooks, offer groups, and quote designs.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: "var(--accent-text)" }}>
            <Upload className="w-4 h-4" /> Upload Media
          </button>
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={e => { onUpload(e.target.files); e.target.value = ""; }} />
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
        <SummaryCard label="Total Assets" value={assets.length} icon={ImageIcon} />
        <SummaryCard label="Equipment Images" value={equipmentCount} icon={Package} />
        <SummaryCard label="Unused Assets" value={unusedCount} icon={Link2} warn={unusedCount > 0} />
        <SummaryCard label="Missing Captions/Alt" value={missingLinks} icon={Pencil} warn={missingLinks > 0} />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search assets, brands, tags…"
            className="w-full rounded-lg pl-9 pr-3 py-2 text-sm outline-none" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
        </div>
        <div className="w-44"><UiSelect size="sm" value={cat} onChange={setCat} placeholder="All categories" options={[{ value: "", label: "All categories" }, ...MEDIA_CATEGORIES.map(c => ({ value: c, label: MEDIA_CATEGORY_LABELS[c] }))]} /></div>
        <div className="w-40"><UiSelect size="sm" value={industry} onChange={setIndustry} placeholder="All industries" options={[{ value: "", label: "All industries" }, ...(Object.keys(INDUSTRY_LABELS) as SalesbookIndustry[]).map(k => ({ value: k, label: INDUSTRY_LABELS[k] }))]} /></div>
        <button onClick={() => setOnlyUnused(v => !v)} className="px-2.5 py-1.5 rounded-lg text-xs font-medium" style={onlyUnused ? { backgroundColor: "var(--accent-soft-bg)", color: "var(--accent-text)", border: "1px solid var(--accent-soft-border)" } : { border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Unused only</button>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-xl py-14 text-center" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
          <ImageIcon className="w-8 h-8 mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
          <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>No assets match</p>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Upload media or adjust your filters.</p>
        </div>
      ) : (
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
          {filtered.map(a => (
            <AssetCard key={a.id} a={a} used={usageById.get(a.id)?.total ?? 0} onOpen={() => setOpenId(a.id)} />
          ))}
        </div>
      )}

      {openAsset && (
        <AssetDrawer asset={openAsset} usage={usageById.get(openAsset.id) ?? { offers: [], salesbooks: [], total: 0 }}
          onClose={() => setOpenId(null)} onChange={refresh} />
      )}
    </div>
  );
}

function SummaryCard({ label, value, icon: Icon, warn }: { label: string; value: number; icon: typeof ImageIcon; warn?: boolean }) {
  return (
    <div className="rounded-xl p-3.5" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>{label}</p>
        <Icon className="w-4 h-4" style={{ color: warn && value > 0 ? "#b45309" : "var(--text-muted)" }} />
      </div>
      <p className="text-2xl font-bold mt-1" style={{ color: warn && value > 0 ? "#b45309" : "var(--text-primary)" }}>{value}</p>
    </div>
  );
}

function AssetCard({ a, used, onOpen }: { a: MediaAsset; used: number; onOpen: () => void }) {
  return (
    <button onClick={onOpen} className="rounded-xl overflow-hidden flex flex-col text-left transition-all hover:shadow-md" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
      <div className="relative" style={{ backgroundColor: "var(--bg-surface-2)" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={a.url} alt={a.altText ?? a.name} style={{ width: "100%", height: "120px", objectFit: "cover", display: "block" }} />
        <span className="absolute top-1.5 left-1.5 text-[9px] font-semibold px-1.5 py-0.5 rounded" style={{ backgroundColor: "rgba(0,0,0,0.6)", color: "#fff" }}>{MEDIA_CATEGORY_LABELS[a.category]}</span>
      </div>
      <div className="px-2.5 py-2 flex-1">
        <p className="text-xs font-semibold truncate" style={{ color: "var(--text-primary)" }}>{a.name}</p>
        {(a.brand || a.model) && <p className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>{[a.brand, a.model].filter(Boolean).join(" · ")}</p>}
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-[10px]" style={{ color: used > 0 ? "var(--accent-text)" : "var(--text-muted)" }}>{used > 0 ? `Used ${used}×` : "Unused"}</span>
          {a.tags.length > 0 && <span className="text-[10px] truncate max-w-[70px]" style={{ color: "var(--text-muted)" }}>#{a.tags[0]}</span>}
        </div>
      </div>
    </button>
  );
}

// ─── Asset detail drawer ──────────────────────────────────
function AssetDrawer({ asset, usage, onClose, onChange }: { asset: MediaAsset; usage: Usage; onClose: () => void; onChange: () => void }) {
  const [name, setName] = useState(asset.name);
  const [category, setCategory] = useState<MediaCategory>(asset.category);
  const [caption, setCaption] = useState(asset.caption ?? "");
  const [altText, setAltText] = useState(asset.altText ?? "");
  const [brand, setBrand] = useState(asset.brand ?? "");
  const [model, setModel] = useState(asset.model ?? "");
  const [tags, setTags] = useState(asset.tags.join(", "));
  const replaceRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState(asset.url);

  function save() {
    updateMediaAsset(asset.id, {
      name: name.trim() || asset.name, category, caption: caption || undefined, altText: altText || undefined,
      brand: brand || undefined, model: model || undefined, url,
      tags: tags.split(",").map(t => t.trim()).filter(Boolean),
    });
    onChange(); onClose();
  }
  function replace(files: FileList | null) {
    const f = files?.[0]; if (!f || !f.type.startsWith("image/")) return;
    const r = new FileReader(); r.onload = () => { if (typeof r.result === "string") setUrl(r.result); }; r.readAsDataURL(f);
  }

  return (
    <div className="fixed inset-0 z-[70] flex justify-end" style={{ backgroundColor: "rgba(17,24,39,0.5)" }} onClick={onClose}>
      <div className="w-full max-w-md h-full overflow-y-auto thin-scroll-y" onClick={e => e.stopPropagation()} style={{ backgroundColor: "var(--bg-surface)", boxShadow: "-12px 0 40px rgba(0,0,0,0.3)" }}>
        <div className="flex items-center justify-between px-5 py-3.5 sticky top-0 z-10" style={{ backgroundColor: "var(--bg-surface)", borderBottom: "1px solid var(--border)" }}>
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Asset details</p>
          <button onClick={onClose} style={{ color: "var(--text-muted)" }}><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={altText || name} style={{ width: "100%", maxHeight: "260px", objectFit: "contain", borderRadius: "10px", backgroundColor: "var(--bg-surface-2)" }} />
          <div className="flex items-center gap-2">
            <button onClick={() => replaceRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}><Upload className="w-3.5 h-3.5" /> Replace image</button>
            <input ref={replaceRef} type="file" accept="image/*" className="hidden" onChange={e => { replace(e.target.files); e.target.value = ""; }} />
            <button disabled className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium opacity-50" style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}><Download className="w-3.5 h-3.5" /> Download</button>
          </div>

          <Field label="Name"><input value={name} onChange={e => setName(e.target.value)} className={inp} style={inpStyle} /></Field>
          <Field label="Category"><UiSelect value={category} onChange={v => setCategory(v as MediaCategory)} options={MEDIA_CATEGORIES.map(c => ({ value: c, label: MEDIA_CATEGORY_LABELS[c] }))} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Brand"><input value={brand} onChange={e => setBrand(e.target.value)} className={inp} style={inpStyle} /></Field>
            <Field label="Model"><input value={model} onChange={e => setModel(e.target.value)} className={inp} style={inpStyle} /></Field>
          </div>
          <Field label="Caption"><input value={caption} onChange={e => setCaption(e.target.value)} className={inp} style={inpStyle} /></Field>
          <Field label="Alt text"><input value={altText} onChange={e => setAltText(e.target.value)} className={inp} style={inpStyle} /></Field>
          <Field label="Tags (comma separated)"><input value={tags} onChange={e => setTags(e.target.value)} className={inp} style={inpStyle} /></Field>
          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Uploaded by {asset.uploadedBy} · {asset.uploadedAt}</p>

          {/* Where used */}
          <div className="rounded-xl p-3.5" style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border)" }}>
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}><Link2 className="w-3.5 h-3.5" /> Where this is used</p>
            {usage.total === 0 ? (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Not used yet. Safe to edit or archive.</p>
            ) : (
              <div className="space-y-2">
                {usage.offers.length > 0 && (
                  <UsedList icon={Package} label="Offer groups" items={usage.offers.map(g => g.name)} />
                )}
                {usage.salesbooks.length > 0 && (
                  <UsedList icon={BookOpen} label="Salesbooks" items={usage.salesbooks.map(s => s.name)} />
                )}
                <p className="text-[10px] pt-1" style={{ color: "var(--text-muted)" }}>Editing this asset updates it everywhere it&apos;s used. Existing quotes keep their copied image.</p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-2">
              <button onClick={() => { archiveMediaAsset(asset.id); onChange(); onClose(); }} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}><Archive className="w-3.5 h-3.5" /> Archive</button>
              <button onClick={() => { if (confirm("Delete this asset?")) { deleteMediaAsset(asset.id); onChange(); onClose(); } }} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium" style={{ color: "#dc2626" }}><Trash2 className="w-3.5 h-3.5" /> Delete</button>
            </div>
            <button onClick={save} className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: "var(--accent-text)" }}>Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function UsedList({ icon: Icon, label, items }: { icon: typeof Package; label: string; items: string[] }) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-[11px] font-medium" style={{ color: "var(--text-secondary)" }}><Icon className="w-3.5 h-3.5" /> {label} ({items.length})</p>
      <ul className="mt-1 space-y-0.5">{items.map((n, i) => <li key={i} className="text-xs pl-5 truncate" style={{ color: "var(--text-muted)" }}>{n}</li>)}</ul>
    </div>
  );
}

// ─── Reusable picker (Offers + Salesbook) ─────────────────
export function MediaPickerModal({ onPick, onClose, allowUpload = true, title = "Choose from Media Library" }: {
  onPick: (asset: MediaAsset) => void; onClose: () => void; allowUpload?: boolean; title?: string;
}) {
  const [tick, setTick] = useState(0);
  const assets = useMemo(() => getMediaAssets(), [tick]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const filtered = assets.filter(a => {
    if (cat && a.category !== cat) return false;
    if (q) { const hay = `${a.name} ${a.brand ?? ""} ${a.tags.join(" ")}`.toLowerCase(); if (!hay.includes(q.toLowerCase())) return false; }
    return true;
  });

  function uploadAndPick(files: FileList | null) {
    const f = files?.[0]; if (!f || !f.type.startsWith("image/")) return;
    const r = new FileReader();
    r.onload = () => { if (typeof r.result === "string") { const a = addMediaAsset({ url: r.result, name: f.name.replace(/\.[^.]+$/, ""), category: "asset" }); setTick(t => t + 1); onPick(a); } };
    r.readAsDataURL(f);
  }

  return (
    <div className="fixed inset-0 z-[80] bg-black/45 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-3xl max-h-[88vh] flex flex-col rounded-2xl overflow-hidden" onClick={e => e.stopPropagation()} style={{ backgroundColor: "var(--bg-surface)", boxShadow: "0 24px 70px rgba(0,0,0,0.4)" }}>
        <div className="flex items-center justify-between px-5 py-3.5 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <p className="text-base font-semibold flex items-center gap-2" style={{ color: "var(--text-primary)" }}><ImageIcon className="w-4 h-4" style={{ color: "var(--accent-text)" }} /> {title}</p>
          <button onClick={onClose} style={{ color: "var(--text-muted)" }}><X className="w-5 h-5" /></button>
        </div>
        <div className="px-5 py-3 flex items-center gap-2 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search…" className="w-full rounded-lg pl-9 pr-3 py-2 text-sm outline-none" style={inpStyle} />
          </div>
          <div className="w-44"><UiSelect size="sm" value={cat} onChange={setCat} placeholder="All categories" options={[{ value: "", label: "All categories" }, ...MEDIA_CATEGORIES.map(c => ({ value: c, label: MEDIA_CATEGORY_LABELS[c] }))]} /></div>
          {allowUpload && (
            <>
              <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white shrink-0" style={{ backgroundColor: "var(--accent-text)" }}><Upload className="w-4 h-4" /> Upload</button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { uploadAndPick(e.target.files); e.target.value = ""; }} />
            </>
          )}
        </div>
        <div className="flex-1 overflow-y-auto thin-scroll-y p-5">
          {filtered.length === 0 ? (
            <p className="text-sm text-center py-10" style={{ color: "var(--text-muted)" }}>No assets — upload one to get started.</p>
          ) : (
            <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}>
              {filtered.map(a => (
                <button key={a.id} onClick={() => onPick(a)} className="rounded-xl overflow-hidden text-left transition-all hover:shadow-md" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.url} alt={a.altText ?? a.name} style={{ width: "100%", height: "100px", objectFit: "cover", display: "block" }} />
                  <div className="px-2 py-1.5">
                    <p className="text-[11px] font-medium truncate" style={{ color: "var(--text-primary)" }}>{a.name}</p>
                    <p className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>{MEDIA_CATEGORY_LABELS[a.category]}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── bits ─────────────────────────────────────────────────
const inp = "w-full rounded-lg px-3 py-2 text-sm outline-none";
const inpStyle: React.CSSProperties = { border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" };
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>{label}</label>{children}</div>;
}
