import { CtaGroup } from "@/components/site/ui";
import EcosystemHero from "@/components/site/EcosystemHero";
import ProductFilm from "@/components/site/ProductFilm";

// ─── Hero ─────────────────────────────────────────────────
// Editorial, left-aligned opening — no badge pills, no centered boilerplate.
// The right column is a self-playing 30s product film cutting through the best
// moment of every app; below, the ecosystem composition shows the ten apps
// connected around one platform core.

export default function Hero() {
  return (
    <section className="site-hero-bg border-b overflow-hidden" style={{ borderColor: "var(--border-subtle)" }}>
      <div className="mx-auto max-w-7xl px-5 lg:px-8 pt-20 pb-16 lg:pt-28">
        {/* Copy + product film */}
        <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-12 lg:gap-16 items-center">
          <div>
            <h1 className="text-4xl sm:text-5xl lg:text-[3.6rem] font-bold tracking-tight leading-[1.05]" style={{ color: "var(--text-primary)" }}>
              Every app your business runs on, <span className="site-gradient-text">connected in one platform</span>
            </h1>
            <p className="mt-6 text-lg leading-relaxed max-w-xl" style={{ color: "var(--text-secondary)" }}>
              Routiqa is the operating system for service businesses — CRM, dispatch, technician mobile, communications, marketing, analytics, workspace, documents, accounting, and HR, working from the same data.
            </p>
            <div className="mt-8"><CtaGroup /></div>
          </div>

          <ProductFilm />
        </div>

        {/* The ecosystem */}
        <div className="mt-16 lg:mt-20">
          <EcosystemHero />
        </div>
      </div>
    </section>
  );
}
