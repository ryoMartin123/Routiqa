"use client";

import { PageHeader, FeaturePlaceholder } from "@/components/platform/ui";

export default function AdminDataPage() {
  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Data Management" subtitle="Platform-wide data tools." accent="#a855f7" />
      <FeaturePlaceholder
        title="Data tools"
        features={["Import / export", "Backups", "Data retention", "Archive rules", "CSV imports", "Global record cleanup", "Merge tools (later)"]}
      />
    </div>
  );
}
