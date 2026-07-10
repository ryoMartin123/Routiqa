"use client";

// Documents IA: Company Library = the folder explorer. Every other sidebar
// section is a SMART VIEW over the same documents, filtered by metadata (type /
// folder subtree) — not a folder shortcut. Archived = a filtered view.

import { useParams, useSearchParams } from "next/navigation";
import {
  FileText, FileSignature, GraduationCap, LayoutTemplate, UsersRound, FileBadge,
  HardHat, Settings, Building2, Archive,
} from "lucide-react";
import DocumentsExplorer from "@/components/platform/DocumentsExplorer";
import DocumentSmartView, { type SmartViewConfig } from "@/components/platform/DocumentSmartView";
import { inFolderTree } from "@/lib/documents/mock";

const CONFIGS: Record<string, SmartViewConfig> = {
  sops: { title: "SOPs", subtitle: "Manage standard operating procedures across departments, apps, and teams.", icon: FileText, filter: d => d.type === "SOP", createType: "SOP", createLabel: "Create SOP", reviewColumn: true, defaultFolderId: "hvac-service", extraActions: ["Assign Required Reading"] },
  policies: { title: "Policies", subtitle: "Company, HR, safety, and field policies with acknowledgement tracking.", icon: FileSignature, filter: d => d.type === "Policy", createType: "Policy", createLabel: "Create Policy", ackColumn: true, defaultFolderId: "hr-policies", extraActions: ["View Acknowledgements"] },
  training: { title: "Training", subtitle: "Manage training resources, assigned learning, and completion tracking.", icon: GraduationCap, filter: d => d.type === "Training", createType: "Training", createLabel: "Create Training", trainingColumn: true, defaultFolderId: "hr-training", extraActions: ["Assign Training"] },
  templates: { title: "Templates", subtitle: "Reusable document starters for SOPs, policies, training guides, meeting notes, and forms.", icon: LayoutTemplate, filter: d => d.type === "Template", createType: "Template", createLabel: "Create Template", defaultFolderId: "sales-proposals", extraActions: ["Use Template"] },
  hr: { title: "HR Documents", subtitle: "Handbook, onboarding, HR policies, and employee files.", icon: UsersRound, filter: d => d.type === "HR Document" || inFolderTree(d, "hr"), createType: "HR Document", createLabel: "Create HR Document", ackColumn: true, restricted: true, defaultFolderId: "hr" },
  sales: { title: "Sales Documents", subtitle: "Proposal terms, financing, scripts, and customer-facing content.", icon: FileBadge, filter: d => d.type === "Sales Document" || inFolderTree(d, "sales"), createType: "Sales Document", createLabel: "Create Sales Document", defaultFolderId: "sales", extraActions: ["Link to CRM"] },
  safety: { title: "Safety", subtitle: "Safety policies, toolbox talks, PPE checklists, and incident forms.", icon: HardHat, filter: d => d.type === "Safety Document" || inFolderTree(d, "hvac-safety"), createType: "Safety Document", createLabel: "Create Safety Document", defaultFolderId: "hvac-safety", extraActions: ["Log Incident"] },
  system: { title: "System Management", subtitle: "Internal process, platform, and company management documentation.", icon: Settings, filter: d => d.type === "System Document" || inFolderTree(d, "system"), createType: "System Document", createLabel: "Create System Doc", defaultFolderId: "system" },
  "vendor-documents": { title: "Vendor Documents", subtitle: "W-9s, insurance certificates, price sheets, and vendor contracts.", icon: Building2, filter: d => d.type === "Vendor Document" || inFolderTree(d, "vendors"), createType: "Vendor Document", createLabel: "Add Vendor Document", defaultFolderId: "vendors" },
  "subcontractor-documents": { title: "Subcontractor Documents", subtitle: "Agreements, COIs, W-9s, licenses, and work scopes.", icon: HardHat, filter: d => d.type === "Subcontractor Document" || inFolderTree(d, "subs"), createType: "Subcontractor Document", createLabel: "Add Subcontractor Document", defaultFolderId: "sub-agreements" },
  archived: { title: "Archived", subtitle: "Archived documents across all folders and types.", icon: Archive, filter: () => true, createType: "Other", createLabel: "", archivedView: true },
};

export default function DocumentsSection() {
  const slug = String(useParams()?.section ?? "");
  // Overview deep-links: /documents/library?folder=…&doc=… focuses the explorer.
  const sp = useSearchParams();
  const folder = sp?.get("folder") ?? undefined;
  const docId = sp?.get("doc") ?? undefined;
  if (slug === "library") return <div className="h-full"><DocumentsExplorer initialFolderId={folder} initialDocId={docId} /></div>;
  const cfg = CONFIGS[slug];
  if (cfg) return <DocumentSmartView config={cfg} />;
  return <div className="h-full"><DocumentsExplorer initialFolderId={folder} initialDocId={docId} /></div>;
}
