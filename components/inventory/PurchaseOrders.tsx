"use client";

// ─── Inventory & Procurement · Purchase Orders ────────────
// Create, track, receive, and link vendor orders to projects/jobs. Receiving
// updates line quantities, rolls up PO status, and writes an inventory movement
// (vendor → stock location). Mock/local state. No real approval or payments yet.

import { useMemo, useState } from "react";
import {
  ShoppingCart, Plus, Search, SlidersHorizontal, PackageCheck, MoreHorizontal,
  Clock, AlertTriangle, X, Trash2, Truck,
} from "lucide-react";
import UiSelect from "@/components/ui/Select";
import ModuleViewToggle, { type ModuleView } from "@/components/shared/ModuleViewToggle";
import StatusTabs from "@/components/shared/StatusTabs";
import { PageHeader, StatCard } from "@/components/platform/ui";
import {
  getPurchaseOrders, getPurchaseOrder, createPurchaseOrder, receivePurchaseOrder,
  getOpenPurchaseOrders, getPartiallyReceivedPOs, getOverduePOs, getVendors, getInventoryItems, getStockLocations,
  poSubtotal, poReceivedQty, poOrderedQty, poReceivingState,
  PO_STATUS_STYLE, TRACKING_METHOD_LABELS, MOCK_PROJECTS, MOCK_JOBS,
  type PurchaseOrder, type POStatus, type POLine, type TrackingMethod,
} from "@/lib/inventory/data";
import {
  ACCENT, money, Slideover, InfoRow, Dot, LinkedChip, Field, inp, inpStyle, DrawerBlockTitle,
} from "@/components/inventory/procurementUi";

const PO_COLS = "0.9fr 1.3fr 1.1fr 1.3fr 0.9fr 1fr 0.8fr 0.9fr 0.6fr";
const TRACKING: TrackingMethod[] = Object.keys(TRACKING_METHOD_LABELS) as TrackingMethod[];

function ReceivedCell({ po }: { po: PurchaseOrder }) {
  const state = poReceivingState(po);
  const color = state === "full" ? "#10b981" : state === "partial" ? "#f59e0b" : "var(--text-muted)";
  return <span className="text-xs tabular-nums" style={{ color }}>{poReceivedQty(po)} / {poOrderedQty(po)}</span>;
}

export default function PurchaseOrders() {
  const [tick, setTick] = useState(0);
  const refresh = () => setTick(t => t + 1);
  const pos = useMemo(() => getPurchaseOrders(), [tick]);

  const [view, setView] = useState<ModuleView>("list");
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [fVendor, setFVendor] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [receiving, setReceiving] = useState<PurchaseOrder | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const vendors = getVendors();

  const TAB_FNS: Record<string, (p: PurchaseOrder) => boolean> = {
    all: () => true,
    draft: p => p.status === "draft",
    open: p => ["pending_approval", "approved", "ordered"].includes(p.status),
    partially_received: p => p.status === "partially_received",
    received: p => p.status === "received" || p.status === "closed",
  };
  const tabFn = TAB_FNS[tab] ?? TAB_FNS.all;

  const q = search.trim().toLowerCase();
  const filtered = pos.filter(p => {
    if (!tabFn(p)) return false;
    if (q && !`${p.number} ${p.vendorName} ${p.projectName ?? ""}`.toLowerCase().includes(q)) return false;
    if (fVendor !== "all" && p.vendorId !== fVendor) return false;
    return true;
  });
  const activeFilters = fVendor !== "all" ? 1 : 0;
  const openPO = openId ? getPurchaseOrder(openId) : undefined;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0"><PageHeader title="Purchase Orders" subtitle="Create, track, receive, and link vendor orders to inventory, jobs, and projects." /></div>
        <ModuleViewToggle view={view} onChange={setView} listLabel="POs" accent={ACCENT} />
        <div className="flex-1 flex justify-end items-center gap-2">
          <button onClick={() => setReceiving(getOpenPurchaseOrders()[0] ?? pos[0] ?? null)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm shrink-0" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
            <PackageCheck className="w-4 h-4" /> Receive Items
          </button>
          <button onClick={() => setCreating(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white shrink-0 hover:brightness-110" style={{ backgroundColor: ACCENT }}>
            <Plus className="w-4 h-4" /> Create Purchase Order
          </button>
        </div>
      </div>

      {view === "overview" && (
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
          <StatCard label="Open POs" value={String(getOpenPurchaseOrders().length)} hint="Active orders" icon={ShoppingCart} accent="#0ea5e9" />
          <StatCard label="Awaiting Approval" value={String(pos.filter(p => p.status === "pending_approval").length)} hint="Placeholder" icon={Clock} accent="#6366f1" />
          <StatCard label="Partially Received" value={String(getPartiallyReceivedPOs().length)} hint="In progress" icon={PackageCheck} accent={ACCENT} />
          <StatCard label="Overdue Deliveries" value={String(getOverduePOs().length)} hint="Past expected" icon={AlertTriangle} accent="#ef4444" />
        </div>
      )}

      {view === "list" && (
      <>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <StatusTabs accent={ACCENT} active={tab} onChange={setTab}
          tabs={[
            { key: "all", label: "All", count: pos.length },
            { key: "draft", label: "Draft", count: pos.filter(TAB_FNS.draft).length },
            { key: "open", label: "Open", count: pos.filter(TAB_FNS.open).length },
            { key: "partially_received", label: "Partial", count: pos.filter(TAB_FNS.partially_received).length },
            { key: "received", label: "Received", count: pos.filter(TAB_FNS.received).length },
          ]} />
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg px-3 py-1.5" style={{ backgroundColor: "var(--bg-input)" }}>
            <Search className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search POs, vendor..." className="bg-transparent text-sm outline-none w-48" style={{ color: "var(--text-primary)" }} />
          </div>
          <div className="relative">
            <button onClick={() => setFiltersOpen(o => !o)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors"
              style={{ border: `1px solid ${activeFilters ? ACCENT + "66" : "var(--border)"}`, backgroundColor: activeFilters ? ACCENT + "14" : "var(--bg-surface)", color: activeFilters ? ACCENT : "var(--text-secondary)" }}>
              <SlidersHorizontal className="w-3.5 h-3.5" /> Filter{activeFilters > 0 && <span className="text-[10px] font-bold px-1.5 rounded-full" style={{ backgroundColor: ACCENT + "26", color: ACCENT }}>{activeFilters}</span>}
            </button>
            {filtersOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setFiltersOpen(false)} />
                <div className="absolute right-0 top-full mt-2 z-50 rounded-xl p-4 w-64" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 12px 32px rgba(0,0,0,0.18)" }}>
                  <div className="flex items-center justify-between mb-3"><p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Filters</p>{activeFilters > 0 && <button onClick={() => setFVendor("all")} className="text-xs" style={{ color: ACCENT }}>Clear</button>}</div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Vendor</label>
                  <UiSelect size="sm" value={fVendor} onChange={setFVendor} options={[{ value: "all", label: "Any vendor" }, ...vendors.map(v => ({ value: v.id, label: v.name }))]} />
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
        <div className="overflow-x-auto thin-scroll-x">
          <div style={{ minWidth: 1100 }}>
            <div className="grid px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider items-center" style={{ gridTemplateColumns: PO_COLS, gap: "0.75rem", color: "var(--text-muted)", borderBottom: "1px solid var(--border)", backgroundColor: "transparent" }}>
              <span>PO #</span><span>Vendor</span><span>Status</span><span>Linked</span><span className="text-right">Total</span><span>Expected</span><span className="text-center">Received</span><span>Created By</span><span className="text-right">Actions</span>
            </div>
            {filtered.length === 0 ? (
              <div className="py-14 text-center"><p className="text-sm" style={{ color: "var(--text-muted)" }}>No purchase orders match the current filters.</p></div>
            ) : filtered.map((p, i) => (
              <div key={p.id} onClick={() => setOpenId(p.id)} className="grid px-4 py-3 items-center cursor-pointer transition-colors hover:bg-[var(--bg-surface-2)]"
                style={{ gridTemplateColumns: PO_COLS, gap: "0.75rem", borderBottom: i < filtered.length - 1 ? "1px solid var(--border)" : "none" }}>
                <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{p.number}</div>
                <div className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>{p.vendorName}</div>
                <div><Dot style={PO_STATUS_STYLE[p.status]} /></div>
                <div className="min-w-0">{p.projectName ? <LinkedChip label={p.projectName} /> : <span className="text-xs" style={{ color: "var(--text-muted)" }}>—</span>}</div>
                <div className="text-right text-sm tabular-nums" style={{ color: "var(--text-primary)" }}>{money(poSubtotal(p))}</div>
                <div className="text-xs" style={{ color: "var(--text-secondary)" }}>{p.expectedDelivery ?? "—"}</div>
                <div className="text-center"><ReceivedCell po={p} /></div>
                <div className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>{p.createdBy}</div>
                <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                  {poReceivingState(p) !== "full" && p.status !== "draft" && p.status !== "canceled" && (
                    <button onClick={() => setReceiving(p)} title="Receive" className="p-1.5 rounded-lg" style={{ border: "1px solid var(--border)", color: ACCENT }}><PackageCheck className="w-3.5 h-3.5" /></button>
                  )}
                  <button onClick={() => setOpenId(p.id)} title="More" className="p-1.5 rounded-lg" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}><MoreHorizontal className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      </>
      )}

      {openPO && <PODrawer po={openPO} onClose={() => setOpenId(null)} onReceive={() => { setReceiving(openPO); setOpenId(null); }} />}
      {creating && <CreatePODrawer onClose={() => setCreating(false)} onCreated={() => { setCreating(false); refresh(); }} />}
      {receiving && <ReceiveDrawer po={receiving} onClose={() => setReceiving(null)} onReceived={() => { setReceiving(null); refresh(); }} />}
    </div>
  );
}

// ─── Detail drawer ────────────────────────────────────────
function PODrawer({ po, onClose, onReceive }: { po: PurchaseOrder; onClose: () => void; onReceive: () => void }) {
  const canReceive = poReceivingState(po) !== "full" && po.status !== "draft" && po.status !== "canceled";
  return (
    <Slideover title={po.number} subtitle={po.vendorName} onClose={onClose}
      footer={<>
        <button onClick={onClose} className="text-sm font-medium px-3 py-2 rounded-lg" style={{ color: "var(--text-secondary)" }}>Close</button>
        {canReceive && <button onClick={onReceive} className="text-sm font-medium px-4 py-2 rounded-lg text-white flex items-center gap-1.5" style={{ backgroundColor: ACCENT }}><PackageCheck className="w-4 h-4" /> Receive Items</button>}
      </>}>
      <div className="px-5 pt-4 flex items-center gap-2 flex-wrap"><Dot style={PO_STATUS_STYLE[po.status]} /></div>
      <div className="p-5 space-y-4">
        <div>
          <InfoRow label="Vendor">{po.vendorName}</InfoRow>
          <InfoRow label="Status">{PO_STATUS_STYLE[po.status].label}</InfoRow>
          <InfoRow label="Linked project">{po.projectName ? <LinkedChip label={po.projectName} /> : "—"}</InfoRow>
          <InfoRow label="Expected delivery">{po.expectedDelivery ?? "—"}</InfoRow>
          <InfoRow label="Ordered">{po.orderedDate ?? "—"}</InfoRow>
          <InfoRow label="Created by">{po.createdBy}</InfoRow>
          <InfoRow label="Total">{money(poSubtotal(po))}</InfoRow>
        </div>
        <div>
          <DrawerBlockTitle>Line Items</DrawerBlockTitle>
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            <div className="grid px-3 py-2 text-[10px] font-semibold uppercase tracking-wider" style={{ gridTemplateColumns: "2fr 0.8fr 1fr 1fr", gap: "0.5rem", color: "var(--text-muted)", backgroundColor: "var(--bg-surface-2)", borderBottom: "1px solid var(--border)" }}>
              <span>Item</span><span className="text-center">Recv/Ord</span><span className="text-right">Unit</span><span className="text-right">Total</span>
            </div>
            {po.lines.map((l, i) => (
              <div key={l.id} className="grid px-3 py-2 items-center" style={{ gridTemplateColumns: "2fr 0.8fr 1fr 1fr", gap: "0.5rem", borderBottom: i < po.lines.length - 1 ? "1px solid var(--border)" : "none" }}>
                <div className="min-w-0"><p className="text-sm truncate" style={{ color: "var(--text-primary)" }}>{l.itemName}</p><p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{TRACKING_METHOD_LABELS[l.tracking]}</p></div>
                <div className="text-center text-xs tabular-nums" style={{ color: l.quantityReceived >= l.quantityOrdered ? "#10b981" : "var(--text-secondary)" }}>{l.quantityReceived}/{l.quantityOrdered}</div>
                <div className="text-right text-xs tabular-nums" style={{ color: "var(--text-secondary)" }}>{money(l.unitCost)}</div>
                <div className="text-right text-xs tabular-nums" style={{ color: "var(--text-primary)" }}>{money(l.unitCost * l.quantityOrdered)}</div>
              </div>
            ))}
          </div>
        </div>
        {po.notes && <div><DrawerBlockTitle>Notes</DrawerBlockTitle><p className="text-sm" style={{ color: "var(--text-secondary)" }}>{po.notes}</p></div>}
      </div>
    </Slideover>
  );
}

// ─── Create PO drawer ─────────────────────────────────────
interface DraftLine { id: string; itemId?: string; itemName: string; quantityOrdered: number; unitCost: number; tracking: TrackingMethod }
function CreatePODrawer({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const vendors = getVendors();
  const items = getInventoryItems();
  const [vendorId, setVendorId] = useState(vendors[0]?.id ?? "");
  const [expected, setExpected] = useState("");
  const [projectId, setProjectId] = useState("");
  const [jobId, setJobId] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([{ id: "dl-1", itemName: "", quantityOrdered: 1, unitCost: 0, tracking: "manual" }]);
  const [error, setError] = useState<string | null>(null);

  function setLine(id: string, patch: Partial<DraftLine>) { setLines(ls => ls.map(l => l.id === id ? { ...l, ...patch } : l)); }
  function addLine() { setLines(ls => [...ls, { id: `dl-${Date.now()}`, itemName: "", quantityOrdered: 1, unitCost: 0, tracking: "manual" }]); }
  function removeLine(id: string) { setLines(ls => ls.filter(l => l.id !== id)); }
  function pickItem(lineId: string, itemId: string) {
    const it = items.find(i => i.id === itemId);
    if (it) setLine(lineId, { itemId: it.id, itemName: it.name, unitCost: it.cost ?? 0 });
    else setLine(lineId, { itemId: undefined });
  }

  const subtotal = lines.reduce((s, l) => s + l.unitCost * l.quantityOrdered, 0);

  function build(status: POStatus) {
    const vendor = vendors.find(v => v.id === vendorId);
    if (!vendor) { setError("Select a vendor."); return; }
    const valid = lines.filter(l => l.itemName.trim() && l.quantityOrdered > 0);
    if (valid.length === 0) { setError("Add at least one line item."); return; }
    const project = MOCK_PROJECTS.find(p => p.id === projectId);
    createPurchaseOrder({
      vendorId: vendor.id, vendorName: vendor.name, status,
      projectId: projectId || undefined, projectName: project?.name, jobId: jobId || undefined,
      expectedDelivery: expected.trim() || undefined, orderedDate: status === "ordered" ? "Jun 24, 2026" : undefined,
      createdBy: "Ryo Martin", notes: notes.trim() || undefined,
      lines: valid.map((l): POLine => ({ id: `pl-${Date.now()}-${Math.random().toString(36).slice(2, 4)}`, itemId: l.itemId, itemName: l.itemName.trim(), quantityOrdered: l.quantityOrdered, quantityReceived: 0, unitCost: l.unitCost, tracking: l.tracking })),
    });
    onCreated();
  }

  return (
    <Slideover title="Create Purchase Order" subtitle="Vendor order — links to inventory, jobs, and projects" onClose={onClose} width={640}
      footer={<>
        <button onClick={onClose} className="text-sm font-medium px-3 py-2 rounded-lg" style={{ color: "var(--text-secondary)" }}>Cancel</button>
        <button onClick={() => build("draft")} className="text-sm font-medium px-3 py-2 rounded-lg" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Save Draft</button>
        <button onClick={() => build("ordered")} className="text-sm font-medium px-4 py-2 rounded-lg text-white" style={{ backgroundColor: ACCENT }}>Mark Ordered</button>
      </>}>
      <div className="p-5 space-y-4">
        <div>
          <DrawerBlockTitle>Vendor &amp; Details</DrawerBlockTitle>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Vendor *"><UiSelect value={vendorId} onChange={setVendorId} options={vendors.map(v => ({ value: v.id, label: v.name }))} /></Field>
            <Field label="Expected delivery"><input value={expected} onChange={e => setExpected(e.target.value)} placeholder="Jun 27, 2026" className={inp} style={inpStyle} /></Field>
            <Field label="Link project" hint="optional"><UiSelect value={projectId} onChange={setProjectId} options={[{ value: "", label: "None" }, ...MOCK_PROJECTS.map(p => ({ value: p.id, label: p.name }))]} /></Field>
            <Field label="Link job" hint="optional"><UiSelect value={jobId} onChange={setJobId} options={[{ value: "", label: "None" }, ...MOCK_JOBS.map(j => ({ value: j.id, label: j.name }))]} /></Field>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2"><DrawerBlockTitle>Line Items</DrawerBlockTitle><button onClick={addLine} className="text-xs font-medium flex items-center gap-1" style={{ color: ACCENT }}><Plus className="w-3.5 h-3.5" /> Add line</button></div>
          <div className="space-y-2">
            {lines.map(l => (
              <div key={l.id} className="rounded-lg p-3 space-y-2" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)" }}>
                <div className="flex items-center gap-2">
                  <div className="flex-1"><UiSelect size="sm" value={l.itemId ?? ""} onChange={v => pickItem(l.id, v)} options={[{ value: "", label: "Custom item…" }, ...items.map(i => ({ value: i.id, label: i.name }))]} /></div>
                  {lines.length > 1 && <button onClick={() => removeLine(l.id)} className="p-1.5 rounded-md shrink-0" style={{ color: "var(--text-muted)" }}><Trash2 className="w-3.5 h-3.5" /></button>}
                </div>
                {!l.itemId && <input value={l.itemName} onChange={e => setLine(l.id, { itemName: e.target.value })} placeholder="Item name" className={inp} style={inpStyle} />}
                <div className="grid grid-cols-3 gap-2">
                  <div><label className="block text-[10px] mb-0.5" style={{ color: "var(--text-muted)" }}>Qty</label><input type="number" min={1} value={l.quantityOrdered} onChange={e => setLine(l.id, { quantityOrdered: parseInt(e.target.value) || 0 })} className={inp} style={inpStyle} /></div>
                  <div><label className="block text-[10px] mb-0.5" style={{ color: "var(--text-muted)" }}>Unit cost</label><input type="number" min={0} step="0.01" value={l.unitCost} onChange={e => setLine(l.id, { unitCost: parseFloat(e.target.value) || 0 })} className={inp} style={inpStyle} /></div>
                  <div><label className="block text-[10px] mb-0.5" style={{ color: "var(--text-muted)" }}>Tracking</label><UiSelect size="sm" value={l.tracking} onChange={v => setLine(l.id, { tracking: v as TrackingMethod })} options={TRACKING.map(t => ({ value: t, label: TRACKING_METHOD_LABELS[t] }))} /></div>
                </div>
                <p className="text-[11px] text-right" style={{ color: "var(--text-muted)" }}>Line total: {money(l.unitCost * l.quantityOrdered)}</p>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-end gap-2 mt-3 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>Subtotal</span>
            <span className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>{money(subtotal)}</span>
          </div>
        </div>

        <Field label="Notes"><textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className={`${inp} resize-none`} style={inpStyle} /></Field>
        {error && <div className="px-3 py-2 rounded-lg text-xs" style={{ backgroundColor: "#fee2e2", color: "#991b1b" }}>{error}</div>}
        <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Approval is a placeholder for now (Draft → Ordered). Bills &amp; payments are handled by Accounting later.</p>
      </div>
    </Slideover>
  );
}

// ─── Receive items drawer ─────────────────────────────────
function ReceiveDrawer({ po, onClose, onReceived }: { po: PurchaseOrder; onClose: () => void; onReceived: () => void }) {
  const locations = getStockLocations();
  const [destination, setDestination] = useState(locations[0] ?? "Main Warehouse");
  const [notes, setNotes] = useState("");
  const [qty, setQty] = useState<Record<string, number>>(() => Object.fromEntries(po.lines.map(l => [l.id, Math.max(0, l.quantityOrdered - l.quantityReceived)])));

  const totalReceiving = Object.values(qty).reduce((s, n) => s + (n || 0), 0);

  function submit() {
    const receipts = po.lines.map(l => ({ lineId: l.id, quantity: Math.max(0, Math.min(qty[l.id] || 0, l.quantityOrdered - l.quantityReceived)) })).filter(r => r.quantity > 0);
    if (receipts.length === 0) { onClose(); return; }
    receivePurchaseOrder(po.id, receipts, destination, { createdBy: "Ryo Martin", notes: notes.trim() || undefined });
    onReceived();
  }

  return (
    <Slideover title={`Receive — ${po.number}`} subtitle={po.vendorName} onClose={onClose}
      footer={<>
        <button onClick={onClose} className="text-sm font-medium px-3 py-2 rounded-lg" style={{ color: "var(--text-secondary)" }}>Cancel</button>
        <button onClick={submit} disabled={totalReceiving <= 0} className="text-sm font-medium px-4 py-2 rounded-lg text-white disabled:opacity-40 flex items-center gap-1.5" style={{ backgroundColor: ACCENT }}><PackageCheck className="w-4 h-4" /> Receive {totalReceiving > 0 ? `(${totalReceiving})` : ""}</button>
      </>}>
      <div className="p-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Destination" className="col-span-2">
            <UiSelect value={destination} onChange={setDestination} options={locations.map(l => ({ value: l, label: l }))} />
          </Field>
        </div>
        <div>
          <DrawerBlockTitle>Items</DrawerBlockTitle>
          <div className="space-y-2">
            {po.lines.map(l => {
              const remaining = l.quantityOrdered - l.quantityReceived;
              return (
                <div key={l.id} className="rounded-lg p-3" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)" }}>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="min-w-0"><p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{l.itemName}</p><p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Ordered {l.quantityOrdered} · received {l.quantityReceived} · {TRACKING_METHOD_LABELS[l.tracking]}</p></div>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-[11px]" style={{ color: "var(--text-muted)" }}>Receive now</label>
                    <input type="number" min={0} max={remaining} value={qty[l.id] ?? 0} onChange={e => setQty(p => ({ ...p, [l.id]: Math.max(0, Math.min(remaining, parseInt(e.target.value) || 0)) }))}
                      className="w-20 rounded-lg px-2 py-1.5 text-sm outline-none" style={inpStyle} disabled={remaining <= 0} />
                    <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>/ {remaining} remaining</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <Field label="Notes"><textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className={`${inp} resize-none`} style={inpStyle} /></Field>
        <div className="rounded-lg px-3 py-2 flex items-center gap-2" style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border)" }}>
          <Truck className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Receiving records a movement (<span style={{ color: "var(--text-secondary)" }}>{po.vendorName} → {destination}</span>) and updates on-hand stock. Barcode / RFID scanning is future-ready.</p>
        </div>
      </div>
    </Slideover>
  );
}
