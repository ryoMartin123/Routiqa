"use client";

// ─── Documents workspace (3-panel knowledge base + manager) ──
// Left: folder tree (search, expand/collapse, counts, hover actions, accent).
// Center: folder header + breadcrumb + toolbar (search/filter/sort/view) + docs.
// Right: preview/details (folder when nothing selected, document when selected).
// Mock/local state. Documents accent = the Documents app icon color.

import { useMemo, useState, useEffect, useRef } from "react";
import {
  ChevronRight, Folder, FolderOpen, FolderPlus, Search, Plus, Upload, MoreHorizontal,
  FileText, ListChecks, LayoutTemplate, NotebookPen, FileSignature, ClipboardList, Link as LinkIcon,
  Image as ImageIcon, Table, Eye, User, Clock, Shield, Tag, X, Pencil, Copy, FolderInput, Archive,
  LayoutGrid, List, SlidersHorizontal, FileEdit, ArrowLeft, StickyNote, GraduationCap, Settings, Building2, HardHat,
} from "lucide-react";
import UiSelect from "@/components/ui/Select";
import { appById } from "@/lib/platform/apps";
import {
  getFolderTree, getFolder, folderPath, docCountDeep, docsInFolder, childFolders, getFolders,
  getDocument, createFolder, createDocument, updateDocument, moveDocument, duplicateDocument,
  archiveDocument, descendantFolderIds, updateFolder, getTemplates, getActivity,
  STATUS_COLOR, VIS_COLOR, LINKED_APP_COLOR, DOC_TYPES, DOC_STATUSES, DOC_VISIBILITIES, LINKED_APPS,
  type FolderNode, type DocItem, type DocType, type DocStatus, type DocVisibility, type LinkedApp, type NewFolderInput,
} from "@/lib/documents/mock";
import DesignStudio from "@/components/design-studio/DesignStudio";
import { emptyDesign, plainTextFromDesign } from "@/lib/design-studio/model";

const ACCENT = appById("documents")?.accent ?? "#f59e0b";   // = the Documents app icon color
const inp = "w-full rounded-lg px-3 py-2 text-sm outline-none";
const inpStyle: React.CSSProperties = { border: "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)", color: "var(--text-primary)" };

// A 1×1 transparent image used to suppress the browser's default drag ghost (the
// faded snapshot of the row). We render our own minimal "Move to…" pill instead.
const EMPTY_DRAG_IMG = typeof window !== "undefined"
  ? (() => { const img = new Image(); img.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"; return img; })()
  : null;
function hideNativeDragImage(e: React.DragEvent) {
  if (EMPTY_DRAG_IMG) { try { e.dataTransfer.setDragImage(EMPTY_DRAG_IMG, 0, 0); } catch { /* ignore */ } }
}

// Document type → icon.
const TYPE_ICON: Record<DocType, typeof FileText> = {
  SOP: FileText, Policy: FileSignature, Training: GraduationCap, Template: LayoutTemplate,
  "HR Document": FileText, "Sales Document": FileText, "Safety Document": HardHat, "System Document": Settings,
  "Vendor Document": Building2, "Subcontractor Document": HardHat, "Meeting Notes": NotebookPen, Contract: FileSignature,
  "Editable Document": FileText, Note: StickyNote, Checklist: ListChecks, Form: ClipboardList,
  Spreadsheet: Table, PDF: FileText, Image: ImageIcon, Link: LinkIcon, Other: FileText,
};
// Exported so smart views share the same type → icon mapping.
export { TYPE_ICON as DOC_TYPE_ICON };

type View = "list" | "grid";
type Sort = "updated" | "name" | "owner";

export default function DocumentsExplorer({ initialFolderId, initialDocId }: { initialFolderId?: string; initialDocId?: string }) {
  const [tick, setTick] = useState(0);
  const refresh = () => setTick(t => t + 1);
  const tree = useMemo(() => getFolderTree(), [tick]);

  const initialFolder = initialFolderId && getFolder(initialFolderId) ? initialFolderId : "hvac-service";
  const [selectedFolder, setSelectedFolder] = useState(initialFolder);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(folderPath(initialFolder).map(f => f.id)));
  const [selectedDoc, setSelectedDoc] = useState<string | null>(initialDocId ?? null);
  const [treeSearch, setTreeSearch] = useState("");
  const [newMenu, setNewMenu] = useState(false);

  // Center toolbar state
  const [search, setSearch] = useState("");
  const [view, setView] = useState<View>("list");
  const [sort, setSort] = useState<Sort>("updated");
  const [fStatus, setFStatus] = useState("all");
  const [fType, setFType] = useState("all");
  const [fVis, setFVis] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Modals / drawers
  const [newFolderParent, setNewFolderParent] = useState<string | null | false>(false);
  const [creatingDoc, setCreatingDoc] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [movingDoc, setMovingDoc] = useState<DocItem | null>(null);
  const [editingDoc, setEditingDoc] = useState<string | null>(null);
  // Designed documents open in the Design Studio; plain ones in the text editor.
  const [designingDoc, setDesigningDoc] = useState<string | null>(null);
  const openEditor = (d: DocItem) => (d.design ? setDesigningDoc(d.id) : setEditingDoc(d.id));

  const toggle = (id: string) => setExpanded(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const folder = getFolder(selectedFolder);
  const doc = selectedDoc ? getDocument(selectedDoc) : null;

  const s = search.trim().toLowerCase();
  const docs = useMemo(() => {
    let list = docsInFolder(selectedFolder);
    if (s) list = list.filter(d => `${d.title} ${d.tags.join(" ")} ${d.owner}`.toLowerCase().includes(s));
    if (fStatus !== "all") list = list.filter(d => d.status === fStatus);
    if (fType !== "all") list = list.filter(d => d.type === fType);
    if (fVis !== "all") list = list.filter(d => d.visibility === fVis);
    list = [...list].sort((a, b) =>
      sort === "name" ? a.title.localeCompare(b.title) : sort === "owner" ? a.owner.localeCompare(b.owner) : 0);
    return list;
  }, [selectedFolder, s, fStatus, fType, fVis, sort, tick]);
  const activeFilters = [fStatus !== "all", fType !== "all", fVis !== "all"].filter(Boolean).length;

  const path = folderPath(selectedFolder);

  function openDoc(id: string) { setSelectedDoc(id); }
  function selectFolder(id: string) { setSelectedFolder(id); setSelectedDoc(null); }

  // Quick note — creates a Draft note in the current folder and opens the editor.
  function newNote() {
    const d = createDocument({ title: "New Note", folderId: selectedFolder, type: "Note", status: "Draft", visibility: "Private", body: "" });
    refresh(); setSelectedDoc(d.id); setEditingDoc(d.id);
  }

  // Drag & drop: drop a document onto a folder to move it; drop a folder onto
  // another to re-parent it (guarded against dropping into its own subtree).
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);
  function onDropFolder(folderId: string, e: React.DragEvent) {
    e.preventDefault(); setDragOverFolder(null);
    const data = e.dataTransfer.getData("text/plain");
    if (data.startsWith("doc:")) {
      moveDocument(data.slice(4), folderId); setSelectedFolder(folderId); setExpanded(p => new Set(p).add(folderId)); refresh();
    } else if (data.startsWith("folder:")) {
      const fid = data.slice(7);
      if (fid !== folderId && !descendantFolderIds(fid).includes(folderId)) {
        updateFolder(fid, { parentId: folderId }); setExpanded(p => new Set(p).add(folderId)); refresh();
      }
    }
  }

  // Custom drag indicator: the native ghost is suppressed (hideNativeDragImage on
  // drag start); instead a small pill follows the cursor and names, in real time,
  // the folder the item will land in. We also track the source so the indicator
  // shows NOTHING while the cursor is over the very item being moved.
  const [dragLabel, setDragLabel] = useState<string | null>(null);
  const [dragSourceId, setDragSourceId] = useState<string | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const [overSource, setOverSource] = useState(false);
  const dragSourceElRef = useRef<HTMLElement | null>(null);
  function beginDrag(label: string, id: string, e: React.DragEvent) {
    hideNativeDragImage(e);
    dragSourceElRef.current = e.currentTarget as HTMLElement;
    setDragSourceId(id);
    setDragLabel(label);
    setDragPos({ x: e.clientX, y: e.clientY });
  }
  function endDrag() {
    setDragLabel(null); setDragSourceId(null); setDragPos(null); setDragOverFolder(null); setOverSource(false);
    dragSourceElRef.current = null;
  }
  useEffect(() => {
    if (!dragLabel) return;
    const onOver = (e: DragEvent) => {
      setDragPos({ x: e.clientX, y: e.clientY });
      const el = dragSourceElRef.current;
      setOverSource(!!el && e.target instanceof Node && el.contains(e.target));
    };
    document.addEventListener("dragover", onOver);
    document.addEventListener("drop", endDrag);
    document.addEventListener("dragend", endDrag);
    return () => {
      document.removeEventListener("dragover", onOver);
      document.removeEventListener("drop", endDrag);
      document.removeEventListener("dragend", endDrag);
    };
  }, [dragLabel]);
  const dragTargetName = dragOverFolder ? getFolder(dragOverFolder)?.name ?? null : null;

  return (
    <div className="flex h-full min-h-0">
      {/* Floating drag pill — replaces the native ghost; names the live target.
          Hidden entirely while the cursor is over the item being moved. */}
      {dragLabel && dragPos && !overSource && (
        <div className="fixed z-[100] pointer-events-none flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs"
          style={{ left: dragPos.x + 14, top: dragPos.y + 14, maxWidth: 280, backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 6px 20px rgba(0,0,0,0.18)" }}>
          <FileText className="w-3.5 h-3.5 shrink-0" style={{ color: ACCENT }} />
          <span className="truncate" style={{ color: "var(--text-secondary)" }}>
            <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{dragLabel}</span>
            {dragTargetName
              ? <> → <span style={{ color: ACCENT, fontWeight: 600 }}>{dragTargetName}</span></>
              : <span style={{ color: "var(--text-muted)" }}> — drag onto a folder</span>}
          </span>
        </div>
      )}
      {/* ── Left: folder tree (transparent — sits on the page background) ── */}
      <aside className="w-64 shrink-0 flex flex-col" style={{ borderRight: "1px solid var(--border)" }}>
        <div className="p-3 space-y-2 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          {/* Search + new-folder on one row — no section label needed */}
          <div className="flex items-center gap-1.5">
            <div className="flex-1 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5" style={{ backgroundColor: "var(--bg-input)" }}>
              <Search className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
              <input value={treeSearch} onChange={e => setTreeSearch(e.target.value)} placeholder="Search folders" className="bg-transparent text-xs outline-none w-full" style={{ color: "var(--text-primary)" }} />
            </div>
            {/* Bare icon — no background tile */}
            <button onClick={() => setNewFolderParent(null)} title="New folder"
              className="flex items-center justify-center w-7 h-7 shrink-0 transition-colors"
              style={{ color: ACCENT }}>
              <FolderPlus className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto thin-scroll-y p-2">
          {tree.map(node => (
            <TreeNode key={node.id} node={node} depth={0} expanded={expanded} selected={selectedFolder} search={treeSearch.trim().toLowerCase()}
              dragOver={dragOverFolder} dragSourceId={dragSourceId} onDragOverFolder={setDragOverFolder} onDropFolder={onDropFolder}
              onBeginDrag={beginDrag} onEndDrag={endDrag}
              onToggle={toggle} onSelect={selectFolder} onNewSub={(pid) => setNewFolderParent(pid)} />
          ))}
        </div>
      </aside>

      {/* ── Center: folder contents ── */}
      <section className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 pt-4 pb-3 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-1 text-[11px] mb-1" style={{ color: "var(--text-muted)" }}>
            <span>Company Documents</span>
            {path.map(f => (<span key={f.id} className="flex items-center gap-1"><ChevronRight className="w-3 h-3" /><span style={{ color: f.id === selectedFolder ? "var(--text-secondary)" : "var(--text-muted)" }}>{f.name}</span></span>))}
          </div>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold truncate" style={{ color: "var(--text-primary)" }}>{folder?.name ?? "Documents"}</h2>
              {folder?.description && <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{folder.description}</p>}
            </div>
            {/* Actions ride the title row so the table starts higher */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="relative shrink-0">
                {/* Plain button — PlusClickEnhancer + the global .lucide-plus rules
                    give it the exact CRM hover/press/spin-and-hold behavior. */}
                <button onClick={() => setNewMenu(o => !o)} title="New…" aria-label="New"
                  className="flex items-center justify-center w-9 h-9 rounded-lg text-white hover:brightness-110"
                  style={{ backgroundColor: ACCENT }}>
                  <Plus className="w-4 h-4" />
                </button>
                {newMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setNewMenu(false)} />
                    <div className="absolute right-0 top-full mt-1.5 w-48 rounded-xl z-50 p-1.5"
                      style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 12px 32px rgba(0,0,0,0.18)" }}>
                      {([
                        { label: "Document", icon: FileText, onClick: () => setCreatingDoc(true) },
                        { label: "Note", icon: StickyNote, onClick: newNote },
                        { label: "Folder", icon: FolderPlus, onClick: () => setNewFolderParent(selectedFolder) },
                        { label: "Upload files", icon: Upload, onClick: () => setUploading(true) },
                      ] as const).map(item => (
                        <button key={item.label} onClick={() => { setNewMenu(false); item.onClick(); }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors hover:bg-[var(--bg-surface-2)]">
                          <item.icon className="w-3.5 h-3.5 shrink-0" style={{ color: ACCENT }} />
                          <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{item.label}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <div className="relative">
                {/* Lights up while open, exactly like the CRM filter buttons */}
                <button onClick={() => setFiltersOpen(o => !o)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors"
                  style={{
                    border: `1px solid ${activeFilters > 0 || filtersOpen ? ACCENT + "66" : "var(--border)"}`,
                    backgroundColor: activeFilters ? ACCENT + "14" : "var(--bg-surface)",
                    color: activeFilters > 0 || filtersOpen ? ACCENT : "var(--text-secondary)",
                  }}>
                  <SlidersHorizontal className="w-3.5 h-3.5 transition-transform duration-200" style={{ transform: filtersOpen ? "rotate(90deg)" : "none" }} />
                  Filter{activeFilters > 0 && <span className="text-[10px] font-bold px-1.5 rounded-full" style={{ backgroundColor: ACCENT + "26", color: ACCENT }}>{activeFilters}</span>}
                </button>
                {filtersOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setFiltersOpen(false)} />
                    <div className="absolute right-0 top-full mt-2 z-50 rounded-xl p-4 w-64 space-y-2.5" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 12px 32px rgba(0,0,0,0.18)" }}>
                      <div className="flex items-center justify-between"><p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Filters</p>{activeFilters > 0 && <button onClick={() => { setFStatus("all"); setFType("all"); setFVis("all"); }} className="text-xs" style={{ color: ACCENT }}>Clear</button>}</div>
                      {/* View first — full-width segmented control */}
                      <FF label="View">
                        <div className="grid grid-cols-2 rounded-lg overflow-hidden w-full" style={{ border: "1px solid var(--border)" }}>
                          {(["list", "grid"] as View[]).map(v => (
                            <button key={v} onClick={() => setView(v)} className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-medium transition-colors"
                              style={{ backgroundColor: view === v ? ACCENT : "var(--bg-surface)", color: view === v ? "#fff" : "var(--text-secondary)" }}>
                              {v === "list" ? <List className="w-3.5 h-3.5" /> : <LayoutGrid className="w-3.5 h-3.5" />} {v === "list" ? "List" : "Cards"}
                            </button>
                          ))}
                        </div>
                      </FF>
                      <FF label="Status"><UiSelect size="sm" value={fStatus} onChange={setFStatus} options={[{ value: "all", label: "Any status" }, ...DOC_STATUSES.map(x => ({ value: x, label: x }))]} /></FF>
                      <FF label="Type"><UiSelect size="sm" value={fType} onChange={setFType} options={[{ value: "all", label: "Any type" }, ...DOC_TYPES.map(x => ({ value: x, label: x }))]} /></FF>
                      <FF label="Visibility"><UiSelect size="sm" value={fVis} onChange={setFVis} options={[{ value: "all", label: "Any visibility" }, ...DOC_VISIBILITIES.map(x => ({ value: x, label: x }))]} /></FF>
                      <FF label="Sort by"><UiSelect size="sm" value={sort} onChange={v => setSort(v as Sort)} options={[{ value: "updated", label: "Updated" }, { value: "name", label: "Name" }, { value: "owner", label: "Owner" }]} /></FF>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Documents */}
        <div className="flex-1 overflow-y-auto px-5 pt-4 pb-5">
          {/* Subfolders first — a parent folder isn't a dead end just because
              its documents live one level down. */}
          {childFolders(selectedFolder).length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {childFolders(selectedFolder).map(f => (
                <button key={f.id} onClick={() => { selectFolder(f.id); setExpanded(p => new Set(p).add(selectedFolder)); }}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors hover:bg-[var(--bg-surface-2)]"
                  style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                  <Folder className="w-3.5 h-3.5" style={{ color: ACCENT }} />
                  {f.name}
                  <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{docCountDeep(f.id)}</span>
                </button>
              ))}
            </div>
          )}
          {docs.length === 0 ? (
            <div className="rounded-xl p-10 text-center" style={{ border: "1px dashed var(--border)" }}>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>No documents here yet.</p>
              <button onClick={() => setCreatingDoc(true)} className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: ACCENT }}><Plus className="w-4 h-4" /> New Document</button>
            </div>
          ) : view === "list" ? (
            // Same table treatment as the smart views / CRM lists: bg-surface
            // card, transparent header row, hover rows.
            <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
              <div className="grid px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider" style={{ gridTemplateColumns: "2.2fr 1fr 0.9fr 1.1fr 0.9fr 1fr", gap: "0.75rem", color: "var(--text-muted)", borderBottom: "1px solid var(--border)", backgroundColor: "transparent" }}>
                <span>Name</span><span>Type</span><span>Status</span><span>Visibility</span><span>Owner</span><span>Updated</span>
              </div>
              {docs.map((d, i) => {
                const Icon = TYPE_ICON[d.type] ?? FileText;
                return (
                  <button key={d.id} onClick={() => openDoc(d.id)} draggable onDragStart={e => { e.dataTransfer.setData("text/plain", "doc:" + d.id); e.dataTransfer.effectAllowed = "move"; beginDrag(d.title, d.id, e); }} onDragEnd={endDrag}
                    className="w-full grid px-4 py-3 items-center text-left transition-colors hover:bg-[var(--bg-surface-2)] cursor-grab active:cursor-grabbing"
                    style={{ gridTemplateColumns: "2.2fr 1fr 0.9fr 1.1fr 0.9fr 1fr", gap: "0.75rem", borderBottom: i < docs.length - 1 ? "1px solid var(--border)" : "none", backgroundColor: selectedDoc === d.id ? ACCENT + "14" : "transparent" }}>
                    <span className="flex items-center gap-2 min-w-0"><Icon className="w-4 h-4 shrink-0" style={{ color: ACCENT }} /><span className="text-sm truncate" style={{ color: "var(--text-primary)" }}>{d.title}</span></span>
                    <span className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>{d.type}</span>
                    {/* Plain colored text — no pills in the table */}
                    <span className="text-xs font-medium truncate" style={{ color: STATUS_COLOR[d.status] }}>{d.status}</span>
                    <span className="text-xs font-medium truncate" style={{ color: VIS_COLOR[d.visibility] }}>{d.visibility}</span>
                    <span className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>{d.owner}</span>
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>{d.updated}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
              {docs.map(d => {
                const Icon = TYPE_ICON[d.type] ?? FileText;
                return (
                  <button key={d.id} onClick={() => openDoc(d.id)} draggable onDragStart={e => { e.dataTransfer.setData("text/plain", "doc:" + d.id); e.dataTransfer.effectAllowed = "move"; beginDrag(d.title, d.id, e); }} onDragEnd={endDrag}
                    className="text-left rounded-xl p-3.5 transition-colors hover:bg-[var(--bg-surface-2)] cursor-grab active:cursor-grabbing"
                    style={{ border: `1px solid ${selectedDoc === d.id ? ACCENT + "66" : "var(--border-subtle)"}`, backgroundColor: selectedDoc === d.id ? ACCENT + "10" : "var(--bg-surface)" }}>
                    <div className="flex items-center justify-between mb-2"><span className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: ACCENT + "1f" }}><Icon className="w-4.5 h-4.5" style={{ color: ACCENT, width: 18, height: 18 }} /></span><Chip color={STATUS_COLOR[d.status]}>{d.status}</Chip></div>
                    <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{d.title}</p>
                    <p className="text-[11px] mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>{d.type} · {d.owner}</p>
                    <div className="flex items-center justify-between mt-2"><Chip color={VIS_COLOR[d.visibility]}>{d.visibility}</Chip><span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{d.updated}</span></div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ── Right: document details (only when a doc is selected) ── */}
      {doc && (
        <aside className="w-80 shrink-0 overflow-y-auto p-5" style={{ borderLeft: "1px solid var(--border)", backgroundColor: "var(--bg-surface)" }}>
          <DocDetails doc={doc} onClose={() => setSelectedDoc(null)} onOpen={() => openEditor(doc)}
            onMove={() => setMovingDoc(doc)} onDuplicate={() => { const c = duplicateDocument(doc.id); refresh(); if (c) setSelectedDoc(c.id); }}
            onArchive={() => { archiveDocument(doc.id); setSelectedDoc(null); refresh(); }} />
        </aside>
      )}

      {/* Modals / drawers */}
      {newFolderParent !== false && <NewFolderModal parentId={newFolderParent} onClose={() => setNewFolderParent(false)} onSaved={(f) => { setNewFolderParent(false); refresh(); if (f.parentId) setExpanded(p => new Set(p).add(f.parentId!)); }} />}
      {creatingDoc && <CreateDocumentDrawer folderId={selectedFolder} onClose={() => setCreatingDoc(false)} onCreated={(d, open) => { setCreatingDoc(false); refresh(); setSelectedDoc(d.id); if (open) openEditor(d); }} />}
      {uploading && <UploadModal folderId={selectedFolder} onClose={() => setUploading(false)} />}
      {movingDoc && <MoveDocModal doc={movingDoc} onClose={() => setMovingDoc(null)} onMoved={(fid) => { moveDocument(movingDoc.id, fid); setMovingDoc(null); setSelectedFolder(fid); refresh(); }} />}
      {editingDoc && <DocEditorDrawer docId={editingDoc} onClose={() => { setEditingDoc(null); refresh(); }} onSaved={refresh} />}
      {designingDoc && (() => {
        const d = getDocument(designingDoc);
        if (!d) return null;
        return (
          <DesignStudio mode="document" backLabel="Documents"
            initialName={d.title} initialDesign={d.design ?? emptyDesign("document")}
            onSave={out => {
              updateDocument(d.id, { title: out.name, body: plainTextFromDesign(out.design), design: out.design });
              setDesigningDoc(null); refresh();
            }}
            onClose={() => setDesigningDoc(null)} />
        );
      })()}
    </div>
  );
}

// ─── Folder tree node ─────────────────────────────────────
function TreeNode({ node, depth, expanded, selected, search, dragOver, dragSourceId, onDragOverFolder, onDropFolder, onBeginDrag, onEndDrag, onToggle, onSelect, onNewSub }: {
  node: FolderNode; depth: number; expanded: Set<string>; selected: string; search: string;
  dragOver: string | null; dragSourceId: string | null; onDragOverFolder: (id: string | null) => void; onDropFolder: (id: string, e: React.DragEvent) => void;
  onBeginDrag: (label: string, id: string, e: React.DragEvent) => void; onEndDrag: () => void;
  onToggle: (id: string) => void; onSelect: (id: string) => void; onNewSub: (pid: string) => void;
}) {
  const [menu, setMenu] = useState(false);
  const hasChildren = node.children.length > 0;
  // When searching, auto-show matches + keep ancestors of matches visible.
  const selfMatch = !search || node.name.toLowerCase().includes(search);
  const descMatch = search ? hasDescendantMatch(node, search) : false;
  if (search && !selfMatch && !descMatch) return null;
  const isOpen = expanded.has(node.id) || (!!search && descMatch);
  const isSelected = selected === node.id;
  const isSource = dragSourceId === node.id;
  const isDropTarget = dragOver === node.id && !isSource;
  const count = docCountDeep(node.id);

  return (
    <div>
      <div className="group relative flex items-center rounded-md"
        draggable onDragStart={e => { e.stopPropagation(); e.dataTransfer.setData("text/plain", "folder:" + node.id); e.dataTransfer.effectAllowed = "move"; onBeginDrag(node.name, node.id, e); }}
        onDragEnd={onEndDrag}
        onDragOver={e => { e.preventDefault(); onDragOverFolder(isSource ? null : node.id); }}
        onDragLeave={() => onDragOverFolder(null)}
        onDrop={e => { if (!isSource) onDropFolder(node.id, e); }}
        style={{
          // The move target wears the SAME shade the main nav uses for "you are
          // here" (sidebar-item-active + its text color), so "this is where it
          // lands" reads like "this is where you are". The source itself is
          // never shaded — the floating pill says where it's going.
          backgroundColor: isDropTarget ? "var(--sidebar-item-active)" : isSelected ? ACCENT + "1f" : "transparent",
        }}>

        <button onClick={() => { onSelect(node.id); if (hasChildren) onToggle(node.id); }}
          className="flex-1 flex items-center gap-1.5 px-2 py-1.5 text-sm min-w-0" style={{ paddingLeft: 8 + depth * 14, color: isDropTarget ? "var(--sidebar-text-active)" : isSelected ? ACCENT : "var(--text-secondary)" }}>
          {hasChildren ? <ChevronRight className="w-3.5 h-3.5 shrink-0 transition-transform" style={{ transform: isOpen ? "rotate(90deg)" : "none" }} /> : <span className="w-3.5 shrink-0" />}
          {isOpen && hasChildren ? <FolderOpen className="w-4 h-4 shrink-0" style={{ color: ACCENT }} /> : <Folder className="w-4 h-4 shrink-0" style={{ color: ACCENT }} />}
          <span className="truncate flex-1 text-left">{node.name}</span>
        </button>
        <span className="text-[11px] pr-1.5 shrink-0 group-hover:hidden" style={{ color: "var(--text-muted)" }}>{count || ""}</span>
        <button onClick={() => setMenu(m => !m)} className="hidden group-hover:flex items-center justify-center w-6 h-6 mr-1 rounded shrink-0" style={{ color: "var(--text-muted)" }}><MoreHorizontal className="w-3.5 h-3.5" /></button>
        {menu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenu(false)} />
            <div className="absolute right-1 top-full mt-1 z-50 w-40 rounded-lg py-1" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 12px 32px rgba(0,0,0,0.2)" }}>
              <MenuItem icon={FolderPlus} label="New subfolder" onClick={() => { setMenu(false); onNewSub(node.id); }} />
              <MenuItem icon={Pencil} label="Rename" onClick={() => { setMenu(false); const n = prompt("Rename folder", node.name); if (n?.trim()) { import("@/lib/documents/mock").then(m => { m.renameFolder(node.id, n.trim()); onSelect(node.id); }); } }} />
              <MenuItem icon={Archive} label="Archive" onClick={() => { setMenu(false); if (confirm(`Archive "${node.name}"?`)) import("@/lib/documents/mock").then(m => { m.archiveFolder(node.id); onSelect("hvac-service"); }); }} />
            </div>
          </>
        )}
      </div>
      {hasChildren && isOpen && node.children.map(c => (
        <TreeNode key={c.id} node={c} depth={depth + 1} expanded={expanded} selected={selected} search={search}
          dragOver={dragOver} dragSourceId={dragSourceId} onDragOverFolder={onDragOverFolder} onDropFolder={onDropFolder}
          onBeginDrag={onBeginDrag} onEndDrag={onEndDrag}
          onToggle={onToggle} onSelect={onSelect} onNewSub={onNewSub} />
      ))}
    </div>
  );
}
function hasDescendantMatch(node: FolderNode, search: string): boolean {
  return node.children.some(c => c.name.toLowerCase().includes(search) || hasDescendantMatch(c, search));
}

// ─── Right panel: document details ────────────────────────
function DocDetails({ doc, onClose, onOpen, onMove, onDuplicate, onArchive }: {
  doc: DocItem; onClose: () => void; onOpen: () => void; onMove: () => void; onDuplicate: () => void; onArchive: () => void;
}) {
  const Icon = TYPE_ICON[doc.type] ?? FileText;
  return (
    <>
      <div className="flex items-start justify-between gap-2 mb-4">
        <div className="flex items-center gap-2 min-w-0"><Icon className="w-5 h-5 shrink-0" style={{ color: ACCENT }} /><h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{doc.title}</h3></div>
        <button onClick={onClose} className="p-1 rounded hover:bg-[var(--bg-surface-2)] shrink-0" style={{ color: "var(--text-muted)" }}><X className="w-4 h-4" /></button>
      </div>
      {/* Preview placeholder by type */}
      <div className="rounded-lg mb-4 flex items-center justify-center" style={{ height: 150, backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border)" }}>
        <div className="text-center px-4">
          {doc.type === "Image" ? <ImageIcon className="w-6 h-6 mx-auto mb-1" style={{ color: "var(--text-muted)" }} />
            : <Icon className="w-6 h-6 mx-auto mb-1" style={{ color: ACCENT }} />}
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            {doc.type === "PDF" ? "PDF preview" : doc.type === "Image" ? "Image preview" : doc.type === "Template" ? "Template preview" : doc.body ? `${doc.body.slice(0, 90)}${doc.body.length > 90 ? "…" : ""}` : `${doc.type} preview`}
          </p>
        </div>
      </div>
      <dl className="space-y-3">
        <Detail icon={Shield} label="Status"><Chip color={STATUS_COLOR[doc.status]}>{doc.status}</Chip></Detail>
        <Detail icon={Eye} label="Visibility"><Chip color={VIS_COLOR[doc.visibility]}>{doc.visibility}</Chip></Detail>
        <Detail icon={User} label="Owner"><span style={{ color: "var(--text-secondary)" }}>{doc.owner}</span></Detail>
        <Detail icon={Clock} label="Updated"><span style={{ color: "var(--text-secondary)" }}>{doc.updated}</span></Detail>
        <Detail icon={FileText} label="Version"><span style={{ color: "var(--text-secondary)" }}>v{doc.version}</span></Detail>
        {doc.linkedApp && <Detail icon={Tag} label="Linked app"><Chip color={LINKED_APP_COLOR[doc.linkedApp]}>{doc.linkedApp}</Chip></Detail>}
      </dl>
      {doc.linkedRecords && doc.linkedRecords.length > 0 && (
        <div className="mt-4"><p className="text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: "var(--text-muted)" }}>Linked Records</p>
          <div className="flex flex-wrap gap-1.5">{doc.linkedRecords.map((r, i) => <Chip key={i} color={LINKED_APP_COLOR[r.app]}>{r.label}</Chip>)}</div></div>
      )}
      {doc.tags.length > 0 && <div className="flex flex-wrap gap-1.5 mt-4">{doc.tags.map(t => <span key={t} className="text-[11px] px-2 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-surface-2)", color: "var(--text-muted)" }}>#{t}</span>)}</div>}
      <div className="grid grid-cols-2 gap-2 mt-5">
        <button onClick={onOpen} className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white col-span-2" style={{ backgroundColor: ACCENT }}><FileEdit className="w-4 h-4" /> Open</button>
        <ActionBtn icon={FolderInput} label="Move" onClick={onMove} />
        <ActionBtn icon={Copy} label="Duplicate" onClick={onDuplicate} />
        <ActionBtn icon={Archive} label="Archive" onClick={onArchive} className="col-span-2" danger />
      </div>
      <p className="text-[10px] mt-4 pt-3" style={{ borderTop: "1px solid var(--border)", color: "var(--text-muted)" }}>Version history, approvals & required-reading land in a later phase.</p>
    </>
  );
}

// ─── New Folder modal ─────────────────────────────────────
function NewFolderModal({ parentId, onClose, onSaved }: { parentId: string | null; onClose: () => void; onSaved: (f: { parentId: string | null }) => void }) {
  const folders = getFolders();
  const [name, setName] = useState("");
  const [parent, setParent] = useState<string>(parentId ?? "");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<DocVisibility>("Everyone");
  function save() {
    if (!name.trim()) return;
    const input: NewFolderInput = { name: name.trim(), parentId: parent || null, description: description.trim() || undefined, visibility };
    createFolder(input);
    onSaved({ parentId: parent || null });
  }
  return (
    <Modal title="New Folder" onClose={onClose} footer={<><CancelBtn onClick={onClose} /><SaveBtn onClick={save} label="Create Folder" /></>}>
      <Field label="Folder name"><input value={name} onChange={e => setName(e.target.value)} className={inp} style={inpStyle} autoFocus /></Field>
      <Field label="Parent folder"><UiSelect value={parent} onChange={setParent} options={[{ value: "", label: "Top level (Company Documents)" }, ...folders.map(f => ({ value: f.id, label: folderPath(f.id).map(x => x.name).join(" / ") }))]} /></Field>
      <Field label="Description" hint="optional"><input value={description} onChange={e => setDescription(e.target.value)} className={inp} style={inpStyle} /></Field>
      <Field label="Visibility"><UiSelect value={visibility} onChange={v => setVisibility(v as DocVisibility)} options={DOC_VISIBILITIES.map(x => ({ value: x, label: x }))} /></Field>
      <div className="flex items-center gap-2 text-[11px]" style={{ color: "var(--text-muted)" }}><span className="w-3 h-3 rounded" style={{ backgroundColor: ACCENT }} /> Folder color uses the Documents app accent.</div>
    </Modal>
  );
}

// ─── Create Document drawer ───────────────────────────────
function CreateDocumentDrawer({ folderId, onClose, onCreated }: { folderId: string; onClose: () => void; onCreated: (d: DocItem, open: boolean) => void }) {
  const folders = getFolders();
  const templates = getTemplates();
  const [title, setTitle] = useState("");
  const [type, setType] = useState<DocType>("Editable Document");
  const [folder, setFolder] = useState(folderId);
  const [status, setStatus] = useState<DocStatus>("Draft");
  const [visibility, setVisibility] = useState<DocVisibility>("Everyone");
  const [templateId, setTemplateId] = useState("");
  const [linkedApp, setLinkedApp] = useState<string>("");
  const [linkLabel, setLinkLabel] = useState("");
  const [body, setBody] = useState("");
  // Content mode: plain text here, or a block design built in the Design Studio.
  const [contentMode, setContentMode] = useState<"text" | "design">("text");

  function pickTemplate(id: string) {
    setTemplateId(id);
    const t = templates.find(x => x.id === id);
    if (t) { setType(t.type); setBody(t.body); setContentMode("text"); }
    else setBody("");
  }
  function build(open: boolean) {
    if (!title.trim()) return;
    const d = createDocument({
      title, folderId: folder, type, status, visibility,
      body: contentMode === "design" ? "" : body,
      design: contentMode === "design" ? emptyDesign("document") : undefined,
      linkedApp: (linkedApp || undefined) as LinkedApp | undefined,
      linkedRecords: linkedApp && linkLabel.trim() ? [{ app: linkedApp as LinkedApp, label: linkLabel.trim() }] : undefined,
    });
    onCreated(d, open);
  }

  return (
    <Modal title="New Document" onClose={onClose} width={640}
      footer={<><CancelBtn onClick={onClose} /><button onClick={() => build(false)} className="text-sm font-medium px-3 py-2 rounded-lg" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Create Draft</button><SaveBtn onClick={() => build(true)} label="Create & Open" /></>}>
      <div className="space-y-5">
        <div>
          <BlockTitle>Document Basics</BlockTitle>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Title" className="col-span-2"><input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. AC Service SOP" className={inp} style={inpStyle} autoFocus /></Field>
            <Field label="Type"><UiSelect value={type} onChange={v => setType(v as DocType)} options={DOC_TYPES.map(x => ({ value: x, label: x }))} /></Field>
            <Field label="Folder"><UiSelect value={folder} onChange={setFolder} options={folders.map(f => ({ value: f.id, label: folderPath(f.id).map(x => x.name).join(" / ") }))} /></Field>
            <Field label="Status"><UiSelect value={status} onChange={v => setStatus(v as DocStatus)} options={DOC_STATUSES.filter(x => x !== "Archived").map(x => ({ value: x, label: x }))} /></Field>
            <Field label="Visibility"><UiSelect value={visibility} onChange={v => setVisibility(v as DocVisibility)} options={DOC_VISIBILITIES.map(x => ({ value: x, label: x }))} /></Field>
          </div>
        </div>
        <div>
          <BlockTitle>Start From</BlockTitle>
          <div className="grid grid-cols-2 gap-2">
            <StartCard active={templateId === ""} title="Blank document" desc="Start from scratch" onClick={() => pickTemplate("")} />
            {templates.map(t => <StartCard key={t.id} active={templateId === t.id} title={t.name} desc={t.description} onClick={() => pickTemplate(t.id)} />)}
          </div>
        </div>
        <div>
          <BlockTitle>Link Records <span className="font-normal lowercase tracking-normal" style={{ color: "var(--text-muted)" }}>· optional</span></BlockTitle>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Linked app"><UiSelect value={linkedApp} onChange={setLinkedApp} options={[{ value: "", label: "None" }, ...LINKED_APPS.map(x => ({ value: x, label: x }))]} /></Field>
            <Field label="Record"><input value={linkLabel} onChange={e => setLinkLabel(e.target.value)} placeholder="e.g. East Coast Metal" className={inp} style={inpStyle} disabled={!linkedApp} /></Field>
          </div>
        </div>
        <div>
          <BlockTitle>Content</BlockTitle>
          <div className="grid grid-cols-2 gap-2 mb-2.5">
            <StartCard active={contentMode === "text"} title="Write text" desc="Plain text, edited inline" onClick={() => setContentMode("text")} />
            <StartCard active={contentMode === "design"} title="Design in Studio" desc="Blocks, layout & styles — opens the visual builder" onClick={() => { setContentMode("design"); setTemplateId(""); }} />
          </div>
          {contentMode === "text" ? (
            <>
              <textarea value={body} onChange={e => setBody(e.target.value)} rows={6} placeholder="Write the document content…" className={`${inp} resize-none font-mono text-[13px]`} style={inpStyle} />
              <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>A full rich-text editor lands in a later phase.</p>
            </>
          ) : (
            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>“Create &amp; Open” drops you straight into the Design Studio to build this document.</p>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ─── Upload placeholder ───────────────────────────────────
function UploadModal({ folderId, onClose }: { folderId: string; onClose: () => void }) {
  const folders = getFolders();
  const [folder, setFolder] = useState(folderId);
  return (
    <Modal title="Upload File" onClose={onClose} footer={<><CancelBtn onClick={onClose} /><button disabled className="text-sm font-medium px-4 py-2 rounded-lg text-white opacity-50" style={{ backgroundColor: ACCENT }}>Upload</button></>}>
      <div className="rounded-xl p-8 text-center" style={{ border: "1px dashed var(--border)", backgroundColor: "var(--bg-surface-2)" }}>
        <Upload className="w-7 h-7 mx-auto mb-2" style={{ color: ACCENT }} />
        <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>File upload is coming soon</p>
        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Storage backend lands in a later phase. You can still pick where it&apos;ll live.</p>
      </div>
      <Field label="Folder"><UiSelect value={folder} onChange={setFolder} options={folders.map(f => ({ value: f.id, label: folderPath(f.id).map(x => x.name).join(" / ") }))} /></Field>
      <Field label="Visibility"><UiSelect value="Everyone" onChange={() => {}} options={DOC_VISIBILITIES.map(x => ({ value: x, label: x }))} /></Field>
    </Modal>
  );
}

// ─── Move document modal ──────────────────────────────────
function MoveDocModal({ doc, onClose, onMoved }: { doc: DocItem; onClose: () => void; onMoved: (folderId: string) => void }) {
  const folders = getFolders();
  const [folder, setFolder] = useState(doc.folderId);
  return (
    <Modal title={`Move "${doc.title}"`} onClose={onClose} footer={<><CancelBtn onClick={onClose} /><SaveBtn onClick={() => onMoved(folder)} label="Move" /></>}>
      <Field label="Destination folder"><UiSelect value={folder} onChange={setFolder} options={folders.map(f => ({ value: f.id, label: folderPath(f.id).map(x => x.name).join(" / ") }))} /></Field>
    </Modal>
  );
}

// ─── Document editor drawer ───────────────────────────────
function DocEditorDrawer({ docId, onClose, onSaved }: { docId: string; onClose: () => void; onSaved: () => void }) {
  const original = getDocument(docId);
  const [title, setTitle] = useState(original?.title ?? "");
  const [body, setBody] = useState(original?.body ?? "");
  const [status, setStatus] = useState<DocStatus>(original?.status ?? "Draft");
  const [visibility, setVisibility] = useState<DocVisibility>(original?.visibility ?? "Everyone");
  if (!original) return null;
  function save(publish?: boolean) {
    updateDocument(docId, { title: title.trim() || original!.title, body, status: publish ? "Published" : status, visibility });
    onSaved();
    onClose();
  }
  return (
    <Slideover title="Edit Document" onClose={onClose} width={760}
      footer={<><CancelBtn onClick={onClose} /><button onClick={() => save(false)} className="text-sm font-medium px-3 py-2 rounded-lg" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Save</button><SaveBtn onClick={() => save(true)} label="Publish" /></>}>
      <div className="flex h-full min-h-0">
        <div className="flex-1 min-w-0 p-5 flex flex-col">
          <input value={title} onChange={e => setTitle(e.target.value)} className="text-lg font-semibold bg-transparent outline-none mb-3" style={{ color: "var(--text-primary)" }} />
          <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Write the document content…" className="flex-1 w-full rounded-lg px-3 py-2.5 text-sm outline-none resize-none font-mono" style={inpStyle} />
        </div>
        <div className="w-60 shrink-0 p-4 space-y-3" style={{ borderLeft: "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)" }}>
          <Field label="Status"><UiSelect size="sm" value={status} onChange={v => setStatus(v as DocStatus)} options={DOC_STATUSES.map(x => ({ value: x, label: x }))} /></Field>
          <Field label="Visibility"><UiSelect size="sm" value={visibility} onChange={v => setVisibility(v as DocVisibility)} options={DOC_VISIBILITIES.map(x => ({ value: x, label: x }))} /></Field>
          <Detail icon={User} label="Owner"><span style={{ color: "var(--text-secondary)" }}>{original.owner}</span></Detail>
          <Detail icon={FileText} label="Version"><span style={{ color: "var(--text-secondary)" }}>v{original.version}</span></Detail>
          <div className="rounded-lg px-3 py-2 text-[11px]" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>Version history & activity land in a later phase.</div>
        </div>
      </div>
    </Slideover>
  );
}

// ─── Small shared bits ────────────────────────────────────
function Chip({ children, color }: { children: React.ReactNode; color: string }) {
  return <span className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap" style={{ backgroundColor: color + "22", color }}>{children}</span>;
}
function Detail({ icon: Icon, label, children }: { icon: typeof Eye; label: string; children: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-2"><span className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}><Icon className="w-3.5 h-3.5" /> {label}</span>{children}</div>;
}
function ActionBtn({ icon: Icon, label, onClick, className = "", danger }: { icon: typeof Eye; label: string; onClick: () => void; className?: string; danger?: boolean }) {
  return <button onClick={onClick} className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm ${className}`} style={{ border: "1px solid var(--border)", color: danger ? "#dc2626" : "var(--text-secondary)" }}><Icon className="w-3.5 h-3.5" /> {label}</button>;
}
function MenuItem({ icon: Icon, label, onClick }: { icon: typeof Eye; label: string; onClick: () => void }) {
  return <button onClick={onClick} className="w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-colors hover:bg-[var(--bg-surface-2)]" style={{ color: "var(--text-primary)" }}><Icon className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} /> {label}</button>;
}
function FF({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>{label}</label>{children}</div>;
}
function Field({ label, hint, className, children }: { label: string; hint?: string; className?: string; children: React.ReactNode }) {
  return <div className={className}><label className="flex items-center gap-1.5 text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>{label}{hint && <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>· {hint}</span>}</label>{children}</div>;
}
function BlockTitle({ children }: { children: React.ReactNode }) { return <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>{children}</p>; }
function StartCard({ active, title, desc, onClick }: { active: boolean; title: string; desc: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="text-left rounded-lg p-2.5 transition-all" style={{ border: `1.5px solid ${active ? ACCENT : "var(--border-subtle)"}`, backgroundColor: active ? ACCENT + "12" : "var(--bg-surface-2)" }}>
      <p className="text-sm font-medium" style={{ color: active ? ACCENT : "var(--text-primary)" }}>{title}</p>
      <p className="text-[11px] mt-0.5 leading-snug" style={{ color: "var(--text-muted)" }}>{desc}</p>
    </button>
  );
}
function CancelBtn({ onClick }: { onClick: () => void }) { return <button onClick={onClick} className="text-sm font-medium px-3 py-2 rounded-lg" style={{ color: "var(--text-secondary)" }}>Cancel</button>; }
function SaveBtn({ onClick, label }: { onClick: () => void; label: string }) { return <button onClick={onClick} className="text-sm font-medium px-4 py-2 rounded-lg text-white" style={{ backgroundColor: ACCENT }}>{label}</button>; }

function Modal({ title, onClose, children, footer, width = 448 }: { title: string; onClose: () => void; children: React.ReactNode; footer: React.ReactNode; width?: number }) {
  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-h-[92vh] rounded-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()} style={{ maxWidth: width, backgroundColor: "var(--bg-surface)", boxShadow: "0 16px 48px rgba(0,0,0,0.24)" }}>
        <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}><p className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>{title}</p><button onClick={onClose} style={{ color: "var(--text-muted)" }}><X className="w-4 h-4" /></button></div>
        <div className="flex-1 overflow-y-auto p-5 space-y-3">{children}</div>
        <div className="px-5 py-3 flex items-center justify-end gap-2 shrink-0" style={{ borderTop: "1px solid var(--border)" }}>{footer}</div>
      </div>
    </div>
  );
}
function Slideover({ title, onClose, children, footer, width = 560 }: { title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; width?: number }) {
  return (
    <div className="fixed inset-0 z-[60] flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative h-full flex flex-col" style={{ width: "100%", maxWidth: width, backgroundColor: "var(--bg-surface)", borderLeft: "1px solid var(--border)", boxShadow: "-16px 0 48px -12px rgba(0,0,0,0.3)" }}>
        <div className="px-5 py-4 flex items-center justify-between gap-3 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2 min-w-0"><button onClick={onClose} className="p-1 rounded hover:bg-[var(--bg-surface-2)]" style={{ color: "var(--text-muted)" }}><ArrowLeft className="w-4 h-4" /></button><p className="text-base font-semibold truncate" style={{ color: "var(--text-primary)" }}>{title}</p></div>
          <button onClick={onClose} style={{ color: "var(--text-muted)" }}><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto min-h-0">{children}</div>
        {footer && <div className="px-5 py-3 flex items-center justify-end gap-2 shrink-0" style={{ borderTop: "1px solid var(--border)" }}>{footer}</div>}
      </div>
    </div>
  );
}
