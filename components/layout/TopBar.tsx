import { Suspense } from "react";
import { ChevronUp } from "lucide-react";
import HierarchySelector from "@/components/layout/HierarchySelector";
import GlobalCreateMenu from "@/components/layout/GlobalCreateMenu";
import GlobalSearch from "@/components/layout/GlobalSearch";
import ViewAsMenu from "@/components/layout/ViewAsMenu";
import NotificationBell from "@/components/layout/NotificationBell";
import CommentModeToggle from "@/components/layout/CommentModeToggle";
import SampleDataPanel from "@/components/dev/SampleDataPanel";

export default function TopBar({ onHide }: { onHide?: () => void }) {
  return (
    <div
      data-app-lock
      className="flex items-center gap-4 px-6 py-3 shrink-0"
      style={{
        backgroundColor: "var(--topbar-bg)",
        borderBottom: "1px solid var(--topbar-border)",
      }}
    >
      {/* Left */}
      <div className="flex-1 min-w-0 flex items-center">
        <HierarchySelector />
      </div>

      {/* Center — search + create grouped and centered together */}
      <div className="shrink-0 flex items-center gap-2">
        <div className="w-[24rem] max-w-full">
          <GlobalSearch />
        </div>
        <GlobalCreateMenu />
      </div>

      {/* Right — actions */}
      <div className="flex-1 flex items-center justify-end gap-2">
        <ViewAsMenu />
        <SampleDataPanel />
        <Suspense fallback={null}><CommentModeToggle /></Suspense>
        <NotificationBell />
        {onHide && (
          <button onClick={onHide} title="Hide bar"
            className="p-2 rounded-lg transition-colors hover:bg-[var(--bg-surface-2)]"
            style={{ color: "var(--text-muted)" }}>
            <ChevronUp className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
