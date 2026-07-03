"use client";

import { Boxes, AlertTriangle, ShoppingCart, Truck } from "lucide-react";
import MobileHeader from "@/components/mobile/MobileHeader";
import { Card, Section } from "@/components/mobile/ui";

const ORANGE = "#f97316";

const LOW_STOCK = [
  { id: "i1", name: "R-410A refrigerant", on: 3, min: 10, unit: "lbs" },
  { id: "i2", name: '3/4" PVC pipe', on: 12, min: 40, unit: "ft" },
  { id: "i3", name: "Capacitor 45/5 MFD", on: 4, min: 15, unit: "ea" },
  { id: "i4", name: "Air filter 16x25x1", on: 8, min: 30, unit: "ea" },
  { id: "i5", name: "Thermostat wire 18/8", on: 25, min: 50, unit: "ft" },
];

export default function MobileInventoryPage() {
  return (
    <div>
      <MobileHeader title="Inventory" subtitle="Stock & procurement" back />
      <div className="px-4 space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <Kpi icon={Boxes} label="Items tracked" value="248" color={ORANGE} />
          <Kpi icon={AlertTriangle} label="Low stock" value={String(LOW_STOCK.length)} color="#dc2626" />
          <Kpi icon={ShoppingCart} label="Open POs" value="6" color="#2563eb" />
          <Kpi icon={Truck} label="Trucks stocked" value="9" color="#16a34a" />
        </div>

        <Section title="Low stock">
          <Card>
            {LOW_STOCK.map((it, i) => (
              <div key={it.id} className="flex items-center gap-3 px-4 py-3" style={{ borderTop: i ? "1px solid var(--border)" : "none" }}>
                <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: "#dc2626" }} />
                <p className="text-sm flex-1 truncate" style={{ color: "var(--text-primary)" }}>{it.name}</p>
                <span className="text-xs tabular-nums shrink-0" style={{ color: "var(--text-muted)" }}><b style={{ color: "#dc2626" }}>{it.on}</b> / {it.min} {it.unit}</span>
              </div>
            ))}
          </Card>
        </Section>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string; color: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-1.5"><Icon className="w-3.5 h-3.5" style={{ color }} /><p className="text-[11px] font-medium truncate" style={{ color: "var(--text-muted)" }}>{label}</p></div>
      <p className="text-xl font-bold mt-1 tabular-nums" style={{ color: "var(--text-primary)" }}>{value}</p>
    </Card>
  );
}
