"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { getAllActivityEvents } from "@/lib/activity/data";

const EVENT_TYPE_LABELS: Record<string, string> = {
  account_created:    "Account created",
  contact_added:      "Contact added",
  property_added:     "Property added",
  lead_created:       "Lead created",
  lead_stage_changed: "Lead stage changed",
  job_created:        "Job created",
  job_scheduled:      "Job scheduled",
  job_completed:      "Job completed",
  work_order_created: "Work order created",
  quote_created:      "Quote created",
  quote_sent:         "Quote sent",
  quote_accepted:     "Quote accepted",
  invoice_created:    "Invoice created",
  payment_received:   "Payment received",
  agreement_created:  "Agreement created",
  agreement_renewed:  "Agreement renewed",
  photo_uploaded:     "Photo uploaded",
  file_uploaded:      "File uploaded",
  note_added:         "Note added",
  email_sent:         "Email sent",
  sms_sent:           "SMS sent",
  call_logged:        "Call logged",
  task_created:       "Task created",
  task_completed:     "Task completed",
};

const EVENT_COLORS: Record<string, string> = {
  job_completed:    "#10b981",
  job_created:      "#239c8d",
  job_scheduled:    "#239c8d",
  lead_created:     "#f59e0b",
  quote_sent:       "#c9703a",
  quote_accepted:   "#10b981",
  payment_received: "#10b981",
  note_added:       "#6b7280",
  call_logged:      "#10b981",
  email_sent:       "#3b82f6",
  task_created:     "#f59e0b",
  task_completed:   "#10b981",
};

export default function RecentActivity() {
  const events = getAllActivityEvents().slice(0, 8);

  return (
    <div className="rounded-xl overflow-hidden h-full min-h-0 flex flex-col"
      style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between px-5 py-4 shrink-0"
        style={{ borderBottom: "1px solid var(--border)" }}>
        <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Recent Activity</h2>
        <Link href="/customers" className="flex items-center gap-1 text-xs font-medium text-[#0f8578] hover:text-[#0c6b60]">
          View all <ExternalLink className="w-3 h-3" />
        </Link>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto dashboard-widget-content">
        {events.map((event, i) => {
          const color = EVENT_COLORS[event.eventType] ?? "#6b7280";
          return (
            <div key={event.id}
              className="flex items-start gap-3 px-5 py-3"
              style={{ borderBottom: i < events.length - 1 ? "1px solid var(--border)" : "none" }}>
              <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: color }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                  <span className="font-medium" style={{ color: "var(--text-primary)" }}>
                    {event.createdBy}
                  </span>{" "}
                  {EVENT_TYPE_LABELS[event.eventType] ?? event.eventType}
                  {event.title !== EVENT_TYPE_LABELS[event.eventType] && (
                    <> — <span style={{ color: "var(--text-primary)" }}>{event.title}</span></>
                  )}
                </p>
                <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>{event.displayDate}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
