import { Suspense } from "react";
import { CountFlow } from "@/components/count-flow";
import { PageHeader, Skeleton } from "@/components/ui";

export default function CountPage() {
  return (
    <>
      <PageHeader
        title="Count"
        description="Count a shelf, by hand or from a photo, and see the variance against what the records expect."
      />
      <Suspense fallback={<Skeleton className="h-40" />}>
        <CountFlow />
      </Suspense>
    </>
  );
}
