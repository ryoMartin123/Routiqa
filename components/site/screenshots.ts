// ─── Real product screenshots ─────────────────────────────
// Typed index over public/product-screenshots/ — actual captures of the running
// app taken by scripts/capture-product-screenshots.ts (see docs/product-
// screenshots.md). Desktop captures are 1440x1000 @2x, mobile 390x844 @3x.

export interface ProductShotMeta {
  src: string;
  alt: string;
  width: number;
  height: number;
  /** in-app route shown in the browser-frame URL bar */
  route: string;
}

const desktop = (file: string, route: string, alt: string): ProductShotMeta => ({
  src: `/product-screenshots/${file}`, alt, route, width: 2880, height: 2000,
});
const mobile = (file: string, route: string, alt: string): ProductShotMeta => ({
  src: `/product-screenshots/${file}`, alt, route, width: 1170, height: 2532,
});

export const SHOTS = {
  dashboard: desktop("crm-dashboard-desktop.png", "app.routiqa.com/dashboard",
    "Routiqa owner dashboard with revenue, jobs, and team KPIs"),
  customers: desktop("crm-customers-desktop.png", "app.routiqa.com/customers",
    "Routiqa CRM customer list with residential and commercial accounts"),
  dispatchBoard: desktop("dispatch-board-desktop.png", "app.routiqa.com/dispatching",
    "Routiqa dispatch board with technician lanes and unscheduled queue"),
  dispatchMap: desktop("dispatch-map-desktop.png", "app.routiqa.com/dispatching",
    "Routiqa live dispatch map with jobs, technicians, and routes"),
  inbox: desktop("communications-desktop.png", "app.routiqa.com/inbox",
    "Routiqa communications inbox with SMS conversation and AI assistance"),
  marketing: desktop("marketing-automation-desktop.png", "app.routiqa.com/marketing/automations",
    "Routiqa marketing automations for follow-ups, reviews, and renewals"),
  analytics: desktop("analytics-dashboard-desktop.png", "app.routiqa.com/analytics",
    "Routiqa analytics with revenue, jobs, and technician reports"),
  documents: desktop("documents-library-desktop.png", "app.routiqa.com/documents",
    "Routiqa documents library with SOPs, policies, and training"),
  hr: desktop("hr-team-desktop.png", "app.routiqa.com/hr",
    "Routiqa HR dashboard with employees, hiring, and reviews"),
  accounting: desktop("accounting-payments-desktop.png", "app.routiqa.com/accounting",
    "Routiqa accounting dashboard with invoices and payments"),
  mobileToday: mobile("mobile-technician-today.png", "routiqa.com/mobile/today",
    "Routiqa technician mobile app showing today's route and current job"),
  mobileJob: mobile("mobile-job-detail.png", "routiqa.com/mobile/jobs",
    "Routiqa mobile job detail with appointment, photos, and checklist"),
  mobileMap: mobile("mobile-route-map.png", "routiqa.com/mobile/map",
    "Routiqa mobile route map with the day's stops"),
} as const;

export type ShotKey = keyof typeof SHOTS;
