// ─── Tech → truck resolution ──────────────────────────────
// A field tech is stocked from a "home truck" (an inventory Warehouse of kind
// "truck"). Parts consumed on a work order deduct from it. The assignment lives
// on the user (`truckWarehouseId`); until a settings UI sets it, we fall back to a
// truck whose name contains the tech's first name (demo data has "Truck - Tucker"
// etc.). Stock records reference a warehouse by NAME (InventoryItem.location), so
// this returns the name to match against.

import type { AppUser } from "@/lib/users/data";
import { getWarehouse, getWarehouses } from "@/lib/inventory/data";

export function techTruckName(user: AppUser): string | undefined {
  if (user.truckWarehouseId) return getWarehouse(user.truckWarehouseId)?.name;
  const first = user.fullName.split(/\s+/)[0]?.toLowerCase();
  if (!first) return undefined;
  return getWarehouses().find(w => w.kind === "truck" && w.name.toLowerCase().includes(first))?.name;
}
