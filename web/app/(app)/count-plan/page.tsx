import { CountPlan } from "@/components/count-plan";
import { PageHeader } from "@/components/ui";

export default function CountPlanPage() {
  return (
    <>
      <PageHeader title="Count plan" description="What to count next, and why." />
      <CountPlan />
    </>
  );
}
