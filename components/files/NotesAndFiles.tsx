"use client";

// ─── Notes & Files ────────────────────────────────────────
// The combined tab body: ONE neutral "Add" action (chooser: upload files or
// write a new document in the block editor), the file gallery, and the record's
// existing notes below. New "notes" are documents — saved straight into files.

import { useEffect, useRef, useState } from "react";
import { Upload, FileText } from "lucide-react";
import DetailActionButton from "@/components/shared/DetailActionButton";
import PhotoGallery from "@/components/files/PhotoGallery";
import DocumentEditor from "@/components/files/DocumentEditor";
import type { FileScope } from "@/lib/files/data";

export default function NotesAndFiles({ recordLevel, scope, accountName }: {
  recordLevel: "account" | "job" | "project" | "property" | "global";
  scope: FileScope;
  accountName?: string;
}) {
  const [uploadSignal, setUploadSignal] = useState(0);
  const [docOpen, setDocOpen] = useState(false);
  const [galleryKey, setGalleryKey] = useState(0);

  // Add chooser — upload vs new document.
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  // The Add chooser rides INSIDE the gallery toolbar (same row as search/filters)
  // so the tab has one toolbar and the content starts high.
  const addAction = (
    <div className="relative shrink-0" ref={menuRef}>
      <DetailActionButton active={menuOpen} onClick={() => setMenuOpen(o => !o)}>Add</DetailActionButton>
      {menuOpen && (
        <div className="absolute right-0 top-full mt-1.5 w-48 rounded-xl z-30 p-1.5"
          style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 12px 32px rgba(0,0,0,0.18)" }}>
          <button onClick={() => { setMenuOpen(false); setDocOpen(true); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors hover:bg-[var(--bg-surface-2)]">
            <FileText className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--accent-text)" }} />
            <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>New document</span>
          </button>
          <button onClick={() => { setMenuOpen(false); setUploadSignal(n => n + 1); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors hover:bg-[var(--bg-surface-2)]">
            <Upload className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--accent-text)" }} />
            <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Upload files</span>
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div>
      <PhotoGallery key={galleryKey} recordLevel={recordLevel} scope={scope} accountName={accountName}
        externalUpload uploadSignal={uploadSignal} toolbarAction={addAction} />

      {docOpen && (
        <DocumentEditor scope={scope} accountName={accountName}
          onClose={() => setDocOpen(false)}
          onSaved={() => { setDocOpen(false); setGalleryKey(k => k + 1); }} />
      )}
    </div>
  );
}
