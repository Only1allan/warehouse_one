import { PageHeader } from "@/components/ui";
import { SupervisorExceptions } from "@/components/supervisor-exceptions";

export default function SupervisorPage() {
  return (
    <>
      <PageHeader
        title="Supervisor"
        description="Exceptions raised on the floor, in one list. Open a row to see the record behind it."
      />
      <SupervisorExceptions />
    </>
  );
}
