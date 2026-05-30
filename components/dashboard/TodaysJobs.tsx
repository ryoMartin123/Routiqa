import Link from "next/link";
import { Filter, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

const jobs = [
  {
    time: "08:00",
    duration: "90 min",
    customer: "Alvarez Residence",
    service: "HVAC tune-up",
    address: "412 Oak St",
    tech: "J. Patel",
    status: "En route",
  },
  {
    time: "10:30",
    duration: "90 min",
    customer: "Lakeside Apts",
    service: "Drain cleaning",
    address: "88 Lakeside Dr",
    tech: "M. Cole",
    status: "In progress",
  },
  {
    time: "13:00",
    duration: "90 min",
    customer: "Hammond LLC",
    service: "Roof inspection",
    address: "1200 Industrial Way",
    tech: "D. Nguyen",
    status: "Scheduled",
  },
  {
    time: "15:30",
    duration: "90 min",
    customer: "K. Brennan",
    service: "Water heater install",
    address: "27 Maple Ct",
    tech: "J. Patel",
    status: "Scheduled",
  },
];

const statusStyles: Record<string, string> = {
  "En route": "bg-amber-100 text-amber-700",
  "In progress": "bg-blue-100 text-blue-700",
  Scheduled: "bg-gray-100 text-gray-500",
};

export default function TodaysJobs() {
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        backgroundColor: "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div
        className="flex items-center justify-between px-5 py-4"
        style={{ borderBottom: "1px solid var(--border-subtle)" }}
      >
        <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Today&apos;s jobs
        </h2>
        <div className="flex items-center gap-3">
          <button style={{ color: "var(--text-muted)" }}>
            <Filter className="w-4 h-4" />
          </button>
          <Link
            href="/jobs"
            className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700"
          >
            View all
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      </div>

      <div>
        {jobs.map((job, i) => (
          <div
            key={i}
            className="flex items-center gap-4 px-5 py-3 cursor-pointer transition-colors hover:opacity-90"
            style={
              i < jobs.length - 1
                ? { borderBottom: "1px solid var(--border-subtle)" }
                : undefined
            }
          >
            <div className="w-14 shrink-0">
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                {job.time}
              </p>
              <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                {job.duration}
              </p>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                {job.customer}
              </p>
              <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                {job.service} · {job.address}
              </p>
            </div>
            <span className="text-xs shrink-0" style={{ color: "var(--text-secondary)" }}>
              {job.tech}
            </span>
            <span
              className={cn(
                "text-[10px] font-semibold px-2 py-1 rounded-full shrink-0",
                statusStyles[job.status]
              )}
            >
              {job.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
