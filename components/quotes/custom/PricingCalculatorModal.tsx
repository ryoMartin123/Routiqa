"use client";

// Pricing Calculator — the margin worksheet, IN the builder (no more separate
// /pricing pre-step). Opens from the studio rail's Internal Pricing group,
// re-opens with the saved worksheet, and "Save pricing" hands the results back
// to the builder — which shows sell-price drift in the reconciliation panel
// (nothing is applied to line items silently).

import { useMemo, useState } from "react";
import { X, Calculator, TrendingUp, DollarSign, Lock, Check } from "lucide-react";
import NumberStepper from "@/components/ui/NumberStepper";
import { fmt } from "@/lib/quotes/data";
import type { QuotePricing } from "@/lib/quotes/types";

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

// Saved worksheet → inputs, so editing picks up where the rep left off.
function toInputs(p?: QuotePricing): Inputs {
  if (!p) return DEFAULTS;
  const s = (n?: number) => (n ? String(n) : "");
  return {
    equipmentCost: s(p.equipmentCost), materialCost: s(p.materialCost),
    laborHours: s(p.laborHours), laborRate: s(p.laborRate), laborBurdenPct: String(p.laborBurdenPct ?? 25),
    subcontractorCost: s(p.subcontractorCost), permitCost: s(p.permitCost), craneCost: s(p.craneCost),
    disposalCost: s(p.disposalCost), miscCost: s(p.miscCost),
    overheadPct: String(p.overheadPct ?? 12), commissionPct: String(p.commissionPct ?? 8), financingPct: String(p.financingPct ?? 3),
    targetGrossMarginPct: String(p.targetGrossMarginPct ?? 45), targetNetProfitPct: String(p.targetNetProfitPct ?? 15),
    desiredFinalPrice: p.sellPrice && p.sellPrice !== p.recommendedSellPrice ? String(p.sellPrice) : "",
    financeMonths: String(p.financeMonths ?? 60),
  };
}

export default function PricingCalculatorModal({ initial, accent, onSave, onClose }: {
  initial?: QuotePricing;
  accent: string;
  onSave: (pricing: QuotePricing) => void;
  onClose: () => void;
}) {
  const [v, setV] = useState<Inputs>(() => toInputs(initial));
  const set = (patch: Partial<Inputs>) => setV(p => ({ ...p, ...patch }));

  // ─── Calculations (same math as the original wizard) ─────
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

  function save() {
    onSave({
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
    });
  }

  return (
    <div className="fixed inset-0 z-[80] bg-black/45 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-5xl max-h-[92vh] flex flex-col rounded-2xl overflow-hidden" onClick={e => e.stopPropagation()}
        style={{ backgroundColor: "var(--bg-page)", boxShadow: "0 24px 70px rgba(0,0,0,0.4)" }}>
        {/* Header */}
        <div className="flex items-center gap-2.5 px-5 py-3.5 shrink-0" style={{ backgroundColor: "var(--bg-surface)", borderBottom: "1px solid var(--border)" }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: accent + "1a" }}>
            <Calculator className="w-4 h-4" style={{ color: accent }} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Pricing Calculator</p>
            <p className="flex items-center gap-1 text-[11px]" style={{ color: "var(--text-muted)" }}><Lock className="w-3 h-3" /> Rep only — never shown to the customer</p>
          </div>
          <button onClick={save} className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium text-white shrink-0" style={{ backgroundColor: accent }}>
            <Check className="w-4 h-4" /> Save pricing
          </button>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-[var(--bg-surface-2)] shrink-0" style={{ color: "var(--text-muted)" }}><X className="w-4 h-4" /></button>
        </div>

        {/* Body — inputs left, live results right */}
        <div className="flex-1 min-h-0 overflow-y-auto thin-scroll-y p-5">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
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
            <div className="lg:sticky lg:top-0 self-start space-y-3">
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
                  <button onClick={save} className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: accent }}>
                    <Check className="w-4 h-4" /> Save pricing
                  </button>
                </div>
              </div>
              <p className="text-[11px] px-1 leading-relaxed" style={{ color: "var(--text-muted)" }}>
                Saving stores the worksheet on the quote. The reconciliation panel then offers a one-click “Apply sell price to line items” — nothing changes the customer total silently.
              </p>
            </div>
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
