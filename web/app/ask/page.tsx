import { PageHeader, Panel } from "@/components/ui";

export default function AskPage() {
  return (
    <>
      <PageHeader
        title="Ask"
        description="Ask about procedures, stock levels and locations. Answers come from your own documents and records."
      />
      <Panel>
        <p className="text-soft">
          Questions about stock use the inventory records, so the numbers are exact. Questions about
          procedures cite the document they came from.
        </p>
      </Panel>
    </>
  );
}
