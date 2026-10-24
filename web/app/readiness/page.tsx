import { PageHeader } from "@/components/ui";
import { ReadinessPanel } from "@/components/readiness-panel";

export default function ReadinessPage() {
  return (
    <>
      <PageHeader
        title="Readiness"
        description="See what is stored on this device, and download anything missing once so everything works offline."
      />
      <ReadinessPanel />
    </>
  );
}
