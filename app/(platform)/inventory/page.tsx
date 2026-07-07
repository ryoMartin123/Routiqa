"use client";

// ─── Inventory & Procurement — dashboard ──────────────────
// "What we buy/use and who supplies it." Mock cards + sections for the shell;
// items/vendors/POs/subs are nav-only placeholders for now. Vendors live here
// (their working home) and link to CRM jobs + Accounting bills later.

import Link from "next/link";
import {
  Boxes, AlertTriangle, ShoppingCart, Building2, HardHat, ArrowRight,
  PackageCheck, Truck, FileText, Star,
} from "lucide-react";
import { PageHeader, StatCard } from "@/components/platform/ui";
import {
  getInventoryItems, getLowStockItems, getOpenPurchaseOrders, getVendors,
  getSubcontractors, getInventoryActivity, getPartiallyReceivedPOs, complianceIssueCount,
  poSubtotal, PO_STATUS_STYLE, VENDOR_TYPE_LABELS,
} from "@/lib/inventory/data";

const ACCENT = "#f97316";
const fmt = (n: number) => `$${n.toLocaleString()}`;

const ACTIVITY_ICON = {
  received: PackageCheck, truck_adjusted: Truck, po_created: ShoppingCart, doc_uploaded: FileText,
  sub_assigned: HardHat, compliance: AlertTriangle, material_request: FileText,
} as const;

export default function InventoryDashboard() {
  const items = getInventoryItems();
  const lowStock = getLowStockItems();
  const openPOs = getOpenPurchaseOrders();
  const pendingReceiving = getPartiallyReceivedPOs();
  const vendors = getVendors();
  const subs = getSubcontractors();
  const complianceIssues = complianceIssueCount();
  const activity = getInventoryActivity();

  return (
    <div className="p-6 space-y-5">
      <PageHeader title="Dashboard" subtitle="Materials, truck stock, purchase orders, vendors, and subcontractors." />

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <StatCard label="Open Purchase Orders" value={String(openPOs.length)} hint="Awaiting receipt" icon={ShoppingCart} accent="#0ea5e9" />
        <StatCard label="Low Stock" value={String(lowStock.length)} hint="At/below reorder" icon={AlertTriangle} accent="#ef4444" />
        <StatCard label="Pending Receiving" value={String(pendingReceiving.length)} hint="Partially received" icon={PackageCheck} accent={ACCENT} />
        <StatCard label="Active Vendors" value={String(vendors.length)} hint="Suppliers" icon={Building2} accent="#239c8d" />
        <StatCard label="Active Subcontractors" value={String(subs.length)} hint="Trades" icon={HardHat} accent="#10b981" />
        <StatCard label="Compliance Issues" value={String(complianceIssues)} hint="Vendors & subs" icon={AlertTriangle} accent="#f59e0b" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Low Stock Items */}
        <Panel title="Low Stock Items" icon={AlertTriangle} accent="#ef4444" href="/inventory/items">
          <ul className="space-y-2">
            {lowStock.map(i => (
              <li key={i.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{i.name}</p>
                  <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{i.location} · reorder at {i.reorderPoint}</p>
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ backgroundColor: "#fee2e2", color: "#991b1b" }}>{i.qtyOnHand} left</span>
              </li>
            ))}
          </ul>
        </Panel>

        {/* Open Purchase Orders */}
        <Panel title="Open Purchase Orders" icon={ShoppingCart} accent="#0ea5e9" href="/inventory/purchase-orders">
          <ul className="space-y-2">
            {openPOs.map(p => (
              <li key={p.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{p.vendorName}</p>
                  <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{p.number} · {p.lines.length} items · {fmt(poSubtotal(p))}</p>
                </div>
                <Dot style={PO_STATUS_STYLE[p.status]} />
              </li>
            ))}
          </ul>
        </Panel>

        {/* Vendor / Subcontractor snapshot */}
        <Panel title="Vendors & Subcontractors" icon={Building2} accent="#239c8d" href="/inventory/vendors">
          <div className="grid grid-cols-2 gap-2 mb-3">
            <Mini label="Vendors" value={vendors.length} icon={Building2} />
            <Mini label="Subcontractors" value={subs.length} icon={HardHat} />
          </div>
          <ul className="space-y-1.5">
            {vendors.slice(0, 3).map(v => (
              <li key={v.id} className="flex items-center justify-between gap-2">
                <span className="text-sm flex items-center gap-1.5 min-w-0" style={{ color: "var(--text-primary)" }}>
                  {v.preferred && <Star className="w-3 h-3 shrink-0" style={{ color: "#f59e0b" }} fill="#f59e0b" />}
                  <span className="truncate">{v.name}</span>
                </span>
                <span className="text-[11px] shrink-0" style={{ color: "var(--text-muted)" }}>{VENDOR_TYPE_LABELS[v.type]}</span>
              </li>
            ))}
          </ul>
        </Panel>

        {/* Recent Inventory Activity */}
        <Panel title="Recent Activity" icon={PackageCheck} accent={ACCENT} href="/inventory/receiving">
          <ul className="space-y-2.5">
            {activity.map(a => {
              const Icon = ACTIVITY_ICON[a.kind];
              return (
                <li key={a.id} className="flex items-start gap-2.5">
                  <span className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border)" }}>
                    <Icon className="w-3 h-3" style={{ color: "var(--text-secondary)" }} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm" style={{ color: "var(--text-primary)" }}>{a.text}</p>
                    <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{a.when}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>
    </div>
  );
}

function Panel({ title, icon: Icon, accent, href, children }: {
  title: string; icon: typeof Boxes; accent: string; href: string; children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl p-5" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: accent + "22" }}>
            <Icon className="w-4 h-4" style={{ color: accent }} />
          </span>
          <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{title}</h2>
        </div>
        <Link href={href} className="flex items-center gap-1 text-xs font-medium" style={{ color: "var(--accent-text)" }}>
          View <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
      {children}
    </div>
  );
}

function Mini({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Boxes }) {
  return (
    <div className="rounded-lg px-3 py-2 flex items-center gap-2.5" style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border)" }}>
      <Icon className="w-4 h-4 shrink-0" style={{ color: "var(--text-muted)" }} />
      <div>
        <p className="text-lg font-bold leading-none" style={{ color: "var(--text-primary)" }}>{value}</p>
        <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{label}</p>
      </div>
    </div>
  );
}

function Dot({ style }: { style: { label: string; dot: string } }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] shrink-0 whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: style.dot }} /> {style.label}
    </span>
  );
}
