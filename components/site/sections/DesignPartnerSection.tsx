import { Section, PrimaryCta, GhostCta } from "@/components/site/ui";
import Reveal from "@/components/site/Reveal";
import { Handshake, MessageSquareText, Rocket } from "lucide-react";

const PERKS = [
  { icon: MessageSquareText, title: "Shape the product", body: "Work directly with our team and influence the roadmap as we build." },
  { icon: Rocket, title: "Early access", body: "Get hands-on with Routiqa before general availability and onboard your team early." },
  { icon: Handshake, title: "Founding pricing", body: "Design partners receive preferred terms as a thank-you for building with us." },
];

export default function DesignPartnerSection() {
  return (
    <Section id="design-partners" grid className="border-b">
      <Reveal direction="scale">
      <div className="rounded-3xl p-8 lg:p-12" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-glow)" }}>
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--accent-text)" }}>Design Partner Program</span>
          <h2 className="mt-4 text-3xl lg:text-4xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>Build Routiqa with us</h2>
          <p className="mt-4 text-base lg:text-lg leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            We're partnering with a small group of service businesses to shape Routiqa around real operations. Design partners get early access, direct input into the roadmap, and founding terms.
          </p>
        </div>
        <div className="mt-8 grid sm:grid-cols-3 gap-5">
          {PERKS.map(p => (
            <div key={p.title}>
              <span className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: "var(--accent-soft-bg)" }}><p.icon className="w-5 h-5" style={{ color: "var(--accent-text)" }} /></span>
              <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{p.title}</h3>
              <p className="mt-1 text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{p.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-9 flex flex-wrap gap-3">
          <PrimaryCta href="/design-partners">Become a Design Partner</PrimaryCta>
          <GhostCta href="/contact">Talk to us</GhostCta>
        </div>
      </div>
      </Reveal>
    </Section>
  );
}
