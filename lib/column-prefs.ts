"use client";

import { useEffect, useState } from "react";

export interface ColumnPrefs {
  showEmail: boolean;
  showFollowUp: boolean;
  showSendCounts: boolean;
}

const DEFAULT_PREFS: ColumnPrefs = {
  showEmail: true,
  showFollowUp: true,
  showSendCounts: true,
};

const STORAGE_KEY = "blacklight-crm-column-prefs";

export function useColumnPrefs() {
  const [prefs, setPrefs] = useState<ColumnPrefs>(DEFAULT_PREFS);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(stored) });
    } catch {
      // ignore malformed storage, fall back to defaults
    }

  }, []);

  function updatePrefs(next: Partial<ColumnPrefs>) {
    setPrefs((prev) => {
      const merged = { ...prev, ...next };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      return merged;
    });
  }

  return { prefs, updatePrefs };
}

export function useTableColumns<T extends string>(tableId: string, defaults: Record<T, boolean>) {
  const storageKey = `blacklight-crm-columns-${tableId}`;
  const [columns, setColumns] = useState<Record<T, boolean>>(defaults);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) setColumns({ ...defaults, ...JSON.parse(stored) });
    } catch {
      // Keep the default visibility when saved preferences are unavailable.
    }
  }, [storageKey]);

  function setColumn(column: T, visible: boolean) {
    setColumns((previous) => {
      const next = { ...previous, [column]: visible };
      localStorage.setItem(storageKey, JSON.stringify(next));
      return next;
    });
  }

  return { columns, setColumn };
}
