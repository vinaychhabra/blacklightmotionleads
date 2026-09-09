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
