// Terms & Conditions — reusable named terms blocks for quotes and invoices
// (Settings → Terms & Conditions). localStorage-backed for now.

const KEY = "crm-quote-terms";

export interface TermsBlock {
  id: string;
  name: string;
  body: string;
  active: boolean;
  order: number;
}

const SEED: Omit<TermsBlock, "order">[] = [
  { id: "terms-standard",   name: "Standard Quote Terms",        active: true, body: "This quote is valid for the period stated above. Prices are subject to change after the expiration date. Acceptance of this quote constitutes agreement to the scope and pricing described herein." },
  { id: "terms-install",    name: "Installation Terms",          active: true, body: "Installation dates are scheduled upon acceptance and deposit. Customer is responsible for providing clear access to the work area. Permits, where required, are billed as listed." },
  { id: "terms-repair",     name: "Service Repair Terms",        active: true, body: "Repair work is warranted for parts and labor as stated. Additional issues discovered during service may require a separate estimate and approval before work proceeds." },
  { id: "terms-maintenance",name: "Maintenance Agreement Terms", active: true, body: "Maintenance agreements renew per the billing frequency selected. Visits are scheduled seasonally. Cancellation requires written notice prior to the next renewal date." },
  { id: "terms-warranty",   name: "Warranty Disclaimer",         active: true, body: "Manufacturer warranties apply to equipment as provided by the manufacturer. Labor warranty is limited to the period stated. Warranty does not cover damage from misuse, neglect, or acts of nature." },
  { id: "terms-payment",    name: "Payment Terms",               active: true, body: "A deposit may be required to schedule work. Final balance is due upon completion unless financing terms are arranged in advance. Late balances may be subject to a service charge." },
  { id: "terms-financing",  name: "Financing Disclaimer",        active: true, body: "Financing is subject to credit approval through our third-party lender. Monthly payment estimates are illustrative and not a guarantee of approval or terms." },
];

function seedBlocks(): TermsBlock[] {
  return SEED.map((b, i) => ({ ...b, order: i }));
}

export function getTermsBlocks(): TermsBlock[] {
  if (typeof window === "undefined") return seedBlocks();
  try {
    const r = localStorage.getItem(KEY);
    return r ? (JSON.parse(r) as TermsBlock[]).sort((a, b) => a.order - b.order) : seedBlocks();
  } catch { return seedBlocks(); }
}
export function saveTermsBlocks(list: TermsBlock[]): void {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* ignore */ }
}
export function resetTermsBlocks(): TermsBlock[] {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  return seedBlocks();
}
export function newTermsId(): string {
  return `terms-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
}
