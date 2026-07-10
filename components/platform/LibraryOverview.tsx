"use client";

// ─── Documents · Overview (the app's landing dashboard) ───
// Replaces the old Documents dashboard: top-level folders as collection
// cards, a shortcut row of subfolders, and real freshness (recently updated
// docs + activity). Clicking anything deep-links into the Company Library
// explorer. No engagement charts yet — there's no view/edit tracking data,
// and we don't fake numbers.

import { useRouter } from "next/navigation";
import { Folder, FileText, ArrowRight } from "lucide-react";
import { appById } from "@/lib/platform/apps";
import {
  topFolders, childFolders, docCountDeep, getDocuments, getActivity,
  STATUS_COLOR, type DocItem,
} from "@/lib/documents/mock";

const ACCENT = appById("documents")?.accent ?? "#f59e0b";

export default function LibraryOverview() {
  const router = useRouter();
  const onBrowse = (folderId: string) => router.push(`/documents/library?folder=${folderId}`);
  const onOpenDoc = (d: DocItem) => router.push(`/documents/library?folder=${d.folderId}&doc=${d.id}`);
  const collections = topFolders();
  const shortcuts = collections.flatMap(f => childFolders(f.id)).slice(0, 10);
  const docs = getDocuments().filter(d => d.status !== "Archived");
  const recent = [...docs]
    .sort((a, b) => (Date.parse(b.updated) || 0) - (Date.parse(a.updated) || 0))
    .slice(0, 6);
  const activity = getActivity().slice(0, 6);

  return (
    // Fills the viewport: fixed-height sections up top, the freshness panels
    // flex to absorb the remaining height (their lists scroll internally).
    <div className="h-full overflow-y-auto thin-scroll-y p-6 flex flex-col gap-5">
      {/* ── Collections — big minimal folder icons in one full-width container,
          tiles stretch to share the whole viewport width ── */}
      <div className="rounded-xl p-4 shrink-0" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
        <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>Collections</p>
        <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(150px, 1fr))` }}>
          {collections.map(f => (
            <button key={f.id} onClick={() => onBrowse(f.id)} title={f.description || f.name}
              className="group flex flex-col items-center gap-1.5 rounded-xl px-3 pt-3 pb-2.5 transition-colors hover:bg-[var(--bg-surface-2)]">
              <Folder className="w-20 h-20 transition-transform group-hover:-translate-y-0.5" strokeWidth={0.9}
                style={{ color: ACCENT, fill: ACCENT + "14" }} />
              <span className="doc-tile-label text-sm font-medium text-center leading-tight">{f.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Shortcuts — the same folder-tile language as Collections, one size down ── */}
      {shortcuts.length > 0 && (
        <div className="rounded-xl p-4 shrink-0" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
          <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>Shortcuts</p>
          <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(112px, 1fr))" }}>
            {shortcuts.map(f => (
              <button key={f.id} onClick={() => onBrowse(f.id)} title={`${f.name} · ${docCountDeep(f.id)} doc${docCountDeep(f.id) === 1 ? "" : "s"}`}
                className="group flex flex-col items-center gap-1 rounded-xl px-2 pt-2.5 pb-2 transition-colors hover:bg-[var(--bg-surface-2)]">
                <Folder className="w-10 h-10 transition-transform group-hover:-translate-y-0.5" strokeWidth={1.1}
                  style={{ color: ACCENT, fill: ACCENT + "14" }} />
                <span className="doc-tile-label text-xs font-medium text-center leading-tight truncate w-full">{f.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Freshness: recently updated + activity — absorb the remaining height ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 flex-1 min-h-0" style={{ minHeight: "16rem" }}>
        <div className="rounded-xl p-5 flex flex-col min-h-0" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
          <p className="text-sm font-semibold mb-3 shrink-0" style={{ color: "var(--text-primary)" }}>Recently updated</p>
          {recent.length === 0 ? (
            <p className="text-sm py-3" style={{ color: "var(--text-muted)" }}>Nothing here yet.</p>
          ) : (
            <ul className="flex-1 min-h-0 overflow-y-auto thin-scroll-y">
              {recent.map((d, i) => (
                <li key={d.id}>
                  <button onClick={() => onOpenDoc(d)}
                    className="group w-full flex items-center gap-2.5 py-2 text-left transition-colors hover:bg-[var(--bg-surface-2)] rounded-lg px-2 -mx-2"
                    style={{ borderTop: i === 0 ? "none" : "1px solid var(--border-subtle)" }}>
                    <FileText className="w-4 h-4 shrink-0" style={{ color: ACCENT }} />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm truncate" style={{ color: "var(--text-primary)" }}>{d.title}</span>
                      <span className="block text-[11px]" style={{ color: "var(--text-muted)" }}>{d.type} · {d.owner}</span>
                    </span>
                    {/* Status: quiet plain text, only on hover */}
                    <span className="text-[11px] font-medium shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: STATUS_COLOR[d.status] }}>{d.status}</span>
                    <span className="text-[11px] shrink-0" style={{ color: "var(--text-muted)" }}>{d.updated}</span>
                    <ArrowRight className="w-3.5 h-3.5 shrink-0 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" style={{ color: ACCENT }} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-xl p-5 flex flex-col min-h-0" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
          <p className="text-sm font-semibold mb-3 shrink-0" style={{ color: "var(--text-primary)" }}>Recent activity</p>
          {activity.length === 0 ? (
            <p className="text-sm py-3" style={{ color: "var(--text-muted)" }}>No activity yet.</p>
          ) : (
            <ul className="space-y-2.5 flex-1 min-h-0 overflow-y-auto thin-scroll-y">
              {activity.map(a => (
                <li key={a.id} className="text-sm" style={{ color: "var(--text-secondary)" }}>
                  {a.text}
                  <span className="block text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>{a.when}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
