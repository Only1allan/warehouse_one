import { CountFlow } from "@/components/count-flow";
import { PageHeader } from "@/components/ui";

export default function CountPage() {
  return (
    <>
      <PageHeader
        title="Count"
        description="Count a shelf and see the variance against what the records expect."
      />
      <CountFlow />
    </>
  );
}
