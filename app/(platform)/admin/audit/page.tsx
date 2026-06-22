"use client";

import { PageHeader, FeaturePlaceholder } from "@/components/platform/ui";

export default function AdminAuditPage() {
  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Audit Log" subtitle="Platform-wide history of sensitive changes." accent="#a855f7" />
      <FeaturePlaceholder
        title="Audit history"
        features={["User invited", "Role changed", "Permission changed", "Quote deleted", "Invoice edited", "Document permission changed", "Login activity", "Security events"]}
      />
    </div>
  );
}
