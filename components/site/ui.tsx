// ─── Marketing site primitives ────────────────────────────
// The reusable pieces every section is built from: section shells, headings,
// feature/industry/package cards, and the two CTA buttons. Light, premium,
// trades-professional — navy ink, indigo brand, soft slate surfaces.

import Link from "next/link";
import Image from "next/image";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, CheckCircle2 } from "lucide-react";

export const INK = "#0f172a";        // headline navy
export const BODY = "#475569";       // body slate
export const BRAND = "#4f46e5";      // Routiqa indigo
export const BRAND_DARK = "#4338ca";

// ── Section shell ──
export function Section({ id, className = "", tinted = false, children }: {
  id?: string; className?: string; tinted?: boolean; children: React.ReactNode;
}) {
  return (
    <section id={id} className={`${tinted ? "bg-slate-50" : "bg-white"} ${className}`}>
      <div className="mx-auto max-w-7xl px-6 lg:px-8 py-20 lg:py-28">{children}</div>
    </section>
  );
}

// ── Eyebrow + headline + sub ──
export function SectionHeading({ eyebrow, title, sub, center = true }: {
  eyebrow?: string; title: string; sub?: string; center?: boolean;
}) {
  return (
    <div className={`${center ? "text-center mx-auto" : ""} max-w-3xl mb-14`}>
      {eyebrow && (
        <p className="text-xs font-bold uppercase tracking-[0.18em] mb-3" style={{ color: BRAND }}>{eyebrow}</p>
      )}
      <h2 className="text-3xl lg:text-[2.6rem] lg:leading-[1.15] font-bold tracking-tight" style={{ color: INK }}>{title}</h2>
      {sub && <p className="mt-4 text-lg leading-relaxed" style={{ color: BODY }}>{sub}</p>}
    </div>
  );
}

// ── CTA buttons ──
export function PrimaryCta({ href, children, large = false }: { href: string; children: React.ReactNode; large?: boolean }) {
  return (
    <Link href={href}
      className={`inline-flex items-center gap-2 rounded-xl font-semibold text-white transition-all hover:-translate-y-0.5 hover:shadow-lg ${large ? "px-7 py-3.5 text-base" : "px-5 py-2.5 text-sm"}`}
      style={{ backgroundColor: BRAND, boxShadow: "0 8px 24px -8px rgba(79,70,229,0.5)" }}>
      {children} <ArrowRight className="w-4 h-4" />
    </Link>
  );
}

export function SecondaryCta({ href, children, large = false }: { href: string; children: React.ReactNode; large?: boolean }) {
  return (
    <Link href={href}
      className={`inline-flex items-center gap-2 rounded-xl font-semibold transition-all hover:-translate-y-0.5 hover:shadow-md bg-white ${large ? "px-7 py-3.5 text-base" : "px-5 py-2.5 text-sm"}`}
      style={{ color: INK, border: "1px solid #e2e8f0", boxShadow: "0 2px 8px rgba(15,23,42,0.05)" }}>
      {children}
    </Link>
  );
}

// ── Feature card (platform grid + feature families) ──
export function FeatureCard({ icon: Icon, title, blurb, href }: {
  icon: LucideIcon; title: string; blurb: string; href?: string;
}) {
  return (
    <div className="group rounded-2xl bg-white p-6 transition-all hover:-translate-y-1 hover:shadow-xl"
      style={{ border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(15,23,42,0.06)" }}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
        style={{ background: "linear-gradient(135deg, #eef2ff, #e0e7ff)" }}>
        <Icon className="w-5 h-5" style={{ color: BRAND }} />
      </div>
      <h3 className="text-[15px] font-semibold mb-1.5" style={{ color: INK }}>{title}</h3>
      <p className="text-sm leading-relaxed" style={{ color: BODY }}>{blurb}</p>
      {href && (
        <Link href={href} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold group-hover:gap-2 transition-all" style={{ color: BRAND }}>
          Learn more <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      )}
    </div>
  );
}

// ── Compact feature row (inside family sections) ──
export function FeatureRow({ icon: Icon, title, blurb }: { icon: LucideIcon; title: string; blurb: string }) {
  return (
    <div className="flex items-start gap-3.5 rounded-xl bg-white p-4 transition-all hover:shadow-md"
      style={{ border: "1px solid #e2e8f0" }}>
      <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "#eef2ff" }}>
        <Icon className="w-4.5 h-4.5" style={{ color: BRAND, width: 18, height: 18 }} />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold" style={{ color: INK }}>{title}</p>
        <p className="text-[13px] leading-relaxed mt-0.5" style={{ color: BODY }}>{blurb}</p>
      </div>
    </div>
  );
}

// ── Industry card ──
export function IndustryCard({ name, blurb }: { name: string; blurb: string }) {
  return (
    <div className="rounded-2xl bg-white p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg"
      style={{ border: "1px solid #e2e8f0" }}>
      <p className="text-[15px] font-bold mb-1" style={{ color: INK }}>{name}</p>
      <p className="text-[13px] leading-relaxed" style={{ color: BODY }}>{blurb}</p>
    </div>
  );
}

// ── Photography ──
// A rounded editorial photo with an optional floating proof chip — the visual
// device used across the feature families and segment tabs.
export function SitePhoto({ src, alt, chip, tall = false }: {
  src: string; alt: string; chip?: string; tall?: boolean;
}) {
  return (
    <div className={`relative w-full ${tall ? "aspect-[4/5] lg:aspect-[3/4]" : "aspect-[4/3]"}`}>
      <div className="absolute inset-0 rounded-3xl overflow-hidden" style={{ boxShadow: "0 32px 80px -32px rgba(15,23,42,0.35)" }}>
        <Image src={src} alt={alt} fill sizes="(max-width: 1024px) 100vw, 44vw" className="object-cover" />
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, transparent 55%, rgba(15,23,42,0.25))" }} />
      </div>
      {chip && (
        <div className="absolute -bottom-4 left-5 right-5 sm:right-auto flex items-center gap-2.5 rounded-2xl bg-white px-4 py-3"
          style={{ border: "1px solid #e2e8f0", boxShadow: "0 16px 40px -16px rgba(15,23,42,0.3)" }}>
          <CheckCircle2 className="w-4.5 h-4.5 shrink-0" style={{ color: "#10b981", width: 18, height: 18 }} />
          <p className="text-[13px] font-semibold" style={{ color: INK }}>{chip}</p>
        </div>
      )}
    </div>
  );
}
