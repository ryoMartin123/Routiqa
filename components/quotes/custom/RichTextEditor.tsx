"use client";

// Rich text editor for Custom Proposal narrative blocks. contentEditable surface
// + a grouped formatting toolbar (execCommand). No external dependency.
//
// Toolbar: H1 H2 H3 · Paragraph(T) · B I U · align L/C/R · bullet/numbered list ·
// divider · link · insert image (URL) · upload image (file) · undo/redo.
// Active formats highlight. Images can be INSERTED (URL/upload/drag a file in)
// and DRAGGED to reposition within the text; they cap at the column width.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bold, Italic, Underline, List, ListOrdered, AlignLeft, AlignCenter, AlignRight,
  Link2, Minus, Undo2, Redo2, Heading1, Heading2, Heading3, Type, Image as ImageIcon, FolderOpen,
} from "lucide-react";

interface ActiveState { bold: boolean; italic: boolean; underline: boolean; ul: boolean; ol: boolean; block: string }
const EMPTY: ActiveState = { bold: false, italic: false, underline: false, ul: false, ol: false, block: "" };

export default function RichTextEditor({ value, onChange, placeholder, minHeight = 320, seamless = false, toolbarExtra }: {
  value: string; onChange: (html: string) => void; placeholder?: string; minHeight?: number;
  // seamless: no surrounding box — the surface blends into the page (flowing
  // document feel) and the toolbar floats above the text only while focused.
  seamless?: boolean;
  toolbarExtra?: React.ReactNode;   // host-provided control at the toolbar's right end (e.g. Ask Riq)
}) {
  const ref = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const savedRange = useRef<Range | null>(null);
  const selImgRef = useRef<HTMLImageElement | null>(null);
  const [active, setActive] = useState<ActiveState>(EMPTY);
  const [focused, setFocused] = useState(false);
  // Bounding box of the currently selected inline image (for the resize overlay).
  const [imgBox, setImgBox] = useState<{ left: number; top: number; w: number; h: number } | null>(null);

  // Seed once on mount — never resync from `value` while typing (caret would jump).
  useEffect(() => {
    const el = ref.current;
    if (el && el.innerHTML !== (value || "")) el.innerHTML = value || "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emit = useCallback(() => { if (ref.current) onChange(ref.current.innerHTML); }, [onChange]);

  const refreshActive = useCallback(() => {
    try {
      setActive({
        bold: document.queryCommandState("bold"),
        italic: document.queryCommandState("italic"),
        underline: document.queryCommandState("underline"),
        ul: document.queryCommandState("insertUnorderedList"),
        ol: document.queryCommandState("insertOrderedList"),
        block: String(document.queryCommandValue("formatBlock") || "").toLowerCase(),
      });
    } catch { /* ignore */ }
  }, []);

  const saveSelection = () => {
    const s = window.getSelection();
    if (s && s.rangeCount && ref.current?.contains(s.anchorNode)) savedRange.current = s.getRangeAt(0).cloneRange();
  };
  const restoreSelection = () => {
    const el = ref.current; if (!el) return;
    el.focus();
    const s = window.getSelection();
    if (savedRange.current && s) { s.removeAllRanges(); s.addRange(savedRange.current); }
  };

  // ── Inline image select + resize ──
  const measureImg = useCallback(() => {
    const img = selImgRef.current, wrap = wrapRef.current;
    if (!img || !wrap) { setImgBox(null); return; }
    const wr = wrap.getBoundingClientRect(), ir = img.getBoundingClientRect();
    setImgBox({ left: ir.left - wr.left, top: ir.top - wr.top, w: ir.width, h: ir.height });
  }, []);
  const selectImg = (img: HTMLImageElement) => { selImgRef.current = img; measureImg(); };
  const clearImg = useCallback(() => { selImgRef.current = null; setImgBox(null); }, []);
  const onEditorClick = (e: React.MouseEvent) => {
    const t = e.target as HTMLElement;
    if (t && t.tagName === "IMG") selectImg(t as HTMLImageElement); else clearImg();
  };
  const startResize = (e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation();
    const img = selImgRef.current, editor = ref.current; if (!img || !editor) return;
    const startX = e.clientX, startW = img.getBoundingClientRect().width;
    const maxW = editor.clientWidth - 32; // minus px-4 padding
    const onMove = (me: PointerEvent) => {
      const w = Math.max(48, Math.min(startW + (me.clientX - startX), maxW));
      img.style.width = `${Math.round(w)}px`; img.style.height = "auto";
      measureImg();
    };
    const onUp = () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); emit(); };
    window.addEventListener("pointermove", onMove); window.addEventListener("pointerup", onUp);
  };
  // Keep the overlay aligned on layout changes; drop selection when clicking away.
  useEffect(() => {
    const onResize = () => { if (selImgRef.current) measureImg(); };
    const onDown = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) clearImg(); };
    window.addEventListener("resize", onResize);
    document.addEventListener("mousedown", onDown);
    return () => { window.removeEventListener("resize", onResize); document.removeEventListener("mousedown", onDown); };
  }, [measureImg, clearImg]);

  const exec = (cmd: string, arg?: string) => { ref.current?.focus(); document.execCommand(cmd, false, arg); emit(); refreshActive(); };
  const addLink = () => { saveSelection(); const url = window.prompt("Link URL", "https://"); restoreSelection(); if (url) exec("createLink", url); };
  const insertImageUrl = () => { saveSelection(); const url = window.prompt("Image URL", "https://"); restoreSelection(); if (url) exec("insertImage", url); };
  const insertImageFile = (file: File) => {
    const r = new FileReader();
    r.onload = () => { restoreSelection(); exec("insertImage", String(r.result)); };
    r.readAsDataURL(file);
  };
  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) insertImageFile(f); e.target.value = ""; };

  // Drag a desktop image file INTO the editor; existing images drag to reposition natively.
  const onDrop = (e: React.DragEvent) => {
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/"));
    if (files.length) { e.preventDefault(); saveSelection(); files.forEach(insertImageFile); }
    else { setTimeout(emit, 0); } // native node move — capture the result
  };

  const headingActive = (tag: string) => active.block === tag;
  const paragraphActive = !["h1", "h2", "h3"].includes(active.block);

  const showToolbar = !seamless || focused;
  return (
    <div ref={wrapRef} className={seamless ? "relative" : "rounded-xl overflow-hidden relative"} style={seamless ? undefined : { border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)" }}>
      {/* Toolbar — fixed at top in boxed mode; floats above the text on focus in seamless mode */}
      {showToolbar && (
      <div className={seamless
          ? "absolute left-0 -top-2 z-30 flex items-center gap-0.5 flex-wrap px-1.5 py-1 rounded-xl -translate-y-full"
          : "flex items-center gap-0.5 flex-wrap px-2 py-1.5 border-b"}
        style={seamless
          ? { backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 8px 24px rgba(0,0,0,0.18)" }
          : { borderColor: "var(--border-subtle)", backgroundColor: "var(--bg-surface-2)" }}
        onMouseDown={e => e.preventDefault() /* keep selection */}>
        <Tb title="Heading 1" on={headingActive("h1")} onClick={() => exec("formatBlock", "h1")}><Heading1 className="w-4 h-4" /></Tb>
        <Tb title="Heading 2" on={headingActive("h2")} onClick={() => exec("formatBlock", "h2")}><Heading2 className="w-4 h-4" /></Tb>
        <Tb title="Heading 3" on={headingActive("h3")} onClick={() => exec("formatBlock", "h3")}><Heading3 className="w-4 h-4" /></Tb>
        <Tb title="Paragraph" on={paragraphActive} onClick={() => exec("formatBlock", "p")}><Type className="w-4 h-4" /></Tb>
        <Sep />
        <Tb title="Bold" on={active.bold} onClick={() => exec("bold")}><Bold className="w-4 h-4" /></Tb>
        <Tb title="Italic" on={active.italic} onClick={() => exec("italic")}><Italic className="w-4 h-4" /></Tb>
        <Tb title="Underline" on={active.underline} onClick={() => exec("underline")}><Underline className="w-4 h-4" /></Tb>
        <Sep />
        <Tb title="Align left" onClick={() => exec("justifyLeft")}><AlignLeft className="w-4 h-4" /></Tb>
        <Tb title="Align center" onClick={() => exec("justifyCenter")}><AlignCenter className="w-4 h-4" /></Tb>
        <Tb title="Align right" onClick={() => exec("justifyRight")}><AlignRight className="w-4 h-4" /></Tb>
        <Sep />
        <Tb title="Bullet list" on={active.ul} onClick={() => exec("insertUnorderedList")}><List className="w-4 h-4" /></Tb>
        <Tb title="Numbered list" on={active.ol} onClick={() => exec("insertOrderedList")}><ListOrdered className="w-4 h-4" /></Tb>
        <Sep />
        <Tb title="Divider" onClick={() => exec("insertHorizontalRule")}><Minus className="w-4 h-4" /></Tb>
        <Tb title="Insert link" onClick={addLink}><Link2 className="w-4 h-4" /></Tb>
        <Tb title="Insert image (URL)" onClick={insertImageUrl}><ImageIcon className="w-4 h-4" /></Tb>
        <Tb title="Upload image" onClick={() => { saveSelection(); fileRef.current?.click(); }}><FolderOpen className="w-4 h-4" /></Tb>
        <Sep />
        <Tb title="Undo" onClick={() => exec("undo")}><Undo2 className="w-4 h-4" /></Tb>
        <Tb title="Redo" onClick={() => exec("redo")}><Redo2 className="w-4 h-4" /></Tb>
        {toolbarExtra && <span className="ml-auto flex items-center">{toolbarExtra}</span>}
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickFile} />
      </div>
      )}

      {/* Editable surface */}
      <div
        ref={ref}
        className={seamless ? "rte text-sm outline-none leading-relaxed" : "rte px-4 py-3 text-sm outline-none leading-relaxed"}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        data-placeholder={placeholder ?? "Start writing…"}
        onClick={onEditorClick}
        onFocus={() => setFocused(true)}
        onInput={() => { emit(); refreshActive(); if (selImgRef.current) measureImg(); }}
        onKeyUp={refreshActive}
        onMouseUp={() => { saveSelection(); refreshActive(); }}
        onBlur={() => { saveSelection(); emit(); setFocused(false); }}
        onDrop={e => { onDrop(e); if (selImgRef.current) setTimeout(measureImg, 0); }}
        style={{ minHeight: seamless ? Math.min(minHeight, 48) : minHeight, color: "var(--text-primary)" }}
      />

      {/* Selected-image overlay: outline + corner resize handle */}
      {imgBox && (
        <>
          <div aria-hidden style={{ position: "absolute", left: imgBox.left, top: imgBox.top, width: imgBox.w, height: imgBox.h, border: "2px solid var(--accent-text)", borderRadius: 6, pointerEvents: "none", zIndex: 5 }} />
          <div onPointerDown={startResize} title="Drag to resize" style={{ position: "absolute", left: imgBox.left + imgBox.w - 8, top: imgBox.top + imgBox.h - 8, width: 16, height: 16, backgroundColor: "var(--accent-text)", border: "2px solid var(--bg-surface)", borderRadius: 4, cursor: "nwse-resize", zIndex: 6, touchAction: "none" }} />
        </>
      )}
    </div>
  );
}

function Tb({ title, on, onClick, children }: { title: string; on?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" title={title} onClick={onClick}
      className={`p-1.5 rounded-md transition-colors ${on ? "" : "hover:bg-[var(--bg-surface)]"}`}
      style={{ color: on ? "var(--accent-text)" : "var(--text-secondary)", backgroundColor: on ? "var(--accent-soft-bg)" : undefined }}>
      {children}
    </button>
  );
}
function Sep() { return <div className="w-px h-5 mx-1" style={{ backgroundColor: "var(--border)" }} />; }
