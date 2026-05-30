const monthlyData = [
  { month: "Jan", value: 38000 },
  { month: "Feb", value: 32000 },
  { month: "Mar", value: 41000 },
  { month: "Apr", value: 36000 },
  { month: "May", value: 44000 },
  { month: "Jun", value: 48210 },
];

const max = Math.max(...monthlyData.map((d) => d.value));

export default function RevenueSnapshot() {
  return (
    <div
      className="rounded-xl p-4"
      style={{
        backgroundColor: "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
        Revenue snapshot
      </h2>
      <p className="text-2xl font-bold mt-1" style={{ color: "var(--text-primary)" }}>
        $48,210
      </p>
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        June month-to-date
      </p>

      <div className="flex items-end gap-1.5 mt-4" style={{ height: "80px" }}>
        {monthlyData.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
            <div
              className="w-full rounded-t-sm transition-all"
              style={{
                height: `${(d.value / max) * 100}%`,
                backgroundColor:
                  i === monthlyData.length - 1 ? "#10b981" : "#d1fae5",
              }}
            />
            <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>
              {d.month}
            </span>
          </div>
        ))}
      </div>

      <div
        className="flex justify-between text-xs mt-3 pt-3"
        style={{
          borderTop: "1px solid var(--border-subtle)",
          color: "var(--text-muted)",
        }}
      >
        <span>Outstanding</span>
        <span>Avg. ticket</span>
      </div>
    </div>
  );
}
