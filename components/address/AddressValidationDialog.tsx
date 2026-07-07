"use client";

import { MapPin, CheckCircle, Pencil } from "lucide-react";
import type { ParsedAddress } from "@/lib/address/types";

interface Props {
  original:        ParsedAddress;
  suggested:       ParsedAddress;
  onUseSuggested:  () => void;
  onKeepOriginal:  () => void;
  onEdit:          () => void;
}

export function AddressValidationDialog({
  original, suggested, onUseSuggested, onKeepOriginal, onEdit,
}: Props) {
  return (
    <div
      className="mt-3 rounded-xl p-4 space-y-3"
      style={{ backgroundColor: "#fffbeb", border: "1px solid #fde68a" }}
    >
      <div className="flex items-center gap-2">
        <MapPin className="w-3.5 h-3.5 shrink-0 text-amber-600" />
        <p className="text-xs font-semibold text-amber-800">
          Address correction available
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Original */}
        <div
          className="rounded-lg p-3"
          style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}
        >
          <p
            className="text-[10px] font-semibold uppercase tracking-wider mb-1.5"
            style={{ color: "var(--text-muted)" }}
          >
            You entered
          </p>
          <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            {original.formattedAddress || [
              original.addressLine1,
              original.city,
              original.state,
              original.postalCode,
            ].filter(Boolean).join(", ")}
          </p>
        </div>

        {/* Suggested */}
        <div className="rounded-lg p-3" style={{ backgroundColor: "#d1fae5", border: "1px solid #6ee7b7" }}>
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5 text-emerald-700">
            Suggested
          </p>
          <p className="text-xs leading-relaxed text-emerald-800">
            {suggested.formattedAddress || [
              suggested.addressLine1,
              suggested.city,
              suggested.state,
              suggested.postalCode,
            ].filter(Boolean).join(", ")}
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={onUseSuggested}
          className="flex items-center gap-1.5 flex-1 justify-center py-1.5 rounded-lg text-xs font-medium transition-colors"
          style={{ backgroundColor: "#0f8578", color: "#fff" }}
        >
          <CheckCircle className="w-3.5 h-3.5" />
          Use Suggested
        </button>
        <button
          onClick={onKeepOriginal}
          className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors"
          style={{
            border: "1px solid var(--border)",
            color: "var(--text-secondary)",
            backgroundColor: "var(--bg-surface)",
          }}
        >
          Keep Original
        </button>
        <button
          onClick={onEdit}
          className="py-1.5 px-3 rounded-lg transition-colors"
          title="Edit address"
          style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
