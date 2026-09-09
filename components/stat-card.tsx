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
    <div className="glass-tile rounded-lg p-3.5">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[9.5px] font-semibold uppercase tracking-[0.18em] text-ink-dim">{label}</span>
        <span className={`h-2 w-2 rounded-full ${accent ? "bg-gradient-to-r from-amber to-cyan" : "bg-slate-300 dark:bg-slate-600"}`} />
      </div>
      <div
        className={`metric-value font-display text-xl font-bold leading-none md:text-2xl ${
          accent
            ? "bg-gradient-to-r from-amber to-cyan bg-clip-text text-transparent"
            : "text-ink"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
