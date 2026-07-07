"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, ImageOff } from "lucide-react";
import MobileHeader from "@/components/mobile/MobileHeader";
import { EmptyState, ACCENT, prettyType } from "@/components/mobile/ui";
import PhotoCapture from "@/components/mobile/PhotoCapture";
import { getCurrentTech, getCurrentJob, getMyJobs } from "@/lib/mobile/data";
import { getFiles } from "@/lib/files/data";

const PHASE_COLOR: Record<string, string> = { before: "#239c8d", during: "#3b82f6", after: "#10b981" };

export default function MobilePhotosPage() {
  const router = useRouter();
  const [tick, setTick] = useState(0);
  const [capture, setCapture] = useState(false);

  const me = useMemo(() => getCurrentTech(), []);
  const current = useMemo(() => getCurrentJob(), [tick]);
  // The tech's photos — anything on their jobs or uploaded by them, newest first.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const photos = useMemo(() => {
    const myJobIds = new Set(getMyJobs().map(j => j.id));
    return getFiles({}).filter(f => (f.jobId && myJobIds.has(f.jobId)) || f.uploadedBy === me?.fullName);
  }, [tick, me]);

  const startCapture = () => { if (current) setCapture(true); else router.push("/mobile/jobs"); };

  return (
    <div>
      <MobileHeader title="Photos" subtitle={current ? `Current job · ${current.customerName}` : "Your field photos"}
        right={<button onClick={startCapture} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: ACCENT }}><Camera className="w-5 h-5 text-white" /></button>} />

      <div className="px-4">
        {/* Capture banner */}
        <button onClick={startCapture} className="w-full flex items-center gap-3 rounded-2xl p-4 mb-4 active:scale-[0.99] transition-transform"
          style={{ border: `1px solid ${ACCENT}33`, backgroundColor: ACCENT + "0d", boxShadow: "var(--shadow-card)" }}>
          <span className="w-11 h-11 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: ACCENT }}><Camera className="w-5 h-5 text-white" /></span>
          <div className="text-left min-w-0 flex-1">
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Take photos</p>
            <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{current ? `${prettyType(current.type)} for ${current.customerName}` : "Open a job to attach photos"}</p>
          </div>
        </button>

        {photos.length === 0 ? (
          <EmptyState icon={ImageOff} title="No photos yet" hint="Tap Take photos to capture your first shots — they attach to the job automatically." />
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {photos.map(p => (
              <div key={p.id} className="relative aspect-square rounded-xl overflow-hidden flex items-center justify-center" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)" }}>
                {p.previewUrl
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={p.previewUrl} alt="" className="w-full h-full object-cover" />
                  : <Camera className="w-5 h-5" style={{ color: "var(--text-muted)" }} />}
                {p.phase && <span className="absolute top-1 left-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full text-white capitalize" style={{ backgroundColor: PHASE_COLOR[p.phase] }}>{p.phase}</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {current && <PhotoCapture open={capture} onClose={() => setCapture(false)} accountId={current.accountId} accountName={current.customerName} jobId={current.id} onSaved={() => setTick(t => t + 1)} />}
    </div>
  );
}
