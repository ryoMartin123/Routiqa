export default function FilesPage() {
  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>Photos & Files</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>Project photos, documents, and media</p>
      </div>
      <div className="rounded-xl p-8 text-center" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>Photos & Files module coming in Phase 3</p>
      </div>
    </div>
  );
}
