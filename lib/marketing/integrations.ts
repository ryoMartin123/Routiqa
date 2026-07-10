// Marketing integrations — the connection command center's catalog + state.
// Connections are SANDBOX-ONLY for now (stored locally, nothing talks to the
// real provider) — live OAuth/API wiring lands with Phase 6. The catalog is
// the honest part: these are the providers the CRM is designed to plug into,
// and a "connected" integration can register a lead source.

export type IntegrationCategory = "advertising" | "messaging" | "capture";
export interface IntegrationDef {
  key: string;
  name: string;
  category: IntegrationCategory;
  description: string;
  accent: string;
  // What the connect sheet asks for (all sandbox — labeled as such in the UI).
  fields: { key: string; label: string; placeholder: string; secret?: boolean }[];
  registersLeadSource?: string;   // connecting also suggests this lead source
}

export const INTEGRATION_CATEGORIES: { key: IntegrationCategory; label: string; blurb: string }[] = [
  { key: "advertising", label: "Advertising & Presence", blurb: "Where new customers find you — ads, local services, your business profile." },
  { key: "messaging", label: "Email & SMS Delivery", blurb: "The providers that actually send what campaigns compose." },
  { key: "capture", label: "Lead Capture & Glue", blurb: "Forms, webhooks, and connectors that push leads into the CRM." },
];

export const INTEGRATIONS: IntegrationDef[] = [
  { key: "google_ads", name: "Google Ads", category: "advertising", accent: "#4285F4",
    description: "Pull campaign spend and conversions; track which ads become booked jobs.",
    fields: [{ key: "customer_id", label: "Customer ID", placeholder: "123-456-7890" }],
    registersLeadSource: "Google Ads" },
  { key: "google_lsa", name: "Google Local Services", category: "advertising", accent: "#34A853",
    description: "Local Services Ads leads land directly in the unscheduled queue.",
    fields: [{ key: "account", label: "LSA account email", placeholder: "you@company.com" }],
    registersLeadSource: "Google LSA" },
  { key: "gbp", name: "Google Business Profile", category: "advertising", accent: "#FBBC05",
    description: "Reviews, Q&A, and message leads from your Business Profile.",
    fields: [{ key: "location", label: "Business location", placeholder: "Northstar Services — Augusta" }],
    registersLeadSource: "Google Business Profile" },
  { key: "meta_ads", name: "Meta Ads", category: "advertising", accent: "#0866FF",
    description: "Facebook & Instagram lead forms flow straight into Leads.",
    fields: [{ key: "ad_account", label: "Ad account ID", placeholder: "act_1234567890" }],
    registersLeadSource: "Facebook / Instagram" },
  { key: "email_provider", name: "Email Provider", category: "messaging", accent: "#0f8578",
    description: "SendGrid / Postmark / SES — powers real email sends, opens, and clicks.",
    fields: [{ key: "api_key", label: "API key", placeholder: "SG.****", secret: true }] },
  { key: "sms_provider", name: "SMS Provider", category: "messaging", accent: "#F22F46",
    description: "Twilio — real SMS delivery, replies, and STOP handling.",
    fields: [{ key: "account_sid", label: "Account SID", placeholder: "AC****" }, { key: "auth_token", label: "Auth token", placeholder: "••••••••", secret: true }] },
  { key: "website_forms", name: "Website Forms", category: "capture", accent: "#7c3aed",
    description: "Embed a form or point your site's forms at the CRM — submissions become leads.",
    fields: [{ key: "site", label: "Website URL", placeholder: "https://yourcompany.com" }],
    registersLeadSource: "Website" },
  { key: "zapier", name: "Zapier / Make", category: "capture", accent: "#FF4F00",
    description: "Webhook in/out — connect thousands of apps without code.",
    fields: [{ key: "webhook", label: "Incoming webhook secret", placeholder: "whsec_****", secret: true }] },
];

// ── Connection state (localStorage) ──
export interface IntegrationState { status: "connected" | "disconnected"; accountLabel?: string; connectedAt?: string }
const KEY = "crm-marketing-integrations";
let _state: Record<string, IntegrationState> | null = null;
function state(): Record<string, IntegrationState> {
  if (_state) return _state;
  if (typeof window === "undefined") return {};
  try { _state = JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { _state = {}; }
  return _state!;
}
function persist(): void {
  try { localStorage.setItem(KEY, JSON.stringify(_state ?? {})); } catch { /* ignore */ }
}

export function integrationState(key: string): IntegrationState {
  return state()[key] ?? { status: "disconnected" };
}
export function connectIntegration(key: string, accountLabel: string): void {
  const all = state();
  all[key] = {
    status: "connected", accountLabel: accountLabel.trim() || undefined,
    connectedAt: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
  };
  _state = all; persist();
}
export function disconnectIntegration(key: string): void {
  const all = state();
  all[key] = { status: "disconnected" };
  _state = all; persist();
}
export function connectedCount(): number {
  return INTEGRATIONS.filter(i => integrationState(i.key).status === "connected").length;
}
