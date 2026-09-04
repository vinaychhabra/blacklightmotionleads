import type { LucideIcon } from "lucide-react";

export function ComingSoon({
  icon: Icon,
  phase,
  description,
}: {
  icon: LucideIcon;
  phase: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-panel px-8 py-16 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-amber/15 to-cyan/15">
        <Icon size={22} className="text-amber" />
      </div>
      <p className="mb-1 text-sm font-semibold text-ink">{phase}</p>
      <p className="max-w-sm text-xs text-ink-dim">{description}</p>
    </div>
  );
}
