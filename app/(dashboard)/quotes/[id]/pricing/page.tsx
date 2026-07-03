"use client";

// Custom Proposal — Pricing Wizard (step 1 of the custom path).
// Collects cost + target-margin inputs and computes a recommended sell price,
// margins, and a monthly financing estimate. "Continue to Proposal" stores the
// full worksheet + results on the quote (quote.pricing), carries the recommended
// price in as a summary line, then opens the flexible block-based Custom Proposal
// builder (/custom) — NOT the template proposal workspace.

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, ArrowRight, SlidersHorizontal, Calculator, TrendingUp, DollarSign,
} from "lucide-react";
import { getQuote, autosaveQuote, computeTotals, fmt, type QuoteRecord, type LineItem } from "@/lib/quotes/data";
import type { QuotePricing } from "@/lib/quotes/types";
import { getProposalBranding } from "@/lib/proposals/data";
import NumberStepper from "@/components/ui/NumberStepper";

// ─── Input model ──────────────────────────────────────────
interface Inputs {
  equipmentCost: string; materialCost: string;
  laborHours: string; laborRate: string; laborBurdenPct: string;
  subcontractorCost: string; permitCost: string; craneCost: string; disposalCost: string; miscCost: string;
  overheadPct: string; commissionPct: string; financingPct: string;
  targetGrossMarginPct: string; targetNetProfitPct: string;
  desiredFinalPrice: string;
  financeMonths: string;
}

const DEFAULTS: Inputs = {
  equipmentCost: "", materialCost: "",
  laborHours: "", laborRate: "", laborBurdenPct: "25",
  subcontractorCost: "", permitCost: "", craneCost: "", disposalCost: "", miscCost: "",
  overheadPct: "12", commissionPct: "8", financingPct: "3",
  targetGrossMarginPct: "45", targetNetProfitPct: "15",
  desiredFinalPrice: "",
  financeMonths: "60",
};

const num = (s: string) => parseFloat(s) || 0;
const round2 = (n: number) => Math.round(n * 100) / 100;

export default function PricingWizardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const branding = useMemo(() => getProposalBranding(), []);
  const accent = branding.accentColor || "#7c3aed";

  const [loading, setLoading] = useState(true);
  const [quote, setQuote] = useState<QuoteRecord | null>(null);
  const [v, setV] = useState<Inputs>(DEFAULTS);

  useEffect(() => { const q = getQuote(id); if (q) setQuote(q); setLoading(false); }, [id]);
  const set = (patch: Partial<Inputs>) => setV(p => ({ ...p, ...patch }));

  // ─── Calculations ───────────────────────────────────────
  const calc = useMemo(() => {
    const laborBase = num(v.laborHours) * num(v.laborRate);
    const laborCost = laborBase * (1 + num(v.laborBurdenPct) / 100);
    const directCost =
      num(v.equipmentCost) + num(v.materialCost) + laborCost +
      num(v.subcontractorCost) + num(v.permitCost) + num(v.craneCost) +
      num(v.disposalCost) + num(v.miscCost);
    const overhead = directCost * (num(v.overheadPct) / 100);
    const totalCost = directCost + overhead;

    const gmTarget = Math.min(num(v.targetGrossMarginPct), 95) / 100;
    const recommended = gmTarget < 1 && totalCost > 0 ? totalCost / (1 - gmTarget) : totalCost;
    const sellPrice = num(v.desiredFinalPrice) > 0 ? num(v.desiredFinalPrice) : recommended;

    const commission = sellPrice * (num(v.commissionPct) / 100);
    const financingFee = sellPrice * (num(v.financingPct) / 100);
    const grossProfit = sellPrice - totalCost;
    const grossMargin = sellPrice > 0 ? grossProfit / sellPrice : 0;
    const netProfit = grossProfit - commission - financingFee;
    const netMargin = sellPrice > 0 ? netProfit / sellPrice : 0;

    const months = Math.max(1, num(v.financeMonths));
    // Simple flat-amortization estimate with a nominal APR factor (display only).
    const apr = 0.0999;
    const r = apr / 12;
    const monthly = sellPrice > 0 ? (sellPrice * r) / (1 - Math.pow(1 + r, -months)) : 0;

    return { laborCost, directCost, overhead, totalCost, recommended, sellPrice, commission, financingFee, grossProfit, grossMargin, netProfit, netMargin, monthly };
  }, [v]);

  // Persist the full worksheet + results onto the quote, carry the price forward
  // as a starter line item, then open the proposal workspace.
  function persistAndGo() {
    if (!quote) return;
    const pricing: QuotePricing = {
      equipmentCost: num(v.equipmentCost), materialCost: num(v.materialCost),
      laborHours: num(v.laborHours), laborRate: num(v.laborRate), laborBurdenPct: num(v.laborBurdenPct),
      subcontractorCost: num(v.subcontractorCost), permitCost: num(v.permitCost), craneCost: num(v.craneCost),
      disposalCost: num(v.disposalCost), miscCost: num(v.miscCost),
      overheadPct: num(v.overheadPct), commissionPct: num(v.commissionPct), financingPct: num(v.financingPct),
      targetGrossMarginPct: num(v.targetGrossMarginPct), targetNetProfitPct: num(v.targetNetProfitPct),
      financeMonths: num(v.financeMonths),
      totalCost: round2(calc.totalCost), recommendedSellPrice: round2(calc.recommended), sellPrice: round2(calc.sellPrice),
      grossProfit: round2(calc.grossProfit), grossMargin: calc.grossMargin,
      netProfit: round2(calc.netProfit), netMargin: calc.netMargin, monthly: round2(calc.monthly),
    };
    const patch: Partial<QuoteRecord> = { pricing };
    if (calc.sellPrice > 0 && quote.lineItems.length === 0) {
      const line: LineItem = {
        id: `li-pricing-${Date.now()}`,
        name: quote.title || "Proposed work", description: quote.title || "Proposed work",
        quantity: 1, unitPrice: round2(calc.sellPrice), total: round2(calc.sellPrice),
        category: "Other", taxable: true,
      };
      Object.assign(patch, { lineItems: [line], ...computeTotals([line], 0) });
    }
    autosaveQuote(id, patch);
    router.push(`/quotes/${id}/custom`);
  }

  if (loading) return <div className="p-10 text-sm" style={{ color: "var(--text-muted)" }}>Loading…</div>;
  if (!quote) return (
    <div className="p-10">
      <Link href="/quotes" className="flex items-center gap-1.5 text-sm mb-3" style={{ color: "var(--text-secondary)" }}><ArrowLeft className="w-4 h-4" /> Back to Quotes</Link>
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>Quote not found.</p>
    </div>
  );

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: "var(--bg-page)" }}>
      {/* Top bar */}
      <div className="flex items-center gap-3 px-5 py-3 shrink-0" style={{ backgroundColor: "var(--bg-surface)", borderBottom: "1px solid var(--border)" }}>
        <Link href={`/quotes/${id}`} className="flex items-center gap-1.5 text-sm shrink-0" style={{ color: "var(--text-secondary)" }}>
          <ArrowLeft className="w-4 h-4" /> Quote
        </Link>
        <div className="w-px h-5" style={{ backgroundColor: "var(--border)" }} />
        <span className="flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: accent + "1a", color: accent }}>
          <SlidersHorizontal className="w-3 h-3" /> Custom Proposal · Pricing
        </span>
        <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{quote.quoteNumber}</span>
        <div className="flex-1" />
        <button onClick={() => router.push(`/quotes/${id}/custom`)} className="text-sm px-3 py-1.5 rounded-lg" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
          Skip pricing
        </button>
        <button onClick={persistAndGo} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: accent }}>
          Continue to Proposal <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto thin-scroll-y p-6">
        <div className="mx-auto grid grid-cols-1 lg:grid-cols-3 gap-5" style={{ maxWidth: "1100px" }}>
          {/* Inputs */}
          <div className="lg:col-span-2 space-y-4">
            <Group title="Costs" icon={DollarSign}>
              <Money label="Equipment cost"     value={v.equipmentCost}     onChange={x => set({ equipmentCost: x })} />
              <Money label="Material cost"       value={v.materialCost}      onChange={x => set({ materialCost: x })} />
              <Money label="Subcontractor cost"  value={v.subcontractorCost} onChange={x => set({ subcontractorCost: x })} />
              <Money label="Permit cost"         value={v.permitCost}        onChange={x => set({ permitCost: x })} />
              <Money label="Crane / lift cost"   value={v.craneCost}         onChange={x => set({ craneCost: x })} />
              <Money label="Disposal cost"       value={v.disposalCost}      onChange={x => set({ disposalCost: x })} />
              <Money label="Miscellaneous cost"  value={v.miscCost}          onChange={x => set({ miscCost: x })} />
            </Group>

            <Group title="Labor" icon={Calculator}>
              <Plain label="Labor hours"  value={v.laborHours} onChange={x => set({ laborHours: x })} suffix="hrs" />
              <Money label="Labor rate"   value={v.laborRate}  onChange={x => set({ laborRate: x })} suffix="/hr" />
              <Pct   label="Labor burden" value={v.laborBurdenPct} onChange={x => set({ laborBurdenPct: x })} />
              <div className="flex items-center justify-between px-1 pt-1">
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>Loaded labor cost</span>
                <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{fmt(calc.laborCost)}</span>
              </div>
            </Group>

            <Group title="Margins & Targets" icon={TrendingUp}>
              <Pct label="Overhead"            value={v.overheadPct}          onChange={x => set({ overheadPct: x })} />
              <Pct label="Commission"          value={v.commissionPct}        onChange={x => set({ commissionPct: x })} />
              <Pct label="Financing / CC fee"  value={v.financingPct}         onChange={x => set({ financingPct: x })} />
              <Pct label="Target gross margin" value={v.targetGrossMarginPct} onChange={x => set({ targetGrossMarginPct: x })} highlight={accent} />
              <Pct label="Target net profit"   value={v.targetNetProfitPct}   onChange={x => set({ targetNetProfitPct: x })} />
              <Money label="Desired final price" value={v.desiredFinalPrice}  onChange={x => set({ desiredFinalPrice: x })} hint="optional — overrides recommended" />
            </Group>
          </div>

          {/* Results (sticky) */}
          <div className="lg:sticky lg:top-2 self-start space-y-3">
            <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
              <div className="px-5 py-4" style={{ background: `linear-gradient(135deg, ${accent}, ${accent}cc)` }}>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-white/80">Recommended Sell Price</p>
                <p className="text-3xl font-bold text-white mt-1">{fmt(calc.sellPrice)}</p>
                <p className="text-[11px] text-white/80 mt-1">≈ {fmt(calc.monthly)}/mo · {num(v.financeMonths)} mo financing</p>
              </div>
              <div className="p-4 space-y-2">
                <Result label="Total cost"      value={fmt(calc.totalCost)} />
                <Result label="Breakeven price" value={fmt(calc.totalCost)} />
                <Result label="Overhead"        value={fmt(calc.overhead)} muted />
                <div className="h-px my-1.5" style={{ backgroundColor: "var(--border-subtle)" }} />
                <Result label="Gross profit"    value={fmt(calc.grossProfit)} strong />
                <Result label="Gross margin"    value={`${(calc.grossMargin * 100).toFixed(1)}%`} accent={accent} />
                <Result label="Commission"      value={`− ${fmt(calc.commission)}`} muted />
                <Result label="Financing fee"   value={`− ${fmt(calc.financingFee)}`} muted />
                <div className="h-px my-1.5" style={{ backgroundColor: "var(--border-subtle)" }} />
                <Result label="Net profit (est.)" value={fmt(calc.netProfit)} strong />
                <Result label="Net margin"        value={`${(calc.netMargin * 100).toFixed(1)}%`} accent={calc.netMargin >= num(v.targetNetProfitPct) / 100 ? "#10b981" : "#dc2626"} />
                <Result label="Labor recovery"    value={fmt(calc.laborCost)} muted />
              </div>
              <div className="px-4 pb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>Financing term</span>
                  <NumberStepper size="sm" min={6} value={v.financeMonths} onChange={x => set({ financeMonths: x })} suffix="mo" className="w-28" />
                </div>
                <button onClick={persistAndGo} className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: accent }}>
                  Continue to Proposal <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
            <p className="text-[11px] px-1 leading-relaxed" style={{ color: "var(--text-muted)" }}>
              The recommended price is carried into the proposal as a starting line item. Financing and net figures are estimates for the rep — not shown to the customer.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Small bits ───────────────────────────────────────────
function Group({ title, icon: Icon, children }: { title: string; icon: typeof DollarSign; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>{title}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">{children}</div>
    </div>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>{label}{hint && <span className="font-normal" style={{ color: "var(--text-muted)" }}> · {hint}</span>}</span>
      {children}
    </label>
  );
}

function Money({ label, value, onChange, suffix, hint }: { label: string; value: string; onChange: (v: string) => void; suffix?: string; hint?: string }) {
  return (
    <Row label={label} hint={hint}>
      <NumberStepper value={value} onChange={onChange} min={0} step={1} placeholder="0" prefix="$" suffix={suffix} />
    </Row>
  );
}

function Plain({ label, value, onChange, suffix }: { label: string; value: string; onChange: (v: string) => void; suffix?: string }) {
  return (
    <Row label={label}>
      <NumberStepper value={value} onChange={onChange} min={0} step={1} placeholder="0" suffix={suffix} />
    </Row>
  );
}

function Pct({ label, value, onChange, highlight }: { label: string; value: string; onChange: (v: string) => void; highlight?: string }) {
  return (
    <Row label={label}>
      <NumberStepper value={value} onChange={onChange} min={0} step={1} placeholder="0" suffix="%" borderColor={highlight} />
    </Row>
  );
}

function Result({ label, value, strong, muted, accent }: { label: string; value: string; strong?: boolean; muted?: boolean; accent?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</span>
      <span className={strong ? "text-sm font-bold" : "text-sm font-medium"} style={{ color: accent ?? (muted ? "var(--text-secondary)" : "var(--text-primary)") }}>{value}</span>
    </div>
  );
}
