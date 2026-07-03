"use client";

// Image picker for an option card. Supports uploading a file (stored as a
// data-URL so it persists in localStorage without a backend) or pasting an
// image URL. No Supabase yet — when storage is wired, swap the data-URL for an
// uploaded storage path.

import { useRef } from "react";
import { ImagePlus, X } from "lucide-react";

export default function OptionImageInput({ value, onChange, accent }: {
  value?: string;
  onChange: (v?: string) => void;
  accent: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => onChange(typeof reader.result === "string" ? reader.result : undefined);
    reader.readAsDataURL(f);
    e.target.value = "";
  }

  return (
    <div>
      {value ? (
        <div className="relative rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="Option" style={{ width: "100%", height: "96px", objectFit: "cover", display: "block" }} />
          <button onClick={() => onChange(undefined)} title="Remove image"
            className="absolute top-1 right-1 w-6 h-6 rounded-full flex items-center justify-center"
            style={{ backgroundColor: "rgba(0,0,0,0.55)", color: "#fff" }}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <button onClick={() => fileRef.current?.click()}
          className="w-full flex items-center justify-center gap-1.5 rounded-lg text-xs font-medium py-3"
          style={{ border: "1px dashed var(--border)", color: "var(--text-secondary)" }}>
          <ImagePlus className="w-4 h-4" style={{ color: accent }} /> Add image
        </button>
      )}
      <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
      <input
        value={value && !value.startsWith("data:") ? value : ""}
        onChange={e => onChange(e.target.value || undefined)}
        placeholder="…or paste image URL"
        className="w-full mt-1.5 rounded-lg px-2.5 py-1.5 text-xs outline-none"
        style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
    </div>
  );
}
