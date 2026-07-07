"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import AnalyticsBuilder from "@/components/analytics/AnalyticsBuilder";
import { getReport } from "@/lib/analytics/store";
import { newReportConfig } from "@/lib/analytics/types";

export default function AnalyticsBuilderPage() {
  const router = useRouter();
  const params = useSearchParams();
  const id = params.get("id");
  // Opening a CRM template starts a fresh "my widget" copy (templates stay intact).
  const initial = useMemo(() => {
    const r = id ? getReport(id) : undefined;
    if (!r) return newReportConfig();
    if (r.template) return { ...r, id: `rpt-${Date.now().toString(36)}`, template: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    return r;
  }, [id]);

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <Link href="/analytics" className="inline-flex items-center gap-1.5 text-sm font-medium mb-5 transition-opacity hover:opacity-80" style={{ color: "#0f8578" }}>
        <ChevronLeft className="w-4 h-4" /> Back to analytics
      </Link>
      <AnalyticsBuilder initial={initial} onSaved={() => router.push("/analytics")} />
    </div>
  );
}
