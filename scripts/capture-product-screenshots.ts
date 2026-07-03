// ─── Product screenshot capture ───────────────────────────
// Captures REAL screenshots of the locally running Routiqa app with Playwright
// and saves them to public/product-screenshots/ for the marketing website.
// Nothing is mocked: each PNG is the actual app rendered in Chromium.
//
// Run:  npm run screenshots:product        (app must be running on :3000,
//       or pass SCREENSHOT_BASE_URL)       start it with: npm run dev
//
// Before capturing, each browser profile is filled with demo records via
// /dev/seed?auto=1&jobs=1 (sample data — no real customer info). All requests
// to *.supabase.co are BLOCKED in the capture browser, so seeded jobs live only
// in the local cache and the shared dev database is never read or written.
//
// Requires Node >= 23.6 (runs TypeScript natively — no tsx needed).

import { chromium, type BrowserContext, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.SCREENSHOT_BASE_URL ?? "http://localhost:3000";
const OUT_DIR = path.join(process.cwd(), "public", "product-screenshots");

interface Shot {
  file: string;          // PNG name inside public/product-screenshots/
  title: string;
  description: string;
  route: string;         // app route captured
  usage: string;         // recommended website placement
  settleMs?: number;     // extra wait for maps/charts to finish painting
  clickTab?: string;     // click a tab/button with this text after load
}

const DESKTOP_VIEWPORT = { width: 1440, height: 1000 };
const MOBILE_VIEWPORT = { width: 390, height: 844 };

const DESKTOP_SHOTS: Shot[] = [
  {
    file: "crm-dashboard-desktop.png",
    title: "Owner Dashboard",
    description: "Live business dashboard with revenue, jobs, and team KPIs in one view.",
    route: "/dashboard",
    usage: "homepage hero / analytics feature section",
    settleMs: 2000,
  },
  {
    file: "crm-customers-desktop.png",
    title: "CRM & Customers",
    description: "Every customer account with jobs, agreements, and billing history connected.",
    route: "/customers",
    usage: "CRM feature section",
  },
  {
    file: "dispatch-board-desktop.png",
    title: "Dispatch Board",
    description: "Drag-and-drop dispatch board with technician lanes and the unscheduled queue.",
    route: "/dispatching",
    usage: "dispatch feature section",
    settleMs: 3000,
  },
  {
    file: "dispatch-map-desktop.png",
    title: "Dispatch & Routing",
    description: "Live dispatch map with technician status, jobs, and route visibility.",
    route: "/dispatching",
    usage: "homepage hero / dispatch feature section",
    settleMs: 5000,
    clickTab: "Map",
  },
  {
    file: "communications-desktop.png",
    title: "Communications Inbox",
    description: "Every customer conversation — calls, texts, and email — with AI reply drafts.",
    route: "/inbox",
    usage: "communications feature section",
  },
  {
    file: "marketing-automation-desktop.png",
    title: "Marketing Automation",
    description: "Automated follow-ups, renewals, and review requests built on live CRM data.",
    route: "/marketing/automations",
    usage: "marketing feature section",
    settleMs: 1500,
  },
  {
    file: "analytics-dashboard-desktop.png",
    title: "Analytics & Reporting",
    description: "Operational and financial reporting over real job and revenue data.",
    route: "/analytics",
    usage: "analytics feature section",
    settleMs: 2500,
  },
  {
    file: "documents-library-desktop.png",
    title: "Documents & SOPs",
    description: "Company knowledge base: SOPs, checklists, and training documents.",
    route: "/documents",
    usage: "documents feature section",
  },
  {
    file: "hr-team-desktop.png",
    title: "HR & Team",
    description: "Team roster, roles, time-off, and onboarding in the same platform.",
    route: "/hr",
    usage: "HR feature section",
  },
  {
    file: "accounting-payments-desktop.png",
    title: "Accounting & Payments",
    description: "Invoices, payments, and financial health tied to every job and customer.",
    route: "/accounting",
    usage: "accounting feature section",
    settleMs: 1500,
  },
];

const MOBILE_SHOTS: Shot[] = [
  {
    file: "mobile-technician-today.png",
    title: "Technician Today View",
    description: "The technician's day: route, next stop, and job status from the truck.",
    route: "/mobile/today",
    usage: "mobile app feature section / hero phone",
    settleMs: 1500,
  },
  {
    file: "mobile-route-map.png",
    title: "Mobile Route Map",
    description: "The day's stops on a live map with navigation to the next job.",
    route: "/mobile/map",
    usage: "mobile app feature section",
    settleMs: 4500,
  },
];

// Captured shots that made it to disk (feeds manifest.json).
const captured: Array<Shot & { viewport: string }> = [];

async function settle(page: Page, extraMs = 1000): Promise<void> {
  await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
  await page.evaluate(() => (document as Document & { fonts: FontFaceSet }).fonts.ready).catch(() => {});
  await page.waitForTimeout(extraMs);
  // Hide the Next.js dev overlay/indicator so it never appears in screenshots.
  await page
    .addStyleTag({ content: "nextjs-portal, #__next-build-watcher { display: none !important; }" })
    .catch(() => {});
  await page.waitForTimeout(150);
}

// Keep the capture browser fully local: seeded sample jobs must never write
// through to the shared dev database, and views must not hydrate real data.
async function blockSupabase(context: BrowserContext): Promise<void> {
  await context.route(/supabase\.co/, route => route.abort());
}

// Fill this browser profile with demo data (localStorage) via the dev seed page.
async function seedDemoData(page: Page): Promise<void> {
  await page.goto(`${BASE}/dev/seed?auto=1&jobs=1`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-seed-complete]", { timeout: 60000 });
}

async function captureShot(page: Page, shot: Shot, viewport: string): Promise<void> {
  const url = `${BASE}${shot.route}`;
  process.stdout.write(`  ${shot.route} → ${shot.file} ... `);
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    if (shot.clickTab) {
      await page.getByRole("button", { name: shot.clickTab, exact: true }).first().click({ timeout: 10000 });
    }
    await settle(page, shot.settleMs ?? 1000);
    await page.screenshot({ path: path.join(OUT_DIR, shot.file), fullPage: false });
    captured.push({ ...shot, viewport });
    console.log("ok");
  } catch (err) {
    console.log(`FAILED (${(err as Error).message.split("\n")[0]})`);
  }
}

// Mobile job detail needs a real job id — pick the first job card on /mobile/jobs.
async function captureMobileJobDetail(page: Page): Promise<void> {
  const shot: Shot = {
    file: "mobile-job-detail.png",
    title: "Mobile Job Detail",
    description: "Job details, checklist, photos, and status updates from the field.",
    route: "/mobile/jobs/[first]",
    usage: "mobile app feature section",
    settleMs: 1500,
  };
  process.stdout.write(`  ${shot.route} → ${shot.file} ... `);
  try {
    await page.goto(`${BASE}/mobile/jobs`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await settle(page, 2000);
    const links = page.locator('a[href^="/mobile/jobs/"]');
    if ((await links.count()) === 0) {
      // "Today" may be empty — walk the other buckets until a job card shows.
      for (const tab of [/Upcoming/, /Completed/, /Follow-up/]) {
        await page.getByRole("button", { name: tab }).first().click({ timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(700);
        if ((await links.count()) > 0) break;
      }
    }
    if ((await links.count()) === 0) {
      console.log("SKIPPED (no jobs found — seed jobs or add one, then re-run)");
      return;
    }
    const href = await links.first().getAttribute("href");
    await page.goto(`${BASE}${href}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await settle(page, shot.settleMs);
    await page.screenshot({ path: path.join(OUT_DIR, shot.file), fullPage: false });
    captured.push({ ...shot, route: href ?? shot.route, viewport: `${MOBILE_VIEWPORT.width}x${MOBILE_VIEWPORT.height}` });
    console.log("ok");
  } catch (err) {
    console.log(`FAILED (${(err as Error).message.split("\n")[0]})`);
  }
}

async function run(): Promise<void> {
  // Fail fast if the app isn't running.
  try {
    await fetch(BASE, { signal: AbortSignal.timeout(4000) });
  } catch {
    console.error(`App is not reachable at ${BASE}. Start it first: npm run dev`);
    process.exit(1);
  }

  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();

  console.log(`Capturing desktop (${DESKTOP_VIEWPORT.width}x${DESKTOP_VIEWPORT.height} @2x) from ${BASE}`);
  const desktop: BrowserContext = await browser.newContext({
    viewport: DESKTOP_VIEWPORT,
    deviceScaleFactor: 2,
  });
  await blockSupabase(desktop);
  const dPage = await desktop.newPage();
  await seedDemoData(dPage);
  for (const shot of DESKTOP_SHOTS) {
    await captureShot(dPage, shot, `${DESKTOP_VIEWPORT.width}x${DESKTOP_VIEWPORT.height}`);
  }
  await desktop.close();

  console.log(`Capturing mobile (${MOBILE_VIEWPORT.width}x${MOBILE_VIEWPORT.height} @3x)`);
  const mobile: BrowserContext = await browser.newContext({
    viewport: MOBILE_VIEWPORT,
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  });
  await blockSupabase(mobile);
  // Force the technician ("field") experience — owners/managers get a nav hub
  // on /mobile/today instead of the route view we want to showcase.
  await mobile.addInitScript(() => localStorage.setItem("routiqa-mobile-experience", "field"));
  const mPage = await mobile.newPage();
  await seedDemoData(mPage);
  for (const shot of MOBILE_SHOTS) {
    await captureShot(mPage, shot, `${MOBILE_VIEWPORT.width}x${MOBILE_VIEWPORT.height}`);
  }
  await captureMobileJobDetail(mPage);
  await mobile.close();

  await browser.close();

  const manifest = captured.map(s => ({
    file: `/product-screenshots/${s.file}`,
    title: s.title,
    description: s.description,
    route: s.route,
    viewport: s.viewport,
    usage: s.usage,
  }));
  await writeFile(path.join(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

  console.log(`\nDone: ${captured.length} screenshots + manifest.json in public/product-screenshots/`);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
