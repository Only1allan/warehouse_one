import { HandoverPanel } from "@/components/handover-panel";
import { PageHeader } from "@/components/ui";

export default function Page() {
  return (
    <>
      <PageHeader title="Shift handover" description="Summarise a shift for the next lead, with the numbers beside the words." />
      <HandoverPanel />
    </>
  );
}
