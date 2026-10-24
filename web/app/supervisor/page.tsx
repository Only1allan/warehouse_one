import { PageHeader, Panel } from "@/components/ui";

export default function SupervisorPage() {
  return (
    <>
      <PageHeader
        title="Supervisor"
        description="Exceptions raised on the floor, in one list."
      />
      <Panel>
        <p className="text-soft">
          Receiving discrepancies, count variances, dispatch shortfalls and equipment issues appear
          here as they are recorded.
        </p>
      </Panel>
    </>
  );
}
