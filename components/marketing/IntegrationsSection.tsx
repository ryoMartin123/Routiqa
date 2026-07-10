"use client";

// ─── Marketing Integrations — the connection command center ──
// Every provider the marketing stack plugs into, grouped by what it does,
// with one obvious Connect action per card. Connections are SANDBOX-ONLY
// (stored locally, honestly labeled) — live OAuth/API wiring is Phase 6.
// Connecting a lead-generating provider suggests its lead source.

import { useState } from "react";
import { X, Plug, Check, Unplug, ShieldCheck, Radio } from "lucide-react";
import PageTitle from "@/components/shared/PageTitle";
import {
  INTEGRATIONS, INTEGRATION_CATEGORIES, integrationState, connectIntegration, disconnectIntegration, connectedCount,
  type IntegrationDef,
} from "@/lib/marketing/integrations";

const ROSE = "#e11d48";

export default function IntegrationsSection() {
  const [tick, setTick] = useState(0);
  const refresh = () => setTick(t => t + 1);
  const [connecting, setConnecting] = useState<IntegrationDef | null>(null);
  void tick;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <PageTitle title="Integrations" description="Connect the tools that feed and power your marketing — ads, delivery, and lead capture." />
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full shrink-0" style={{ backgroundColor: connectedCount() > 0 ? "#d1fae5" : "var(--bg-input)", color: connectedCount() > 0 ? "#065f46" : "var(--text-muted)" }}>
          {connectedCount()} of {INTEGRATIONS.length} connected
        </span>
      </div>

      {INTEGRATION_CATEGORIES.map(cat => (
        <div key={cat.key}>
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{cat.label}</p>
          <p className="text-xs mb-2.5" style={{ color: "var(--text-muted)" }}>{cat.blurb}</p>
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
            {INTEGRATIONS.filter(i => i.category === cat.key).map(i => {
              const st = integrationState(i.key);
              const connected = st.status === "connected";
              return (
                <div key={i.key} className="rounded-xl p-4 flex flex-col" style={{ backgroundColor: "var(--bg-surface)", border: `1px solid ${connected ? "#10b98155" : "var(--border)"}`, boxShadow: "var(--shadow-card)" }}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: i.accent + "1a" }}>
                      <Plug className="w-4 h-4" style={{ color: i.accent }} />
                    </span>
                    {connected ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: "#d1fae5", color: "#065f46" }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "#10b981" }} /> Connected
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>Not connected</span>
                    )}
                  </div>
                  <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{i.name}</p>
                  <p className="text-xs mt-0.5 flex-1" style={{ color: "var(--text-muted)" }}>{i.description}</p>
                  {connected && (
                    <p className="text-[11px] mt-2 truncate" style={{ color: "var(--text-secondary)" }}>
                      {st.accountLabel ?? "Sandbox account"} · since {st.connectedAt}
                    </p>
                  )}
                  {i.registersLeadSource && (
                    <p className="flex items-center gap-1 text-[10px] mt-1.5" style={{ color: "var(--text-muted)" }}>
                      <Radio className="w-3 h-3" /> Feeds the “{i.registersLeadSource}” lead source
                    </p>
                  )}
                  <div className="mt-3">
                    {connected ? (
                      <button onClick={() => { disconnectIntegration(i.key); refresh(); }}
                        className="w-full flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg transition-colors hover:bg-[var(--bg-surface-2)]"
                        style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                        <Unplug className="w-3.5 h-3.5" /> Disconnect
                      </button>
                    ) : (
                      <button onClick={() => setConnecting(i)}
                        className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg text-white hover:brightness-110"
                        style={{ backgroundColor: ROSE }}>
                        <Plug className="w-3.5 h-3.5" /> Connect
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <p className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
        <ShieldCheck className="w-3.5 h-3.5 shrink-0" /> Connections here are sandbox-only — credentials stay on this device and nothing reaches the provider until live integrations ship.
      </p>

      {connecting && (
        <ConnectSheet def={connecting} onClose={() => setConnecting(null)}
          onConnected={() => { setConnecting(null); refresh(); }} />
      )}
    </div>
  );
}

// ── Connect sheet — the one easy path in ──
function ConnectSheet({ def, onClose, onConnected }: { def: IntegrationDef; onClose: () => void; onConnected: () => void }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const primary = values[def.fields[0]?.key ?? ""] ?? "";
  return (
    <div className="fixed inset-0 z-[70] bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}
        style={{ backgroundColor: "var(--bg-surface)", boxShadow: "0 16px 48px rgba(0,0,0,0.24)" }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: def.accent + "1a" }}><Plug className="w-3.5 h-3.5" style={{ color: def.accent }} /></span>
            <p className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Connect {def.name}</p>
          </div>
          <button onClick={onClose} style={{ color: "var(--text-muted)" }}><X className="w-4 h-4" /></button>
        </div>
        <div className="px-6 py-4 space-y-3">
          {def.fields.map(f => (
            <div key={f.key}>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>{f.label}</label>
              <input type={f.secret ? "password" : "text"} value={values[f.key] ?? ""} placeholder={f.placeholder}
                onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
            </div>
          ))}
          <p className="text-[11px] rounded-lg px-3 py-2" style={{ backgroundColor: "var(--bg-surface-2)", color: "var(--text-muted)" }}>
            Sandbox connection — saved locally so you can wire up campaigns and lead sources now; live authentication ships with Phase 6 integrations.
          </p>
          {def.registersLeadSource && (
            <p className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--text-secondary)" }}>
              <Radio className="w-3.5 h-3.5 shrink-0" style={{ color: ROSE }} /> Connecting links the “{def.registersLeadSource}” lead source to this provider.
            </p>
          )}
        </div>
        <div className="px-6 py-4 flex justify-end gap-2" style={{ borderTop: "1px solid var(--border)" }}>
          <button onClick={onClose} className="px-3 py-2 rounded-lg text-sm" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
          <button onClick={() => { connectIntegration(def.key, primary); onConnected(); }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: ROSE }}>
            <Check className="w-4 h-4" /> Connect
          </button>
        </div>
      </div>
    </div>
  );
}
