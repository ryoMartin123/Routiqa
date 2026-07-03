import Hero from "@/components/site/sections/Hero";
import ProblemSection from "@/components/site/sections/ProblemSection";
import SolutionSection from "@/components/site/sections/SolutionSection";
import AppEcosystemGrid from "@/components/site/sections/AppEcosystemGrid";
import ProductShowcase from "@/components/site/sections/ProductShowcase";
import WhyRoutiqa from "@/components/site/sections/WhyRoutiqa";
import DesignPartnerSection from "@/components/site/sections/DesignPartnerSection";
import FinalCta from "@/components/site/sections/FinalCta";

export default function HomePage() {
  return (
    <>
      <Hero />
      <ProblemSection />
      <SolutionSection />
      <AppEcosystemGrid />
      <ProductShowcase withIds />
      <WhyRoutiqa />
      <DesignPartnerSection />
      <FinalCta />
    </>
  );
}
