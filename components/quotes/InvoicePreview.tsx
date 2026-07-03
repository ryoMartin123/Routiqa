"use client";

import { fmt, type LineItem } from "@/lib/quotes/data";

// Customer-facing invoice document — shared by the invoice Preview, Print, and PDF.
export interface InvoicePreviewData {
  invoiceNumber?: string;
  title: string;
  customerName: string;
  propertyLabel?: string;
  locationName?: string;
  dueDate?: string;
  createdAt?: string;
  lineItems: LineItem[];
  subtotal: number;
  tax: number;
  total: number;
  balanceDue: number;
  paidAt?: string;
  customerNotes?: string;
  stamp?: string;             // e.g. "PAID" — diagonal stamp across the document
}

export default function InvoicePreview({ data }: { data: InvoicePreviewData }) {
  const items = data.lineItems.filter(li => !li.optional);

  return (
    <div className="rounded-xl overflow-hidden" style={{ position: "relative", backgroundColor: "#ffffff", border: "1px solid var(--border)", color: "#111827" }}>
      {data.stamp && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", zIndex: 10 }}>
          <div style={{
            transform: "rotate(-22deg)", border: "5px solid #059669", color: "#059669",
            padding: "6px 26px", borderRadius: "10px", fontSize: "50px", fontWeight: 800,
            letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.8,
            fontFamily: "var(--font-family-sans)", whiteSpace: "nowrap",
          }}>{data.stamp}</div>
        </div>
      )}

      {/* Letterhead */}
      <div className="flex items-start justify-between px-8 py-6" style={{ borderBottom: "2px solid #4f46e5" }}>
        <div>
          <p className="text-lg font-bold" style={{ color: "#4f46e5" }}>Northstar Services</p>
          <p className="text-xs" style={{ color: "#6b7280" }}>{data.locationName ?? "Augusta Branch"}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold uppercase tracking-widest" style={{ color: "#111827" }}>Invoice</p>
          {data.invoiceNumber && <p className="text-xs font-mono" style={{ color: "#6b7280" }}>{data.invoiceNumber}</p>}
        </div>
      </div>

      {/* Meta */}
      <div className="grid grid-cols-2 gap-6 px-8 py-5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: "#9ca3af" }}>Bill to</p>
          <p className="text-sm font-semibold" style={{ color: "#111827" }}>{data.customerName}</p>
          {data.propertyLabel && <p className="text-xs" style={{ color: "#6b7280" }}>{data.propertyLabel}</p>}
        </div>
        <div className="text-right space-y-0.5">
          {data.createdAt && <p className="text-xs" style={{ color: "#6b7280" }}>Issued: <span style={{ color: "#111827" }}>{data.createdAt}</span></p>}
          {data.dueDate && <p className="text-xs" style={{ color: "#6b7280" }}>Due: <span style={{ color: "#111827" }}>{data.dueDate}</span></p>}
        </div>
      </div>

      {/* Title */}
      <div className="px-8 pb-2">
        <p className="text-base font-semibold" style={{ color: "#111827" }}>{data.title || "Invoice"}</p>
      </div>

      {/* Line items */}
      <div className="px-8 pb-4">
        <div className="grid px-3 py-2 text-[10px] font-semibold uppercase tracking-wider rounded-t-lg"
          style={{ gridTemplateColumns: "3fr 0.6fr 1fr 1fr", color: "#6b7280", backgroundColor: "#f9fafb" }}>
          <span>Description</span><span className="text-right">Qty</span><span className="text-right">Unit</span><span className="text-right">Amount</span>
        </div>
        {items.length === 0 ? (
          <div className="px-3 py-4 text-center text-xs" style={{ color: "#9ca3af", border: "1px solid #f3f4f6" }}>No line items.</div>
        ) : items.map(li => (
          <div key={li.id} className="grid px-3 py-2.5 items-start" style={{ gridTemplateColumns: "3fr 0.6fr 1fr 1fr", borderBottom: "1px solid #f3f4f6" }}>
            <div>
              <p className="text-sm" style={{ color: "#111827" }}>{li.name || li.description}</p>
              {li.name && li.description && li.description !== li.name && <p className="text-xs" style={{ color: "#6b7280" }}>{li.description}</p>}
            </div>
            <p className="text-sm text-right" style={{ color: "#6b7280" }}>{li.quantity}</p>
            <p className="text-sm text-right" style={{ color: "#6b7280" }}>{fmt(li.unitPrice)}</p>
            <p className="text-sm text-right font-medium" style={{ color: "#111827" }}>{fmt(li.total)}</p>
          </div>
        ))}

        {/* Totals */}
        <div className="flex justify-end mt-3">
          <div className="w-60 space-y-1.5">
            <div className="flex justify-between text-sm"><span style={{ color: "#6b7280" }}>Subtotal</span><span style={{ color: "#111827" }}>{fmt(data.subtotal)}</span></div>
            <div className="flex justify-between text-sm"><span style={{ color: "#6b7280" }}>Tax</span><span style={{ color: "#111827" }}>{fmt(data.tax)}</span></div>
            <div className="flex justify-between pt-1.5" style={{ borderTop: "1px solid #e5e7eb" }}>
              <span className="text-sm font-semibold" style={{ color: "#111827" }}>Total</span>
              <span className="text-sm font-bold" style={{ color: "#111827" }}>{fmt(data.total)}</span>
            </div>
            {data.paidAt && (
              <div className="flex justify-between text-sm"><span style={{ color: "#6b7280" }}>Paid {data.paidAt}</span><span style={{ color: "#059669" }}>–{fmt(data.total - data.balanceDue)}</span></div>
            )}
            <div className="flex justify-between pt-1.5" style={{ borderTop: "2px solid #4f46e5" }}>
              <span className="text-sm font-bold" style={{ color: "#111827" }}>Balance Due</span>
              <span className="text-lg font-bold" style={{ color: data.balanceDue > 0 ? "#4f46e5" : "#059669" }}>
                {data.balanceDue > 0 ? fmt(data.balanceDue) : "Paid in Full"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Notes */}
      {data.customerNotes && (
        <div className="px-8 pb-6">
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: "#9ca3af" }}>Notes</p>
          <p className="text-xs whitespace-pre-wrap" style={{ color: "#374151" }}>{data.customerNotes}</p>
        </div>
      )}

      <div className="px-8 py-3 text-center text-[10px]" style={{ backgroundColor: "#f9fafb", color: "#9ca3af", borderTop: "1px solid #f3f4f6" }}>
        Thank you for your business. Please remit payment by the due date above.
      </div>
    </div>
  );
}
