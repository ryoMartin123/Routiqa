"use client";

// ─── Settings auto-save ───────────────────────────────────
// Settings sections no longer render a manual Save button. Instead a section
// registers its persist handler + a `dirty` flag here; this auto-fires the
// handler (debounced) whenever the section becomes dirty and pings the global
// SavedPill. Kept as a thin hook so existing sections need minimal changes.

import { useEffect, useRef } from "react";
import { pingSaved } from "@/components/shared/SavedPill";

export interface SaveAction {
  dirty: boolean;
  onSave: () => void;
  saved?: boolean;   // legacy — ignored (SavedPill owns the "saved" feedback)
  label?: string;    // legacy — ignored
}

// Provider is now a passthrough (no shared button state to hold). Retained so
// call sites don't have to change.
export function SettingsActionsProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

// A section calls this to register its persist handler. When `dirty` flips true
// we debounce briefly, then persist and flash the SavedPill. onSave is kept
// fresh via a ref so we always run the latest closure.
export function useRegisterSaveAction({ dirty, onSave }: SaveAction) {
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  useEffect(() => {
    if (!dirty) return;
    const t = window.setTimeout(() => { onSaveRef.current(); pingSaved(); }, 500);
    return () => window.clearTimeout(t);
  }, [dirty]);
}

// Legacy slot — the button is gone; the global SavedPill replaces it.
export function SettingsSaveSlot() {
  return null;
}
