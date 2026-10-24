import { StockWorkspace } from "@/components/stock-workspace";
import { PageHeader } from "@/components/ui";

export default function StockPage() {
  return (
    <>
      <PageHeader
        title="Stock records"
        description="Search every product, see where it is and how it has moved, and reconcile counts that show a variance."
      />
      <StockWorkspace />
    </>
  );
}
