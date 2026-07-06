"use client";

// ─── Site header: announcement bar + mega navigation ──────
// Enterprise-SaaS nav: hover-open mega panels for Platform / Solutions /
// Features / Industries / Resources, plus Pricing, Login, and the Book Demo
// CTA. Collapses to a slide-down menu on mobile.

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Menu, X, ArrowRight } from "lucide-react";
import {
  NAV, PLATFORM_ITEMS, SOLUTION_ITEMS, FEATURE_GROUPS, INDUSTRIES, RESOURCE_ITEMS,
  APP_LOGIN_HREF, DEMO_HREF,
} from "./nav";
import { INK, BODY, BRAND } from "./ui";

function Wordmark() {
  return (
    <Link href="/" className="flex items-center gap-2 shrink-0">
      <span className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
        style={{ background: "linear-gradient(135deg, #4f46e5, #6d28d9)" }}>R</span>
      <span className="text-lg font-bold tracking-tight" style={{ color: INK }}>Routiqa</span>
    </Link>
  );
}

// One hover-anchored mega panel. `open` is controlled by the header so only
// one panel shows at a time.
function MegaPanel({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={`absolute left-1/2 -translate-x-1/2 top-full pt-3 ${wide ? "w-[min(64rem,92vw)]" : "w-[min(44rem,92vw)]"}`}>
      <div className="rounded-2xl bg-white p-6 shadow-2xl" style={{ border: "1px solid #e2e8f0" }}>
        {children}
      </div>
    </div>
  );
}

function PanelItem({ href, icon: Icon, title, blurb, onNavigate }: {
  href: string; icon: React.ElementType; title: string; blurb: string; onNavigate: () => void;
}) {
  return (
    <Link href={href} onClick={onNavigate} className="group flex items-start gap-3 rounded-xl p-2.5 transition-colors hover:bg-slate-50">
      <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "#eef2ff" }}>
        <Icon className="w-4 h-4" style={{ color: BRAND }} />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold" style={{ color: INK }}>{title}</span>
        <span className="block text-xs leading-snug mt-0.5" style={{ color: BODY }}>{blurb}</span>
      </span>
    </Link>
  );
}

export default function SiteHeader() {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const close = () => setOpenMenu(null);

  return (
    <div className="sticky top-0 z-50">
      {/* Announcement bar */}
      <div className="text-center px-4 py-2 text-[13px] font-medium text-white"
        style={{ background: "linear-gradient(90deg, #312e81, #4f46e5, #6d28d9)" }}>
        Built for service businesses that want their CRM, dispatch, marketing, accounting, HR, and field teams in one place.
      </div>

      {/* Nav */}
      <header className="bg-white/95 backdrop-blur" style={{ borderBottom: "1px solid #e2e8f0" }}>
        <div className="mx-auto max-w-7xl px-6 lg:px-8 h-16 flex items-center gap-8">
          <Wordmark />

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-1 flex-1" onMouseLeave={close}>
            {NAV.map(item => (
              item.type === "link" ? (
                <Link key={item.label} href={item.href!} onMouseEnter={close}
                  className="px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-slate-50"
                  style={{ color: INK }}>
                  {item.label}
                </Link>
              ) : (
                <div key={item.label} className="relative" onMouseEnter={() => setOpenMenu(item.label)}>
                  <button className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-slate-50"
                    style={{ color: openMenu === item.label ? BRAND : INK }}>
                    {item.label}
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${openMenu === item.label ? "rotate-180" : ""}`} />
                  </button>

                  {openMenu === item.label && item.type === "platform" && (
                    <MegaPanel>
                      <div className="grid grid-cols-2 gap-1">
                        {PLATFORM_ITEMS.map(p => <PanelItem key={p.title} href={p.href} icon={p.icon} title={p.title} blurb={p.blurb} onNavigate={close} />)}
                      </div>
                    </MegaPanel>
                  )}

                  {openMenu === item.label && item.type === "solutions" && (
                    <MegaPanel>
                      <div className="grid grid-cols-2 gap-1">
                        {SOLUTION_ITEMS.map(p => <PanelItem key={p.title} href={p.href} icon={p.icon} title={p.title} blurb={p.blurb} onNavigate={close} />)}
                      </div>
                    </MegaPanel>
                  )}

                  {openMenu === item.label && item.type === "features" && (
                    <MegaPanel wide>
                      <div className="grid grid-cols-5 gap-6">
                        {FEATURE_GROUPS.map(g => (
                          <div key={g.title}>
                            <Link href={g.anchor} onClick={close} className="block text-[11px] font-bold uppercase tracking-wider mb-2.5 hover:underline" style={{ color: BRAND }}>
                              {g.title}
                            </Link>
                            <ul className="space-y-1.5">
                              {g.items.map(f => (
                                <li key={f.title}>
                                  <Link href={g.anchor} onClick={close} className="flex items-center gap-2 text-[13px] font-medium transition-colors hover:text-indigo-600" style={{ color: BODY }}>
                                    <f.icon className="w-3.5 h-3.5 shrink-0" style={{ color: "#94a3b8" }} />
                                    {f.title}
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </MegaPanel>
                  )}

                  {openMenu === item.label && item.type === "industries" && (
                    <MegaPanel>
                      <div className="grid grid-cols-3 gap-1">
                        {INDUSTRIES.map(ind => (
                          <Link key={ind.name} href="#industries" onClick={close}
                            className="rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-slate-50" style={{ color: INK }}>
                            {ind.name}
                          </Link>
                        ))}
                      </div>
                      <div className="mt-4 pt-4 flex items-center justify-between" style={{ borderTop: "1px solid #f1f5f9" }}>
                        <p className="text-xs" style={{ color: BODY }}>Purpose-built for the trades and service businesses.</p>
                        <Link href="#industries" onClick={close} className="inline-flex items-center gap-1 text-sm font-semibold" style={{ color: BRAND }}>
                          See all industries <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </MegaPanel>
                  )}

                  {openMenu === item.label && item.type === "resources" && (
                    <MegaPanel>
                      <div className="grid grid-cols-2 gap-1">
                        {RESOURCE_ITEMS.map(p => <PanelItem key={p.title} href={p.href} icon={p.icon} title={p.title} blurb={p.blurb} onNavigate={close} />)}
                      </div>
                    </MegaPanel>
                  )}
                </div>
              )
            ))}
          </nav>

          {/* Right actions */}
          <div className="hidden lg:flex items-center gap-2 shrink-0">
            <Link href={APP_LOGIN_HREF} className="px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-slate-50" style={{ color: INK }}>
              Login
            </Link>
            <Link href={DEMO_HREF}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:shadow-lg"
              style={{ backgroundColor: BRAND, boxShadow: "0 6px 20px -6px rgba(79,70,229,0.5)" }}>
              Book Demo
            </Link>
          </div>

          {/* Mobile toggle */}
          <button className="lg:hidden ml-auto p-2 rounded-lg" style={{ color: INK }} onClick={() => setMobileOpen(o => !o)} aria-label="Menu">
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="lg:hidden px-6 pb-6 pt-2 space-y-4 bg-white max-h-[80vh] overflow-y-auto" style={{ borderTop: "1px solid #f1f5f9" }}>
            {[
              { label: "Platform", items: PLATFORM_ITEMS },
              { label: "Solutions", items: SOLUTION_ITEMS },
              { label: "Resources", items: RESOURCE_ITEMS },
            ].map(group => (
              <div key={group.label}>
                <p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: BRAND }}>{group.label}</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  {group.items.map(p => (
                    <Link key={p.title} href={p.href} onClick={() => setMobileOpen(false)} className="text-sm font-medium" style={{ color: INK }}>{p.title}</Link>
                  ))}
                </div>
              </div>
            ))}
            <div className="flex items-center gap-3 pt-2">
              <Link href="#packages" onClick={() => setMobileOpen(false)} className="text-sm font-medium" style={{ color: INK }}>Pricing</Link>
              <Link href={APP_LOGIN_HREF} className="text-sm font-medium" style={{ color: INK }}>Login</Link>
              <Link href={DEMO_HREF} onClick={() => setMobileOpen(false)}
                className="ml-auto px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ backgroundColor: BRAND }}>
                Book Demo
              </Link>
            </div>
          </div>
        )}
      </header>
    </div>
  );
}
