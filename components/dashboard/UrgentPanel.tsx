import { AlertTriangle } from "lucide-react";

const urgentItems = [
  {
    title: "Burst pipe — 8 Cedar Ln",
    detail: "Customer waiting · ETA needed",
  },
  {
    title: "Invoice #1042 overdue 14 days",
    detail: "Hammond LLC · $3,420",
  },
  {
    title: "Permit expires Friday",
    detail: "Job #2231 · roof tear-off",
  },
];

export default function UrgentPanel() {
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
        className="flex items-center justify-between px-4 py-3"
        style={{ backgroundColor: "#fffbeb", borderBottom: "1px solid #fde68a" }}
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" style={{ color: "#d97706" }} />
          <h2 className="text-sm font-semibold" style={{ color: "#92400e" }}>
            Urgent
          </h2>
        </div>
        <span
          className="text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center"
          style={{ backgroundColor: "#fde68a", color: "#92400e" }}
        >
          {urgentItems.length}
        </span>
      </div>
      <div>
        {urgentItems.map((item, i) => (
          <div
            key={i}
            className="flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors"
            style={
              i < urgentItems.length - 1
                ? { borderBottom: "1px solid var(--border-subtle)" }
                : undefined
            }
          >
            <div
              className="w-2 h-2 rounded-full mt-1.5 shrink-0"
              style={{ backgroundColor: "#ef4444" }}
            />
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                {item.title}
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                {item.detail}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
