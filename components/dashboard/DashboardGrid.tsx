"use client";

// Heavy, interactive widget grid extracted from the dashboard page so it can be
// lazy-loaded. This module owns react-grid-layout (+ react-resizable) and all
// widget components — none of which are needed for the dashboard route shell to
// paint. The parent loads this via next/dynamic, so the library and every widget
// land in a separate chunk fetched after the page frame is visible.

import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

import React, { useMemo } from "react";
import {
  GridLayout,
  useContainerWidth,
  verticalCompactor,
  type LayoutItem as RGLItem,
} from "react-grid-layout";
import { GripHorizontal, EyeOff } from "lucide-react";

import StatsOverview        from "@/components/dashboard/StatsOverview";
import TodaysJobs           from "@/components/dashboard/TodaysJobs";
import RecentActivity       from "@/components/dashboard/RecentActivity";
import UrgentPanel          from "@/components/dashboard/UrgentPanel";
import RevenueSnapshot      from "@/components/dashboard/RevenueSnapshot";
import PipelineSnapshot     from "@/components/dashboard/PipelineSnapshot";
import QuotesFollowUp       from "@/components/dashboard/QuotesFollowUp";
import OpenWorkOrders       from "@/components/dashboard/OpenWorkOrders";
import InvoicesDue          from "@/components/dashboard/InvoicesDue";
import LocationPerformance  from "@/components/dashboard/LocationPerformance";
import CompanyPerformance   from "@/components/dashboard/CompanyPerformance";
import LeadsInTerritory     from "@/components/dashboard/LeadsInTerritory";
import JobsInTerritory      from "@/components/dashboard/JobsInTerritory";
import AgreementRenewals    from "@/components/dashboard/AgreementRenewals";
import MissingPhotos        from "@/components/dashboard/MissingPhotos";

import { WIDGET_MAP } from "@/lib/dashboard/registry";
import { type LayoutItem as DashItem } from "@/lib/dashboard/layouts";

// ─── Widget renderer ──────────────────────────────────────
function renderWidget(id: string) {
  switch (id) {
    case "stats_overview":          return <StatsOverview />;
    case "todays_jobs":             return <TodaysJobs />;
    case "urgent_panel":            return <UrgentPanel />;
    case "pipeline_snapshot":       return <PipelineSnapshot />;
    case "quotes_followup":         return <QuotesFollowUp />;
    case "revenue_snapshot":        return <RevenueSnapshot />;
    case "recent_activity":         return <RecentActivity />;
    case "open_work_orders":        return <OpenWorkOrders />;
    case "invoices_due":            return <InvoicesDue />;
    case "location_performance":    return <LocationPerformance />;
    case "company_performance":     return <CompanyPerformance />;
    case "leads_in_territory":      return <LeadsInTerritory />;
    case "jobs_in_territory":       return <JobsInTerritory />;
    case "agreement_renewals":      return <AgreementRenewals />;
    case "missing_required_photos": return <MissingPhotos />;
    default: return null;
  }
}

export interface DashboardGridProps {
  contextVisible: DashItem[];
  customizing: boolean;
  onLayoutChange: (layout: readonly RGLItem[]) => void;
  onHideWidget: (id: string) => void;
}

export default function DashboardGrid({
  contextVisible, customizing, onLayoutChange, onHideWidget,
}: DashboardGridProps) {
  // Convert to react-grid-layout format
  const rglLayout: RGLItem[] = useMemo(() =>
    contextVisible.map(item => {
      const def  = WIDGET_MAP[item.widgetId];
      // maxW: full-width widget can still be narrowed to half; narrow widgets cap at 8 cols
      const maxW = def?.defaultSize === "narrow" ? 8 : 12;
      return {
        i:    item.widgetId,
        x:    item.x,
        y:    item.y,
        w:    item.w,
        h:    item.h,
        minW: item.minW,
        minH: item.minH,
        maxW,
        maxH: 24,
      };
    }),
    [contextVisible]
  );

  // Container width measurement
  const { width, containerRef } = useContainerWidth();
  const gridWidth = width > 0 ? width : 1280;

  return (
    /* The dashboard-grid-editing class gates resize handle visibility via CSS */
    <div ref={containerRef as React.RefObject<HTMLDivElement>}
      className={customizing ? "dashboard-grid-editing" : ""}>
      <GridLayout
        width={gridWidth}
        layout={rglLayout}
        gridConfig={{
          cols:             12,
          rowHeight:        50,
          margin:           [16, 16],
          containerPadding: [0, 0],
        }}
        dragConfig={{
          enabled: customizing,
          bounded: true,               // prevent dragging outside grid bounds
          handle:  ".widget-drag-handle",
        }}
        resizeConfig={{
          enabled: customizing,
          handles: ["se"],
        }}
        compactor={verticalCompactor}  // auto-fill gaps for cleaner layouts
        onLayoutChange={onLayoutChange}
        autoSize
      >
        {contextVisible.map(item => (
          /* Chromeless cell — the widget owns its own card and fills the cell
             via `h-full`. In customize mode the drag handle floats over the top
             as an absolute overlay so it never changes the widget's height
             (no layout shift between view/edit). */
          <div key={item.widgetId}
            className={["relative", customizing ? "dashboard-widget-editing" : ""].filter(Boolean).join(" ")}
          >
            {renderWidget(item.widgetId)}

            {/* ── Drag handle overlay — customize mode only ── */}
            {customizing && (
              <div
                className="widget-drag-handle absolute top-0 left-0 right-0 z-10 flex items-center gap-2 px-3 py-1.5 select-none"
                style={{
                  backgroundColor: "var(--accent-soft-bg)",
                  borderBottom:    "1px solid var(--accent-soft-border)",
                  borderRadius:    "12px 12px 0 0",
                  cursor:          "grab",
                  minHeight:       "32px",
                }}>
                <GripHorizontal className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--accent-icon)" }} />
                <span className="text-[10px] font-semibold flex-1 truncate" style={{ color: "var(--accent-text)" }}>
                  {WIDGET_MAP[item.widgetId]?.title}
                </span>
                {/* Stop drag from firing when clicking Hide */}
                <button
                  onMouseDown={e => e.stopPropagation()}
                  onClick={() => onHideWidget(item.widgetId)}
                  className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-opacity hover:opacity-80"
                  style={{ backgroundColor: "var(--accent-soft-2-bg)", color: "var(--accent-text)" }}
                >
                  <EyeOff className="w-2.5 h-2.5" /> Hide
                </button>
              </div>
            )}
          </div>
        ))}
      </GridLayout>
    </div>
  );
}
