import { Section, SectionHeading } from "@/components/site/ui";
import Reveal from "@/components/site/Reveal";
import { ALL_AREAS, type PlatformArea } from "@/components/site/nav";

// Configurable area grid. Defaults to the full platform overview (home page). On
// /product it's reused with the Operations subset + `anchors` so the mega-menu
// deep-links land on the right card.
export default function PlatformGrid({
  areas = ALL_AREAS.filter(a => a.id !== "overview"),
  anchors = false,
  id = "overview",
  eyebrow = "The platform",
  title = "Everything a service business runs on",
  sub = "Ten connected areas, one platform. Start with strong defaults and turn on what you need as you grow.",
}: {
  areas?: PlatformArea[]; anchors?: boolean; id?: string; eyebrow?: string; title?: React.ReactNode; sub?: React.ReactNode;
}) {
  return (
    <Section id={id} grid className="border-b">
      <Reveal>
        <SectionHeading center eyebrow={eyebrow} title={title} sub={sub} />
      </Reveal>
      <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {areas.map((a, i) => (
          <Reveal key={a.id} delay={(i % 3) * 0.08}>
            <div id={anchors ? a.id : undefined} className="group rounded-2xl p-5 h-full transition-all hover:-translate-y-0.5"
              style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)", scrollMarginTop: "5rem" }}>
              <span className="w-10 h-10 rounded-xl flex items-center justify-center mb-3.5" style={{ backgroundColor: "var(--accent-soft-bg)" }}>
                <a.icon className="w-5 h-5" style={{ color: "var(--accent-text)" }} />
              </span>
              <h3 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>{a.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{a.blurb}.</p>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
