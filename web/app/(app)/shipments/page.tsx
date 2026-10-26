import { ShipmentList } from "@/components/shipments-dashboard";
import { PageHeader } from "@/components/ui";

export default function Page() {
  return (
    <>
      <PageHeader title="Shipments" description="Every order, where it is going, and whether it left in full." />
      <ShipmentList />
    </>
  );
}
