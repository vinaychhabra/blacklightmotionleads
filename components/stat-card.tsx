import type { LucideIcon } from "lucide-react";

export function StatCard({
  value,
  label,
  icon: Icon,
  accent = false,
}: {
  value: string | number;
  label: string;
  icon?: LucideIcon;
  accent?: boolean;
}) {
  return (
    <div className="soft-card rounded-lg p-4 transition-colors duration-200 hover:border-amber/30">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-dim">{label}</span>
        {Icon && (
          <span
            className={`flex h-7 w-7 items-center justify-center rounded-md ${
              accent ? "bg-amber/15 text-amber" : "bg-row text-ink-dim"
            }`}
          >
            <Icon size={14} strokeWidth={2.2} />
          </span>
        )}
      </div>
      <div className="metric-value font-display text-2xl font-bold leading-none text-ink">{value}</div>
    </div>
  );
}
