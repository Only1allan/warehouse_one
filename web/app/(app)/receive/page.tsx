import { ReceiveFlow } from "@/components/receive-flow";
import { PageHeader } from "@/components/ui";

export default function ReceivePage() {
  return (
    <>
      <PageHeader
        title="Receive"
        description="Check a delivery against its purchase order and see exactly what is missing or extra."
      />
      <ReceiveFlow />
    </>
  );
}
