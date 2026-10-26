import { CompliancePanel } from "@/components/shipments-dashboard";
import { PageHeader } from "@/components/ui";

export default function Page() {
  return (
    <>
      <PageHeader title="Process compliance" description="How well receiving, dispatch and counting follow procedure, from the recorded checks." />
      <CompliancePanel />
    </>
  );
}
