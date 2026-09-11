"use client";

import { Columns3 } from "lucide-react";

export function ColumnChooser<T extends string>({
  columns,
  labels,
  onChange,
}: {
  columns: Record<T, boolean>;
  labels: Record<T, string>;
  onChange: (column: T, visible: boolean) => void;
}) {
  return (
    <details className="relative">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-ink-dim hover:text-ink">
        <Columns3 size={13} /> Columns
      </summary>
      <div className="absolute right-0 z-20 mt-1 w-48 rounded-lg border border-border bg-panel p-2 shadow-xl">
        <p className="mb-1 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-ink-dim">Show columns</p>
        {(Object.keys(labels) as T[]).map((column) => (
          <label key={column} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs text-ink hover:bg-row">
            <input type="checkbox" checked={columns[column]} onChange={(event) => onChange(column, event.target.checked)} className="accent-amber" />
            {labels[column]}
          </label>
        ))}
      </div>
    </details>
  );
}
