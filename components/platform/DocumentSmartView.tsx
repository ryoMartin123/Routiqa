"use client";

// ─── Documents · generic smart view ───────────────────────
// The left sidebar sections (SOPs, Policies, Training, Templates, HR/Sales/
// Safety/System/Vendor/Subcontractor Documents, Archived) are SMART VIEWS over
// the same documents — filtered by metadata, not folder shortcuts. One component,
// configured per section. Company Library keeps the folder explorer.
// Accent = the Documents app icon color.

import { useMemo, useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Plus, Search, SlidersHorizontal, X, FolderInput, Copy, Archive, ExternalLink,
  FileText, ShieldCheck, FileClock, CheckCircle2, GraduationCap, Eye, User, Clock, Shield, Tag, BadgeCheck,
} from "lucide-react";
import UiSelect from "@/components/ui/Select";
import { PageHeader, StatCard } from "@/components/platform/ui";
import { appById } from "@/lib/platform/apps";
import { DOC_TYPE_ICON } from "@/components/platform/DocumentsExplorer";
import {
  documentsWhere, archivedDocuments, docCategory, categoriesInUse, folderPath, getFolders,
  getDocument, createDocument, duplicateDocument, archiveDocument, updateDocument,
  STATUS_COLOR, VIS_COLOR, LINKED_APP_COLOR, DOC_STATUSES, DOC_VISIBILITIES,
  type DocItem, type DocType, type DocStatus, type DocVisibility,
} from "@/lib/documents/mock";

const ACCENT = appById("documents")?.accent ?? "#f59e0b";
const inp = "w-full rounded-lg px-3 py-2 text-sm outline-none";
const inpStyle: React.CSSProperties = { border: "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)", color: "var(--text-primary)" };

export interface SmartViewConfig {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  filter: (d: DocItem) => boolean;
  createType: DocType;
  createLabel: string;
  defaultFolderId?: string;
  reviewColumn?: boolean;       // show Review Date (SOPs)
  ackColumn?: boolean;          // show Acknowledgement (Policies / HR)
  trainingColumn?: boolean;     // show Training Required (Training)
  restricted?: boolean;         // mark confidential placeholder (HR)
  archivedView?: boolean;       // pull archived docs, hide create
  extraActions?: string[];      // placeholder action labels (alert on click)
}

export default function DocumentSmartView({ config }: { config: SmartViewConfig }) {
  const [tick, setTick] = useState(0);
  const refresh = () => setTick(t => t + 1);
  const [search, setSearch] = useState("");
  const [fStatus, setFStatus] = useState("all");
  const [fCategory, setFCategory] = useState("all");
  const [fVis, setFVis] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const all = useMemo(() => config.archivedView ? archivedDocuments() : documentsWhere(config.filter), [config, tick]);
  const categories = useMemo(() => categoriesInUse(all), [all]);

  const s = search.trim().toLowerCase();
  const docs = all.filter(d => {
    if (s && !`${d.title} ${d.tags.join(" ")} ${d.owner} ${docCategory(d)}`.toLowerCase().includes(s)) return false;
    if (fStatus !== "all" && d.status !== fStatus) return false;
    if (fCategory !== "all" && docCategory(d) !== fCategory) return false;
    if (fVis !== "all" && d.visibility !== fVis) return false;
    return true;
  });
  const activeFilters = [fStatus !== "all", fCategory !== "all", fVis !== "all"].filter(Boolean).length;

  const published = all.filter(d => d.status === "Published").length;
  const review = all.filter(d => d.status === "In Review" || d.status === "Draft").length;
  const open = openId ? getDocument(openId) : null;

  // Columns are configurable per view.
  const cols = ["2fr", "1fr", "0.9fr", config.reviewColumn ? "0.9fr" : null, "0.9fr", "1fr", "0.9fr", config.ackColumn || config.trainingColumn ? "0.8fr" : null, "0.9fr"]
    .filter(Boolean).join(" ");

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0"><PageHeader title={config.title} subtitle={config.subtitle} icon={config.icon} accent={ACCENT} /></div>
        <div className="flex items-center gap-2 shrink-0">
          {(config.extraActions ?? []).map(a => (
            <button key={a} onClick={() => alert(`${a} — coming soon`)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>{a}</button>
          ))}
          {!config.archivedView && (
            <button onClick={() => setCreating(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white hover:brightness-110" style={{ backgroundColor: ACCENT }}><Plus className="w-4 h-4" /> {config.createLabel}</button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
        <StatCard label={config.title} value={String(all.length)} hint="Total documents" icon={config.icon} accent={ACCENT} />
        <StatCard label="Published" value={String(published)} hint="Live & current" icon={CheckCircle2} accent="#10b981" />
        <StatCard label="Needs Review" value={String(review)} hint="Draft / in review" icon={FileClock} accent="#f59e0b" />
        {config.ackColumn && <StatCard label="Requires Ack." value={String(all.filter(d => d.requiresAcknowledgement).length)} hint="Acknowledgement" icon={BadgeCheck} accent="#0ea5e9" />}
        {config.trainingColumn && <StatCard label="Required Training" value={String(all.filter(d => d.trainingRequired).length)} hint="Assigned learning" icon={GraduationCap} accent="#0ea5e9" />}
        {!config.ackColumn && !config.trainingColumn && <StatCard label="Categories" value={String(categories.length)} hint="Departments" icon={ShieldCheck} accent="#0ea5e9" />}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 rounded-lg px-3 py-1.5" style={{ backgroundColor: "var(--bg-input)" }}>
          <Search className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={`Search ${config.title.toLowerCase()}...`} className="bg-transparent text-sm outline-none w-52" style={{ color: "var(--text-primary)" }} />
        </div>
        <div className="relative">
          <button onClick={() => setFiltersOpen(o => !o)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors"
            style={{ border: `1px solid ${activeFilters ? ACCENT + "66" : "var(--border)"}`, backgroundColor: activeFilters ? ACCENT + "14" : "var(--bg-surface)", color: activeFilters ? ACCENT : "var(--text-secondary)" }}>
            <SlidersHorizontal className="w-3.5 h-3.5" /> Filter{activeFilters > 0 && <span className="text-[10px] font-bold px-1.5 rounded-full" style={{ backgroundColor: ACCENT + "26", color: ACCENT }}>{activeFilters}</span>}
          </button>
          {filtersOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setFiltersOpen(false)} />
              <div className="absolute right-0 top-full mt-2 z-50 rounded-xl p-4 w-64 space-y-2.5" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 12px 32px rgba(0,0,0,0.18)" }}>
                <div className="flex items-center justify-between"><p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Filters</p>{activeFilters > 0 && <button onClick={() => { setFStatus("all"); setFCategory("all"); setFVis("all"); }} className="text-xs" style={{ color: ACCENT }}>Clear</button>}</div>
                <FF label="Status"><UiSelect size="sm" value={fStatus} onChange={setFStatus} options={[{ value: "all", label: "Any status" }, ...DOC_STATUSES.map(x => ({ value: x, label: x }))]} /></FF>
                <FF label="Category / Department"><UiSelect size="sm" value={fCategory} onChange={setFCategory} options={[{ value: "all", label: "Any category" }, ...categories.map(c => ({ value: c, label: c }))]} /></FF>
                <FF label="Visibility"><UiSelect size="sm" value={fVis} onChange={setFVis} options={[{ value: "all", label: "Any visibility" }, ...DOC_VISIBILITIES.map(x => ({ value: x, label: x }))]} /></FF>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
        <div className="overflow-x-auto thin-scroll-x">
          <div style={{ minWidth: 920 }}>
            <div className="grid px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider items-center" style={{ gridTemplateColumns: cols, gap: "0.75rem", color: "var(--text-muted)", borderBottom: "1px solid var(--border)", backgroundColor: "transparent" }}>
              <span>Name</span><span>Category</span><span>Status</span>{config.reviewColumn && <span>Review</span>}<span>Owner</span><span>Linked App</span><span>Visibility</span>{(config.ackColumn || config.trainingColumn) && <span>{config.ackColumn ? "Ack." : "Required"}</span>}<span>Updated</span>
            </div>
            {docs.length === 0 ? (
              <div className="py-14 text-center"><p className="text-sm" style={{ color: "var(--text-muted)" }}>No documents match.</p></div>
            ) : docs.map((d, i) => {
              const Icon = DOC_TYPE_ICON[d.type] ?? FileText;
              return (
                <button key={d.id} onClick={() => setOpenId(d.id)} className="w-full grid px-4 py-3 items-center text-left transition-colors hover:bg-[var(--bg-surface-2)]"
                  style={{ gridTemplateColumns: cols, gap: "0.75rem", borderBottom: i < docs.length - 1 ? "1px solid var(--border)" : "none", backgroundColor: openId === d.id ? ACCENT + "14" : "transparent" }}>
                  <span className="flex items-center gap-2 min-w-0">
                    <Icon className="w-4 h-4 shrink-0" style={{ color: ACCENT }} />
                    <span className="text-sm truncate" style={{ color: "var(--text-primary)" }}>{d.title}</span>
                    {config.restricted && d.visibility !== "Everyone" && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded shrink-0" style={{ backgroundColor: "#fee2e2", color: "#991b1b" }}>Restricted</span>}
                  </span>
                  <span className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>{docCategory(d)}</span>
                  <Chip color={STATUS_COLOR[d.status]}>{d.status}</Chip>
                  {config.reviewColumn && <span className="text-xs" style={{ color: "var(--text-muted)" }}>{d.reviewDate ?? "—"}</span>}
                  <span className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>{d.owner}</span>
                  <span>{d.linkedApp ? <Chip color={LINKED_APP_COLOR[d.linkedApp]}>{d.linkedApp}</Chip> : <span className="text-xs" style={{ color: "var(--text-muted)" }}>—</span>}</span>
                  <Chip color={VIS_COLOR[d.visibility]}>{d.visibility}</Chip>
                  {config.ackColumn && <span>{d.requiresAcknowledgement ? <Chip color="#0ea5e9">Required</Chip> : <span className="text-xs" style={{ color: "var(--text-muted)" }}>—</span>}</span>}
                  {config.trainingColumn && !config.ackColumn && <span>{d.trainingRequired ? <Chip color="#0ea5e9">Required</Chip> : <span className="text-xs" style={{ color: "var(--text-muted)" }}>Optional</span>}</span>}
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>{d.updated}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {open && <DocDrawer doc={open} config={config} onClose={() => setOpenId(null)}
        onDuplicate={() => { const c = duplicateDocument(open.id); refresh(); if (c) setOpenId(c.id); }}
        onArchive={() => { if (open.status === "Archived" || open.archived) { updateDocument(open.id, { status: "Draft", archived: false }); } else { archiveDocument(open.id); } setOpenId(null); refresh(); }} />}
      {creating && <CreateDocModal config={config} onClose={() => setCreating(false)} onCreated={(d) => { setCreating(false); refresh(); setOpenId(d.id); }} />}
    </div>
  );
}

// ─── Detail drawer ────────────────────────────────────────
function DocDrawer({ doc, config, onClose, onDuplicate, onArchive }: { doc: DocItem; config: SmartViewConfig; onClose: () => void; onDuplicate: () => void; onArchive: () => void }) {
  const Icon = DOC_TYPE_ICON[doc.type] ?? FileText;
  const isArch = doc.status === "Archived" || doc.archived;
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative h-full w-full max-w-md flex flex-col" style={{ backgroundColor: "var(--bg-surface)", borderLeft: "1px solid var(--border)", boxShadow: "-16px 0 48px -12px rgba(0,0,0,0.3)" }}>
        <div className="px-5 py-4 flex items-center justify-between gap-2 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2 min-w-0"><Icon className="w-5 h-5 shrink-0" style={{ color: ACCENT }} /><p className="text-base font-semibold truncate" style={{ color: "var(--text-primary)" }}>{doc.title}</p></div>
          <button onClick={onClose} style={{ color: "var(--text-muted)" }}><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <div className="rounded-lg mb-4 flex items-center justify-center" style={{ height: 140, backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border)" }}>
            <div className="text-center px-4"><Icon className="w-6 h-6 mx-auto mb-1" style={{ color: ACCENT }} /><p className="text-xs" style={{ color: "var(--text-muted)" }}>{doc.body ? `${doc.body.slice(0, 80)}${doc.body.length > 80 ? "…" : ""}` : `${doc.type} preview`}</p></div>
          </div>
          <dl className="space-y-3">
            <Row icon={Tag} label="Type"><span style={{ color: "var(--text-secondary)" }}>{doc.type}</span></Row>
            <Row icon={FolderInput} label="Category"><span style={{ color: "var(--text-secondary)" }}>{docCategory(doc)}</span></Row>
            <Row icon={Shield} label="Status"><Chip color={STATUS_COLOR[doc.status]}>{doc.status}</Chip></Row>
            <Row icon={Eye} label="Visibility"><Chip color={VIS_COLOR[doc.visibility]}>{doc.visibility}</Chip></Row>
            <Row icon={User} label="Owner"><span style={{ color: "var(--text-secondary)" }}>{doc.owner}</span></Row>
            {doc.reviewDate && <Row icon={Clock} label="Review date"><span style={{ color: "var(--text-secondary)" }}>{doc.reviewDate}</span></Row>}
            {doc.requiresAcknowledgement && <Row icon={BadgeCheck} label="Acknowledgement"><Chip color="#0ea5e9">Required</Chip></Row>}
            {doc.trainingRequired && <Row icon={GraduationCap} label="Training"><Chip color="#0ea5e9">Required</Chip></Row>}
            <Row icon={FileText} label="Folder"><span className="text-xs text-right" style={{ color: "var(--text-secondary)" }}>{folderPath(doc.folderId).map(f => f.name).join(" / ")}</span></Row>
          </dl>
          {doc.linkedRecords && doc.linkedRecords.length > 0 && (
            <div className="mt-4"><p className="text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: "var(--text-muted)" }}>Linked Records</p><div className="flex flex-wrap gap-1.5">{doc.linkedRecords.map((r, i) => <Chip key={i} color={LINKED_APP_COLOR[r.app]}>{r.label}</Chip>)}</div></div>
          )}
          {(config.ackColumn || config.trainingColumn) && <p className="text-[11px] mt-4 rounded-lg px-3 py-2" style={{ backgroundColor: "var(--bg-surface-2)", color: "var(--text-muted)" }}>{config.ackColumn ? "Acknowledgement tracking" : "Training assignment & completion"} lands in a later phase (My Portal).</p>}
        </div>
        <div className="px-5 py-3 grid grid-cols-3 gap-2 shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
          <Link href="/documents/library" className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm text-white col-span-1" style={{ backgroundColor: ACCENT }}><ExternalLink className="w-3.5 h-3.5" /> Open</Link>
          <button onClick={onDuplicate} className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}><Copy className="w-3.5 h-3.5" /> Duplicate</button>
          <button onClick={onArchive} className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm" style={{ border: "1px solid var(--border)", color: isArch ? "#10b981" : "#dc2626" }}><Archive className="w-3.5 h-3.5" /> {isArch ? "Restore" : "Archive"}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Create (prefilled type) ──────────────────────────────
function CreateDocModal({ config, onClose, onCreated }: { config: SmartViewConfig; onClose: () => void; onCreated: (d: DocItem) => void }) {
  const folders = getFolders();
  const [title, setTitle] = useState("");
  const [folder, setFolder] = useState(config.defaultFolderId ?? folders[0]?.id ?? "");
  const [status, setStatus] = useState<DocStatus>("Draft");
  const [visibility, setVisibility] = useState<DocVisibility>("Everyone");
  function save() {
    if (!title.trim()) return;
    const d = createDocument({ title, folderId: folder, type: config.createType, status, visibility });
    onCreated(d);
  }
  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()} style={{ backgroundColor: "var(--bg-surface)", boxShadow: "0 16px 48px rgba(0,0,0,0.24)" }}>
        <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}><p className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>{config.createLabel}</p><button onClick={onClose} style={{ color: "var(--text-muted)" }}><X className="w-4 h-4" /></button></div>
        <div className="p-5 space-y-3">
          <F label="Title"><input value={title} onChange={e => setTitle(e.target.value)} className={inp} style={inpStyle} autoFocus /></F>
          <F label={`Type`}><div className="px-3 py-2 rounded-lg text-sm" style={{ ...inpStyle, color: "var(--text-secondary)" }}>{config.createType}</div></F>
          <F label="Folder"><UiSelect value={folder} onChange={setFolder} options={folders.map(f => ({ value: f.id, label: folderPath(f.id).map(x => x.name).join(" / ") }))} /></F>
          <div className="grid grid-cols-2 gap-3">
            <F label="Status"><UiSelect value={status} onChange={v => setStatus(v as DocStatus)} options={DOC_STATUSES.filter(x => x !== "Archived").map(x => ({ value: x, label: x }))} /></F>
            <F label="Visibility"><UiSelect value={visibility} onChange={v => setVisibility(v as DocVisibility)} options={DOC_VISIBILITIES.map(x => ({ value: x, label: x }))} /></F>
          </div>
        </div>
        <div className="px-5 py-3 flex items-center justify-end gap-2 shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
          <button onClick={onClose} className="text-sm font-medium px-3 py-2 rounded-lg" style={{ color: "var(--text-secondary)" }}>Cancel</button>
          <button onClick={save} className="text-sm font-medium px-4 py-2 rounded-lg text-white" style={{ backgroundColor: ACCENT }}>Create</button>
        </div>
      </div>
    </div>
  );
}

function Chip({ children, color }: { children: React.ReactNode; color: string }) {
  return <span className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap w-fit" style={{ backgroundColor: color + "22", color }}>{children}</span>;
}
function Row({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-2"><span className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}><Icon className="w-3.5 h-3.5" /> {label}</span>{children}</div>;
}
function FF({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>{label}</label>{children}</div>;
}
function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>{label}</label>{children}</div>;
}
