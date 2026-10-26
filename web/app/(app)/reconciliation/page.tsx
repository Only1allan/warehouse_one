import { Reconcile } from "@/components/stock-workspace";
import { PageHeader } from "@/components/ui";

export default function ReconciliationPage() {
  return (
    <>
      <PageHeader
        title="Reconciliation"
        description="Every count that disagreed with the records, waiting for your decision: correct the stock, or keep it and say why."
      />
      <Reconcile />
    </>
  );
}
