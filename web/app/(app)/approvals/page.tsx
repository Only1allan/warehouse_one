import { Reconcile } from "@/components/stock-workspace";
import { PageHeader } from "@/components/ui";

export default function ApprovalsPage() {
  return (
    <>
      <PageHeader
        title="Stock approvals"
        description="Counts from the floor that disagree with the records. Only a supervisor or inventory controller can change stock."
      />
      <Reconcile />
    </>
  );
}
