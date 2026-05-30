export default function MarketingPage() {
  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>Marketing</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>Campaigns, sequences, and outreach</p>
      </div>
      <div className="rounded-xl p-8 text-center" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>Marketing module coming in Phase 5</p>
      </div>
    </div>
  );
}
