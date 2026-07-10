"use client";

import { useParams } from "next/navigation";
import MarketingWorkspace, { type MarketingSection } from "@/components/marketing/MarketingWorkspace";
import SectionPlaceholder from "@/components/platform/SectionPlaceholder";

// URL slug → workspace section. Most map 1:1; the kebab-case route for Lead
// Sources maps to the snake_case section key the workspace uses.
const SLUG_TO_SECTION: Record<string, MarketingSection> = {
  campaigns: "campaigns",
  audiences: "audiences",
  templates: "templates",
  automations: "automations",
  "lead-sources": "lead_sources",
  integrations: "integrations",
  performance: "performance",
  settings: "settings",
};

export default function MarketingSectionPage() {
  const params = useParams();
  const slug = String(params?.section ?? "");
  const section = SLUG_TO_SECTION[slug];
  if (section) return <MarketingWorkspace section={section} />;
  // Unknown sub-route — fall back to the shared "coming soon" placeholder.
  return <SectionPlaceholder appId="marketing" />;
}
