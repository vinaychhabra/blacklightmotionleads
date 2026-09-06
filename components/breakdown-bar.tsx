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
    <div className="soft-card rounded-xl p-3.5 md:p-4">
      <h3 className="mb-3 font-display text-sm font-bold tracking-tight text-ink">{title}</h3>
      {nonZero.length === 0 ? (
        <p className="text-xs text-ink-dim">No data yet.</p>
      ) : (
        <div className="space-y-2.5">
          {nonZero.map((r) => (
            <div key={r.label} className="flex items-center gap-2.5 text-[11px]">
              <div className="w-24 shrink-0 truncate text-ink-dim md:w-28">{r.label}</div>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-row">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber via-cyan to-sky-500"
                  style={{ width: `${(r.count / maxCount) * 100}%` }}
                />
              </div>
              <div className="w-7 shrink-0 text-right font-mono text-ink-dim">{r.count}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
