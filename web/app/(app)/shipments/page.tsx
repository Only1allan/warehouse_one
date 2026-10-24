import { ShipmentsDashboard } from "@/components/shipments-dashboard";
import { PageHeader } from "@/components/ui";

export default function Page() {
  return (
    <>
      <PageHeader title="Shipments" description="Follow orders out of the door, and see how accurately they leave." />
      <ShipmentsDashboard />
    </>
  );
}
