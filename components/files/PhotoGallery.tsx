"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import {
  Image as ImageIcon, FileText, Film, File as FileIcon, Upload, X, Search,
  Download, Pencil, Trash2, Tag, SlidersHorizontal,
} from "lucide-react";
import Select from "@/components/ui/Select";
import { useHierarchy } from "@/components/providers/HierarchyProvider";
import {
  getFiles, getUploaders, getFileAccounts, getFileLocations, addFile, inferFileType,
  fileLinkKind, fileHasLink, LINK_BADGE,
} from "@/lib/files/data";
import type { PhotoFile, FileScope, FileType, FileLinkKind } from "@/lib/files/types";
import { getPhotoCategories } from "@/lib/photo-categories/data";
import { locations as HIER_LOCATIONS } from "@/lib/hierarchy/data";
import { getJob } from "@/lib/jobs/data";
import { getProject } from "@/lib/projects/data";

type RecordLevel = "account" | "property" | "job" | "project" | "work_order" | "agreement" | "global";
type ViewMode = "grid" | "list" | "group_account" | "group_job";

interface Props {
  recordLevel: RecordLevel;
  scope?:       FileScope;
  accountName?: string;
  uploaderName?: string;
  // When the page renders its own Upload button in the header (global page),
  // it hides the toolbar button and triggers uploads via uploadSignal.
  externalUpload?: boolean;
  uploadSignal?:   number;
  // Lets the host page show the live filtered file count (e.g. next to its
  // heading) instead of the toolbar showing it.
  onCount?: (n: number) => void;
}

const FILE_ICON: Record<FileType, typeof ImageIcon> = {
  image: ImageIcon, pdf: FileText, document: FileText, video: Film, other: FileIcon,
};

const LOCATION_NAME = new Map(HIER_LOCATIONS.map(l => [l.id, l.name]));

const LINK_CHIP_LABEL: Record<string, string> = {
  job: "Job Photos", work_order: "Work Order Photos", project: "Project Files",
  property: "Property Files", agreement: "Agreement Documents", quote: "Quote Attachments",
  invoice: "Invoice Attachments", account: "Account-only Files",
};

const QUICK_TABS = [
  { key: "all",       label: "All"             },
  { key: "photos",    label: "Photos"          },
  { key: "documents", label: "Documents"       },
  { key: "required",  label: "Required Photos" },
  { key: "recent",    label: "Recent"          },
] as const;

// View / grouping tabs — rendered as text tabs alongside the quick tabs.
const VIEW_TABS = [
  { key: "grid",          label: "Grid"    },
  { key: "list",          label: "List"    },
  { key: "group_account", label: "Account" },
  { key: "group_job",     label: "Project" },
] as const;

// ─── Scope toggle options (record-level embedded mode) ────
function buildScopeOptions(level: RecordLevel, scope: FileScope): { key: string; label: string; scope: FileScope }[] {
  const out: { key: string; label: string; scope: FileScope }[] = [];
  if (level === "job"        && scope.jobId)        out.push({ key: "record", label: "This Job", scope: { jobId: scope.jobId } });
  if (level === "project"    && scope.projectId)    out.push({ key: "record", label: "This Project", scope: { projectId: scope.projectId } });
  if (level === "work_order" && scope.workOrderId)  out.push({ key: "record", label: "This Work Order", scope: { workOrderId: scope.workOrderId } });
  if (level === "property"   && scope.propertyId)   out.push({ key: "record", label: "This Property", scope: { propertyId: scope.propertyId } });
  if (level === "agreement"  && scope.agreementId)  out.push({ key: "record", label: "This Agreement", scope: { agreementId: scope.agreementId } });
  if (level === "agreement"  && scope.propertyId)   out.push({ key: "property", label: "This Property", scope: { propertyId: scope.propertyId } });
  if ((level === "job" || level === "work_order" || level === "project") && scope.propertyId)
    out.push({ key: "property", label: "This Property", scope: { propertyId: scope.propertyId } });
  if (scope.accountId) out.push({ key: "account", label: "This Account", scope: { accountId: scope.accountId } });
  return out;
}

// Linked-record chips for the detail drawer (best-effort names).
function linkedRecords(f: PhotoFile): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = [];
  if (f.accountName)  out.push({ label: "Account", value: f.accountName });
  if (f.propertyId)   out.push({ label: "Property", value: f.propertyId });
  if (f.jobId)        out.push({ label: "Job", value: getJob(f.jobId)?.title ?? f.jobId });
  if (f.projectId)    out.push({ label: "Project", value: getProject(f.projectId)?.name ?? f.projectId });
  if (f.workOrderId)  out.push({ label: "Work Order", value: f.workOrderId });
  if (f.agreementId)  out.push({ label: "Agreement", value: f.agreementId });
  if (f.quoteId)      out.push({ label: "Quote", value: f.quoteId });
  if (f.invoiceId)    out.push({ label: "Invoice", value: f.invoiceId });
  if (f.equipmentId)  out.push({ label: "Equipment", value: f.equipmentId });
  return out;
}

export default function PhotoGallery({ recordLevel, scope = {}, accountName, uploaderName = "Ryo Martin", externalUpload = false, uploadSignal = 0, onCount }: Props) {
  const categories = useMemo(() => getPhotoCategories().filter(c => c.active), []);
  const catByKey   = useMemo(() => new Map(categories.map(c => [c.key, c])), [categories]);
  const catLabel   = (key: string) => catByKey.get(key)?.name ?? key;
  const catColor   = (key: string) => catByKey.get(key)?.color ?? "#6b7280";

  const isGlobal     = recordLevel === "global";
  const scopeOptions = useMemo(() => buildScopeOptions(recordLevel, scope), [recordLevel, scope]);

  const [activeScopeKey, setActiveScopeKey] = useState(scopeOptions[0]?.key ?? "account");
  const activeScope = isGlobal ? {} : (scopeOptions.find(s => s.key === activeScopeKey)?.scope ?? {});

  // Filters
  const [search, setSearch]       = useState("");
  const [catFilter, setCat]       = useState("all");
  const [typeFilter, setType]     = useState<"all" | FileType>("all");
  const [uploader, setUploader]   = useState("all");
  const [accountFilter, setAccount] = useState("all");
  const [linkFilter, setLink]     = useState<"all" | FileLinkKind>("all");
  const [locationFilter, setLoc]  = useState("all");
  const [dateRange, setDateRange] = useState("all");
  const [view, setView]           = useState<ViewMode>("grid");
  const [quickTab, setQuickTab]   = useState<"all" | "photos" | "documents" | "required" | "recent">("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersRef = useRef<HTMLDivElement>(null);

  const { effectiveCompanyId, effectiveLocationId } = useHierarchy();

  const [files, setFiles]         = useState<PhotoFile[]>([]);
  const [showUpload, setShowUpload] = useState(false);
  const [selected, setSelected]   = useState<PhotoFile | null>(null);

  // Open the upload modal when the page-level Upload button fires a new signal.
  useEffect(() => {
    if (uploadSignal > 0) setShowUpload(true);
  }, [uploadSignal]);

  // Close the filters popover on outside click
  useEffect(() => {
    if (!filtersOpen) return;
    const onDown = (e: MouseEvent) => {
      if (filtersRef.current && !filtersRef.current.contains(e.target as Node)) setFiltersOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [filtersOpen]);

  useEffect(() => { setFiles(getFiles(activeScope)); },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeScopeKey, activeScope.accountId, activeScope.jobId, activeScope.projectId, activeScope.propertyId, activeScope.workOrderId]);

  const accounts  = useMemo(() => getFileAccounts(), []);
  const uploaders = useMemo(() => getUploaders(), []);
  const locs      = useMemo(() => getFileLocations(), []);

  const now = new Date();
  function withinRange(f: PhotoFile): boolean {
    if (dateRange === "all") return true;
    const d = new Date(f.uploadedAt);
    const days = (now.getTime() - d.getTime()) / 86_400_000;
    if (dateRange === "7")    return days <= 7;
    if (dateRange === "30")   return days <= 30;
    if (dateRange === "year") return d.getFullYear() === now.getFullYear();
    return true;
  }

  // Quick-tab constraint (global only)
  function matchesQuickTab(f: PhotoFile): boolean {
    if (!isGlobal || quickTab === "all") return true;
    if (quickTab === "photos")    return f.fileType === "image";
    if (quickTab === "documents") return f.fileType === "pdf" || f.fileType === "document";
    if (quickTab === "required")  return f.fileType === "image" && (!!f.jobId || !!f.workOrderId);
    if (quickTab === "recent")    { const days = (now.getTime() - new Date(f.uploadedAt).getTime()) / 86_400_000; return days <= 30; }
    return true;
  }

  const displayed = useMemo(() => files
    // Respect the hierarchy context selector (global view)
    .filter(f => !isGlobal || !effectiveCompanyId  || f.companyId  === effectiveCompanyId)
    .filter(f => !isGlobal || !effectiveLocationId || f.locationId === effectiveLocationId)
    .filter(matchesQuickTab)
    .filter(f => catFilter === "all"  || f.categoryKey === catFilter)
    .filter(f => typeFilter === "all" || f.fileType === typeFilter)
    .filter(f => uploader === "all"   || f.uploadedBy === uploader)
    .filter(f => !isGlobal || accountFilter === "all"  || f.accountId === accountFilter)
    .filter(f => !isGlobal || linkFilter === "all"     || fileHasLink(f, linkFilter))
    .filter(f => !isGlobal || locationFilter === "all" || f.locationId === locationFilter)
    .filter(f => !isGlobal || withinRange(f))
    .filter(f => {
      if (!search) return true;
      const q = search.toLowerCase();
      return f.fileName.toLowerCase().includes(q)
        || (f.notes ?? "").toLowerCase().includes(q)
        || (f.accountName ?? "").toLowerCase().includes(q)
        || f.tags.some(t => t.toLowerCase().includes(q));
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [files, quickTab, catFilter, typeFilter, uploader, accountFilter, linkFilter, locationFilter, dateRange, search, isGlobal, effectiveCompanyId, effectiveLocationId]);

  // Report the live filtered count up so the host page can show it (e.g. by its heading).
  useEffect(() => { onCount?.(displayed.length); }, [displayed.length, onCount]);

  // ── Active filter chips (advanced filters only) ──
  const accountName_ = (id: string) => accounts.find(a => a.id === id)?.name ?? id;
  const dateLabel    = (v: string) => ({ "7": "Last 7 days", "30": "Last 30 days", year: "This year" } as Record<string, string>)[v] ?? v;
  const linkLabel    = (v: string) => LINK_CHIP_LABEL[v] ?? v;
  const activeChips: { label: string; clear: () => void }[] = [];
  if (isGlobal && accountFilter !== "all")  activeChips.push({ label: accountName_(accountFilter), clear: () => setAccount("all") });
  if (catFilter !== "all")                  activeChips.push({ label: catLabel(catFilter),         clear: () => setCat("all") });
  if (typeFilter !== "all")                 activeChips.push({ label: `Type: ${typeFilter}`,        clear: () => setType("all") });
  if (isGlobal && linkFilter !== "all")     activeChips.push({ label: linkLabel(linkFilter),        clear: () => setLink("all") });
  if (isGlobal && uploader !== "all")       activeChips.push({ label: uploader,                     clear: () => setUploader("all") });
  if (isGlobal && locationFilter !== "all") activeChips.push({ label: LOCATION_NAME.get(locationFilter) ?? locationFilter, clear: () => setLoc("all") });
  if (isGlobal && dateRange !== "all")      activeChips.push({ label: dateLabel(dateRange),         clear: () => setDateRange("all") });

  function clearAllFilters() {
    setAccount("all"); setCat("all"); setType("all"); setLink("all");
    setUploader("all"); setLoc("all"); setDateRange("all");
  }

  // Upload a whole batch at once — each file keeps its own name + auto-detected
  // type; the chosen category and notes apply to all of them.
  function handleUpload(items: { fileName: string; fileType: FileType }[], categoryKey: string, notes: string) {
    const uploadScope: FileScope = isGlobal ? { accountId: scope.accountId } : scope;
    for (const it of items) {
      addFile({ scope: uploadScope, fileName: it.fileName, fileType: it.fileType, categoryKey, uploadedBy: uploaderName, notes, accountName });
    }
    setFiles(getFiles(activeScope));
    setShowUpload(false);
  }

  // ── Grouping for group views ──
  const groups = useMemo(() => {
    if (view !== "group_account" && view !== "group_job") return null;
    const map = new Map<string, { title: string; files: PhotoFile[] }>();
    for (const f of displayed) {
      let key: string, title: string;
      if (view === "group_account") {
        key = f.accountId; title = f.accountName ?? f.accountId;
      } else {
        if (f.jobId)        { key = `job:${f.jobId}`; title = getJob(f.jobId)?.title ?? `Job ${f.jobId}`; }
        else if (f.projectId) { key = `proj:${f.projectId}`; title = getProject(f.projectId)?.name ?? `Project ${f.projectId}`; }
        else { key = "none"; title = "Not linked to a job or project"; }
      }
      if (!map.has(key)) map.set(key, { title, files: [] });
      map.get(key)!.files.push(f);
    }
    return Array.from(map.values()).sort((a, b) => a.title.localeCompare(b.title));
  }, [view, displayed]);

  return (
    <div className="space-y-4">
      {/* ── Toolbar ── Embedded: search (left) · client/project tabs (center) ·
          upload (right). Global keeps tabs (left) · search + filter + upload (right). */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Left zone */}
        <div className="flex-1 min-w-0 flex flex-wrap items-center gap-2">
          {isGlobal ? (
            <div className="flex items-center gap-0.5 flex-wrap">
              {QUICK_TABS.map(t => {
                const active = quickTab === t.key;
                return (
                  <button key={t.key} onClick={() => setQuickTab(t.key)}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                    style={{
                      backgroundColor: active ? "var(--accent-soft-bg)" : "transparent",
                      color: active ? "var(--accent-text)" : "var(--text-muted)",
                      border: `1px solid ${active ? "var(--accent-soft-border)" : "transparent"}`,
                    }}>
                    {t.label}
                  </button>
                );
              })}

              {/* Divider between filter tabs and view tabs */}
              <span className="w-px h-5 mx-1.5 shrink-0" style={{ backgroundColor: "var(--border)" }} />

              {VIEW_TABS.map(v => {
                const active = view === v.key;
                return (
                  <button key={v.key} onClick={() => setView(v.key)}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                    style={{
                      backgroundColor: active ? "var(--accent-soft-bg)" : "transparent",
                      color: active ? "var(--accent-text)" : "var(--text-muted)",
                      border: `1px solid ${active ? "var(--accent-soft-border)" : "transparent"}`,
                    }}>
                    {v.label}
                  </button>
                );
              })}
            </div>
          ) : (
            /* Search — embedded mode: pinned left (sized to match the Tasks search) */
            <div className="flex items-center gap-2 rounded-lg px-3 py-1.5" style={{ backgroundColor: "var(--bg-input)" }}>
              <Search className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search files, jobs, tags…"
                className="bg-transparent text-sm outline-none w-40" style={{ color: "var(--text-primary)" }} />
            </div>
          )}
        </div>

        {/* Center zone — client / project scope tabs (embedded record mode) */}
        {!isGlobal && scopeOptions.length > 1 && (
          <div className="flex items-center rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            {scopeOptions.map(opt => {
              const active = activeScopeKey === opt.key;
              return (
                <button key={opt.key} onClick={() => setActiveScopeKey(opt.key)}
                  className="px-3 py-1.5 text-xs font-medium transition-colors"
                  style={{ backgroundColor: active ? "#4f46e5" : "var(--bg-surface)", color: active ? "#fff" : "var(--text-secondary)" }}>
                  {opt.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Right zone — (global) search + filter · upload */}
        <div className="flex-1 min-w-0 flex items-center gap-2 justify-end">
          {/* Search — global mode: right */}
          {isGlobal && (
            <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ backgroundColor: "var(--bg-input)" }}>
              <Search className="w-4 h-4 shrink-0" style={{ color: "var(--text-muted)" }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search files, accounts, jobs, tags…"
                className="bg-transparent text-sm outline-none w-52" style={{ color: "var(--text-primary)" }} />
            </div>
          )}

          {/* Filters button + popover (global only) */}
          {isGlobal && (
            <div className="relative" ref={filtersRef}>
              <button onClick={() => setFiltersOpen(o => !o)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors"
                style={{
                  border: `1px solid ${activeChips.length > 0 || filtersOpen ? "var(--accent-soft-border)" : "var(--border)"}`,
                  backgroundColor: activeChips.length > 0 ? "var(--accent-soft-bg)" : "var(--bg-surface)",
                  color: activeChips.length > 0 ? "var(--accent-text)" : "var(--text-secondary)",
                }}>
                <SlidersHorizontal className="w-3.5 h-3.5" /> Filters
                {activeChips.length > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ backgroundColor: "var(--accent-soft-2-bg)", color: "var(--accent-text)" }}>
                    {activeChips.length}
                  </span>
                )}
              </button>

              {filtersOpen && (
                <div className="absolute right-0 top-full mt-2 z-50 rounded-xl p-4 w-80"
                  style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 12px 32px rgba(0,0,0,0.18)" }}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Filters</p>
                    {activeChips.length > 0 && (
                      <button onClick={clearAllFilters} className="text-xs" style={{ color: "var(--accent-text)" }}>Clear all</button>
                    )}
                  </div>
                  <div className="space-y-2.5">
                    <FilterField label="Account / Customer">
                      <Select size="sm" value={accountFilter} onChange={setAccount}
                        options={[{ value: "all", label: "All Accounts" }, ...accounts.map(a => ({ value: a.id, label: a.name }))]} />
                    </FilterField>
                    <FilterField label="Linked Record">
                      <Select size="sm" value={linkFilter} onChange={v => setLink(v as "all" | FileLinkKind)}
                        options={[
                          { value: "all", label: "All Linked Records" },
                          { value: "job", label: "Job Photos" },
                          { value: "work_order", label: "Work Order Photos" },
                          { value: "project", label: "Project Files" },
                          { value: "property", label: "Property Files" },
                          { value: "agreement", label: "Agreement Documents" },
                          { value: "quote", label: "Quote Attachments" },
                          { value: "invoice", label: "Invoice Attachments" },
                          { value: "account", label: "Account-only Files" },
                        ]} />
                    </FilterField>
                    <FilterField label="Category">
                      <Select size="sm" value={catFilter} onChange={setCat}
                        options={[{ value: "all", label: "All Categories" }, ...categories.map(c => ({ value: c.key, label: c.name }))]} />
                    </FilterField>
                    <FilterField label="File Type">
                      <Select size="sm" value={typeFilter} onChange={v => setType(v as "all" | FileType)}
                        options={[{ value: "all", label: "All Types" }, { value: "image", label: "Images" }, { value: "pdf", label: "PDFs" }, { value: "document", label: "Documents" }, { value: "video", label: "Video" }, { value: "other", label: "Other" }]} />
                    </FilterField>
                    <FilterField label="Uploaded By">
                      <Select size="sm" value={uploader} onChange={setUploader}
                        options={[{ value: "all", label: "All Uploaders" }, ...uploaders.map(u => ({ value: u, label: u }))]} />
                    </FilterField>
                    {locs.length > 1 && (
                      <FilterField label="Location">
                        <Select size="sm" value={locationFilter} onChange={setLoc}
                          options={[{ value: "all", label: "All Locations" }, ...locs.map(l => ({ value: l, label: LOCATION_NAME.get(l) ?? l }))]} />
                      </FilterField>
                    )}
                    <FilterField label="Date Range">
                      <Select size="sm" value={dateRange} onChange={setDateRange}
                        options={[{ value: "all", label: "Any Date" }, { value: "7", label: "Last 7 days" }, { value: "30", label: "Last 30 days" }, { value: "year", label: "This year" }]} />
                    </FilterField>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Toolbar Upload — minimal accent +chip (matches New Vendor); hidden
              when the page renders its own in the header */}
          {!externalUpload && (
            <button onClick={() => setShowUpload(true)}
              className="group flex items-center gap-1.5 text-sm font-medium transition-colors shrink-0" style={{ color: "#4f46e5" }}>
              <span className="w-5 h-5 rounded-full flex items-center justify-center transition-all group-hover:brightness-95" style={{ backgroundColor: "#4f46e51a" }}><Upload className="w-3 h-3" /></span>
              Upload
            </button>
          )}
        </div>
      </div>

      {/* ── Active filter chips ── */}
      {activeChips.length > 0 && (
        <div className="flex items-center flex-wrap gap-2">
          {activeChips.map((chip, i) => (
            <button key={i} onClick={chip.clear}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full transition-colors"
              style={{ backgroundColor: "var(--bg-input)", color: "var(--text-secondary)" }}>
              {chip.label}
              <X className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
            </button>
          ))}
          <button onClick={clearAllFilters} className="text-xs font-medium px-2 py-1" style={{ color: "var(--accent-text)" }}>
            Clear All
          </button>
        </div>
      )}

      {/* ── Content ── */}
      {displayed.length === 0 ? (
        <div className="rounded-xl py-16 text-center" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
          <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-20" style={{ color: "var(--text-muted)" }} />
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>No files match these filters.</p>
        </div>
      ) : groups ? (
        <div className="space-y-5">
          {groups.map(g => (
            <div key={g.title}>
              <div className="flex items-center gap-2 mb-2">
                <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{g.title}</p>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>{g.files.length}</span>
              </div>
              <FileGrid files={g.files} catLabel={catLabel} catColor={catColor} onOpen={setSelected} />
            </div>
          ))}
        </div>
      ) : view === "list" ? (
        <FileList files={displayed} catLabel={catLabel} catColor={catColor} onOpen={setSelected} showAccount={isGlobal} />
      ) : (
        <FileGrid files={displayed} catLabel={catLabel} catColor={catColor} onOpen={setSelected} />
      )}

      {/* ── Detail drawer ── */}
      {selected && (
        <FileDrawer file={selected} catLabel={catLabel} catColor={catColor} onClose={() => setSelected(null)} />
      )}

      {showUpload && (
        <UploadModal categories={categories.map(c => ({ key: c.key, name: c.name }))}
          onClose={() => setShowUpload(false)} onUpload={handleUpload} />
      )}
    </div>
  );
}

// ─── Related-record badge ─────────────────────────────────
function LinkBadge({ file }: { file: PhotoFile }) {
  const kind = fileLinkKind(file);
  const b = LINK_BADGE[kind];
  return (
    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap"
      style={{ backgroundColor: b.color + "22", color: b.color }}>
      {b.label}
    </span>
  );
}

// ─── Grid view ────────────────────────────────────────────
function FileGrid({ files, catLabel, catColor, onOpen }: {
  files: PhotoFile[]; catLabel: (k: string) => string; catColor: (k: string) => string; onOpen: (f: PhotoFile) => void;
}) {
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))" }}>
      {files.map(f => {
        const Icon = FILE_ICON[f.fileType];
        const color = catColor(f.categoryKey);
        return (
          <button key={f.id} onClick={() => onOpen(f)} className="text-left rounded-xl overflow-hidden group transition-shadow hover:shadow-md"
            style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
            <div className="aspect-[4/3] flex items-center justify-center relative"
              style={{ background: f.fileType === "image" ? `linear-gradient(135deg, ${color}22, ${color}44)` : "var(--bg-surface-2)" }}>
              <Icon className="w-8 h-8" style={{ color: f.fileType === "image" ? color : "var(--text-muted)" }} />
              <span className="absolute top-2 left-2 text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
                style={{ backgroundColor: color + "33", color }}>
                {catLabel(f.categoryKey)}
              </span>
            </div>
            <div className="p-2.5">
              <p className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>{f.fileName}</p>
              {f.accountName && <p className="text-[10px] truncate mt-0.5" style={{ color: "var(--text-secondary)" }}>{f.accountName}</p>}
              <div className="mt-1.5"><LinkBadge file={f} /></div>
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>{f.uploadedBy}</span>
                <span className="text-[10px] shrink-0" style={{ color: "var(--text-muted)" }}>{f.displayDate}</span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ─── List view ────────────────────────────────────────────
function FileList({ files, catLabel, catColor, onOpen, showAccount }: {
  files: PhotoFile[]; catLabel: (k: string) => string; catColor: (k: string) => string; onOpen: (f: PhotoFile) => void; showAccount: boolean;
}) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
      <div className="grid px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider"
        style={{ gridTemplateColumns: showAccount ? "2.2fr 1.4fr 1.4fr 1fr 1fr" : "2.4fr 1.4fr 1fr 1fr", color: "var(--text-muted)", borderBottom: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-surface-2)" }}>
        <span>File</span>{showAccount && <span>Account</span>}<span>Linked To</span><span>Uploaded By</span><span>Date</span>
      </div>
      {files.map((f, i) => {
        const Icon = FILE_ICON[f.fileType];
        const color = catColor(f.categoryKey);
        return (
          <button key={f.id} onClick={() => onOpen(f)}
            className="w-full grid px-4 py-2.5 items-center text-left hover:bg-[var(--bg-surface-2)] transition-colors"
            style={{ gridTemplateColumns: showAccount ? "2.2fr 1.4fr 1.4fr 1fr 1fr" : "2.4fr 1.4fr 1fr 1fr", borderBottom: i < files.length - 1 ? "1px solid var(--border-subtle)" : "none" }}>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: color + "22" }}>
                <Icon className="w-3.5 h-3.5" style={{ color }} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{f.fileName}</p>
                <span className="text-[10px]" style={{ color }}>{catLabel(f.categoryKey)}</span>
              </div>
            </div>
            {showAccount && <span className="text-sm truncate" style={{ color: "var(--text-secondary)" }}>{f.accountName ?? "—"}</span>}
            <div><LinkBadge file={f} /></div>
            <span className="text-sm truncate" style={{ color: "var(--text-secondary)" }}>{f.uploadedBy}</span>
            <span className="text-sm" style={{ color: "var(--text-muted)" }}>{f.displayDate}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Detail drawer ────────────────────────────────────────
function FileDrawer({ file, catLabel, catColor, onClose }: {
  file: PhotoFile; catLabel: (k: string) => string; catColor: (k: string) => string; onClose: () => void;
}) {
  const Icon = FILE_ICON[file.fileType];
  const color = catColor(file.categoryKey);
  const links = linkedRecords(file);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 flex flex-col w-[440px] max-w-full"
        style={{ backgroundColor: "var(--bg-surface)", borderLeft: "1px solid var(--border-subtle)", boxShadow: "-4px 0 24px rgba(0,0,0,0.18)" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>File Details</p>
          <button onClick={onClose} style={{ color: "var(--text-muted)" }}><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Preview */}
          <div className="aspect-[16/10] flex items-center justify-center"
            style={{ background: file.fileType === "image" ? `linear-gradient(135deg, ${color}22, ${color}44)` : "var(--bg-surface-2)" }}>
            <Icon className="w-14 h-14" style={{ color: file.fileType === "image" ? color : "var(--text-muted)" }} />
          </div>

          <div className="p-5 space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: color + "22", color }}>{catLabel(file.categoryKey)}</span>
                <LinkBadge file={file} />
              </div>
              <p className="text-base font-semibold break-words" style={{ color: "var(--text-primary)" }}>{file.fileName}</p>
            </div>

            {/* Linked records */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>Linked Records</p>
              <div className="space-y-1.5">
                {links.map(l => (
                  <div key={l.label} className="flex items-center justify-between gap-3">
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>{l.label}</span>
                    <span className="text-sm font-medium text-right truncate" style={{ color: "var(--text-primary)" }}>{l.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Meta */}
            <div className="pt-3 space-y-1.5" style={{ borderTop: "1px solid var(--border-subtle)" }}>
              <div className="flex items-center justify-between"><span className="text-xs" style={{ color: "var(--text-muted)" }}>Uploaded by</span><span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{file.uploadedBy}</span></div>
              <div className="flex items-center justify-between"><span className="text-xs" style={{ color: "var(--text-muted)" }}>Date</span><span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{file.displayDate}</span></div>
              <div className="flex items-center justify-between"><span className="text-xs" style={{ color: "var(--text-muted)" }}>Location</span><span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{LOCATION_NAME.get(file.locationId) ?? file.locationId}</span></div>
            </div>

            {/* Notes */}
            {file.notes && (
              <div className="pt-3" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>Notes</p>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{file.notes}</p>
              </div>
            )}

            {/* Tags */}
            {file.tags.length > 0 && (
              <div className="pt-3" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>Tags</p>
                <div className="flex flex-wrap gap-1.5">
                  {file.tags.map(t => (
                    <span key={t} className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-full" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-secondary)" }}>
                      <Tag className="w-2.5 h-2.5" /> {t}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 py-4 flex items-center gap-2 shrink-0" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors"
            style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
            <Pencil className="w-3.5 h-3.5" /> Edit
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white transition-colors" style={{ backgroundColor: "#4f46e5" }}>
            <Download className="w-3.5 h-3.5" /> Download
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm ml-auto transition-colors"
            style={{ border: "1px solid #fecaca", color: "#dc2626" }}>
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Filter field (label + control, used in the Filters popover) ──
function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

// ─── Upload modal — real multi-file drag & drop ───────────
// Pick or drop as many files as you like; each file's type (image / document /
// video / …) is detected automatically, so there's no manual type field.
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function UploadModal({ categories, onClose, onUpload }: {
  categories: { key: string; name: string }[];
  onClose: () => void;
  onUpload: (items: { fileName: string; fileType: FileType }[], categoryKey: string, notes: string) => void;
}) {
  const [picked, setPicked]       = useState<File[]>([]);
  const [categoryKey, setCategoryKey] = useState(categories[0]?.key ?? "");
  const [notes, setNotes]         = useState("");
  const [dragOver, setDragOver]   = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function addFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    setPicked(prev => [...prev, ...Array.from(list)]);
  }
  function removeAt(i: number) { setPicked(prev => prev.filter((_, idx) => idx !== i)); }

  function submit() {
    if (!picked.length) return;
    onUpload(picked.map(f => ({ fileName: f.name, fileType: inferFileType(f.name, f.type) })), categoryKey, notes.trim());
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden" onClick={e => e.stopPropagation()}
        style={{ backgroundColor: "var(--bg-surface)", boxShadow: "0 16px 48px rgba(0,0,0,0.24)" }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Upload Files</p>
          <button onClick={onClose} style={{ color: "var(--text-muted)" }}><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-3">
          {/* Dropzone — click to browse or drop files anywhere on it */}
          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
            className="rounded-xl py-8 text-center cursor-pointer transition-colors"
            style={{ border: `2px dashed ${dragOver ? "#4f46e5" : "var(--border)"}`, backgroundColor: dragOver ? "var(--accent-soft-bg)" : "var(--bg-surface-2)" }}>
            <input ref={inputRef} type="file" multiple hidden
              onChange={e => { addFiles(e.target.files); e.target.value = ""; }} />
            <Upload className="w-6 h-6 mx-auto mb-1.5" style={{ color: dragOver ? "var(--accent-text)" : "var(--text-muted)" }} />
            <p className="text-xs font-medium" style={{ color: dragOver ? "var(--accent-text)" : "var(--text-secondary)" }}>
              Drag &amp; drop photos or files here, or click to browse
            </p>
            <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>Add as many as you like — type is detected automatically</p>
          </div>

          {/* Selected files */}
          {picked.length > 0 && (
            <div className="space-y-1.5 max-h-52 overflow-y-auto thin-scroll-y">
              {picked.map((f, i) => {
                const ft = inferFileType(f.name, f.type);
                const Icon = FILE_ICON[ft];
                return (
                  <div key={`${f.name}-${i}`} className="flex items-center gap-2.5 rounded-lg px-2.5 py-2"
                    style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border-subtle)" }}>
                    <Icon className="w-4 h-4 shrink-0" style={{ color: ft === "image" ? "#4f46e5" : "var(--text-muted)" }} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>{f.name}</p>
                      <p className="text-[10px] capitalize" style={{ color: "var(--text-muted)" }}>{ft} · {formatSize(f.size)}</p>
                    </div>
                    <button onClick={() => removeAt(i)} className="shrink-0 p-0.5 rounded hover:bg-[var(--bg-surface)]" style={{ color: "var(--text-muted)" }} title="Remove">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Category</label>
            <Select size="sm" value={categoryKey} onChange={setCategoryKey}
              options={categories.map(c => ({ value: c.key, label: c.name }))} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Notes</label>
            <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional — applied to all files"
              className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
          </div>
        </div>
        <div className="px-5 py-4 flex justify-end gap-2" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-sm" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
          <button onClick={submit} disabled={!picked.length}
            className="px-4 py-1.5 rounded-lg text-sm font-medium text-white disabled:opacity-40" style={{ backgroundColor: "#4f46e5" }}>
            Upload{picked.length > 0 ? ` ${picked.length} file${picked.length === 1 ? "" : "s"}` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
