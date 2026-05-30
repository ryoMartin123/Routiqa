export default function LeadsPage() {
  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>Leads</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>Track and convert your pipeline</p>
      </div>
      <div className="rounded-xl p-8 text-center" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>Lead pipeline coming in Phase 1</p>
      </div>
    </div>
  );
}
