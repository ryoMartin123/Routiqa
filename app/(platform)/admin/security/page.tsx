"use client";

import { PageHeader, FeaturePlaceholder } from "@/components/platform/ui";

export default function AdminSecurityPage() {
  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Security" subtitle="Platform-wide security and access policies." accent="#a855f7" />
      <FeaturePlaceholder
        title="Security controls"
        features={["Two-factor authentication", "Password policy", "Session timeout", "Login history", "Device / session management", "Allowed domains (later)", "SSO (later)", "Security audit settings"]}
      />
    </div>
  );
}
