import { PageHeader } from "@/components/page-header";
import { LeadsView } from "@/components/leads-view";

export default function FollowUpsPage() {
  return (
    <div>
      <PageHeader title="Follow-ups" subtitle="Leads due for a follow-up today or overdue." />
      <LeadsView dueOnly />
    </div>
  );
}
