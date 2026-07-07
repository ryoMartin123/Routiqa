"use client";

// ─── Field photo capture (CompanyCam-style) ───────────────
// Frictionless: shoot a burst, they stage, tag the batch by category (Before /
// During / After / Equipment Plate / …), and save. Auto-stamps GPS, timestamp,
// and uploader, and writes straight into the shared Photos & Files store — so
// they show up in the CRM gallery and on the job, tied to job + customer.

import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, X, Check, MapPin } from "lucide-react";
import { getPhotoCategories } from "@/lib/photo-categories/data";
import { addFile } from "@/lib/files/data";
import type { PhotoPhase } from "@/lib/files/types";
import { getCurrentTech } from "@/lib/mobile/data";

const ACCENT = "#0f8578";
const phaseOf = (key: string): PhotoPhase | undefined => (["before", "during", "after"].includes(key) ? (key as PhotoPhase) : undefined);

interface Staged { id: string; url: string }

export default function PhotoCapture({ open, onClose, accountId, accountName, jobId, defaultCategory, onSaved }: {
  open: boolean; onClose: () => void; accountId: string; accountName?: string; jobId?: string; defaultCategory?: string; onSaved?: () => void;
}) {
  const cats = useMemo(() => getPhotoCategories().filter(c => c.active && c.appliesTo.includes("Job")), []);
  const [staged, setStaged] = useState<Staged[]>([]);
  const [categoryKey, setCategoryKey] = useState<string>(defaultCategory ?? cats.find(c => c.key === "during")?.key ?? cats[0]?.key ?? "during");
  const [caption, setCaption] = useState("");
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setStaged([]); setCaption(""); setCategoryKey(defaultCategory ?? cats.find(c => c.key === "during")?.key ?? cats[0]?.key ?? "during");
    if (navigator.geolocation) navigator.geolocation.getCurrentPosition(p => setGeo({ lat: p.coords.latitude, lng: p.coords.longitude }), () => setGeo(null), { enableHighAccuracy: true, timeout: 5000 });
    // open the camera immediately
    const t = setTimeout(() => inputRef.current?.click(), 150);
    return () => clearTimeout(t);
  }, [open, defaultCategory, cats]);

  if (!open) return null;
  const cat = cats.find(c => c.key === categoryKey);

  function onFiles(files: FileList | null) {
    const next = Array.from(files ?? []).map((f, i) => ({ id: `s-${Date.now()}-${i}`, url: URL.createObjectURL(f) }));
    setStaged(s => [...next, ...s]);
  }
  function save() {
    if (!staged.length) return;
    const by = getCurrentTech()?.fullName ?? "Field tech";
    staged.forEach((s, i) => addFile({
      scope: { accountId, jobId },
      fileName: `IMG_${Date.now()}_${i}.jpg`, fileType: "image",
      categoryKey, phase: phaseOf(categoryKey),
      lat: geo?.lat, lng: geo?.lng, uploadedBy: by, accountName,
      notes: caption || undefined, previewUrl: s.url,
    }));
    onSaved?.(); onClose();
  }

  return (
    <div className="fixed inset-0 z-[70] flex flex-col" style={{ backgroundColor: "var(--bg-page)", paddingTop: "env(safe-area-inset-top)" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
        <button onClick={onClose} className="p-1.5 -ml-1.5 rounded-lg active:bg-[var(--bg-surface-2)]"><X className="w-5 h-5" style={{ color: "var(--text-primary)" }} /></button>
        <p className="text-base font-bold" style={{ color: "var(--text-primary)" }}>Add photos</p>
        <button onClick={save} disabled={!staged.length} className="text-sm font-semibold transition-opacity disabled:opacity-40" style={{ color: ACCENT }}>Save {staged.length || ""}</button>
      </div>

      <div className="flex-1 overflow-y-auto thin-scroll-y p-4 space-y-4">
        {/* Capture tile + staged grid */}
        <div className="grid grid-cols-3 gap-2">
          <button onClick={() => inputRef.current?.click()} className="aspect-square rounded-2xl flex flex-col items-center justify-center gap-1 active:scale-[0.98] transition-transform"
            style={{ border: `1.5px dashed ${ACCENT}66`, backgroundColor: ACCENT + "0d" }}>
            <Camera className="w-7 h-7" style={{ color: ACCENT }} />
            <span className="text-[11px] font-medium" style={{ color: ACCENT }}>Capture</span>
          </button>
          {staged.map(s => (
            // eslint-disable-next-line @next/next/no-img-element
            <div key={s.id} className="relative aspect-square">
              <img src={s.url} alt="" className="w-full h-full object-cover rounded-2xl" style={{ border: "1px solid var(--border)" }} />
              <button onClick={() => setStaged(v => v.filter(x => x.id !== s.id))} className="absolute top-1 right-1 w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.55)" }}><X className="w-3.5 h-3.5 text-white" /></button>
            </div>
          ))}
        </div>
        <input ref={inputRef} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={e => onFiles(e.target.files)} />

        {/* Category (drives the required checklist; before/during/after also set phase) */}
        <div>
          <p className="text-xs font-semibold mb-2" style={{ color: "var(--text-secondary)" }}>Tag as</p>
          <div className="flex flex-wrap gap-2">
            {cats.map(c => {
              const on = c.key === categoryKey;
              return (
                <button key={c.key} onClick={() => setCategoryKey(c.key)} className="px-3 py-1.5 rounded-full text-sm font-medium transition-colors inline-flex items-center gap-1.5"
                  style={{ backgroundColor: on ? c.color + "22" : "var(--bg-surface)", color: on ? c.color : "var(--text-secondary)", border: `1px solid ${on ? c.color + "66" : "var(--border-subtle)"}` }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: c.color }} />{c.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Caption */}
        <div>
          <p className="text-xs font-semibold mb-2" style={{ color: "var(--text-secondary)" }}>Caption <span className="font-normal" style={{ color: "var(--text-muted)" }}>(optional)</span></p>
          <input value={caption} onChange={e => setCaption(e.target.value)} placeholder="Add a note…" className="w-full rounded-xl px-3 py-2.5 text-sm outline-none" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
        </div>

        {/* Auto-stamps */}
        <p className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
          <MapPin className="w-3.5 h-3.5" style={{ color: geo ? "#16a34a" : "var(--text-muted)" }} />
          {geo ? "Location captured" : "Location unavailable"} · stamped with time & your name
        </p>
      </div>

      {/* Save bar */}
      <div className="p-4" style={{ borderTop: "1px solid var(--border)", paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}>
        <button onClick={save} disabled={!staged.length} className="w-full min-h-[50px] rounded-2xl flex items-center justify-center gap-2 text-base font-semibold text-white transition-opacity disabled:opacity-40" style={{ backgroundColor: ACCENT }}>
          <Check className="w-5 h-5" /> Save {staged.length} photo{staged.length === 1 ? "" : "s"}{cat ? ` · ${cat.name}` : ""}
        </button>
      </div>
    </div>
  );
}
