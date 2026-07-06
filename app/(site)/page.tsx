// ─── Routiqa marketing homepage ───────────────────────────
// The full story in one confident page: hero → trust → platform → segments →
// feature families → Riq → outcomes → industries → packages → demo CTA.

import {
  Hero, TrustStrip, PlatformGrid, SegmentTabs, FeatureFamilies,
  RiqSection, Outcomes, IndustriesSection, Packages, FinalCta,
} from "@/components/site/sections";

export default function HomePage() {
  return (
    <>
      <Hero />
      <TrustStrip />
      <PlatformGrid />
      <SegmentTabs />
      <FeatureFamilies />
      <RiqSection />
      <Outcomes />
      <IndustriesSection />
      <Packages />
      <FinalCta />
    </>
  );
}
