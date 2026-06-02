"use client";

import { useState } from "react";
import { Images, FileText, UploadCloud, ImageOff, Upload } from "lucide-react";
import PhotoGallery from "@/components/files/PhotoGallery";
import ModuleSummaryCards, { type SummaryCard } from "@/components/shared/ModuleSummaryCards";
import ModuleViewToggle, { type ModuleView } from "@/components/shared/ModuleViewToggle";
import { getFiles } from "@/lib/files/data";
import { WORK_ORDERS, ALL_JOBS } from "@/lib/jobs/data";
import { useHierarchy } from "@/components/providers/HierarchyProvider";

const NOW = new Date();
function isThisMonth(dateStr: string): boolean {
  const d = new Date(dateStr);
  return !isNaN(d.getTime()) && d.getMonth() === NOW.getMonth() && d.getFullYear() === NOW.getFullYear();
}

export default function FilesPage() {
  const { effectiveCompanyId, effectiveLocationId } = useHierarchy();
  const [uploadSignal, setUploadSignal] = useState(0);
  const [moduleView, setModuleView] = useState<ModuleView>("list");
  const [fileCount, setFileCount] = useState(0);

  // Context-filtered file set (respects the selector, like the gallery)
  const files = getFiles({})
    .filter(f => !effectiveCompanyId  || f.companyId  === effectiveCompanyId)
    .filter(f => !effectiveLocationId || f.locationId === effectiveLocationId);

  // "Missing required photos" — active work orders (in this context) with no image file
  const woMissing = Object.entries(WORK_ORDERS).filter(([jobId, wo]) => {
    const job = ALL_JOBS.find(j => j.id === jobId);
    if (!job) return false;
    if (effectiveCompanyId  && job.companyId  !== effectiveCompanyId)  return false;
    if (effectiveLocationId && job.locationId !== effectiveLocationId) return false;
    if (wo.status === "pending") return false;
    return getFiles({ workOrderId: wo.id }).every(f => f.fileType !== "image");
  }).length;

  const summaryCards: SummaryCard[] = [
    { icon: Images,      label: "Total Files",          value: String(files.length),                                              sub: "Across all records",   iconColor: "#4f46e5" },
    { icon: UploadCloud, label: "Uploaded This Month",  value: String(files.filter(f => isThisMonth(f.uploadedAt)).length),       sub: NOW.toLocaleDateString("en-US", { month: "short", year: "numeric" }), iconColor: "#10b981" },
    { icon: ImageOff,    label: "Missing Required Photos", value: String(woMissing),                                              sub: "Active work orders",   iconColor: "#f59e0b" },
    { icon: FileText,    label: "Documents",            value: String(files.filter(f => f.fileType === "pdf" || f.fileType === "document").length), sub: "PDFs & documents", iconColor: "#0891b2" },
  ];

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>Photos &amp; Files</h1>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>
              {fileCount} file{fileCount === 1 ? "" : "s"}
            </span>
          </div>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            Global media library — search across accounts, properties, jobs, projects, and more
          </p>
        </div>
        <ModuleViewToggle view={moduleView} onChange={setModuleView} listLabel="Library" />
        <div className="flex-1 flex justify-end">
          <button onClick={() => setUploadSignal(n => n + 1)}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors">
            <Upload className="w-4 h-4" /> Upload
          </button>
        </div>
      </div>

      {moduleView === "overview" && <ModuleSummaryCards cards={summaryCards} />}

      {moduleView === "list" && (
        <PhotoGallery recordLevel="global" externalUpload uploadSignal={uploadSignal} onCount={setFileCount} />
      )}
    </div>
  );
}
