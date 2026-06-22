"use client";

import { BusinessStructureSection, AppearanceSection } from "@/components/admin/structure";
import { PageHeader, FeaturePlaceholder } from "@/components/platform/ui";

export default function AdminPlatformSettingsPage() {
  return (
    <div className="p-6 space-y-10">
      <PageHeader title="Platform Settings" subtitle="Global platform behavior, business structure, and appearance." accent="#a855f7" />
      <BusinessStructureSection />
      <AppearanceSection />
      <FeaturePlaceholder
        title="Global defaults"
        features={["Default landing app", "Enabled apps & modules", "Feature flags", "Global branding & appearance", "Notification defaults", "Global search settings", "Terminology (later)"]}
      />
    </div>
  );
}
