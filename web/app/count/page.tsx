import { PageHeader, Panel } from "@/components/ui";

export default function CountPage() {
  return (
    <>
      <PageHeader
        title="Count"
        description="Count a shelf and see the variance against what the records expect."
      />
      <Panel>
        <p className="text-soft">
          Pick a location, count it, and confirm. Any variance is raised for the supervisor. Stock is
          adjusted only when a supervisor approves.
        </p>
      </Panel>
    </>
  );
}
