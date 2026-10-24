import { DispatchFlow } from "@/components/dispatch-flow";
import { PageHeader } from "@/components/ui";

export default function DispatchPage() {
  return (
    <>
      <PageHeader
        title="Dispatch"
        description="Check what was loaded against the order before the truck leaves."
      />
      <DispatchFlow />
    </>
  );
}
