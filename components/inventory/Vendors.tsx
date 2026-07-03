"use client";

// ─── Inventory & Procurement · Vendors ────────────────────
// Master vendor records (suppliers, equipment, service providers, and the vendor
// side of subcontractors). CRM links to these later; Accounting owns bills.
// Mock/local state. List + detail drawer (tabs) + add/edit modal.

import { useMemo, useState } from "react";
import {
  Building2, Plus, Search, SlidersHorizontal, Upload, MoreHorizontal, Star,
  Pencil, ShoppingCart, FileText, AlertTriangle, X,
} from "lucide-react";
import UiSelect from "@/components/ui/Select";
import StatusBadge from "@/components/shared/StatusBadge";
import ModuleViewToggle, { type ModuleView } from "@/components/shared/ModuleViewToggle";
import StatusTabs from "@/components/shared/StatusTabs";
import { PageHeader, StatCard } from "@/components/platform/ui";
import {
  getVendors, getVendor, createVendor, updateVendor, posForVendor, openPosForVendor,
  getOpenPurchaseOrders, getInventoryItems, docComplianceLevel, poSubtotal,
  VENDOR_TYPE_LABELS, VENDOR_STATUS_STYLE, PO_STATUS_STYLE, DOC_KIND_LABELS,
  type Vendor, type VendorType, type VendorStatus,
} from "@/lib/inventory/data";
import {
  ACCENT, money, Slideover, DrawerTabs, InfoRow, ComplianceBadge, Dot, Field, inp, inpStyle, DrawerBlockTitle,
} from "@/components/inventory/procurementUi";

const VEND_COLS = "1.8fr 1.2fr 1.4fr 1fr 0.7fr 0.7fr 1fr 0.9fr 0.7fr";
const VENDOR_TYPES = Object.keys(VENDOR_TYPE_LABELS) as VendorType[];

export default function Vendors() {
  const [tick, setTick] = useState(0);
  const refresh = () => setTick(t => t + 1);
  const vendors = useMemo(() => getVendors(), [tick]);

  const [view, setView] = useState<ModuleView>("list");
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [fType, setFType] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [editing, setEditing] = useState<Vendor | "new" | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const activeCount = vendors.filter(v => v.status === "active").length;
  const preferredCount = vendors.filter(v => v.preferred).length;
  const openPOCount = getOpenPurchaseOrders().length;
  const missingDocs = vendors.filter(v => docComplianceLevel(v.documents) === "issue").length;

  const TAB_FNS: Record<string, (v: Vendor) => boolean> = {
    all: () => true,
    active: v => v.status === "active",
    preferred: v => !!v.preferred,
    on_hold: v => v.status === "on_hold",
    pending_review: v => v.status === "pending_review",
    inactive: v => v.status === "inactive",
  };
  const tabFn = TAB_FNS[tab] ?? TAB_FNS.all;

  const s = search.trim().toLowerCase();
  const filtered = vendors.filter(v => {
    if (!tabFn(v)) return false;
    if (s && !`${v.name} ${v.primaryContactName ?? ""} ${VENDOR_TYPE_LABELS[v.type]}`.toLowerCase().includes(s)) return false;
    if (fType !== "all" && v.type !== fType) return false;
    return true;
  });
  const activeFilters = fType !== "all" ? 1 : 0;

  const openVendor = openId ? getVendor(openId) : undefined;

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0"><PageHeader title="Vendors" subtitle="Manage suppliers, service providers, equipment vendors, and procurement relationships." /></div>
        <ModuleViewToggle view={view} onChange={setView} listLabel="Vendors" accent={ACCENT} />
        <div className="flex-1 flex justify-end items-center gap-2">
          <button onClick={() => alert("Import Vendors — coming soon")} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm shrink-0" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
            <Upload className="w-4 h-4" /> Import
          </button>
          <button onClick={() => setEditing("new")} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white shrink-0 hover:brightness-110" style={{ backgroundColor: ACCENT }}>
            <Plus className="w-4 h-4" /> Add Vendor
          </button>
        </div>
      </div>

      {/* Overview cards */}
      {view === "overview" && (
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
          <StatCard label="Active Vendors" value={String(activeCount)} hint="Currently active" icon={Building2} accent={ACCENT} />
          <StatCard label="Preferred Vendors" value={String(preferredCount)} hint="Go-to suppliers" icon={Star} accent="#f59e0b" />
          <StatCard label="Open Purchase Orders" value={String(openPOCount)} hint="Awaiting receipt" icon={ShoppingCart} accent="#0ea5e9" />
          <StatCard label="Missing Documents" value={String(missingDocs)} hint="Action needed" icon={AlertTriangle} accent="#ef4444" />
        </div>
      )}

      {view === "list" && (
      <>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <StatusTabs accent={ACCENT} active={tab} onChange={setTab}
          tabs={[
            { key: "all", label: "All", count: vendors.length },
            { key: "active", label: "Active", count: vendors.filter(TAB_FNS.active).length },
            { key: "preferred", label: "Preferred", count: vendors.filter(TAB_FNS.preferred).length },
            { key: "on_hold", label: "On Hold", count: vendors.filter(TAB_FNS.on_hold).length },
            { key: "pending_review", label: "Pending", count: vendors.filter(TAB_FNS.pending_review).length },
          ]} />
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg px-3 py-1.5" style={{ backgroundColor: "var(--bg-input)" }}>
            <Search className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search vendors..." className="bg-transparent text-sm outline-none w-48" style={{ color: "var(--text-primary)" }} />
          </div>
          <div className="relative">
            <button onClick={() => setFiltersOpen(o => !o)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors"
              style={{ border: `1px solid ${activeFilters ? ACCENT + "66" : "var(--border)"}`, backgroundColor: activeFilters ? ACCENT + "14" : "var(--bg-surface)", color: activeFilters ? ACCENT : "var(--text-secondary)" }}>
              <SlidersHorizontal className="w-3.5 h-3.5" /> Filter
              {activeFilters > 0 && <span className="text-[10px] font-bold px-1.5 rounded-full" style={{ backgroundColor: ACCENT + "26", color: ACCENT }}>{activeFilters}</span>}
            </button>
            {filtersOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setFiltersOpen(false)} />
                <div className="absolute right-0 top-full mt-2 z-50 rounded-xl p-4 w-64" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 12px 32px rgba(0,0,0,0.18)" }}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Filters</p>
                    {activeFilters > 0 && <button onClick={() => setFType("all")} className="text-xs" style={{ color: ACCENT }}>Clear</button>}
                  </div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Type</label>
                  <UiSelect size="sm" value={fType} onChange={setFType} options={[{ value: "all", label: "Any type" }, ...VENDOR_TYPES.map(t => ({ value: t, label: VENDOR_TYPE_LABELS[t] }))]} />
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
        <div className="overflow-x-auto thin-scroll-x">
          <div style={{ minWidth: 1080 }}>
            <div className="grid px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider items-center" style={{ gridTemplateColumns: VEND_COLS, gap: "0.75rem", color: "var(--text-muted)", borderBottom: "1px solid var(--border)", backgroundColor: "transparent" }}>
              <span>Vendor</span><span>Type</span><span>Primary Contact</span><span>Terms</span><span className="text-center">Open POs</span><span className="text-center">Preferred</span><span>Documents</span><span>Status</span><span className="text-right">Actions</span>
            </div>
            {filtered.length === 0 ? (
              <div className="py-14 text-center"><p className="text-sm" style={{ color: "var(--text-muted)" }}>No vendors match the current filters.</p></div>
            ) : filtered.map((v, i) => {
              const openPOs = openPosForVendor(v.id).length;
              return (
                <div key={v.id} onClick={() => setOpenId(v.id)} className="grid px-4 py-3 items-center cursor-pointer transition-colors hover:bg-[var(--bg-surface-2)]"
                  style={{ gridTemplateColumns: VEND_COLS, gap: "0.75rem", borderBottom: i < filtered.length - 1 ? "1px solid var(--border)" : "none" }}>
                  <div className="min-w-0 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: ACCENT + "1f" }}><Building2 className="w-4 h-4" style={{ color: ACCENT }} /></span>
                    <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{v.name}</p>
                  </div>
                  <div className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>{VENDOR_TYPE_LABELS[v.type]}</div>
                  <div className="min-w-0">
                    <p className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>{v.primaryContactName ?? "—"}</p>
                    <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>{v.primaryContactEmail ?? v.primaryContactPhone ?? ""}</p>
                  </div>
                  <div className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>{v.paymentTerms ?? "—"}</div>
                  <div className="text-center text-sm tabular-nums" style={{ color: openPOs ? "var(--text-primary)" : "var(--text-muted)" }}>{openPOs}</div>
                  <div className="flex justify-center">{v.preferred ? <Star className="w-3.5 h-3.5" style={{ color: "#f59e0b" }} fill="#f59e0b" /> : <span style={{ color: "var(--text-muted)" }}>—</span>}</div>
                  <div><ComplianceBadge level={docComplianceLevel(v.documents)} /></div>
                  <div><Dot style={VENDOR_STATUS_STYLE[v.status]} /></div>
                  <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                    <button onClick={() => setEditing(v)} title="Edit" className="p-1.5 rounded-lg" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => setOpenId(v.id)} title="More" className="p-1.5 rounded-lg" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}><MoreHorizontal className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      </>
      )}

      {openVendor && <VendorDrawer vendor={openVendor} onClose={() => setOpenId(null)} onEdit={() => { setEditing(openVendor); }} />}
      {editing && <VendorModal vendor={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh(); }} />}
    </div>
  );
}

// ─── Detail drawer ────────────────────────────────────────
type VTab = "overview" | "contacts" | "pos" | "price" | "documents" | "activity" | "notes";
function VendorDrawer({ vendor, onClose, onEdit }: { vendor: Vendor; onClose: () => void; onEdit: () => void }) {
  const [tab, setTab] = useState<VTab>("overview");
  const pos = posForVendor(vendor.id);
  const priceItems = getInventoryItems().filter(i => i.vendor === vendor.name);

  return (
    <Slideover title={vendor.name} subtitle={VENDOR_TYPE_LABELS[vendor.type]} onClose={onClose}
      footer={<>
        <button onClick={onClose} className="text-sm font-medium px-3 py-2 rounded-lg" style={{ color: "var(--text-secondary)" }}>Close</button>
        <button onClick={onEdit} className="text-sm font-medium px-4 py-2 rounded-lg text-white" style={{ backgroundColor: ACCENT }}>Edit Vendor</button>
      </>}>
      <div className="px-5 pt-4 flex items-center gap-2 flex-wrap">
        <Dot style={VENDOR_STATUS_STYLE[vendor.status]} />
        {vendor.preferred && <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: "#fef3c7", color: "#92400e" }}><Star className="w-3 h-3" fill="#92400e" /> Preferred</span>}
        <ComplianceBadge level={docComplianceLevel(vendor.documents)} />
      </div>
      <div className="mt-3"><DrawerTabs<VTab> active={tab} onChange={setTab} tabs={[
        { key: "overview", label: "Overview" }, { key: "contacts", label: "Contacts" }, { key: "pos", label: "Purchase Orders" },
        { key: "price", label: "Price List" }, { key: "documents", label: "Documents" }, { key: "activity", label: "Activity" }, { key: "notes", label: "Notes" },
      ]} /></div>

      <div className="p-5">
        {tab === "overview" && (
          <div>
            <InfoRow label="Type">{VENDOR_TYPE_LABELS[vendor.type]}</InfoRow>
            <InfoRow label="Status">{VENDOR_STATUS_STYLE[vendor.status].label}</InfoRow>
            <InfoRow label="Preferred">{vendor.preferred ? "Yes" : "No"}</InfoRow>
            <InfoRow label="Payment terms">{vendor.paymentTerms ?? "—"}</InfoRow>
            <InfoRow label="Website">{vendor.website ?? "—"}</InfoRow>
            <InfoRow label="Address">{vendor.address ?? "—"}</InfoRow>
            <InfoRow label="Open POs">{openPosForVendor(vendor.id).length}</InfoRow>
          </div>
        )}
        {tab === "contacts" && (
          <div>
            <InfoRow label="Primary contact">{vendor.primaryContactName ?? "—"}</InfoRow>
            <InfoRow label="Email">{vendor.primaryContactEmail ?? "—"}</InfoRow>
            <InfoRow label="Phone">{vendor.primaryContactPhone ?? "—"}</InfoRow>
            <InfoRow label="Billing email">{vendor.billingEmail ?? "—"}</InfoRow>
          </div>
        )}
        {tab === "pos" && (
          pos.length === 0 ? <Empty text="No purchase orders for this vendor yet." /> : (
            <div className="space-y-2">
              {pos.map(po => (
                <div key={po.id} className="rounded-lg px-3 py-2.5 flex items-center justify-between gap-2" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)" }}>
                  <div className="min-w-0">
                    <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{po.number}</p>
                    <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>{po.lines.length} items · {money(poSubtotal(po))}{po.projectName ? ` · ${po.projectName}` : ""}</p>
                  </div>
                  <Dot style={PO_STATUS_STYLE[po.status]} />
                </div>
              ))}
            </div>
          )
        )}
        {tab === "price" && (
          priceItems.length === 0 ? <Empty text="No catalog items linked to this vendor." /> : (
            <div className="space-y-1.5">
              {priceItems.map(it => (
                <div key={it.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg" style={{ border: "1px solid var(--border)" }}>
                  <span className="text-sm truncate" style={{ color: "var(--text-primary)" }}>{it.name}</span>
                  <span className="text-sm tabular-nums shrink-0" style={{ color: "var(--text-secondary)" }}>{money(it.cost)}</span>
                </div>
              ))}
            </div>
          )
        )}
        {tab === "documents" && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <DrawerBlockTitle>Documents</DrawerBlockTitle>
              <button onClick={() => alert("Upload — coming soon (Documents app stores the files)")} className="text-xs font-medium flex items-center gap-1" style={{ color: ACCENT }}><Upload className="w-3.5 h-3.5" /> Upload</button>
            </div>
            {vendor.documents.length === 0 ? <Empty text="No documents on file." /> : (
              <div className="space-y-1.5">
                {vendor.documents.map(d => (
                  <div key={d.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg" style={{ border: "1px solid var(--border)" }}>
                    <span className="flex items-center gap-2 min-w-0"><FileText className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} /><span className="text-sm truncate" style={{ color: "var(--text-primary)" }}>{DOC_KIND_LABELS[d.kind]}</span></span>
                    <DocBadge status={d.status} expiresOn={d.expiresOn} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {tab === "activity" && <Empty text="Activity timeline lands in a later phase (PO created, document uploaded, bill received)." />}
        {tab === "notes" && (vendor.notes ? <p className="text-sm whitespace-pre-line" style={{ color: "var(--text-secondary)" }}>{vendor.notes}</p> : <Empty text="No notes." />)}
      </div>
    </Slideover>
  );
}

function DocBadge({ status, expiresOn }: { status: string; expiresOn?: string }) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    valid: { label: "Valid", bg: "#d1fae5", color: "#065f46" },
    expiring: { label: expiresOn ? `Expires ${expiresOn}` : "Expiring", bg: "#fef3c7", color: "#92400e" },
    expired: { label: expiresOn ? `Expired ${expiresOn}` : "Expired", bg: "#fee2e2", color: "#991b1b" },
    missing: { label: "Missing", bg: "#fee2e2", color: "#991b1b" },
  };
  const s = map[status] ?? map.valid;
  return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap shrink-0" style={{ backgroundColor: s.bg, color: s.color }}>{s.label}</span>;
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm py-8 text-center" style={{ color: "var(--text-muted)" }}>{text}</p>;
}

// ─── Add / edit modal ─────────────────────────────────────
function VendorModal({ vendor, onClose, onSaved }: { vendor: Vendor | "new"; onClose: () => void; onSaved: () => void }) {
  const isNew = vendor === "new";
  const base = isNew ? null : vendor;
  const [name, setName] = useState(base?.name ?? "");
  const [type, setType] = useState<VendorType>(base?.type ?? "material_supplier");
  const [status, setStatus] = useState<VendorStatus>(base?.status ?? "active");
  const [preferred, setPreferred] = useState(base?.preferred ?? false);
  const [contactName, setContactName] = useState(base?.primaryContactName ?? "");
  const [contactEmail, setContactEmail] = useState(base?.primaryContactEmail ?? "");
  const [contactPhone, setContactPhone] = useState(base?.primaryContactPhone ?? "");
  const [billingEmail, setBillingEmail] = useState(base?.billingEmail ?? "");
  const [address, setAddress] = useState(base?.address ?? "");
  const [terms, setTerms] = useState(base?.paymentTerms ?? "");
  const [website, setWebsite] = useState(base?.website ?? "");
  const [notes, setNotes] = useState(base?.notes ?? "");
  const [error, setError] = useState<string | null>(null);

  function save() {
    if (!name.trim()) { setError("Vendor name is required."); return; }
    const payload = {
      name: name.trim(), type, status, preferred,
      primaryContactName: contactName.trim() || undefined, primaryContactEmail: contactEmail.trim() || undefined,
      primaryContactPhone: contactPhone.trim() || undefined, billingEmail: billingEmail.trim() || undefined,
      address: address.trim() || undefined, paymentTerms: terms.trim() || undefined,
      website: website.trim() || undefined, notes: notes.trim() || undefined,
    };
    if (isNew) createVendor(payload); else updateVendor((vendor as Vendor).id, payload);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-xl max-h-[92vh] rounded-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()} style={{ backgroundColor: "var(--bg-surface)", boxShadow: "0 16px 48px rgba(0,0,0,0.24)" }}>
        <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <p className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>{isNew ? "Add Vendor" : "Edit Vendor"}</p>
          <button onClick={onClose} style={{ color: "var(--text-muted)" }}><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Vendor name *" className="col-span-2"><input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. East Coast Metal" className={inp} style={inpStyle} autoFocus /></Field>
            <Field label="Type"><UiSelect value={type} onChange={v => setType(v as VendorType)} options={VENDOR_TYPES.map(t => ({ value: t, label: VENDOR_TYPE_LABELS[t] }))} /></Field>
            <Field label="Status"><UiSelect value={status} onChange={v => setStatus(v as VendorStatus)} options={(Object.keys(VENDOR_STATUS_STYLE) as VendorStatus[]).map(st => ({ value: st, label: VENDOR_STATUS_STYLE[st].label }))} /></Field>
            <Field label="Primary contact"><input value={contactName} onChange={e => setContactName(e.target.value)} className={inp} style={inpStyle} /></Field>
            <Field label="Payment terms"><input value={terms} onChange={e => setTerms(e.target.value)} placeholder="Net 30" className={inp} style={inpStyle} /></Field>
            <Field label="Contact email"><input value={contactEmail} onChange={e => setContactEmail(e.target.value)} className={inp} style={inpStyle} /></Field>
            <Field label="Contact phone"><input value={contactPhone} onChange={e => setContactPhone(e.target.value)} className={inp} style={inpStyle} /></Field>
            <Field label="Billing email"><input value={billingEmail} onChange={e => setBillingEmail(e.target.value)} className={inp} style={inpStyle} /></Field>
            <Field label="Website"><input value={website} onChange={e => setWebsite(e.target.value)} placeholder="example.com" className={inp} style={inpStyle} /></Field>
            <Field label="Address" className="col-span-2"><input value={address} onChange={e => setAddress(e.target.value)} className={inp} style={inpStyle} /></Field>
            <Field label="Notes" className="col-span-2"><textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className={`${inp} resize-none`} style={inpStyle} /></Field>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={preferred} onChange={e => setPreferred(e.target.checked)} className="accent-amber-500" />
            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Mark as preferred vendor</span>
          </label>
          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Documents (W-9, COI, agreements) are stored in the Documents app and linked here in a later phase.</p>
        </div>
        {error && <div className="mx-5 mb-3 px-3 py-2 rounded-lg text-xs shrink-0" style={{ backgroundColor: "#fee2e2", color: "#991b1b" }}>{error}</div>}
        <div className="px-5 py-3 flex items-center justify-end gap-2 shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
          <button onClick={onClose} className="text-sm font-medium px-3 py-2 rounded-lg" style={{ color: "var(--text-secondary)" }}>Cancel</button>
          <button onClick={save} className="text-sm font-medium px-4 py-2 rounded-lg text-white" style={{ backgroundColor: ACCENT }}>{isNew ? "Add Vendor" : "Save Changes"}</button>
        </div>
      </div>
    </div>
  );
}
