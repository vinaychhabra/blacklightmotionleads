import { PageHeader } from "@/components/page-header";
import { LeadsView } from "@/components/leads-view";

export default function LeadsPage() {
  return (
    <div>
      <PageHeader title="Leads" subtitle="Every lead in one place — filter, edit, and send from here." />
      <LeadsView />
    </div>
  );
}
