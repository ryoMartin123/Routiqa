import { Search, Bell, Plus } from "lucide-react";
import HierarchySelector from "@/components/layout/HierarchySelector";

export default function TopBar() {
  return (
    <div
      className="flex items-center gap-4 px-6 py-3 shrink-0"
      style={{
        backgroundColor: "var(--topbar-bg)",
        borderBottom: "1px solid var(--topbar-border)",
      }}
    >
      <HierarchySelector />

      <div className="flex-1 max-w-xl">
        <div
          className="flex items-center gap-2 rounded-lg px-3 py-2"
          style={{ backgroundColor: "var(--bg-input)" }}
        >
          <Search className="w-4 h-4 shrink-0" style={{ color: "var(--text-muted)" }} />
          <input
            type="text"
            placeholder="Search customers, jobs, addresses..."
            className="bg-transparent text-sm outline-none flex-1 min-w-0"
            style={{ color: "var(--text-primary)" }}
          />
          <span
            className="text-xs shrink-0 border rounded px-1.5 py-0.5 font-mono"
            style={{
              color: "var(--text-muted)",
              backgroundColor: "var(--bg-surface)",
              borderColor: "var(--border)",
            }}
          >
            ⌘K
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          className="relative p-2 rounded-lg transition-colors"
          style={{ color: "var(--text-secondary)" }}
        >
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
        </button>
        <button className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors">
          <Plus className="w-4 h-4" />
          Create
        </button>
      </div>
    </div>
  );
}
