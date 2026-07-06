"use client";

// ─── Homepage sections ────────────────────────────────────
// The full marketing story, in order: hero → trust strip → platform grid →
// segment tabs → feature families → Riq → outcomes → industries → packages →
// demo CTA. Copy is benefit-led and concise; every section reuses the ui.tsx
// primitives so the page stays visually consistent.

import { useState } from "react";
import {
  Users, CalendarRange, CalendarClock, Megaphone, UsersRound, Calculator,
  Smartphone, FolderKanban, Globe, BarChart3, Sparkles, PhoneCall, TrendingUp,
  Radio, MessageSquare, History, ClipboardList, Camera, FilePen, Wallet,
  Mail, BellRing, Star, FileCheck, Receipt, PieChart, ShoppingCart,
  FileBarChart, ShieldCheck, GraduationCap, Timer, Banknote, StickyNote,
  AudioLines, SearchCheck, Route, PenLine, FileText, CheckCircle2,
  Home, Building2, HardHat, KeyRound, LayoutGrid, Zap, Eye, Repeat,
} from "lucide-react";
import HeroMockup from "./HeroMockup";
import { INDUSTRIES, DEMO_HREF } from "./nav";
import {
  Section, SectionHeading, PrimaryCta, SecondaryCta,
  FeatureCard, FeatureRow, IndustryCard, SitePhoto, INK, BODY, BRAND,
} from "./ui";

// ═══ 3. Hero ═══
export function Hero() {
  return (
    <section className="relative overflow-hidden bg-white">
      {/* Soft brand wash */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(60rem 32rem at 50% -8rem, rgba(79,70,229,0.10), transparent 65%), radial-gradient(40rem 24rem at 85% 10rem, rgba(109,40,217,0.06), transparent 60%)" }} />
      <div className="relative mx-auto max-w-7xl px-6 lg:px-8 pt-20 lg:pt-28 pb-28 lg:pb-36">
        <div className="mx-auto max-w-4xl text-center">
          <p className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold mb-6"
            style={{ backgroundColor: "#eef2ff", color: BRAND, border: "1px solid #e0e7ff" }}>
            <Sparkles className="w-3.5 h-3.5" /> Now with Riq — the built-in AI assistant
          </p>
          <h1 className="text-4xl sm:text-5xl lg:text-[3.75rem] lg:leading-[1.08] font-bold tracking-tight" style={{ color: INK }}>
            Run your entire service business from one platform.
          </h1>
          <p className="mt-6 text-lg lg:text-xl leading-relaxed max-w-3xl mx-auto" style={{ color: BODY }}>
            Routiqa brings CRM, dispatch, marketing, communication, accounting, HR, projects,
            reporting, and AI into one connected workspace built for the trades.
          </p>
          <div className="mt-9 flex items-center justify-center gap-3 flex-wrap">
            <PrimaryCta href={DEMO_HREF} large>Book a Demo</PrimaryCta>
            <SecondaryCta href="#platform" large>Explore Platform</SecondaryCta>
          </div>
        </div>
        <div className="mt-20 lg:mt-24 px-4 lg:px-0">
          <HeroMockup />
        </div>
      </div>
    </section>
  );
}

// ═══ 4. Trust strip ═══
const TRUST_BADGES = ["HVAC", "Plumbing", "Electrical", "Roofing", "Property Maintenance", "Construction", "Commercial Service"];
export function TrustStrip() {
  return (
    <section className="bg-slate-50" style={{ borderTop: "1px solid #f1f5f9", borderBottom: "1px solid #f1f5f9" }}>
      <div className="mx-auto max-w-7xl px-6 lg:px-8 py-10 text-center">
        <p className="text-sm font-medium mb-5" style={{ color: BODY }}>
          Built for the teams that keep homes, buildings, and businesses running.
        </p>
        <div className="flex items-center justify-center gap-2.5 flex-wrap">
          {TRUST_BADGES.map(b => (
            <span key={b} className="px-4 py-1.5 rounded-full text-[13px] font-semibold bg-white"
              style={{ color: INK, border: "1px solid #e2e8f0" }}>{b}</span>
          ))}
        </div>
      </div>
    </section>
  );
}

// ═══ 5. Platform grid ═══
const PLATFORM_CARDS = [
  { icon: Users,         title: "CRM",             blurb: "Every customer, property, and conversation on one record." },
  { icon: Radio,         title: "Dispatch",        blurb: "A live drag-and-drop board your dispatcher can trust." },
  { icon: CalendarClock, title: "Scheduling",      blurb: "Book the right tech at the right time, without the whiteboard." },
  { icon: Megaphone,     title: "Marketing",       blurb: "Campaigns and follow-ups powered by your real job data." },
  { icon: UsersRound,    title: "Team Workspace",  blurb: "Announcements, training, and coordination for the whole crew." },
  { icon: Calculator,    title: "Accounting",      blurb: "Invoices, payments, and clean books without re-keying." },
  { icon: ShieldCheck,   title: "HR",              blurb: "Roles, permissions, time, and onboarding in one place." },
  { icon: Smartphone,    title: "Mobile App",      blurb: "Everything the tech needs in the truck and on site." },
  { icon: FolderKanban,  title: "Projects",        blurb: "Stages, crews, budgets, and progress billing on one timeline." },
  { icon: Globe,         title: "Customer Portal", blurb: "Estimates, invoices, and updates customers can self-serve." },
  { icon: BarChart3,     title: "Reporting",       blurb: "The numbers behind every job, crew, and dollar." },
  { icon: Sparkles,      title: "Riq AI",          blurb: "A built-in assistant that flags what needs attention next." },
];

export function PlatformGrid() {
  return (
    <Section id="platform">
      <SectionHeading
        eyebrow="The Platform"
        title="All the tools your team needs, connected from first call to final payment."
        sub="No integrations to babysit, no double-entry between systems. When everything runs on one platform, every record stays connected."
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {PLATFORM_CARDS.map(c => <FeatureCard key={c.title} icon={c.icon} title={c.title} blurb={c.blurb} href="#demo" />)}
      </div>
    </Section>
  );
}

// ═══ 6. Segment tabs ═══
const SEGMENTS = [
  {
    key: "residential", label: "Residential Service", icon: Home,
    headline: "Book calls, dispatch techs, sell options, collect payment, and keep homeowners updated.",
    points: ["Call booking with customer history on screen", "Good-better-best options techs present at the door", "Text updates and on-my-way notifications", "Payment collected on site, synced to the books"],
    photo: "/site/home-service.jpg", photoAlt: "Technician working inside a customer's home", chip: "Homeowner updated automatically",
  },
  {
    key: "commercial", label: "Commercial Service", icon: Building2,
    headline: "Manage locations, contacts, assets, service agreements, multi-party billing, and recurring work.",
    points: ["Multi-location accounts with per-site history", "Tracked equipment and service records per asset", "Agreements that schedule and bill themselves", "Terms billing with statements and aging"],
    photo: "/site/tech-electrical.jpg", photoAlt: "Technician servicing commercial building equipment", chip: "Asset history on every unit",
  },
  {
    key: "projects", label: "Projects & Construction", icon: HardHat,
    headline: "Track project stages, crews, files, budgets, change orders, progress billing, and job costing.",
    points: ["Stage-by-stage timelines with crew assignments", "Budgets and job costing against actuals", "Change orders documented and approved", "Progress billing tied to completed phases"],
    photo: "/site/site-rebar.jpg", photoAlt: "Crew working on an active construction site", chip: "Every phase on one timeline",
  },
  {
    key: "property", label: "Property Maintenance", icon: KeyRound,
    headline: "Coordinate tenants, owners, vendors, maintenance requests, billing, inspections, and communication.",
    points: ["Requests routed from tenant to tech automatically", "Owner and tenant communication kept separate", "Inspections with photo documentation", "Billing split correctly across parties"],
    photo: "/site/tech-portrait.jpg", photoAlt: "Maintenance technician on site at a property", chip: "Tenant to tech, automatically",
  },
];

export function SegmentTabs() {
  const [active, setActive] = useState(SEGMENTS[0].key);
  const seg = SEGMENTS.find(s => s.key === active)!;
  return (
    <Section id="segments" tinted>
      <SectionHeading
        eyebrow="Every Kind of Work"
        title="One platform that fits the work you actually do."
      />
      <div className="flex items-center justify-center gap-2 flex-wrap mb-10">
        {SEGMENTS.map(s => (
          <button key={s.key} onClick={() => setActive(s.key)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={active === s.key
              ? { backgroundColor: BRAND, color: "#fff", boxShadow: "0 8px 24px -8px rgba(79,70,229,0.5)" }
              : { backgroundColor: "#fff", color: INK, border: "1px solid #e2e8f0" }}>
            <s.icon className="w-4 h-4" /> {s.label}
          </button>
        ))}
      </div>
      <div className="mx-auto max-w-6xl rounded-3xl bg-white p-6 lg:p-10" style={{ border: "1px solid #e2e8f0", boxShadow: "0 12px 40px -16px rgba(15,23,42,0.12)" }}>
        <div className="grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <p className="text-xl lg:text-2xl font-semibold leading-snug" style={{ color: INK }}>{seg.headline}</p>
            <div className="mt-6 space-y-3">
              {seg.points.map(p => (
                <p key={p} className="flex items-start gap-2.5 text-[15px]" style={{ color: BODY }}>
                  <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" style={{ color: "#10b981" }} /> {p}
                </p>
              ))}
            </div>
          </div>
          <div className="pb-4">
            <SitePhoto src={seg.photo} alt={seg.photoAlt} chip={seg.chip} />
          </div>
        </div>
      </div>
    </Section>
  );
}

// ═══ 7. Feature families ═══
import type { LucideIcon } from "lucide-react";
interface Family {
  id: string; eyebrow: string; title: string; sub: string;
  photo: string; photoAlt: string; chip: string;
  cards: { icon: LucideIcon; title: string; blurb: string }[];
}

const FAMILIES: Family[] = [
  {
    id: "front-office", eyebrow: "Front Office",
    photo: "/site/office-team.jpg", photoAlt: "Office team coordinating the day's work", chip: "Every call lands on the board",
    title: "Give your office one command center.",
    sub: "Every call, lead, and booking lands in the same system your dispatcher runs — nothing lives on sticky notes.",
    cards: [
      { icon: PhoneCall,     title: "Call Booking",           blurb: "Book with the customer's full history on screen." },
      { icon: TrendingUp,    title: "Lead Management",        blurb: "A pipeline that shows exactly what to chase next." },
      { icon: CalendarClock, title: "Scheduling",             blurb: "Capacity, skills, and drive time in every decision." },
      { icon: Radio,         title: "Dispatch",               blurb: "Drag, drop, and adjust the day in real time." },
      { icon: MessageSquare, title: "Customer Communication", blurb: "Two-way texting from the record, not a side app." },
      { icon: History,       title: "Customer History",       blurb: "Every visit, quote, and payment — one timeline." },
    ],
  },
  {
    id: "field-ops", eyebrow: "Field Operations",
    photo: "/site/tech-electrical.jpg", photoAlt: "Technician completing work in the field", chip: "Scope, photos, and payment in hand",
    title: "Give your technicians everything they need in the field.",
    sub: "The truck gets the same system as the office — scope, history, pricing, photos, and payment, with nothing lost in handoff.",
    cards: [
      { icon: Smartphone,    title: "Mobile Job View",     blurb: "Scope, contacts, history, and directions in hand." },
      { icon: ClipboardList, title: "Forms & Checklists",  blurb: "Required steps that make quality consistent." },
      { icon: Camera,        title: "Photos & Files",      blurb: "Before-and-after documentation tied to the job." },
      { icon: History,       title: "Equipment History",   blurb: "What's installed, when it was serviced, by whom." },
      { icon: FilePen,       title: "Estimates",           blurb: "Options built and presented on site." },
      { icon: Wallet,        title: "Payments",            blurb: "Card, check, or financing — collected at the door." },
    ],
  },
  {
    id: "customer-experience", eyebrow: "Customer Experience",
    photo: "/site/home-service.jpg", photoAlt: "Service professional working in a customer's home", chip: "Customers updated without extra calls",
    title: "Keep customers informed without adding office work.",
    sub: "Confirmations, updates, and approvals go out automatically — customers stay in the loop while your team stays on task.",
    cards: [
      { icon: MessageSquare, title: "Two-Way SMS",           blurb: "Real conversations, saved to the record." },
      { icon: Mail,          title: "Email",                 blurb: "Quotes, invoices, and updates that match your brand." },
      { icon: Globe,         title: "Customer Portal",       blurb: "Self-serve estimates, invoices, and history." },
      { icon: BellRing,      title: "Appointment Reminders", blurb: "Fewer no-shows without a single phone call." },
      { icon: Star,          title: "Review Requests",       blurb: "Ask at the right moment, automatically." },
      { icon: FileCheck,     title: "Estimate Approvals",    blurb: "One-tap approval that starts the work." },
    ],
  },
  {
    id: "financial", eyebrow: "Financial Operations",
    photo: "/site/office-finance.jpg", photoAlt: "Reviewing job financials at the office", chip: "Every dollar tied to the work",
    title: "See the money behind every job.",
    sub: "From deposit to final payment, every dollar ties back to the work — so the books match the field without re-entry.",
    cards: [
      { icon: Receipt,      title: "Invoices",         blurb: "Built from captured work, not typed from memory." },
      { icon: Wallet,       title: "Payments",         blurb: "Deposits, progress payments, and finals — tracked." },
      { icon: Calculator,   title: "Accounting",       blurb: "Clean books that reconcile with the jobs." },
      { icon: PieChart,     title: "Job Costing",      blurb: "Know which work actually makes money." },
      { icon: ShoppingCart, title: "Purchase Orders",  blurb: "Parts ordered, received, and billed to the job." },
      { icon: FileBarChart, title: "Reporting",        blurb: "Revenue, close rate, and ticket size at a glance." },
    ],
  },
  {
    id: "team", eyebrow: "Team & HR",
    photo: "/site/crew-construction.jpg", photoAlt: "A service crew reviewing the job site together", chip: "One workspace for the whole crew",
    title: "Manage the people behind the work.",
    sub: "One workspace for who's on the team, what they can access, and how they're doing — from first day to every payday.",
    cards: [
      { icon: UsersRound,    title: "Team Workspace",      blurb: "Announcements, docs, and coordination in one hub." },
      { icon: ShieldCheck,   title: "Roles & Permissions", blurb: "Everyone sees exactly what their job needs." },
      { icon: GraduationCap, title: "Training",            blurb: "Onboarding and SOPs where the work happens." },
      { icon: Timer,         title: "Time Tracking",       blurb: "Hours captured against real jobs." },
      { icon: Banknote,      title: "Payroll Support",     blurb: "Clean time data your payroll can trust." },
      { icon: StickyNote,    title: "Internal Notes",      blurb: "Context that travels with the record, not the hallway." },
    ],
  },
];

export function FeatureFamilies() {
  return (
    <>
      {FAMILIES.map((f, i) => {
        const photoFirst = i % 2 === 1;   // alternate photo side for pacing
        return (
          <Section key={f.id} id={f.id} tinted={i % 2 === 1}>
            <div className="grid lg:grid-cols-[1.15fr_1fr] gap-12 lg:gap-16 items-center">
              <div className={photoFirst ? "lg:order-2" : ""}>
                <SectionHeading eyebrow={f.eyebrow} title={f.title} sub={f.sub} center={false} />
                <div className="grid sm:grid-cols-2 gap-3 -mt-4">
                  {f.cards.map(c => <FeatureRow key={c.title} icon={c.icon} title={c.title} blurb={c.blurb} />)}
                </div>
              </div>
              <div className={photoFirst ? "lg:order-1" : ""}>
                <SitePhoto src={f.photo} alt={f.photoAlt} chip={f.chip} tall />
              </div>
            </div>
          </Section>
        );
      })}
    </>
  );
}

// ═══ 8. Riq AI section ═══
const RIQ_SUGGESTIONS = [
  { icon: Camera,      text: "This job is missing before photos." },
  { icon: FilePen,     text: "The customer has an open estimate from 14 days ago." },
  { icon: Route,       text: "This technician is running behind based on current route timing." },
  { icon: Receipt,     text: "This invoice is ready to send." },
  { icon: Repeat,      text: "This maintenance agreement is up for renewal." },
];

const RIQ_CAPABILITIES = [
  { icon: AudioLines, title: "Summarize Calls",        blurb: "Every booking call becomes clean notes on the record." },
  { icon: PenLine,    title: "Draft Estimates",        blurb: "A first draft from the job scope, ready to review." },
  { icon: SearchCheck, title: "Flag Missing Job Info", blurb: "Photos, signatures, and details that slipped." },
  { icon: BellRing,   title: "Suggest Follow-Ups",     blurb: "The right customer, at the right moment." },
  { icon: FileText,   title: "Find Customer Context",  blurb: "The history you need, surfaced when you need it." },
  { icon: Eye,        title: "Spot Operational Issues", blurb: "Jobs stalling, routes slipping, money waiting." },
];

export function RiqSection() {
  return (
    <section id="riq" className="relative overflow-hidden" style={{ backgroundColor: "#0f172a" }}>
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(50rem 28rem at 20% -4rem, rgba(109,40,217,0.28), transparent 60%), radial-gradient(44rem 26rem at 90% 110%, rgba(79,70,229,0.22), transparent 60%)" }} />
      <div className="relative mx-auto max-w-7xl px-6 lg:px-8 py-20 lg:py-28">
        <div className="grid lg:grid-cols-2 gap-14 items-center">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold mb-6"
              style={{ backgroundColor: "rgba(139,92,246,0.15)", color: "#c4b5fd", border: "1px solid rgba(139,92,246,0.3)" }}>
              <Sparkles className="w-3.5 h-3.5" /> Riq · Built into Routiqa
            </p>
            <h2 className="text-3xl lg:text-[2.6rem] lg:leading-[1.15] font-bold tracking-tight text-white">
              Riq helps your team move faster without losing control.
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-slate-300">
              From call summaries and job notes to estimate drafts, dispatch suggestions, and
              follow-up reminders, Riq works inside Routiqa to help your office and field team stay ahead.
            </p>
            <div className="mt-8 grid sm:grid-cols-2 gap-3">
              {RIQ_CAPABILITIES.map(c => (
                <div key={c.title} className="flex items-start gap-3 rounded-xl p-3.5" style={{ backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <c.icon className="w-4.5 h-4.5 shrink-0 mt-0.5" style={{ color: "#a78bfa", width: 18, height: 18 }} />
                  <div>
                    <p className="text-sm font-semibold text-white">{c.title}</p>
                    <p className="text-[13px] text-slate-400 mt-0.5 leading-snug">{c.blurb}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-9">
              <PrimaryCta href={DEMO_HREF} large>See Riq in action</PrimaryCta>
            </div>
          </div>

          {/* Suggestion feed */}
          <div className="rounded-2xl p-5" style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <p className="text-xs font-bold uppercase tracking-wider mb-4 flex items-center gap-2" style={{ color: "#a78bfa" }}>
              <Sparkles className="w-3.5 h-3.5" /> What Riq is watching right now
            </p>
            <div className="space-y-2.5">
              {RIQ_SUGGESTIONS.map((sug, i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl px-4 py-3.5 bg-white transition-transform hover:-translate-y-0.5"
                  style={{ boxShadow: "0 8px 24px -12px rgba(0,0,0,0.5)" }}>
                  <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "#f5f3ff" }}>
                    <sug.icon className="w-4 h-4" style={{ color: "#6d28d9" }} />
                  </span>
                  <p className="text-sm font-medium flex-1" style={{ color: INK }}>{sug.text}</p>
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg shrink-0" style={{ backgroundColor: "#eef2ff", color: BRAND }}>Review</span>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-slate-500 mt-4 text-center">Suggestions surface inside the records they belong to — your team stays in control.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ═══ 9. Outcomes ═══
const OUTCOMES = [
  { icon: PhoneCall,  title: "Book more work",          blurb: "Faster follow-up on every lead and open estimate — nothing waits in an inbox." },
  { icon: Radio,      title: "Dispatch with less chaos", blurb: "Cleaner handoffs between office and field, with the whole day on one board." },
  { icon: TrendingUp, title: "Increase average ticket",  blurb: "Options presented on every job, and fewer missed details that leave money behind." },
  { icon: Zap,        title: "Get paid faster",          blurb: "Invoices built from captured work and payment taken on site — less waiting, less chasing." },
  { icon: LayoutGrid, title: "Reduce double-entry",      blurb: "One record from call to payment means less duplicate work across systems." },
  { icon: ShieldCheck, title: "Improve accountability",  blurb: "Checklists, photos, and timestamps — better visibility into who did what, when." },
  { icon: Eye,        title: "See real-time performance", blurb: "Revenue, capacity, and job status live — not in next week's spreadsheet." },
  { icon: Repeat,     title: "Keep customers coming back", blurb: "Agreements, reminders, and follow-ups that make repeat work the default." },
];

export function Outcomes() {
  return (
    <Section id="outcomes" tinted>
      <SectionHeading
        eyebrow="Why Teams Switch"
        title="Built to improve the way your business runs."
        sub="Not features for a checklist — changes you feel in the day-to-day: fewer missed details, cleaner handoffs, better visibility, less duplicate work."
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {OUTCOMES.map(o => (
          <div key={o.title} className="rounded-2xl bg-white p-6" style={{ border: "1px solid #e2e8f0" }}>
            <o.icon className="w-5 h-5 mb-3" style={{ color: BRAND }} />
            <p className="text-[15px] font-bold mb-1.5" style={{ color: INK }}>{o.title}</p>
            <p className="text-[13px] leading-relaxed" style={{ color: BODY }}>{o.blurb}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ═══ 10. Industries ═══
export function IndustriesSection() {
  return (
    <Section id="industries">
      <SectionHeading
        eyebrow="Industries"
        title="Purpose-built for the trades and service businesses."
        sub="Routiqa speaks the language of the work — visits and work orders, agreements and assets, crews and callbacks."
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {INDUSTRIES.map(ind => <IndustryCard key={ind.name} name={ind.name} blurb={ind.blurb} />)}
      </div>
    </Section>
  );
}

// ═══ 11. Packages ═══
const PACKAGES = [
  {
    name: "Starter",
    tagline: "For small teams getting organized.",
    features: ["CRM & customer records", "Scheduling & dispatch board", "Jobs & work orders", "Two-way communication", "Invoices & payments"],
    highlighted: false,
  },
  {
    name: "Growth",
    tagline: "For teams ready to scale operations.",
    features: ["Everything in Starter", "Marketing campaigns & reviews", "Reporting & dashboards", "Maintenance agreements", "Inventory & purchase orders", "Technician mobile app", "Automations"],
    highlighted: true,
  },
  {
    name: "Pro",
    tagline: "For companies that want the full operating system.",
    features: ["Everything in Growth", "Accounting tools & job costing", "HR & team workspace", "Advanced reporting", "Riq AI assistant", "Multi-location tools", "Customer portal"],
    highlighted: false,
  },
];

export function Packages() {
  return (
    <Section id="packages" tinted>
      <SectionHeading
        eyebrow="Packages"
        title="Start where you are. Grow into the full platform."
        sub="Every package runs on the same connected system — upgrade when the business is ready, and nothing has to migrate."
      />
      <div className="grid lg:grid-cols-3 gap-5 max-w-5xl mx-auto items-stretch">
        {PACKAGES.map(p => (
          <div key={p.name} className="relative rounded-2xl p-7 flex flex-col bg-white"
            style={p.highlighted
              ? { border: `2px solid ${BRAND}`, boxShadow: "0 20px 50px -20px rgba(79,70,229,0.35)" }
              : { border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(15,23,42,0.06)" }}>
            {p.highlighted && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[11px] font-bold text-white" style={{ backgroundColor: BRAND }}>
                Most Popular
              </span>
            )}
            <p className="text-lg font-bold" style={{ color: INK }}>{p.name}</p>
            <p className="text-sm mt-1 mb-5" style={{ color: BODY }}>{p.tagline}</p>
            <ul className="space-y-2.5 flex-1">
              {p.features.map(f => (
                <li key={f} className="flex items-start gap-2.5 text-sm" style={{ color: BODY }}>
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#10b981" }} /> {f}
                </li>
              ))}
            </ul>
            <div className="mt-7">
              <a href={DEMO_HREF}
                className="block text-center rounded-xl px-5 py-2.5 text-sm font-semibold transition-all hover:-translate-y-0.5"
                style={p.highlighted
                  ? { backgroundColor: BRAND, color: "#fff", boxShadow: "0 8px 24px -8px rgba(79,70,229,0.5)" }
                  : { border: "1px solid #e2e8f0", color: INK }}>
                Request Pricing
              </a>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ═══ 12. Final demo CTA ═══
export function FinalCta() {
  return (
    <section id="demo" className="relative overflow-hidden" style={{ background: "linear-gradient(135deg, #312e81, #4f46e5 55%, #6d28d9)" }}>
      <div className="absolute inset-0 pointer-events-none opacity-20"
        style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.35) 1px, transparent 1px)", backgroundSize: "26px 26px" }} />
      <div className="relative mx-auto max-w-4xl px-6 lg:px-8 py-24 lg:py-32 text-center">
        <h2 className="text-3xl lg:text-[2.75rem] lg:leading-[1.12] font-bold tracking-tight text-white">
          See how Routiqa can run your business from first call to final payment.
        </h2>
        <p className="mt-5 text-lg leading-relaxed text-indigo-100 max-w-2xl mx-auto">
          Book a demo and see how your CRM, dispatch, marketing, accounting, HR, and field
          operations can work together in one platform.
        </p>
        <div className="mt-9 flex items-center justify-center gap-3 flex-wrap">
          <a href="mailto:hello@routiqa.com?subject=Routiqa%20Demo%20Request"
            className="inline-flex items-center gap-2 rounded-xl px-7 py-3.5 text-base font-semibold transition-all hover:-translate-y-0.5 hover:shadow-xl bg-white"
            style={{ color: BRAND }}>
            Book a Demo
          </a>
          <a href="#platform"
            className="inline-flex items-center gap-2 rounded-xl px-7 py-3.5 text-base font-semibold text-white transition-all hover:-translate-y-0.5"
            style={{ border: "1px solid rgba(255,255,255,0.35)" }}>
            Explore Features
          </a>
        </div>
      </div>
    </section>
  );
}
