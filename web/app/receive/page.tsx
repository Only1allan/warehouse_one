import { PageHeader, Panel } from "@/components/ui";

export default function ReceivePage() {
  return (
    <>
      <PageHeader
        title="Receive"
        description="Check a delivery against its purchase order and see exactly what is missing or extra."
      />
      <Panel>
        <p className="text-soft">
          Choose a purchase order, enter what actually arrived, and confirm the receipt. Stock only
          changes when you confirm.
        </p>
      </Panel>
    </>
  );
}
