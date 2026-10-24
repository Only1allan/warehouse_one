import { HealthDashboard } from "@/components/health-dashboard";
import { PageHeader } from "@/components/ui";

export default function Page() {
  return (
    <>
      <PageHeader title="Inventory health" description="Stock that needs a decision, each with a clear next step." />
      <HealthDashboard />
    </>
  );
}
