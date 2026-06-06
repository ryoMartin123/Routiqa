"use client";

// ─── Settings action slot ─────────────────────────────────
// Lets a settings section publish its Save action up to a shared slot rendered
// above the Editing Scope header (top-right), so every section's save lives in
// the same place — clean and consistent — instead of inside each section.

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";

export interface SaveAction {
  dirty: boolean;
  saved: boolean;
  onSave: () => void;
  label?: string;
}

interface Ctx { action: SaveAction | null; setAction: (a: SaveAction | null) => void; }
const SettingsActionsCtx = createContext<Ctx | null>(null);

export function SettingsActionsProvider({ children }: { children: React.ReactNode }) {
  const [action, setAction] = useState<SaveAction | null>(null);
  return <SettingsActionsCtx.Provider value={{ action, setAction }}>{children}</SettingsActionsCtx.Provider>;
}

function useCtx(): Ctx {
  const ctx = useContext(SettingsActionsCtx);
  if (!ctx) throw new Error("useSettingsActions must be used within SettingsActionsProvider");
  return ctx;
}

// A section calls this to register its Save action. onSave is kept fresh via a
// ref so the slot always runs the latest handler; re-registers only when the
// dirty/saved state changes (no render loop).
export function useRegisterSaveAction({ dirty, saved, onSave, label }: SaveAction) {
  const { setAction } = useCtx();
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  useEffect(() => {
    setAction({ dirty, saved, label, onSave: () => onSaveRef.current() });
    return () => setAction(null);
  }, [dirty, saved, label, setAction]);
}

// The slot itself — rendered above the Editing Scope header.
export function SettingsSaveSlot() {
  const { action } = useCtx();
  if (!action) return null;
  const { dirty, saved, onSave, label } = action;
  return (
    <button onClick={onSave} disabled={!dirty && !saved}
      data-active={dirty || saved ? "true" : "false"}
      className="glossy-pill inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 disabled:opacity-50 shrink-0"
      style={{ cursor: dirty ? "pointer" : "default" }}>
      <Check className="w-3.5 h-3.5" /> {saved ? "Saved" : (label ?? "Save changes")}
    </button>
  );
}
