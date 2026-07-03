"use client";

// ─── Bottom sheet ─────────────────────────────────────────
// Slide-up sheet with a grab handle. Drag the handle/header down to dismiss
// (past a threshold it closes, otherwise it snaps back). Backdrop tap closes too.

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

export default function BottomSheet({
  open, onClose, title, subtitle, children,
}: {
  open: boolean; onClose: () => void; title?: string; subtitle?: string; children: React.ReactNode;
}) {
  const [dragY, setDragY] = useState(0);
  const dragging = useRef(false);
  const startY = useRef(0);

  useEffect(() => { if (open) setDragY(0); }, [open]);

  const onDown = (e: React.PointerEvent) => {
    dragging.current = true; startY.current = e.clientY;
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    setDragY(Math.max(0, e.clientY - startY.current));
  };
  const onUp = () => {
    if (!dragging.current) return;
    dragging.current = false;
    setDragY(dy => { if (dy > 90) onClose(); return 0; });
  };

  return (
    <div className={`fixed inset-0 z-[70] flex flex-col justify-end ${open ? "" : "pointer-events-none"}`}>
      <div onClick={onClose} className="absolute inset-0 transition-opacity duration-300" style={{ backgroundColor: "rgba(0,0,0,0.5)", opacity: open ? 1 : 0 }} />
      <div className="relative flex flex-col rounded-t-3xl max-h-[88vh]"
        style={{
          transform: open ? `translateY(${dragY}px)` : "translateY(110%)",
          transition: dragging.current ? "none" : "transform 0.34s cubic-bezier(0.22,1,0.36,1)",
          backgroundColor: "var(--bg-surface)", borderTop: "1px solid var(--border)",
          boxShadow: "0 -16px 48px rgba(0,0,0,0.4)",
        }}>
        {/* Drag zone — handle + header */}
        <div onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} className="shrink-0 pt-2.5 cursor-grab active:cursor-grabbing touch-none">
          <div className="w-10 h-1.5 rounded-full mx-auto" style={{ backgroundColor: "var(--border)" }} />
          {(title || subtitle) && (
            <div className="flex items-start justify-between gap-3 px-5 pt-3 pb-2">
              <div className="min-w-0">
                {title && <p className="text-lg font-bold truncate" style={{ color: "var(--text-primary)" }}>{title}</p>}
                {subtitle && <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{subtitle}</p>}
              </div>
              <button onClick={onClose} aria-label="Close" className="p-1.5 -mr-1 rounded-full active:bg-[var(--bg-surface-2)] shrink-0"><X className="w-5 h-5" style={{ color: "var(--text-muted)" }} /></button>
            </div>
          )}
        </div>
        <div className="overflow-y-auto overscroll-contain pb-[calc(env(safe-area-inset-bottom)+1rem)]">{children}</div>
      </div>
    </div>
  );
}
