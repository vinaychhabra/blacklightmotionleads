export function BreakdownSection({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; count: number }[];
}) {
  const nonZero = rows.filter((r) => r.count > 0);
  const maxCount = Math.max(...nonZero.map((r) => r.count), 1);

  return (
    <div className="mb-6">
      <h3 className="mb-3 font-display text-sm font-bold text-ink">{title}</h3>
      {nonZero.length === 0 ? (
        <p className="text-xs text-ink-dim">No data yet.</p>
      ) : (
        <div className="space-y-2">
          {nonZero.map((r) => (
            <div key={r.label} className="flex items-center gap-3 text-xs">
              <div className="w-32 shrink-0 truncate text-ink-dim">{r.label}</div>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-row">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber to-cyan"
                  style={{ width: `${(r.count / maxCount) * 100}%` }}
                />
              </div>
              <div className="w-8 shrink-0 text-right font-mono text-ink-dim">{r.count}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
