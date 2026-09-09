import { PageHeader } from "@/components/page-header";
import { LeadsView } from "@/components/leads-view";

export default function LeadsPage() {
  return (
    <div>
      <PageHeader title="Leads" />
      <LeadsView />
    </div>
  );
}
