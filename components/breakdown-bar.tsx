export function BreakdownSection({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; count: number }[];
}) {
  const nonZero = rows.filter((r) => r.count > 0);
  const maxCount = Math.max(...nonZero.map((r) => r.count), 1);
  const total = nonZero.reduce((sum, r) => sum + r.count, 0);

  return (
    <div className="panel-surface rounded-lg p-4">
      <div className="mb-3.5 flex items-center justify-between">
        <h3 className="font-display text-sm font-semibold text-ink">{title}</h3>
        {total > 0 && <span className="text-[11px] text-ink-dim">{total} total</span>}
      </div>
      {nonZero.length === 0 ? (
        <p className="text-xs text-ink-dim">No data yet.</p>
      ) : (
        <div className="space-y-3">
          {nonZero.map((r) => (
            <div key={r.label} className="flex items-center gap-3 text-[12px]">
              <div className="w-24 shrink-0 truncate text-ink-dim md:w-28">{r.label}</div>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-row">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber to-cyan"
                  style={{ width: `${(r.count / maxCount) * 100}%` }}
                />
              </div>
              <div className="w-7 shrink-0 text-right font-mono text-[11px] font-medium text-ink">{r.count}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
