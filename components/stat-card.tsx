export function StatCard({
  value,
  label,
  accent = false,
}: {
  value: string | number;
  label: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-panel p-4">
      <div
        className={`font-display text-2xl font-bold ${
          accent
            ? "bg-gradient-to-r from-amber to-cyan bg-clip-text text-transparent"
            : "text-ink"
        }`}
      >
        {value}
      </div>
      <div className="mt-1 text-[10.5px] uppercase tracking-wide text-ink-dim">{label}</div>
    </div>
  );
}
