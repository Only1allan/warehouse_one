import { AskChat } from "@/components/ask-chat";
import { PageHeader } from "@/components/ui";

export default function AskPage() {
  return (
    <>
      <PageHeader
        title="Ask"
        description="Ask about procedures, stock levels and locations. Answers come from your own documents and records."
      />
      <AskChat />
    </>
  );
}
