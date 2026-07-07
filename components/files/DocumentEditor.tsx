"use client";

// ─── Document editor — free-form canvas ───────────────────
// The "note" grown into a document: a full-screen pannable/zoomable canvas with
// the SAME view mechanics as the work-order template canvas (space-pan, ⌘-scroll
// zoom, bottom zoom bar, fit-to-view on load). A document is one or more PAGES —
// each page is a movable, resizable container whose blocks (headings, text,
// bullet lists, checklists, callouts, dividers, images) stack inside it.
// Saving files the document into Photos & Files (category "documents"), so
// notes and files live together.

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ArrowLeft, Heading2, Type, List, ListChecks, Megaphone, Minus, ImagePlus,
  Trash2, ChevronUp, ChevronDown, FileText, Plus, Maximize, GripVertical, FilePlus2, Sparkles,
} from "lucide-react";
import { addFile, type FileScope } from "@/lib/files/data";
import { pingSaved } from "@/components/shared/SavedPill";
import { recordUsage } from "@/lib/usage/data";

type BlockType = "heading" | "text" | "bullets" | "checklist" | "callout" | "divider" | "image";
// Content lives INSIDE page containers as stacked lists of segments —
// the canvas pans/zooms around the pages, not around loose boxes.
// Images are saved as their own gallery file records — the segment persists only
// the fileId reference; src is the session-only preview (never written to storage).
interface DocSegment { id: string; type: BlockType; text: string; src?: string; fileId?: string }
// A page owns its canvas position and width so layouts survive reopening.
export interface DocPage { id: string; x: number; y: number; width: number; height?: number; segments: DocSegment[] }
export interface DocContent { version: 3; pages: DocPage[] }

const DEFAULT_W = 680;
const MIN_W = 440;
const MAX_W = 1080;
const MIN_H = 420;
const MAX_H = 1600;
const PAGE_GAP = 48;

// Full content per saved document file, so documents can be reopened later.
// v1 stored a flat segment array (single implicit page) — migrate on read.
const DOC_KEY = "crm-doc-contents";
export function getDocumentContent(fileId: string): DocContent | null {
  try {
    const raw = JSON.parse(localStorage.getItem(DOC_KEY) || "{}")[fileId];
    if (!raw) return null;
    // v1: flat segment array (single implicit page). v2: pages with embedded
    // image dataURLs. v3: pages with image fileId references. Fields are
    // forward-compatible, so older shapes just re-wrap.
    if (Array.isArray(raw)) return { version: 3, pages: [{ id: "p-legacy", x: 0, y: 0, width: DEFAULT_W, segments: raw }] };
    return { ...(raw as DocContent), version: 3 };
  } catch { return null; }
}
function saveDocumentContent(fileId: string, content: DocContent): void {
  try {
    const all = JSON.parse(localStorage.getItem(DOC_KEY) || "{}");
    all[fileId] = content;
    localStorage.setItem(DOC_KEY, JSON.stringify(all));
  } catch { /* ignore */ }
}

const bid = () => `db-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const newPage = (x: number, y: number): DocPage =>
  ({ id: bid(), x, y, width: DEFAULT_W, segments: [{ id: bid(), type: "text", text: "" }] });

// Riq's output is markdown-lite (see /api/ai/write SYSTEM) — parse it into
// the same segment blocks a user would build by hand.
function parseRiqText(md: string): DocSegment[] {
  const segs: DocSegment[] = [];
  let buf: string[] = [];
  let bufType: "text" | "bullets" | "checklist" = "text";
  const flush = () => {
    if (buf.length) segs.push({ id: bid(), type: bufType, text: buf.join("\n") });
    buf = []; bufType = "text";
  };
  for (const raw of md.replace(/\r/g, "").split("\n")) {
    const line = raw.trim();
    if (!line) { flush(); continue; }
    if (/^#{1,6}\s/.test(line)) { flush(); segs.push({ id: bid(), type: "heading", text: line.replace(/^#{1,6}\s*/, "") }); continue; }
    if (/^(-{3,}|\*{3,})$/.test(line)) { flush(); segs.push({ id: bid(), type: "divider", text: "" }); continue; }
    const li = line.match(/^[-*•]\s+(.*)$/);
    if (li) {
      const chk = li[1].match(/^\[[ xX]?\]\s*(.*)$/);
      const t: "bullets" | "checklist" = chk ? "checklist" : "bullets";
      if (bufType !== t) flush();
      bufType = t; buf.push(chk ? chk[1] : li[1]); continue;
    }
    if (bufType !== "text") flush();
    buf.push(line.replace(/\*\*/g, ""));
  }
  flush();
  return segs.length ? segs : [{ id: bid(), type: "text", text: md.trim() }];
}

// Offline fallback when no API key is configured — an honest starter outline.
const localRiqDraft = (prompt: string) => [
  `# ${prompt.charAt(0).toUpperCase()}${prompt.slice(1, 80)}`,
  "",
  "Riq needs an API connection to write this for you — here's a starter outline to fill in.",
  "",
  "- What happened / what this covers",
  "- Key details worth recording",
  "- Next steps",
].join("\n");

const TOOLS: { type: BlockType; icon: React.ElementType; label: string }[] = [
  { type: "heading",   icon: Heading2,   label: "Heading" },
  { type: "text",      icon: Type,       label: "Text" },
  { type: "bullets",   icon: List,       label: "Bullets" },
  { type: "checklist", icon: ListChecks, label: "Checklist" },
  { type: "callout",   icon: Megaphone,  label: "Callout" },
  { type: "divider",   icon: Minus,      label: "Divider" },
];

export default function DocumentEditor({ scope, accountName, authorName = "Ryo Martin", onClose, onSaved }: {
  scope: FileScope;
  accountName?: string;
  authorName?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState("");
  const [pages, setPages] = useState<DocPage[]>([newPage(0, 0)]);
  const pagesRef = useRef(pages); pagesRef.current = pages;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pageEls = useRef<Record<string, HTMLDivElement | null>>({});
  // Which page an uploaded image lands in (set when its Image button is clicked).
  const imageTarget = useRef<string | null>(null);
  // Riq — ask-to-write panel (open on one page at a time).
  const [riqOpen, setRiqOpen] = useState<string | null>(null);
  const [riqPrompt, setRiqPrompt] = useState("");
  const [riqBusy, setRiqBusy] = useState(false);
  // Double-click the zoom % to type an exact value.
  const [zoomEdit, setZoomEdit] = useState<string | null>(null);

  // ── Canvas view (same mechanics as the WO template canvas) ──
  const viewportRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ x: 40, y: 64, zoom: 1 });
  const viewRef = useRef(view); viewRef.current = view;
  const [spaceHeld, setSpaceHeld] = useState(false);
  const spaceRef = useRef(false);
  const panning = useRef(false);
  const didCenter = useRef(false);

  const hasContent = title.trim().length > 0 || pages.some(p => p.segments.some(b => b.text.trim().length > 0 || b.src));

  const zoomAt = (factor: number, cx: number, cy: number) => setView(v => {
    const z = clamp(v.zoom * factor, 0.4, 1.8);
    const wx = (cx - v.x) / v.zoom, wy = (cy - v.y) / v.zoom;
    return { x: cx - wx * z, y: cy - wy * z, zoom: z };
  });
  const zoomButton = (f: number) => { const vp = viewportRef.current; if (!vp) return; zoomAt(f, vp.clientWidth / 2, vp.clientHeight / 2); };

  // Fit ALL pages in the viewport (centered) — also the initial view.
  const fit = () => {
    const vp = viewportRef.current; if (!vp) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of pagesRef.current) {
      const h = Math.max(pageEls.current[p.id]?.offsetHeight ?? 480, 480);
      minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x + p.width); maxY = Math.max(maxY, p.y + h);
    }
    const bw = maxX - minX, bh = maxY - minY;
    const z = clamp(Math.min((vp.clientWidth - 128) / bw, (vp.clientHeight - 128) / bh, 1), 0.4, 1);
    setView({ x: (vp.clientWidth - bw * z) / 2 - minX * z, y: (vp.clientHeight - bh * z) / 2 - minY * z, zoom: z });
  };
  useLayoutEffect(() => { if (!didCenter.current && viewportRef.current) { didCenter.current = true; fit(); } });

  // Space = pan mode (never while typing in a field).
  useEffect(() => {
    const typing = () => { const el = document.activeElement as HTMLElement | null; return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable); };
    const down = (e: KeyboardEvent) => { if (e.code === "Space" && !typing() && !spaceRef.current) { e.preventDefault(); spaceRef.current = true; setSpaceHeld(true); } };
    const up = (e: KeyboardEvent) => { if (e.code === "Space") { spaceRef.current = false; setSpaceHeld(false); } };
    window.addEventListener("keydown", down); window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  // Wheel: ⌘/Ctrl-scroll zooms at the cursor, plain scroll pans.
  useEffect(() => {
    const vp = viewportRef.current; if (!vp) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = vp.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) zoomAt(e.deltaY < 0 ? 1.12 : 0.89, e.clientX - rect.left, e.clientY - rect.top);
      else setView(v => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
    };
    vp.addEventListener("wheel", onWheel, { passive: false });
    return () => vp.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!spaceRef.current) return;
    e.preventDefault(); panning.current = true;
    const sx = e.clientX, sy = e.clientY, ox = viewRef.current.x, oy = viewRef.current.y;
    const move = (ev: PointerEvent) => { if (panning.current) setView(v => ({ ...v, x: ox + (ev.clientX - sx), y: oy + (ev.clientY - sy) })); };
    const up = () => { panning.current = false; window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  };

  // ── Pages ──
  const patchPage = (id: string, p: Partial<DocPage>) => setPages(prev => prev.map(pg => pg.id === id ? { ...pg, ...p } : pg));

  function addPage() {
    // New page opens to the right of the rightmost page, tops aligned.
    const right = pagesRef.current.reduce((a, b) => (a.x + a.width > b.x + b.width ? a : b));
    setPages(prev => [...prev, newPage(right.x + right.width + PAGE_GAP, right.y)]);
    requestAnimationFrame(fit);
  }
  const removePage = (id: string) => setPages(prev => prev.length > 1 ? prev.filter(p => p.id !== id) : prev);

  // Drag a page around the canvas — grip only, zoom-corrected deltas.
  function beginPageDrag(e: React.PointerEvent, pageId: string) {
    if (spaceRef.current) return;
    e.preventDefault(); e.stopPropagation();
    const page = pagesRef.current.find(p => p.id === pageId); if (!page) return;
    const sx = e.clientX, sy = e.clientY, ox = page.x, oy = page.y, z = viewRef.current.zoom;
    document.body.style.userSelect = "none";
    const move = (ev: PointerEvent) => patchPage(pageId, { x: ox + (ev.clientX - sx) / z, y: oy + (ev.clientY - sy) / z });
    const up = () => {
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  }

  // Resize a page — right edge (width), bottom edge (height), or corner (both).
  // Height is a floor, not a ceiling: content can still grow the page past it.
  function beginPageResize(e: React.PointerEvent, pageId: string, axis: "x" | "y" | "xy") {
    if (spaceRef.current) return;
    e.preventDefault(); e.stopPropagation();
    const page = pagesRef.current.find(p => p.id === pageId); if (!page) return;
    const sx = e.clientX, sy = e.clientY, ow = page.width, z = viewRef.current.zoom;
    const oh = page.height ?? pageEls.current[pageId]?.offsetHeight ?? MIN_H;
    document.body.style.userSelect = "none";
    document.body.style.cursor = axis === "x" ? "ew-resize" : axis === "y" ? "ns-resize" : "nwse-resize";
    const move = (ev: PointerEvent) => {
      const p: Partial<DocPage> = {};
      if (axis !== "y") p.width = clamp(ow + (ev.clientX - sx) / z, MIN_W, MAX_W);
      if (axis !== "x") p.height = clamp(oh + (ev.clientY - sy) / z, MIN_H, MAX_H);
      patchPage(pageId, p);
    };
    const up = () => {
      document.body.style.userSelect = ""; document.body.style.cursor = "";
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  }

  // ── Segments (stacked inside a page) ──
  const patchSegs = (pageId: string, fn: (segs: DocSegment[]) => DocSegment[]) =>
    setPages(prev => prev.map(p => p.id === pageId ? { ...p, segments: fn(p.segments) } : p));

  const addBlock = (pageId: string, type: BlockType, src?: string, fileId?: string) =>
    patchSegs(pageId, segs => [...segs, { id: bid(), type, text: "", src, fileId }]);
  const patch = (pageId: string, id: string, p: Partial<DocSegment>) =>
    patchSegs(pageId, segs => segs.map(b => b.id === id ? { ...b, ...p } : b));
  const remove = (pageId: string, id: string) =>
    patchSegs(pageId, segs => segs.length > 1 ? segs.filter(b => b.id !== id) : segs);
  const move = (pageId: string, id: string, dir: -1 | 1) =>
    patchSegs(pageId, segs => {
      const i = segs.findIndex(b => b.id === id), j = i + dir;
      if (j < 0 || j >= segs.length) return segs;
      const next = [...segs]; [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  function pickImage(pageId: string) { imageTarget.current = pageId; fileInputRef.current?.click(); }
  function onImage(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    const pageId = imageTarget.current ?? pagesRef.current[0]?.id;
    if (!f || !pageId) return;
    const reader = new FileReader();
    reader.onload = () => {
      // The image is a real gallery file; the document only references it.
      const dataUrl = String(reader.result);
      const files = addFile({
        scope, fileName: f.name, fileType: "image", categoryKey: "documents",
        uploadedBy: authorName, notes: "Inserted in a document", accountName,
        previewUrl: dataUrl,
      });
      addBlock(pageId, "image", dataUrl, files[0]?.id);
    };
    reader.readAsDataURL(f);
    e.target.value = "";
  }

  async function askRiq(pageId: string) {
    const prompt = riqPrompt.trim();
    if (!prompt || riqBusy) return;
    setRiqBusy(true);
    recordUsage("ai");
    let text = "";
    try {
      const r = await fetch("/api/ai/write", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt, title: title.trim() || undefined }),
      });
      const data = await r.json();
      if (data?.text) text = data.text;
    } catch { /* fall through to local draft */ }
    const segs = parseRiqText(text || localRiqDraft(prompt));
    // An untouched page gets replaced; otherwise Riq appends below your content.
    patchSegs(pageId, prev =>
      prev.length === 1 && prev[0].type === "text" && !prev[0].text.trim() && !prev[0].src ? segs : [...prev, ...segs]);
    setRiqBusy(false);
    setRiqPrompt("");
    setRiqOpen(null);
  }

  // Apply a typed zoom % (double-click the readout to edit).
  function applyZoomEdit() {
    if (zoomEdit !== null) {
      const n = parseFloat(zoomEdit);
      if (Number.isFinite(n)) zoomButton(clamp(n, 40, 180) / 100 / viewRef.current.zoom);
    }
    setZoomEdit(null);
  }

  function save() {
    if (!hasContent) return;
    const name = title.trim() || "Untitled document";
    // Plain-text digest (page order, top to bottom) goes on the file record.
    const digest = pages
      .flatMap(p => p.segments)
      .map(b => b.type === "divider" ? "—" : b.type === "image" ? "[image]" : b.text)
      .filter(Boolean).join("\n").slice(0, 600);
    const files = addFile({
      scope, fileName: name, fileType: "document", categoryKey: "documents",
      uploadedBy: authorName, notes: digest, accountName,
    });
    // Persist structure only — image binaries live in the gallery, not the doc.
    const lean = pages.map(p => ({ ...p, segments: p.segments.map(b => b.fileId ? { ...b, src: undefined } : b) }));
    if (files[0]) saveDocumentContent(files[0].id, { version: 3, pages: lean });
    pingSaved();
    onSaved();
  }

  const lineMarker = (type: BlockType) => type === "bullets" ? "•" : type === "checklist" ? "☐" : null;

  return (
    <div className="fixed inset-0 z-[70] flex flex-col" style={{ backgroundColor: "var(--bg-page)" }}>
      {/* Immersive header — same language as the template/proposal builders */}
      <header className="flex items-center gap-3 px-4 h-14 shrink-0" style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--bg-surface)" }}>
        <button onClick={onClose} className="flex items-center gap-1.5 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="h-5 w-px" style={{ backgroundColor: "var(--border)" }} />
        <FileText className="w-4 h-4 shrink-0" style={{ color: "var(--accent-text)" }} />
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Untitled document"
          className="flex-1 min-w-0 bg-transparent text-sm font-semibold outline-none" style={{ color: "var(--text-primary)" }} autoFocus />
        <button onClick={save} disabled={!hasContent}
          className="px-4 py-1.5 rounded-lg text-sm font-medium text-white bg-[#0f8578] hover:bg-[#0c6b60] disabled:opacity-40 transition-colors">
          Save as file
        </button>
      </header>

      {/* Pannable / zoomable canvas */}
      <div ref={viewportRef} onPointerDown={onPointerDown}
        className={`flex-1 overflow-hidden relative ${spaceHeld ? "cursor-grab select-none" : ""}`}
        style={{ backgroundColor: "var(--bg-page)" }}>
        <div ref={worldRef}
          style={{ position: "absolute", top: 0, left: 0, transformOrigin: "0 0", transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`, pointerEvents: spaceHeld ? "none" : undefined }}>
          {/* Pages — each a movable, resizable container; content stacks inside */}
          {pages.map(page => (
            <div key={page.id} ref={el => { pageEls.current[page.id] = el; }} className="absolute rounded-2xl"
              style={{ left: page.x, top: page.y, width: page.width, minHeight: page.height, backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 12px 40px rgba(0,0,0,0.10)" }}>
              {/* Insert tools — inside the top of the page; grip drags the page */}
              <div className="flex items-center gap-1 px-3 pt-2.5 pb-2 flex-wrap" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                <button onPointerDown={e => beginPageDrag(e, page.id)} title="Drag to move the page"
                  className="p-1 mr-1 rounded-md cursor-grab active:cursor-grabbing"
                  style={{ color: "var(--text-muted)" }}>
                  <GripVertical className="w-3.5 h-3.5" />
                </button>
                {TOOLS.map(({ type, icon: Icon, label }) => (
                  <button key={type} onClick={() => addBlock(page.id, type)} title={label}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors hover:bg-[var(--bg-surface-2)]"
                    style={{ color: "var(--text-secondary)" }}>
                    <Icon className="w-3.5 h-3.5" /> {label}
                  </button>
                ))}
                <button onClick={() => pickImage(page.id)} title="Image"
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors hover:bg-[var(--bg-surface-2)]"
                  style={{ color: "var(--text-secondary)" }}>
                  <ImagePlus className="w-3.5 h-3.5" /> Image
                </button>
                <button onClick={() => { setRiqOpen(o => o === page.id ? null : page.id); setRiqPrompt(""); }} title="Ask Riq to write"
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold transition-colors hover:bg-[var(--bg-surface-2)]"
                  style={{ color: "#6d28d9" }}>
                  <Sparkles className="w-3.5 h-3.5" /> Riq
                </button>
                {pages.length > 1 && (
                  <button onClick={() => removePage(page.id)} title="Delete page"
                    className="ml-auto p-1 rounded-md transition-colors hover:bg-[var(--bg-surface-2)]"
                    style={{ color: "#dc2626" }}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Riq — ask-to-write */}
              {riqOpen === page.id && (
                <div className="flex items-start gap-2 px-3 py-2.5"
                  style={{ borderBottom: "1px solid var(--border-subtle)", backgroundColor: "color-mix(in srgb, #7c3aed 6%, transparent)" }}>
                  <Sparkles className="w-3.5 h-3.5 mt-2 shrink-0" style={{ color: "#6d28d9" }} />
                  <textarea autoFocus value={riqPrompt} rows={2} disabled={riqBusy}
                    onChange={e => setRiqPrompt(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); askRiq(page.id); }
                      if (e.key === "Escape") setRiqOpen(null);
                    }}
                    placeholder='Ask Riq to write something — "summarize the no-cool visit for the customer"…'
                    className="flex-1 bg-transparent text-sm leading-relaxed outline-none resize-none"
                    style={{ color: "var(--text-primary)" }} />
                  <button onClick={() => askRiq(page.id)} disabled={!riqPrompt.trim() || riqBusy}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-40 transition-colors shrink-0"
                    style={{ backgroundColor: "#6d28d9" }}>
                    {riqBusy ? "Writing…" : "Write"}
                  </button>
                </div>
              )}

              {/* Stacked content */}
              <div className="px-8 py-6 space-y-1" style={{ minHeight: 420 }}>
                {page.segments.map(b => (
                  <div key={b.id} className="group relative -mx-3 px-3 py-1 rounded-lg"
                    style={b.type === "callout" ? { backgroundColor: "var(--accent-soft-bg)", border: "1px solid var(--accent-soft-border)", margin: "6px -12px", padding: "10px 12px" } : undefined}>
                    {b.type === "divider" ? (
                      <div className="py-2"><div className="h-px" style={{ backgroundColor: "var(--border)" }} /></div>
                    ) : b.type === "image" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={b.src} alt="" className="w-full rounded-lg" draggable={false} />
                    ) : b.type === "heading" ? (
                      <input value={b.text} onChange={e => patch(page.id, b.id, { text: e.target.value })} placeholder="Heading"
                        className="w-full bg-transparent text-lg font-semibold outline-none" style={{ color: "var(--text-primary)" }} />
                    ) : (
                      <div className="flex gap-2">
                        {lineMarker(b.type) && (
                          <span className="text-sm pt-[1px] select-none" style={{ color: "var(--text-muted)" }}>{lineMarker(b.type)}</span>
                        )}
                        <textarea value={b.text}
                          onChange={e => { patch(page.id, b.id, { text: e.target.value }); e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; }}
                          placeholder={b.type === "callout" ? "Something worth highlighting…" : b.type === "bullets" ? "One item per line…" : b.type === "checklist" ? "One task per line…" : "Write something…"}
                          rows={b.type === "text" && page.segments.length === 1 ? 12 : 1}
                          className="w-full bg-transparent text-sm leading-relaxed outline-none resize-none overflow-hidden"
                          style={{ color: "var(--text-primary)" }} />
                      </div>
                    )}
                    {/* Segment controls — revealed on hover, pinned to the right edge */}
                    <div className="absolute -right-1 top-1/2 -translate-y-1/2 translate-x-full flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => move(page.id, b.id, -1)} title="Move up" className="p-0.5 rounded" style={{ color: "var(--text-muted)" }}><ChevronUp className="w-3 h-3" /></button>
                      <button onClick={() => remove(page.id, b.id)} title="Delete" className="p-0.5 rounded" style={{ color: "#dc2626" }}><Trash2 className="w-3 h-3" /></button>
                      <button onClick={() => move(page.id, b.id, 1)} title="Move down" className="p-0.5 rounded" style={{ color: "var(--text-muted)" }}><ChevronDown className="w-3 h-3" /></button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Resize handles — right edge (width), bottom edge (height), corner (both) */}
              <div onPointerDown={e => beginPageResize(e, page.id, "x")} title="Drag to resize"
                className="group/rs absolute -right-1.5 top-0 bottom-4 w-3 cursor-ew-resize flex items-center justify-center">
                <div className="w-[3px] h-10 rounded-full opacity-0 group-hover/rs:opacity-100 transition-opacity"
                  style={{ backgroundColor: "var(--accent-text)" }} />
              </div>
              <div onPointerDown={e => beginPageResize(e, page.id, "y")} title="Drag to resize"
                className="group/rs absolute -bottom-1.5 left-0 right-4 h-3 cursor-ns-resize flex items-center justify-center">
                <div className="h-[3px] w-10 rounded-full opacity-0 group-hover/rs:opacity-100 transition-opacity"
                  style={{ backgroundColor: "var(--accent-text)" }} />
              </div>
              <div onPointerDown={e => beginPageResize(e, page.id, "xy")} title="Drag to resize"
                className="group/rs absolute -bottom-1.5 -right-1.5 w-4 h-4 cursor-nwse-resize flex items-center justify-center">
                <div className="w-2 h-2 rounded-sm opacity-0 group-hover/rs:opacity-100 transition-opacity"
                  style={{ backgroundColor: "var(--accent-text)" }} />
              </div>
            </div>
          ))}
        </div>

        {/* Zoom controls — same bottom-center bar as the WO template canvas */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-0.5 rounded-xl p-1"
          style={{ backgroundColor: "color-mix(in srgb, var(--bg-surface) 88%, transparent)", border: "1px solid var(--border)", boxShadow: "0 8px 24px -8px rgba(0,0,0,0.35)", backdropFilter: "blur(10px)" }}>
          <button onClick={() => zoomButton(0.83)} title="Zoom out" className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--bg-surface-2)]" style={{ color: "var(--text-secondary)" }}><Minus className="w-4 h-4" /></button>
          {zoomEdit !== null ? (
            <input autoFocus value={zoomEdit}
              onChange={e => setZoomEdit(e.target.value.replace(/[^0-9]/g, ""))}
              onKeyDown={e => { if (e.key === "Enter") applyZoomEdit(); if (e.key === "Escape") setZoomEdit(null); }}
              onBlur={applyZoomEdit}
              className="w-12 px-1 py-1 rounded-lg text-xs font-semibold tabular-nums text-center bg-transparent outline-none"
              style={{ color: "var(--text-primary)", border: "1px solid var(--accent-text)" }} />
          ) : (
            <button onDoubleClick={() => setZoomEdit(String(Math.round(view.zoom * 100)))} title="Double-click to set zoom"
              className="px-2 py-1 rounded-lg text-xs font-semibold tabular-nums min-w-[3rem] transition-colors hover:bg-[var(--bg-surface-2)]"
              style={{ color: "var(--text-secondary)" }}>{Math.round(view.zoom * 100)}%</button>
          )}
          <button onClick={() => zoomButton(1.2)} title="Zoom in" className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--bg-surface-2)]" style={{ color: "var(--text-secondary)" }}><Plus className="w-4 h-4" /></button>
          <div className="w-px h-5 mx-0.5" style={{ backgroundColor: "var(--border)" }} />
          <button onClick={fit} title="Fit to view" className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--bg-surface-2)]" style={{ color: "var(--text-secondary)" }}><Maximize className="w-4 h-4" /></button>
          <div className="w-px h-5 mx-0.5" style={{ backgroundColor: "var(--border)" }} />
          <button onClick={addPage} title="Add page" className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--bg-surface-2)]" style={{ color: "var(--text-secondary)" }}><FilePlus2 className="w-4 h-4" /></button>
        </div>
        <p className="absolute bottom-3 right-3 z-10 text-[10px] pointer-events-none" style={{ color: "var(--text-muted)" }}>Hold Space to pan · ⌘-scroll to zoom</p>
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onImage} />
    </div>
  );
}
