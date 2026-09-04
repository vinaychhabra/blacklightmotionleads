import type { Priority } from "@/lib/supabase/types";

const COLORS: Record<Priority, string> = {
  Hot: "bg-danger shadow-[0_0_6px_rgba(192,82,74,0.6)]",
  Warm: "bg-amber",
  Cold: "bg-blue-400",
};

export function PriorityDot({ priority }: { priority: Priority }) {
  return (
    <span
      title={`${priority} priority`}
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${COLORS[priority] || COLORS.Warm}`}
    />
  );
}
