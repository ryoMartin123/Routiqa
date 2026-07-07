"use client";

// Parts on order for a job — what "Waiting on Parts" is waiting FOR. Add the
// ordered part(s), mark them received as they arrive; when everything is in,
// the card flags the job ready and the dispatch queue picks it up on its own.

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Package, Check, Plus, Trash2, ArrowUpRight } from "lucide-react";
import { getPartOrders, createPartOrder, markPartReceived, deletePartOrder, jobPartsReady } from "@/lib/jobs/parts";
import { getJob } from "@/lib/jobs/data";

export default function JobPartsCard({ jobId }: { jobId: string }) {
  const [rev, setRev] = useState(0);
  const bump = () => setRev(r => r + 1);
  const parts = useMemo(() => getPartOrders(jobId), [jobId, rev]);
  const job = getJob(jobId);
  const [desc, setDesc] = useState("");
  const [supplier, setSupplier] = useState("");
  const [eta, setEta] = useState("");

  const waiting = job?.status === "waiting_on_parts";
  if (!waiting && parts.length === 0) return null;
  const ready = jobPartsReady(jobId) && waiting;

  function add() {
    if (!desc.trim()) return;
    createPartOrder({ jobId, description: desc.trim(), supplier: supplier.trim() || undefined, eta: eta.trim() || undefined });
    setDesc(""); setSupplier(""); setEta("");
    bump();
  }

  return (
    <div className="rounded-xl shrink-0 overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center justify-between px-4 pt-4">
        <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Parts on Order</p>
        {parts.length > 0 && <span className="text-[11px] font-medium tabular-nums" style={{ color: "var(--text-muted)" }}>{parts.filter(p => p.status === "received").length}/{parts.length} received</span>}
      </div>

      {/* Ready banner — everything arrived, the return visit can be booked. */}
      {ready && (
        <div className="mx-4 mt-3 rounded-lg px-3 py-2.5 flex items-center justify-between gap-2" style={{ backgroundColor: "#ecfdf5", border: "1px solid #a7f3d0" }}>
          <p className="text-xs font-medium" style={{ color: "#065f46" }}>All parts received — the return visit is in the dispatch queue.</p>
          <Link href="/dispatching" className="group inline-flex items-center gap-1 text-[11px] font-semibold shrink-0" style={{ color: "#059669", textDecoration: "none" }}>
            Dispatch <ArrowUpRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
        </div>
      )}

      <div className="px-4 py-3 space-y-2">
        {parts.length === 0 && (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>This job is waiting on parts — track what was ordered so it's clear when it can be rescheduled.</p>
        )}
        {parts.map(p => (
          <div key={p.id} className="flex items-center gap-2.5">
            <Package className="w-3.5 h-3.5 shrink-0" style={{ color: p.status === "received" ? "#16a34a" : "#d97706" }} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)", textDecoration: p.status === "received" ? "line-through" : "none", opacity: p.status === "received" ? 0.6 : 1 }}>{p.description}</p>
              <p className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>
                {p.status === "received" ? "Received" : [p.supplier, p.eta ? `ETA ${p.eta}` : null, p.note].filter(Boolean).join(" · ") || "Ordered"}
              </p>
            </div>
            {p.status === "ordered" ? (
              <button onClick={() => { markPartReceived(p.id); bump(); }}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium shrink-0 transition-colors hover:bg-[var(--bg-surface-2)]"
                style={{ border: "1px solid var(--border)", color: "#059669" }}>
                <Check className="w-3 h-3" /> Received
              </button>
            ) : (
              <button onClick={() => { deletePartOrder(p.id); bump(); }} title="Remove"
                className="p-1 rounded shrink-0 opacity-50 hover:opacity-100 transition-opacity" style={{ color: "var(--text-muted)" }}>
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}

        {/* Add a part */}
        <div className="flex items-center gap-1.5 pt-1">
          <input value={desc} onChange={e => setDesc(e.target.value)} onKeyDown={e => e.key === "Enter" && add()} placeholder="Part…"
            className="flex-1 min-w-0 rounded-md px-2 py-1.5 text-xs outline-none" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
          <input value={supplier} onChange={e => setSupplier(e.target.value)} onKeyDown={e => e.key === "Enter" && add()} placeholder="Supplier"
            className="w-20 rounded-md px-2 py-1.5 text-xs outline-none" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
          <input value={eta} onChange={e => setEta(e.target.value)} onKeyDown={e => e.key === "Enter" && add()} placeholder="ETA"
            className="w-16 rounded-md px-2 py-1.5 text-xs outline-none" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
          <button onClick={add} disabled={!desc.trim()} title="Add part"
            className="p-1.5 rounded-md shrink-0 text-white disabled:opacity-40" style={{ backgroundColor: "#0f8578" }}>
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
