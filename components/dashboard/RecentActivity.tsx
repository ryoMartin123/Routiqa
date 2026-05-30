const activities = [
  {
    color: "#3b82f6",
    text: "J. Patel marked job complete",
    link: "Alvarez Residence",
    time: "2m ago",
  },
  {
    color: "#10b981",
    text: "Sara (intake) added a lead from web form",
    link: "T. Okar",
    time: "12m ago",
  },
  {
    color: "#8b5cf6",
    text: "M. Cole uploaded 6 photos",
    link: "Job #2218",
    time: "1h ago",
  },
  {
    color: "#f59e0b",
    text: "Auto-reminder sent follow-up to",
    link: "K. Brennan",
    time: "2h ago",
  },
];

export default function RecentActivity() {
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
        className="px-5 py-4"
        style={{ borderBottom: "1px solid var(--border-subtle)" }}
      >
        <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Recent activity
        </h2>
      </div>
      <div>
        {activities.map((item, i) => (
          <div
            key={i}
            className="flex items-start gap-3 px-5 py-3"
            style={
              i < activities.length - 1
                ? { borderBottom: "1px solid var(--border-subtle)" }
                : undefined
            }
          >
            <div
              className="w-2 h-2 rounded-full mt-1.5 shrink-0"
              style={{ backgroundColor: item.color }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                {item.text}{" "}
                <span className="font-medium" style={{ color: "var(--text-primary)" }}>
                  {item.link}
                </span>
              </p>
              <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                {item.time}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
