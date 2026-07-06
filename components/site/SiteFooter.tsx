// ─── Site footer ──────────────────────────────────────────
// Deep-navy footer with the platform sitemap. Mirrors the nav data so links
// never drift from the menu.

import Link from "next/link";
import { PLATFORM_ITEMS, SOLUTION_ITEMS, INDUSTRIES, APP_LOGIN_HREF, DEMO_HREF } from "./nav";

const COLS: { title: string; links: { label: string; href: string }[] }[] = [
  { title: "Platform", links: PLATFORM_ITEMS.slice(0, 8).map(p => ({ label: p.title, href: p.href })) },
  { title: "Solutions", links: SOLUTION_ITEMS.map(s => ({ label: s.title, href: s.href })) },
  { title: "Industries", links: INDUSTRIES.slice(0, 8).map(i => ({ label: i.name, href: "#industries" })) },
  {
    title: "Company",
    links: [
      { label: "Pricing", href: "#packages" },
      { label: "Meet Riq", href: "#riq" },
      { label: "Book a Demo", href: DEMO_HREF },
      { label: "Login", href: APP_LOGIN_HREF },
    ],
  },
];

export default function SiteFooter() {
  return (
    <footer style={{ backgroundColor: "#0f172a" }}>
      <div className="mx-auto max-w-7xl px-6 lg:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-10">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                style={{ background: "linear-gradient(135deg, #4f46e5, #6d28d9)" }}>R</span>
              <span className="text-lg font-bold text-white">Routiqa</span>
            </div>
            <p className="text-sm leading-relaxed text-slate-400">
              The all-in-one operating platform for service businesses — CRM, dispatch,
              marketing, accounting, HR, projects, and Riq AI in one connected system.
            </p>
          </div>
          {COLS.map(col => (
            <div key={col.title}>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3.5">{col.title}</p>
              <ul className="space-y-2.5">
                {col.links.map(l => (
                  <li key={l.label}>
                    <Link href={l.href} className="text-sm text-slate-300 transition-colors hover:text-white">{l.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-14 pt-8 flex items-center justify-between flex-wrap gap-3" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <p className="text-xs text-slate-500">© {new Date().getFullYear()} Routiqa. Built for the trades.</p>
          <p className="text-xs text-slate-500">One platform. First call to final payment.</p>
        </div>
      </div>
    </footer>
  );
}
