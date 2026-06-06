"use client";

// ─── useScopedSetting ─────────────────────────────────────
// The React entry point for a cascading setting. Reads the value resolved at the
// active layer (from SettingsScopeProvider), tells you whether it's inherited or
// overridden here, and lets you save / override / reset at the active layer.
//
// Pass a STABLE defaultValue (module constant or useMemo) — it's the built-in
// base the cascade falls back to.

import { useCallback, useEffect, useState } from "react";
import { useSettingsScope } from "@/components/providers/SettingsScopeProvider";
import {
  chainFrom, hasScoped, readChain, scopeKeyFor, writeScoped, clearScoped,
  type Source,
} from "./store";

export interface ScopedSetting<T> {
  value: T;
  source: Source;            // where the value came from
  isOverride: boolean;       // an explicit value exists at the active layer
  parentSource: Source;      // where it would fall back to on reset
  save: (v: T) => void;      // write an explicit value at the active layer
  override: () => void;      // copy the inherited value down to the active layer
  reset: () => void;         // remove the explicit value at the active layer
}

export function useScopedSetting<T>(key: string, defaultValue: T): ScopedSetting<T> {
  const { activeLayer, companyId, locationId, serviceAreaId } = useSettingsScope();
  const [version, setVersion] = useState(0);

  const compute = useCallback(() => {
    const ids = { companyId, locationId, serviceAreaId };
    const chain = chainFrom(activeLayer, ids);
    const activeKey = scopeKeyFor(activeLayer, ids);
    const resolved = readChain<T>(key, chain, defaultValue);
    const parent = readChain<T>(key, chain.slice(1), defaultValue);
    return {
      value: resolved.value, source: resolved.source,
      isOverride: hasScoped(key, activeKey),
      parentSource: parent.source,
      activeKey,
    };
  }, [key, activeLayer, companyId, locationId, serviceAreaId, defaultValue]);

  // First render is the built-in default on both server and client (no store
  // read) to avoid a hydration mismatch; the effect then resolves from storage.
  const [snap, setSnap] = useState<{
    value: T; source: Source; isOverride: boolean; parentSource: Source; activeKey: string;
  }>(() => ({
    value: defaultValue, source: "default", isOverride: false, parentSource: "default",
    activeKey: scopeKeyFor(activeLayer, { companyId, locationId, serviceAreaId }),
  }));
  useEffect(() => { setSnap(compute()); }, [compute, version]);

  const bump = () => setVersion(v => v + 1);

  return {
    value: snap.value,
    source: snap.source,
    isOverride: snap.isOverride,
    parentSource: snap.parentSource,
    save: (v: T) => { writeScoped(key, snap.activeKey, v); bump(); },
    override: () => { writeScoped(key, snap.activeKey, snap.value); bump(); },
    reset: () => { clearScoped(key, snap.activeKey); bump(); },
  };
}
