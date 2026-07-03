# Product screenshots

Real screenshots of the running Routiqa app, captured with Playwright and used
by the public marketing site. Nothing is mocked — every PNG is the actual
product rendered in Chromium.

## Where things live

| What | Path |
| --- | --- |
| Capture script | `scripts/capture-product-screenshots.ts` |
| Output PNGs + manifest | `public/product-screenshots/` |
| Dev seed page (demo data) | `app/dev/seed/page.tsx` → `/dev/seed` |
| Typed index used by the site | `components/site/screenshots.ts` |
| Framed image components | `components/site/ProductShot.tsx` |

## How to (re)capture

1. Start the app: `npm run dev` (assumed at `http://localhost:3000`; override
   with `SCREENSHOT_BASE_URL=http://localhost:4000` if needed).
2. Run: `npm run screenshots:product`
   (requires Node ≥ 23.6 — the script runs as native TypeScript, no tsx;
   Playwright Chromium must be installed once via `npx playwright install chromium`).

The script:

- opens headless Chromium at **1440×1000 @2x** (desktop) and **390×844 @3x** (mobile),
- **blocks every request to `*.supabase.co`** so the capture browser never reads
  or writes the shared dev database,
- seeds demo-only data through `/dev/seed?auto=1&jobs=1` (the same sample-data
  generator as the top-bar flask panel, plus backdated history so 12-month
  charts and KPIs look alive — all in that browser profile's localStorage only,
  discarded when the run ends),
- forces the technician ("field") mobile experience so `/mobile/today` shows the
  route view,
- hides the Next.js dev overlay, waits for fonts/network/maps to settle,
- writes the PNGs plus `manifest.json` (title, description, route, viewport,
  recommended usage per file).

### Captured screens

Desktop: dashboard, customers, dispatch board, dispatch map (Map tab),
inbox/communications, marketing automations, analytics, documents, HR,
accounting. Mobile: technician today, job detail (first job card), route map.

To add a screen, append an entry to `DESKTOP_SHOTS` / `MOBILE_SHOTS` in the
script and (if the site should use it) to `SHOTS` in
`components/site/screenshots.ts`.

## How the website uses them

- `components/site/HeroShowcase.tsx` — the hero's auto-cycling reel of five
  desktop captures (dispatch map, dashboard, inbox, marketing, analytics).
- `components/site/sections/Hero.tsx` — layers the real technician phone
  capture next to the reel.
- `components/site/sections/ProductShowcase.tsx` — the alternating feature
  sections on `/` and `/product`, one real capture per module, plus the
  two-phone mobile section and the documents/HR/accounting trio.
- `BrowserShot` / `PhoneShot` (`components/site/ProductShot.tsx`) wrap each
  capture in the shared browser/phone chrome with `next/image`.

## Updating screenshots later

Re-run the two steps above whenever the product UI changes — file names are
stable, so the site picks up new captures with no code changes. Screenshots are
committed to the repo (the site needs them at build time). Keep captures free
of real customer data: only use the seeded demo records.
