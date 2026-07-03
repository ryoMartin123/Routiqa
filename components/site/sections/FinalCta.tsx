import { PrimaryCta, GhostCta } from "@/components/site/ui";
import Reveal from "@/components/site/Reveal";
import Link from "next/link";
import { APP_LOGIN_HREF } from "@/components/site/nav";

export default function FinalCta() {
  return (
    <section className="site-hero-bg">
      <Reveal>
      <div className="mx-auto max-w-7xl px-5 lg:px-8 py-24 lg:py-28 text-center">
        <h2 className="text-3xl lg:text-5xl font-bold tracking-tight leading-[1.08]" style={{ color: "var(--text-primary)" }}>
          Run your service business<br className="hidden sm:block" /> as <span className="site-gradient-text">one connected system</span>
        </h2>
        <p className="mt-5 text-lg max-w-2xl mx-auto leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          Join the businesses building their operations on Routiqa. Request early access or become a design partner.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <PrimaryCta href="/early-access">Request Early Access</PrimaryCta>
          <GhostCta href="/design-partners">Become a Design Partner</GhostCta>
        </div>
        <p className="mt-6 text-sm" style={{ color: "var(--text-muted)" }}>
          Already have an account? <Link href={APP_LOGIN_HREF} className="font-semibold" style={{ color: "var(--accent-text)" }}>Log in</Link>
        </p>
      </div>
      </Reveal>
    </section>
  );
}
