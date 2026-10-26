import { DispatchAccuracyPanel } from "@/components/shipments-dashboard";
import { PageHeader } from "@/components/ui";

export default function Page() {
  return (
    <>
      <PageHeader title="Dispatch accuracy" description="How often loads match their orders, and where they did not." />
      <DispatchAccuracyPanel />
    </>
  );
}
