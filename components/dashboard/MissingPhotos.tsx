"use client";

import { ImageIcon } from "lucide-react";

export default function MissingPhotos() {
  return (
    <div className="rounded-xl p-5 h-full min-h-0 flex flex-col overflow-y-auto dashboard-widget-content"
      style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div className="flex items-center gap-2">
          <ImageIcon className="w-4 h-4" style={{ color: "#2563eb" }} />
          <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Missing Required Photos</h2>
        </div>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
          style={{ backgroundColor: "#e0e7ff", color: "#4f46e5" }}>Phase 3</span>
      </div>
      <div className="flex-1 min-h-0 py-4 text-center space-y-2">
        <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
          Jobs missing required before/after photos will appear here once Photos & Files is connected.
        </p>
        <ul className="text-xs space-y-1 text-left mt-3" style={{ color: "var(--text-muted)" }}>
          {["Required photo checklists per job type", "Technician alerts for missing photos", "Completion blocked until photos uploaded", "Photo quality compliance reporting"].map(f => (
            <li key={f} className="flex items-start gap-1.5">
              <div className="w-1 h-1 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: "var(--text-muted)" }} />
              {f}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
