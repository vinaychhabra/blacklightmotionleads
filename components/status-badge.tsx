import type { LeadStatus } from "@/lib/supabase/types";

const STYLES: Record<LeadStatus, string> = {
  "New": "bg-ink-dim/15 text-ink-dim",
  "Contacted": "bg-cyan/15 text-cyan",
  "Follow-up": "bg-amber/15 text-amber",
  "No Response": "bg-danger/10 text-danger/80",
  "Interested": "bg-success/15 text-success",
  "Client Denied": "bg-danger/15 text-danger",
  "Converted": "bg-purple-400/15 text-purple-400",
};

export function StatusBadge({ status }: { status: LeadStatus }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
        STYLES[status] || STYLES["New"]
      }`}
    >
      {status}
    </span>
  );
}
