"use client";

// Content Blocks — reusable proposal wording (scopes, warranties, financing, terms,
// exclusions, approvals, value statements) inserted into salesbooks and copied into
// quotes. Master block → copied into salesbook → copied into quote (no live link).
//
// Exports:
//   • ContentBlocksSection — Settings page (summary + filters + list + edit + preview)
//   • ContentBlockPicker   — reusable "Add Content Block" (used by the Salesbook editor)

import { useMemo, useState } from "react";
import {
  FileText, Plus, Upload, Eye, Pencil, Copy, Archive, X, Search, Check, Link2,
} from "lucide-react";
import UiSelect from "@/components/ui/Select";
import { getCompanySalesbooks } from "@/lib/salesbooks/data";
import {
  getContentBlocks, getContentBlock, createContentBlock, updateContentBlock,
  duplicateContentBlock, archiveContentBlock,
  CONTENT_BLOCK_TYPE_LABELS, CONTENT_BLOCK_TYPES, INDUSTRY_LABELS,
  type ContentBlock, type ContentBlockType, type ContentBlockStatus, type SalesbookIndustry,
} from "@/lib/content-blocks/data";

// ─── Page ─────────────────────────────────────────────────
export default function ContentBlocksSection() {
  const [tick, setTick] = useState(0);
  const refresh = () => setTick(t => t + 1);
  const blocks = useMemo(() => getContentBlocks(), [tick]);
  const salesbooks = useMemo(() => getCompanySalesbooks(), [tick]);
  const usageCount = (id: string) => salesbooks.filter(sb => (sb.sectionLayout ?? []).some(s => s.contentBlockId === id)).length;

  const [q, setQ] = useState("");
  const [type, setType] = useState<string>("");
  const [industry, setIndustry] = useState<string>("");
  const [editId, setEditId] = useState<string | null>(null);    // "new" sentinel for create
  const [previewId, setPreviewId] = useState<string | null>(null);

  const filtered = blocks.filter(b => {
    if (type && b.type !== type) return false;
    if (industry && b.industry !== industry) return false;
    if (q) { const hay = `${b.name} ${b.text} ${b.tags.join(" ")} ${CONTENT_BLOCK_TYPE_LABELS[b.type]}`.toLowerCase(); if (!hay.includes(q.toLowerCase())) return false; }
    return true;
  });

  const scopes = blocks.filter(b => b.type === "scope_of_work").length;
  const termsWarranty = blocks.filter(b => b.type === "terms" || b.type === "warranty").length;
  const unused = blocks.filter(b => usageCount(b.id) === 0).length;

  const editBlock = editId === "new" ? null : (editId ? getContentBlock(editId) : undefined);
  const previewBlock = blocks.find(b => b.id === previewId) ?? null;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-base font-semibold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <FileText className="w-4.5 h-4.5" style={{ color: "var(--accent-text)" }} /> Content Blocks
          </h3>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>Reusable proposal wording for scopes, warranties, financing, terms, exclusions, and approvals.</p>
        </div>
        <div className="flex items-center gap-2">
          <button disabled className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium opacity-50" style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}><Upload className="w-4 h-4" /> Import Blocks</button>
          <button onClick={() => setEditId("new")} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: "var(--accent-text)" }}><Plus className="w-4 h-4" /> Create Block</button>
        </div>
      </div>

      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
        <SummaryCard label="Active Blocks" value={blocks.length} />
        <SummaryCard label="Scopes" value={scopes} />
        <SummaryCard label="Terms / Warranty" value={termsWarranty} />
        <SummaryCard label="Unused Blocks" value={unused} warn />
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search wording, names, tags…" className="w-full rounded-lg pl-9 pr-3 py-2 text-sm outline-none" style={inpStyle} />
        </div>
        <div className="w-48"><UiSelect size="sm" value={type} onChange={setType} placeholder="All types" options={[{ value: "", label: "All types" }, ...CONTENT_BLOCK_TYPES.map(t => ({ value: t, label: CONTENT_BLOCK_TYPE_LABELS[t] }))]} /></div>
        <div className="w-40"><UiSelect size="sm" value={industry} onChange={setIndustry} placeholder="All industries" options={[{ value: "", label: "All industries" }, ...(Object.keys(INDUSTRY_LABELS) as SalesbookIndustry[]).map(k => ({ value: k, label: INDUSTRY_LABELS[k] }))]} /></div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl py-14 text-center" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
          <FileText className="w-8 h-8 mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
          <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>No content blocks match</p>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Create one or adjust your filters.</p>
        </div>
      ) : (
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
          {filtered.map(b => (
            <BlockCard key={b.id} b={b} usedIn={usageCount(b.id)}
              onEdit={() => setEditId(b.id)} onPreview={() => setPreviewId(b.id)}
              onDuplicate={() => { duplicateContentBlock(b.id); refresh(); }}
              onArchive={() => { archiveContentBlock(b.id); refresh(); }} />
          ))}
        </div>
      )}

      {(editId === "new" || editBlock) && (
        <BlockEditModal block={editBlock ?? null} onClose={() => setEditId(null)} onSaved={() => { setEditId(null); refresh(); }} />
      )}
      {previewBlock && (
        <BlockPreviewModal block={previewBlock} usedIn={usageCount(previewBlock.id)}
          onClose={() => setPreviewId(null)} onEdit={() => { setPreviewId(null); setEditId(previewBlock.id); }}
          onDuplicate={() => { duplicateContentBlock(previewBlock.id); setPreviewId(null); refresh(); }} />
      )}
    </div>
  );
}

function SummaryCard({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  const danger = warn && value > 0;
  return (
    <div className="rounded-xl p-3.5" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
      <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>{label}</p>
      <p className="text-2xl font-bold mt-1" style={{ color: danger ? "#b45309" : "var(--text-primary)" }}>{value}</p>
    </div>
  );
}

function BlockCard({ b, usedIn, onEdit, onPreview, onDuplicate, onArchive }: {
  b: ContentBlock; usedIn: number; onEdit: () => void; onPreview: () => void; onDuplicate: () => void; onArchive: () => void;
}) {
  return (
    <div className="rounded-xl p-4 flex flex-col" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold leading-snug" style={{ color: "var(--text-primary)" }}>{b.name}</p>
      </div>
      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--accent-soft-bg)", color: "var(--accent-text)" }}>{CONTENT_BLOCK_TYPE_LABELS[b.type]}</span>
        {b.industry && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>{INDUSTRY_LABELS[b.industry]}</span>}
      </div>
      <p className="text-xs mt-2 leading-relaxed flex-1" style={{ color: "var(--text-secondary)", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{b.text}</p>
      <div className="flex items-center justify-between mt-3">
        <span className="text-[11px]" style={{ color: usedIn > 0 ? "var(--accent-text)" : "var(--text-muted)" }}>{usedIn > 0 ? `In ${usedIn} salesbook${usedIn === 1 ? "" : "s"}` : "Unused"}</span>
        <div className="flex items-center gap-1">
          <button onClick={onEdit} title="Edit" className="p-1.5 rounded-lg" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}><Pencil className="w-3.5 h-3.5" /></button>
          <button onClick={onPreview} title="Preview" className="p-1.5 rounded-lg" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}><Eye className="w-3.5 h-3.5" /></button>
          <button onClick={onDuplicate} title="Duplicate" className="p-1.5 rounded-lg" style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}><Copy className="w-3.5 h-3.5" /></button>
          <button onClick={onArchive} title="Archive" className="p-1.5 rounded-lg" style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}><Archive className="w-3.5 h-3.5" /></button>
        </div>
      </div>
    </div>
  );
}

// ─── Create / Edit ────────────────────────────────────────
function BlockEditModal({ block, onClose, onSaved }: { block: ContentBlock | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(block?.name ?? "");
  const [type, setType] = useState<ContentBlockType>(block?.type ?? "scope_of_work");
  const [industry, setIndustry] = useState<string>(block?.industry ?? "");
  const [category, setCategory] = useState(block?.category ?? "");
  const [description, setDescription] = useState(block?.description ?? "");
  const [text, setText] = useState(block?.text ?? "");
  const [tags, setTags] = useState((block?.tags ?? []).join(", "));
  const [status, setStatus] = useState<ContentBlockStatus>(block?.status ?? "active");

  function save() {
    const patch = {
      name: name.trim() || "Untitled block", type, industry: (industry || undefined) as SalesbookIndustry | undefined,
      category: category || undefined, description: description || undefined, text,
      tags: tags.split(",").map(t => t.trim()).filter(Boolean), status,
    };
    if (block) updateContentBlock(block.id, patch); else createContentBlock(patch);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-[80] bg-black/45 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl overflow-hidden" onClick={e => e.stopPropagation()} style={{ backgroundColor: "var(--bg-surface)", boxShadow: "0 24px 70px rgba(0,0,0,0.4)" }}>
        <div className="flex items-center justify-between px-5 py-3.5 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <p className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>{block ? "Edit Content Block" : "Create Content Block"}</p>
          <button onClick={onClose} style={{ color: "var(--text-muted)" }}><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto thin-scroll-y p-5 space-y-4">
          <Field label="Block name *"><input value={name} onChange={e => setName(e.target.value)} className={inp} style={inpStyle} placeholder="e.g. HVAC System Replacement Scope" /></Field>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Block type"><UiSelect value={type} onChange={v => setType(v as ContentBlockType)} options={CONTENT_BLOCK_TYPES.map(t => ({ value: t, label: CONTENT_BLOCK_TYPE_LABELS[t] }))} /></Field>
            <Field label="Industry"><UiSelect value={industry} onChange={setIndustry} placeholder="Any industry" options={[{ value: "", label: "Any industry" }, ...(Object.keys(INDUSTRY_LABELS) as SalesbookIndustry[]).map(k => ({ value: k, label: INDUSTRY_LABELS[k] }))]} /></Field>
            <Field label="Category"><input value={category} onChange={e => setCategory(e.target.value)} className={inp} style={inpStyle} placeholder="optional" /></Field>
            <Field label="Status"><UiSelect value={status} onChange={v => setStatus(v as ContentBlockStatus)} options={[{ value: "active", label: "Active" }, { value: "archived", label: "Archived" }]} /></Field>
          </div>
          <Field label="Short description"><input value={description} onChange={e => setDescription(e.target.value)} className={inp} style={inpStyle} placeholder="What this block is for" /></Field>
          <Field label="Default text *">
            <MiniEditor value={text} onChange={setText} />
            <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>Tip: start a line with “• ” for a bullet. Merge fields like {"{{customer_name}}"} are supported in wording (resolved at quote time, later).</p>
          </Field>
          <Field label="Tags (comma separated)"><input value={tags} onChange={e => setTags(e.target.value)} className={inp} style={inpStyle} /></Field>
        </div>
        <div className="px-5 py-3.5 flex justify-end gap-2 shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
          <button onClick={onClose} className="px-3 py-2 rounded-lg text-sm" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
          <button onClick={save} className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: "var(--accent-text)" }}>{block ? "Save" : "Create"}</button>
        </div>
      </div>
    </div>
  );
}

// Lightweight "editor": a textarea with a couple of insert helpers (kept simple).
function MiniEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  function wrap(before: string, after = before) {
    onChange(value + (value && !value.endsWith("\n") ? "\n" : "") + before + "text" + after);
  }
  return (
    <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
      <div className="flex items-center gap-1 px-2 py-1.5" style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)" }}>
        <ToolBtn label="H" title="Heading line" onClick={() => onChange(value + (value && !value.endsWith("\n") ? "\n" : "") + "## Heading")} bold />
        <ToolBtn label="B" title="Bold" onClick={() => wrap("**")} bold />
        <ToolBtn label="i" title="Italic" onClick={() => wrap("*")} italic />
        <ToolBtn label="• List" title="Bullet item" onClick={() => onChange(value + (value && !value.endsWith("\n") ? "\n" : "") + "• item")} />
        <ToolBtn label="1. List" title="Numbered item" onClick={() => onChange(value + (value && !value.endsWith("\n") ? "\n" : "") + "1. item")} />
      </div>
      <textarea value={value} onChange={e => onChange(e.target.value)} rows={7} className="w-full px-3 py-2 text-sm outline-none resize-y" style={{ backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} placeholder="Write the reusable wording…" />
    </div>
  );
}
function ToolBtn({ label, title, onClick, bold, italic }: { label: string; title: string; onClick: () => void; bold?: boolean; italic?: boolean }) {
  return <button onClick={onClick} title={title} className="px-1.5 py-0.5 rounded text-xs hover:bg-[var(--bg-input)]" style={{ color: "var(--text-secondary)", fontWeight: bold ? 700 : 400, fontStyle: italic ? "italic" : "normal" }}>{label}</button>;
}

// ─── Preview ──────────────────────────────────────────────
function BlockPreviewModal({ block, usedIn, onClose, onEdit, onDuplicate }: {
  block: ContentBlock; usedIn: number; onClose: () => void; onEdit: () => void; onDuplicate: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[80] bg-black/45 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-xl max-h-[88vh] flex flex-col rounded-2xl overflow-hidden" onClick={e => e.stopPropagation()} style={{ backgroundColor: "var(--bg-surface)", boxShadow: "0 24px 70px rgba(0,0,0,0.4)" }}>
        <div className="flex items-center justify-between px-5 py-3.5 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="min-w-0">
            <p className="text-base font-semibold truncate" style={{ color: "var(--text-primary)" }}>{block.name}</p>
            <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>{CONTENT_BLOCK_TYPE_LABELS[block.type]}{block.industry ? ` · ${INDUSTRY_LABELS[block.industry]}` : ""}</p>
          </div>
          <button onClick={onClose} style={{ color: "var(--text-muted)" }}><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto thin-scroll-y p-5">
          <div className="rounded-xl p-4" style={{ backgroundColor: "#fff", border: "1px solid var(--border)" }}>
            <RenderedText text={block.text} />
          </div>
          <p className="flex items-center gap-1.5 text-[11px] mt-3" style={{ color: "var(--text-muted)" }}><Link2 className="w-3.5 h-3.5" /> {usedIn > 0 ? `Used in ${usedIn} salesbook${usedIn === 1 ? "" : "s"}` : "Not used in any salesbook yet"}</p>
        </div>
        <div className="px-5 py-3.5 flex justify-end gap-2 shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
          <button onClick={onDuplicate} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}><Copy className="w-4 h-4" /> Duplicate</button>
          <button onClick={onEdit} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: "var(--accent-text)" }}><Pencil className="w-4 h-4" /> Edit</button>
        </div>
      </div>
    </div>
  );
}

// Render plain text: ## headings, • bullets, 1. numbered, **bold**, paragraphs.
export function RenderedText({ text }: { text: string }) {
  const lines = text.split("\n");
  const out: React.ReactNode[] = [];
  let list: string[] = [];
  const flush = (key: string) => { if (list.length) { out.push(<ul key={key} style={{ margin: "4px 0 8px", paddingLeft: "18px", color: "#374151", fontSize: "13px", lineHeight: 1.6 }}>{list.map((l, i) => <li key={i}>{inline(l)}</li>)}</ul>); list = []; } };
  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (line.startsWith("• ") || line.startsWith("- ")) { list.push(line.slice(2)); return; }
    if (/^\d+\.\s/.test(line)) { list.push(line.replace(/^\d+\.\s/, "")); return; }
    flush(`l${i}`);
    if (!line) return;
    if (line.startsWith("## ")) { out.push(<p key={i} style={{ fontSize: "14px", fontWeight: 700, color: "#111827", margin: "10px 0 4px" }}>{line.slice(3)}</p>); return; }
    out.push(<p key={i} style={{ fontSize: "13px", color: "#374151", lineHeight: 1.6, margin: "0 0 8px" }}>{inline(line)}</p>);
  });
  flush("last");
  return <div>{out}</div>;
}
function inline(s: string): React.ReactNode {
  // Minimal **bold** support.
  const parts = s.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => p.startsWith("**") && p.endsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>);
}

// ─── Reusable picker (Salesbook "Add Content Block") ──────
export function ContentBlockPicker({ filterType, onPick, onClose }: {
  filterType?: ContentBlockType; onPick: (b: ContentBlock) => void; onClose: () => void;
}) {
  const [tick, setTick] = useState(0);
  const blocks = useMemo(() => getContentBlocks(), [tick]);
  const [q, setQ] = useState("");
  const [type, setType] = useState<string>(filterType ?? "");
  const [creating, setCreating] = useState(false);

  const filtered = blocks.filter(b => {
    if (type && b.type !== type) return false;
    if (q) { const hay = `${b.name} ${b.text} ${b.tags.join(" ")}`.toLowerCase(); if (!hay.includes(q.toLowerCase())) return false; }
    return true;
  });

  return (
    <div className="fixed inset-0 z-[80] bg-black/45 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-3xl max-h-[88vh] flex flex-col rounded-2xl overflow-hidden" onClick={e => e.stopPropagation()} style={{ backgroundColor: "var(--bg-surface)", boxShadow: "0 24px 70px rgba(0,0,0,0.4)" }}>
        <div className="flex items-center justify-between px-5 py-3.5 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <p className="text-base font-semibold flex items-center gap-2" style={{ color: "var(--text-primary)" }}><FileText className="w-4 h-4" style={{ color: "var(--accent-text)" }} /> Add Content Block</p>
          <button onClick={onClose} style={{ color: "var(--text-muted)" }}><X className="w-5 h-5" /></button>
        </div>
        <div className="px-5 py-3 flex items-center gap-2 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="relative flex-1"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search blocks…" className="w-full rounded-lg pl-9 pr-3 py-2 text-sm outline-none" style={inpStyle} /></div>
          <div className="w-48"><UiSelect size="sm" value={type} onChange={setType} placeholder="All types" options={[{ value: "", label: "All types" }, ...CONTENT_BLOCK_TYPES.map(t => ({ value: t, label: CONTENT_BLOCK_TYPE_LABELS[t] }))]} /></div>
          <button onClick={() => setCreating(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white shrink-0" style={{ backgroundColor: "var(--accent-text)" }}><Plus className="w-4 h-4" /> New</button>
        </div>
        <div className="flex-1 overflow-y-auto thin-scroll-y p-5">
          {filtered.length === 0 ? <p className="text-sm text-center py-10" style={{ color: "var(--text-muted)" }}>No blocks — create one with “New”.</p> : (
            <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
              {filtered.map(b => (
                <div key={b.id} className="rounded-xl p-3.5 flex flex-col" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
                  <div className="flex items-center gap-1.5 flex-wrap"><p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{b.name}</p></div>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded w-fit mt-1" style={{ backgroundColor: "var(--accent-soft-bg)", color: "var(--accent-text)" }}>{CONTENT_BLOCK_TYPE_LABELS[b.type]}</span>
                  <p className="text-[11px] mt-1.5 leading-snug flex-1" style={{ color: "var(--text-muted)", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{b.text}</p>
                  <button onClick={() => onPick(b)} className="mt-2 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: "var(--accent-text)" }}><Check className="w-3.5 h-3.5" /> Insert</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {creating && <BlockEditModal block={null} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); setTick(t => t + 1); }} />}
    </div>
  );
}

// ─── bits ─────────────────────────────────────────────────
const inp = "w-full rounded-lg px-3 py-2 text-sm outline-none";
const inpStyle: React.CSSProperties = { border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" };
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>{label}</label>{children}</div>;
}
