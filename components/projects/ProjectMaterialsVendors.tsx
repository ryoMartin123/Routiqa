"use client";

// ─── CRM Project · Materials & Vendors ────────────────────
// Project procurement visibility. Inventory & Procurement OWNS the vendor /
// subcontractor masters, purchase orders, and material requests — this tab only
// LINKS them to the current project (mock/local). Five sections: Required
// Materials, Purchase Orders, Vendors, Subcontractors, Procurement Activity.

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Package, ShoppingCart, Building2, HardHat, Activity, Plus, ExternalLink, X, Trash2,
  PackageCheck, AlertTriangle, FileText,
} from "lucide-react";
import UiSelect from "@/components/ui/Select";
import StatusBadge from "@/components/shared/StatusBadge";
import {
  getVendors, getVendor, getSubcontractors, getSubcontractor,
  getProjectVendorLinks, createProjectVendorLink, removeProjectVendorLink,
  posForProject, assignmentsForProject, createAssignment,
  materialRequestsForProject, createMaterialRequest, projectProcurementActivity,
  subCompliance, subComplianceWarnings, poSubtotal, poReceivedQty, poOrderedQty,
  PO_STATUS_STYLE, ASSIGNMENT_STATUS_STYLE, PROJECT_VENDOR_STATUS_STYLE,
  type DocStatus, type AssignmentStatus, type ProjectVendorStatus,
} from "@/lib/inventory/data";

const ACCENT = "#4f46e5"; // CRM indigo
const money = (n?: number) => (n != null ? `$${n.toLocaleString()}` : "—");
const inp = "w-full rounded-lg px-3 py-2 text-sm outline-none";
const inpStyle: React.CSSProperties = { border: "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)", color: "var(--text-primary)" };

const ACTIVITY_ICON = { received: PackageCheck, truck_adjusted: PackageCheck, po_created: ShoppingCart, doc_uploaded: FileText, sub_assigned: HardHat, compliance: AlertTriangle, material_request: Package } as const;

export default function ProjectMaterialsVendors({ projectId, projectName }: { projectId: string; projectName: string }) {
  const [tick, setTick] = useState(0);
  const refresh = () => setTick(t => t + 1);
  const [modal, setModal] = useState<null | "vendor" | "sub" | "materials">(null);

  const links = useMemo(() => getProjectVendorLinks(projectId), [projectId, tick]);
  const pos = useMemo(() => posForProject(projectId), [projectId, tick]);
  const assignments = useMemo(() => assignmentsForProject(projectId), [projectId, tick]);
  const requests = useMemo(() => materialRequestsForProject(projectId), [projectId, tick]);
  const activity = useMemo(() => projectProcurementActivity(projectId), [projectId, tick]);

  return (
    <div className="space-y-5 w-full">
      {/* Four sections two-up; Procurement Activity spans full width below. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
      {/* 1 · Required Materials */}
      <Section title="Required Materials" icon={Package} action={<Btn onClick={() => setModal("materials")}>Request Materials</Btn>}>
        {requests.length === 0 ? <Empty text="No material requests for this project yet." /> : (
          <Table head={["Item", "Qty", "Source", "Status", "Linked PO", "Received", "Used"]}>
            {requests.flatMap(mr => mr.items.map((it, idx) => (
              <Row key={`${mr.id}-${idx}`} cells={[
                it.name,
                String(it.quantity),
                cap(mr.source),
                <StatusBadge key="s" size="sm" label={cap(mr.status)} color={mr.status === "fulfilled" ? "#10b981" : mr.status === "ordered" ? "#f59e0b" : "#9ca3af"} />,
                mr.number,
                "—", "—",
              ]} />
            )))}
          </Table>
        )}
      </Section>

      {/* 2 · Purchase Orders */}
      <Section title="Purchase Orders" icon={ShoppingCart} action={<Link href="/inventory/purchase-orders" className="text-xs font-medium flex items-center gap-1" style={{ color: ACCENT }}><ExternalLink className="w-3.5 h-3.5" /> Create in Inventory</Link>}>
        {pos.length === 0 ? <Empty text="No purchase orders linked to this project." /> : (
          <Table head={["PO #", "Vendor", "Status", "Total", "Expected", "Received"]}>
            {pos.map(p => (
              <Row key={p.id} cells={[
                p.number, p.vendorName,
                <StatusBadge key="s" size="sm" label={PO_STATUS_STYLE[p.status].label} color={PO_STATUS_STYLE[p.status].dot} />,
                money(poSubtotal(p)), p.expectedDelivery ?? "—",
                `${poReceivedQty(p)} / ${poOrderedQty(p)}`,
              ]} />
            ))}
          </Table>
        )}
      </Section>

      {/* 3 · Vendors */}
      <Section title="Vendors" icon={Building2} action={<Btn onClick={() => setModal("vendor")}>Add Vendor</Btn>}>
        {links.length === 0 ? <Empty text="No vendors linked to this project yet." /> : (
          <Table head={["Vendor", "Purpose", "Contact", "Related POs", "Committed", "Status", ""]}>
            {links.map(l => {
              const v = getVendor(l.vendorId);
              const relatedPOs = pos.filter(p => p.vendorId === l.vendorId).length;
              return (
                <Row key={l.id} cells={[
                  v?.name ?? "—", l.purpose, l.contactPerson ?? v?.primaryContactName ?? "—",
                  String(relatedPOs), money(l.amountCommitted),
                  <StatusBadge key="s" size="sm" label={PROJECT_VENDOR_STATUS_STYLE[l.status].label} color={PROJECT_VENDOR_STATUS_STYLE[l.status].dot} />,
                  <button key="x" onClick={() => { removeProjectVendorLink(l.id); refresh(); }} title="Remove link" className="p-1 rounded" style={{ color: "var(--text-muted)" }}><Trash2 className="w-3.5 h-3.5" /></button>,
                ]} />
              );
            })}
          </Table>
        )}
      </Section>

      {/* 4 · Subcontractors */}
      <Section title="Subcontractors" icon={HardHat} action={<Btn onClick={() => setModal("sub")}>Assign Subcontractor</Btn>}>
        {assignments.length === 0 ? <Empty text="No subcontractors assigned to this project yet." /> : (
          <div className="space-y-2">
            {assignments.map(a => {
              const sub = getSubcontractor(a.subcontractorId);
              return (
                <div key={a.id} className="rounded-lg px-3 py-2.5" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)" }}>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{sub?.companyName ?? "Subcontractor"}</span>
                      {sub && <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>· {sub.trade}</span>}
                    </div>
                    <StatusBadge size="sm" label={ASSIGNMENT_STATUS_STYLE[a.status].label} color={ASSIGNMENT_STATUS_STYLE[a.status].dot} />
                  </div>
                  <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{a.scopeOfWork}</p>
                  <div className="flex items-center justify-between gap-2 mt-1.5 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      {sub && <CompPill label="W-9" status={sub.w9Status} />}
                      {sub && <CompPill label="Ins" status={sub.insuranceStatus} />}
                      {sub && <CompPill label="Lic" status={sub.licenseStatus} />}
                    </div>
                    <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                      {a.phaseName ? `${a.phaseName} · ` : ""}{a.scheduledDate ?? "Unscheduled"}{a.contractAmount != null ? ` · ${money(a.contractAmount)}` : ""}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      </div>

      {/* 5 · Procurement Activity — full width */}
      <Section title="Procurement Activity" icon={Activity}>
        {activity.length === 0 ? <Empty text="No procurement activity yet." /> : (
          <ul className="space-y-2.5">
            {activity.map(ev => {
              const Icon = ACTIVITY_ICON[ev.kind] ?? Activity;
              return (
                <li key={ev.id} className="flex items-start gap-2.5">
                  <span className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: ev.kind === "compliance" ? "#fee2e2" : "var(--bg-surface-2)", border: "1px solid var(--border)" }}>
                    <Icon className="w-3 h-3" style={{ color: ev.kind === "compliance" ? "#dc2626" : "var(--text-secondary)" }} />
                  </span>
                  <div className="min-w-0"><p className="text-sm" style={{ color: "var(--text-primary)" }}>{ev.text}</p><p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{ev.when}</p></div>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
        Vendors & subcontractors are owned by Inventory &amp; Procurement — this tab links them to the project. Bills &amp; payments are handled by Accounting; W-9s/COIs/contracts live in Documents.
      </p>

      {modal === "vendor" && <AddVendorModal projectId={projectId} onClose={() => setModal(null)} onSaved={() => { setModal(null); refresh(); }} />}
      {modal === "sub" && <AssignSubModal projectId={projectId} projectName={projectName} onClose={() => setModal(null)} onSaved={() => { setModal(null); refresh(); }} />}
      {modal === "materials" && <RequestMaterialsModal projectId={projectId} projectName={projectName} onClose={() => setModal(null)} onSaved={() => { setModal(null); refresh(); }} />}
    </div>
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// ─── Layout helpers ───────────────────────────────────────
function Section({ title, icon: Icon, action, children }: { title: string; icon: typeof Package; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl overflow-hidden flex flex-col h-full" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2"><Icon className="w-4 h-4" style={{ color: "var(--text-muted)" }} /><p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{title}</p></div>
        {action}
      </div>
      <div className="p-4 flex-1">{children}</div>
    </div>
  );
}
function Btn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="group flex items-center gap-1 text-xs font-medium transition-colors" style={{ color: ACCENT }}>
      <span className="w-4 h-4 rounded-full flex items-center justify-center transition-colors group-hover:brightness-95" style={{ backgroundColor: ACCENT + "1a" }}><Plus className="w-3 h-3" /></span>
      {children}
    </button>
  );
}
function Empty({ text }: { text: string }) { return <p className="text-sm py-6 text-center" style={{ color: "var(--text-muted)" }}>{text}</p>; }
function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto thin-scroll-x">
      <table className="w-full text-sm" style={{ minWidth: 560 }}>
        <thead><tr style={{ backgroundColor: "var(--bg-surface-2)" }}>{head.map((h, i) => <th key={i} className="text-left font-semibold px-3 py-2 text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{h}</th>)}</tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
function Row({ cells }: { cells: React.ReactNode[] }) {
  return <tr style={{ borderTop: "1px solid var(--border)" }}>{cells.map((c, i) => <td key={i} className="px-3 py-2.5" style={{ color: "var(--text-secondary)" }}>{c}</td>)}</tr>;
}
function CompPill({ label, status }: { label: string; status: DocStatus }) {
  const ok = status === "valid";
  const warn = status === "expiring";
  const bg = ok ? "#d1fae5" : warn ? "#fef3c7" : "#fee2e2";
  const color = ok ? "#065f46" : warn ? "#92400e" : "#991b1b";
  return <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: bg, color }}>{label} {ok ? "✓" : status === "expiring" ? "!" : "✕"}</span>;
}

// ─── Modal shell ──────────────────────────────────────────
function Modal({ title, onClose, children, footer }: { title: string; onClose: () => void; children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[90vh] rounded-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()} style={{ backgroundColor: "var(--bg-surface)", boxShadow: "0 16px 48px rgba(0,0,0,0.24)" }}>
        <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <p className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>{title}</p>
          <button onClick={onClose} style={{ color: "var(--text-muted)" }}><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-3">{children}</div>
        <div className="px-5 py-3 flex items-center justify-end gap-2 shrink-0" style={{ borderTop: "1px solid var(--border)" }}>{footer}</div>
      </div>
    </div>
  );
}
function FLabel({ children }: { children: React.ReactNode }) { return <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>{children}</label>; }
function SaveBtn({ onClick, label }: { onClick: () => void; label: string }) { return <button onClick={onClick} className="text-sm font-medium px-4 py-2 rounded-lg text-white" style={{ backgroundColor: ACCENT }}>{label}</button>; }
function CancelBtn({ onClick }: { onClick: () => void }) { return <button onClick={onClick} className="text-sm font-medium px-3 py-2 rounded-lg" style={{ color: "var(--text-secondary)" }}>Cancel</button>; }

// ─── Add Vendor link ──────────────────────────────────────
function AddVendorModal({ projectId, onClose, onSaved }: { projectId: string; onClose: () => void; onSaved: () => void }) {
  const vendors = getVendors().filter(v => v.type !== "subcontractor");
  const [vendorId, setVendorId] = useState(vendors[0]?.id ?? "");
  const [purpose, setPurpose] = useState("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<ProjectVendorStatus>("active");
  function save() {
    if (!vendorId) return;
    createProjectVendorLink({ projectId, vendorId, purpose: purpose.trim() || "Project vendor", status, amountCommitted: amount ? parseFloat(amount) : undefined });
    onSaved();
  }
  return (
    <Modal title="Add Vendor to Project" onClose={onClose} footer={<><CancelBtn onClick={onClose} /><SaveBtn onClick={save} label="Add Vendor" /></>}>
      <div><FLabel>Vendor</FLabel><UiSelect value={vendorId} onChange={setVendorId} options={vendors.map(v => ({ value: v.id, label: v.name }))} /></div>
      <div><FLabel>Purpose</FLabel><input value={purpose} onChange={e => setPurpose(e.target.value)} placeholder="e.g. Equipment supplier, crane rental" className={inp} style={inpStyle} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><FLabel>Amount committed</FLabel><div className="flex items-center gap-1.5 rounded-lg px-3" style={inpStyle}><span className="text-xs" style={{ color: "var(--text-muted)" }}>$</span><input type="number" min={0} value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" className="w-full py-2 text-sm outline-none bg-transparent" style={{ color: "var(--text-primary)" }} /></div></div>
        <div><FLabel>Status</FLabel><UiSelect value={status} onChange={v => setStatus(v as ProjectVendorStatus)} options={(Object.keys(PROJECT_VENDOR_STATUS_STYLE) as ProjectVendorStatus[]).filter(s => s !== "removed").map(s => ({ value: s, label: PROJECT_VENDOR_STATUS_STYLE[s].label }))} /></div>
      </div>
      <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Vendors are managed in Inventory &amp; Procurement. This links an existing vendor to the project.</p>
    </Modal>
  );
}

// ─── Assign subcontractor ─────────────────────────────────
function AssignSubModal({ projectId, projectName, onClose, onSaved }: { projectId: string; projectName: string; onClose: () => void; onSaved: () => void }) {
  const subs = getSubcontractors();
  const [subId, setSubId] = useState(subs[0]?.id ?? "");
  const [scope, setScope] = useState("");
  const [phase, setPhase] = useState("");
  const [date, setDate] = useState("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<AssignmentStatus>("proposed");
  const sub = getSubcontractor(subId);
  const warnings = sub ? subComplianceWarnings(sub) : [];
  function save() {
    if (!subId) return;
    createAssignment({ subcontractorId: subId, projectId, projectName, phaseName: phase.trim() || undefined, scopeOfWork: scope.trim() || "—", scheduledDate: date.trim() || undefined, status, contractAmount: amount ? parseFloat(amount) : undefined });
    onSaved();
  }
  return (
    <Modal title="Assign Subcontractor" onClose={onClose} footer={<><CancelBtn onClick={onClose} /><SaveBtn onClick={save} label="Assign" /></>}>
      <div><FLabel>Subcontractor</FLabel><UiSelect value={subId} onChange={setSubId} options={subs.map(s => ({ value: s.id, label: `${s.companyName} · ${s.trade}` }))} /></div>
      {sub && warnings.length > 0 && (
        <div className="rounded-lg px-3 py-2 flex items-start gap-2" style={{ backgroundColor: "#fffbeb", border: "1px solid #fde68a" }}>
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: "#b45309" }} />
          <p className="text-xs" style={{ color: "#92400e" }}>{warnings.join(" · ")} — verify before scheduling.</p>
        </div>
      )}
      <div><FLabel>Scope of work</FLabel><textarea value={scope} onChange={e => setScope(e.target.value)} rows={2} className={`${inp} resize-none`} style={inpStyle} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><FLabel>Phase / milestone</FLabel><input value={phase} onChange={e => setPhase(e.target.value)} placeholder="e.g. Electrical Rough-In" className={inp} style={inpStyle} /></div>
        <div><FLabel>Scheduled date</FLabel><input value={date} onChange={e => setDate(e.target.value)} placeholder="Jul 10, 2026" className={inp} style={inpStyle} /></div>
        <div><FLabel>Contract amount</FLabel><div className="flex items-center gap-1.5 rounded-lg px-3" style={inpStyle}><span className="text-xs" style={{ color: "var(--text-muted)" }}>$</span><input type="number" min={0} value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" className="w-full py-2 text-sm outline-none bg-transparent" style={{ color: "var(--text-primary)" }} /></div></div>
        <div><FLabel>Status</FLabel><UiSelect value={status} onChange={v => setStatus(v as AssignmentStatus)} options={(Object.keys(ASSIGNMENT_STATUS_STYLE) as AssignmentStatus[]).map(s => ({ value: s, label: ASSIGNMENT_STATUS_STYLE[s].label }))} /></div>
      </div>
    </Modal>
  );
}

// ─── Request materials ────────────────────────────────────
function RequestMaterialsModal({ projectId, projectName, onClose, onSaved }: { projectId: string; projectName: string; onClose: () => void; onSaved: () => void }) {
  const [items, setItems] = useState<{ name: string; quantity: number }[]>([{ name: "", quantity: 1 }]);
  const [neededBy, setNeededBy] = useState("");
  const [source, setSource] = useState<"warehouse" | "vendor" | "truck">("warehouse");
  function setItem(i: number, patch: Partial<{ name: string; quantity: number }>) { setItems(arr => arr.map((it, idx) => idx === i ? { ...it, ...patch } : it)); }
  function save() {
    const valid = items.filter(i => i.name.trim() && i.quantity > 0).map(i => ({ name: i.name.trim(), quantity: i.quantity }));
    if (valid.length === 0) return;
    createMaterialRequest({ projectId, projectName, requestedBy: "Ryo Martin", neededBy: neededBy.trim() || undefined, status: "open", source, items: valid });
    onSaved();
  }
  return (
    <Modal title="Request Materials" onClose={onClose} footer={<><CancelBtn onClick={onClose} /><SaveBtn onClick={save} label="Create Request" /></>}>
      <div className="grid grid-cols-2 gap-3">
        <div><FLabel>Needed by</FLabel><input value={neededBy} onChange={e => setNeededBy(e.target.value)} placeholder="Jun 28, 2026" className={inp} style={inpStyle} /></div>
        <div><FLabel>Source</FLabel><UiSelect value={source} onChange={v => setSource(v as "warehouse" | "vendor" | "truck")} options={[{ value: "warehouse", label: "Warehouse" }, { value: "vendor", label: "Vendor" }, { value: "truck", label: "Truck" }]} /></div>
      </div>
      <div>
        <div className="flex items-center justify-between mb-1.5"><FLabel>Items</FLabel><button onClick={() => setItems(a => [...a, { name: "", quantity: 1 }])} className="text-xs font-medium flex items-center gap-1" style={{ color: ACCENT }}><Plus className="w-3.5 h-3.5" /> Add</button></div>
        <div className="space-y-2">
          {items.map((it, i) => (
            <div key={i} className="flex items-center gap-2">
              <input value={it.name} onChange={e => setItem(i, { name: e.target.value })} placeholder="Item name" className={`${inp} flex-1`} style={inpStyle} />
              <input type="number" min={1} value={it.quantity} onChange={e => setItem(i, { quantity: parseInt(e.target.value) || 0 })} className="w-20 rounded-lg px-2 py-2 text-sm outline-none" style={inpStyle} />
              {items.length > 1 && <button onClick={() => setItems(a => a.filter((_, idx) => idx !== i))} className="p-1.5 rounded-md shrink-0" style={{ color: "var(--text-muted)" }}><Trash2 className="w-3.5 h-3.5" /></button>}
            </div>
          ))}
        </div>
      </div>
      <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Material requests route to Inventory &amp; Procurement — warehouse checks stock, then a PO is created if needed.</p>
    </Modal>
  );
}
