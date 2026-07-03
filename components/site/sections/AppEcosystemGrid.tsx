import Image from "next/image";
import { Section, SectionHeading } from "@/components/site/ui";
import Reveal from "@/components/site/Reveal";
import { ECOSYSTEM_APPS } from "@/components/site/apps";
import { APP_PREVIEWS } from "@/components/site/AppPreviews";
import { SHOTS } from "@/components/site/screenshots";

// ─── App ecosystem grid ───────────────────────────────────
// The homepage platform overview: one polished "app card" per module — icon,
// positioning, and a crafted module preview in the product's design language.
// Reinforces the hero's message: a suite of connected apps, not one tool.

export default function AppEcosystemGrid() {
  return (
    <Section id="overview" grid className="border-b">
      <Reveal>
        <SectionHeading
          center
          eyebrow="The platform"
          title={<>One platform. <span className="site-gradient-text">Ten connected apps.</span></>}
          sub="Each app is strong on its own. Together they run the whole operation — office, field, and back office on the same data."
        />
      </Reveal>

      <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {ECOSYSTEM_APPS.map((app, i) => {
          const Preview = APP_PREVIEWS[app.id];
          return (
            <Reveal key={app.id} delay={(i % 5) * 0.07}>
              <div className="group h-full rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1"
                style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
                {/* module snippet: a treated crop of the real app surface, falling
                    back to the crafted panel when no capture exists */}
                <div className="relative h-32 border-b overflow-hidden" style={{ backgroundColor: "var(--bg-page)", borderColor: "var(--border-subtle)" }}>
                  {app.shot ? (
                    <>
                      <Image src={SHOTS[app.shot].src} alt={SHOTS[app.shot].alt} fill sizes="20rem"
                        className="object-cover object-left-top"
                        style={{ transform: "scale(1.55)", transformOrigin: "top left", opacity: 0.92 }} />
                      <div className="absolute inset-0 pointer-events-none"
                        style={{ background: "linear-gradient(180deg, transparent 35%, color-mix(in srgb, var(--bg-surface) 96%, transparent) 100%)" }} />
                    </>
                  ) : (
                    <div className="p-3 h-full"><Preview /></div>
                  )}
                </div>
                {/* identity */}
                <div className="p-4">
                  <div className="flex items-center gap-2.5">
                    <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors duration-300 group-hover:bg-[#4f46e5]" style={{ backgroundColor: "var(--accent-soft-bg)" }}>
                      <app.icon className="w-4 h-4 transition-colors duration-300 group-hover:text-white" style={{ color: "var(--accent-text)" }} />
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{app.name}</h3>
                      <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>{app.role}</p>
                    </div>
                  </div>
                  <p className="mt-2.5 text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>{app.blurb}.</p>
                </div>
              </div>
            </Reveal>
          );
        })}
      </div>

      <Reveal delay={0.2}>
        <p className="mt-10 text-center text-sm" style={{ color: "var(--text-muted)" }}>
          All ten share one customer record, one schedule, and one source of truth — turn on what you need as you grow.
        </p>
      </Reveal>
    </Section>
  );
}
