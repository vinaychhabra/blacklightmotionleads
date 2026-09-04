export function FollowUpBadge({ dateStr }: { dateStr: string | null }) {
  if (!dateStr) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dateStr + "T00:00:00");
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86400000);

  let cls = "bg-ink-dim/15 text-ink-dim";
  let label = due.toLocaleDateString("en-IN", { day: "numeric", month: "short" });

  if (diffDays < 0) {
    cls = "bg-danger/15 text-danger";
    label = "Overdue " + label;
  } else if (diffDays === 0) {
    cls = "bg-amber/15 text-amber";
    label = "Due today";
  } else if (diffDays === 1) {
    label = "Tomorrow";
  }

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide ${cls}`}>
      {label}
    </span>
  );
}
