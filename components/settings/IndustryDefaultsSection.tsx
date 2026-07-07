"use client";

import { useState, useEffect } from "react";
import {
  Factory, Eye, Check, X, AlertTriangle, CheckCircle, Clock, Layers,
} from "lucide-react";
import {
  INDUSTRY_TEMPLATES, applyTemplate, getActiveTemplate, setActiveTemplate,
  type IndustryTemplate, type ApplyMode, type ApplyResult,
} from "@/lib/industry-defaults/data";

// ─── Preview panel ────────────────────────────────────────
const PREVIEW_SECTIONS: { key: keyof IndustryTemplate["preview"]; label: string }[] = [
  { key: "pipelineStages",     label: "Pipeline Stages" },
  { key: "jobTypes",           label: "Job Types" },
  { key: "jobStatuses",        label: "Job Statuses" },
  { key: "photoCategories",    label: "Photo Categories" },
  { key: "workOrderTemplates", label: "Work Order Templates" },
  { key: "customFields",       label: "Custom Fields" },
  { key: "agreementTemplates", label: "Agreement Templates" },
];

function PreviewModal({ tpl, onClose, onApply }: {
  tpl: IndustryTemplate; onClose: () => void; onApply: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 flex flex-col w-[560px] max-w-full"
        style={{ backgroundColor: "var(--bg-surface)", borderLeft: "1px solid var(--border)", boxShadow: "-4px 0 24px rgba(0,0,0,0.12)" }}>
        <div className="flex items-center justify-between px-6 py-5 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: "var(--bg-surface-2)" }}>
              <Factory className="w-4.5 h-4.5" style={{ color: "#0f8578" }} />
            </div>
            <div>
              <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>{tpl.name} Template</h2>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{tpl.description}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg" style={{ color: "var(--text-muted)" }}><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {PREVIEW_SECTIONS.map(sec => {
            const items = tpl.preview[sec.key];
            if (items.length === 0) return null;
            return (
              <div key={sec.key}>
                <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>
                  {sec.label} <span style={{ color: "var(--text-muted)" }}>({items.length})</span>
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {items.map(it => (
                    <span key={it} className="text-xs px-2.5 py-1 rounded-lg"
                      style={{ backgroundColor: "var(--bg-surface-2)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                      {it}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
          {tpl.key === "custom" && (
            <div className="py-8 text-center">
              <Layers className="w-8 h-8 mx-auto mb-2 opacity-30" style={{ color: "var(--text-muted)" }} />
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                The Custom template starts blank. Build your pipeline, job types, and categories from scratch.
              </p>
            </div>
          )}
        </div>

        {tpl.status === "available" && tpl.key !== "custom" && (
          <div className="px-6 py-4 shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
            <button onClick={onApply}
              className="w-full py-2.5 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: "#0f8578" }}>
              Apply This Template
            </button>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Apply confirmation modal ─────────────────────────────
function ApplyModal({ tpl, onConfirm, onClose, result }: {
  tpl: IndustryTemplate; onConfirm: (mode: ApplyMode) => void; onClose: () => void; result: ApplyResult | null;
}) {
  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
        <div className="w-full max-w-md rounded-2xl overflow-hidden" onClick={e => e.stopPropagation()}
          style={{ backgroundColor: "var(--bg-surface)", boxShadow: "0 16px 48px rgba(0,0,0,0.24)" }}>

          {result ? (
            // Success state
            <div className="p-6 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
                <CheckCircle className="w-6 h-6 text-emerald-600" />
              </div>
              <p className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>{tpl.name} template applied</p>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                {result.replaced
                  ? `Replaced existing defaults with the ${tpl.name} starter set.`
                  : `Added ${result.added} new default${result.added === 1 ? "" : "s"} that weren't already configured.`}
                {" "}You can customize everything in Pipelines, Job Types, and Photo Categories.
              </p>
              <button onClick={onClose} className="mt-2 px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: "#0f8578" }}>Done</button>
            </div>
          ) : (
            <>
              <div className="p-6 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-4.5 h-4.5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Apply {tpl.name} template?</p>
                    <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
                      Applying an industry default copies starter settings into this company.
                      Existing custom settings will <strong>not</strong> be overwritten unless you choose to replace them.
                    </p>
                  </div>
                </div>
              </div>
              <div className="px-6 pb-6 space-y-2">
                <button onClick={() => onConfirm("missing")}
                  className="w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors hover:border-[#8ed0c6]"
                  style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)" }}>
                  <Check className="w-4 h-4 shrink-0" style={{ color: "#10b981" }} />
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Apply only missing defaults</p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>Recommended — keeps your existing settings, adds what&apos;s missing.</p>
                  </div>
                </button>
                <button onClick={() => onConfirm("replace")}
                  className="w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors hover:border-red-300"
                  style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)" }}>
                  <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: "#ef4444" }} />
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Replace existing defaults</p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>Overwrites your pipeline, job types, statuses, and photo categories.</p>
                  </div>
                </button>
                <button onClick={onClose}
                  className="w-full py-2 rounded-lg text-sm transition-colors mt-1"
                  style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Section ──────────────────────────────────────────────
export default function IndustryDefaultsSection() {
  const [active, setActive] = useState<string | null>(null);
  const [previewTpl, setPreviewTpl] = useState<IndustryTemplate | null>(null);
  const [applyTpl, setApplyTpl] = useState<IndustryTemplate | null>(null);
  const [applyResult, setApplyResult] = useState<ApplyResult | null>(null);

  useEffect(() => { setActive(getActiveTemplate()); }, []);

  function confirmApply(mode: ApplyMode) {
    if (!applyTpl) return;
    const result = applyTemplate(applyTpl.key, mode);
    setActiveTemplate(applyTpl.key);
    setActive(applyTpl.key);
    setApplyResult(result);
  }

  function closeApply() { setApplyTpl(null); setApplyResult(null); }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Industry Defaults</h2>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
          Choose a starter template for this company. Templates can be customized after applying — your
          edits never change the global template.
        </p>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
        {INDUSTRY_TEMPLATES.map(tpl => {
          const isActive = active === tpl.key;
          const comingSoon = tpl.status === "coming_soon";
          return (
            <div key={tpl.key} className="rounded-xl p-4 flex flex-col"
              style={{ backgroundColor: "var(--bg-surface)", border: `1px solid ${isActive ? "#8ed0c6" : "var(--border-subtle)"}`, boxShadow: "var(--shadow-card)" }}>
              <div className="flex items-start justify-between mb-2">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: "var(--bg-surface-2)" }}>
                  <Factory className="w-4.5 h-4.5" style={{ color: "#0f8578" }} />
                </div>
                {isActive ? (
                  <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: "#d1fae5", color: "#065f46" }}>
                    <CheckCircle className="w-3 h-3" /> Active
                  </span>
                ) : comingSoon ? (
                  <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>
                    <Clock className="w-3 h-3" /> Coming Soon
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: "#d3ebe6", color: "#0f8578" }}>Available</span>
                )}
              </div>

              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{tpl.name}</p>
              <p className="text-xs mt-0.5 mb-3 flex-1" style={{ color: "var(--text-muted)" }}>{tpl.description}</p>

              <div className="flex flex-wrap gap-1 mb-3">
                {tpl.includes.map(inc => (
                  <span key={inc} className="text-[9px] font-semibold px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--bg-surface-2)", color: "var(--text-secondary)" }}>{inc}</span>
                ))}
              </div>

              <div className="flex gap-2">
                <button onClick={() => setPreviewTpl(tpl)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                  <Eye className="w-3.5 h-3.5" /> Preview
                </button>
                <button onClick={() => { setApplyResult(null); setApplyTpl(tpl); }}
                  disabled={comingSoon || tpl.key === "custom"}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium text-white transition-colors disabled:opacity-40"
                  style={{ backgroundColor: "#0f8578" }}>
                  Apply
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        Applying a template copies its pipeline stages, job types, job statuses, and photo categories into
        this company&apos;s settings. After that, edit them freely in their own settings pages.
      </p>

      {previewTpl && (
        <PreviewModal tpl={previewTpl} onClose={() => setPreviewTpl(null)}
          onApply={() => { const t = previewTpl; setPreviewTpl(null); setApplyResult(null); setApplyTpl(t); }} />
      )}
      {applyTpl && (
        <ApplyModal tpl={applyTpl} result={applyResult} onConfirm={confirmApply} onClose={closeApply} />
      )}
    </div>
  );
}
