import { StockRecords } from "@/components/stock-workspace";
import { PageHeader } from "@/components/ui";

export default function StockPage() {
  return (
    <>
      <PageHeader
        title="Stock records"
        description="Search every product. Open one to see where it is, how it has moved, what is on the way and what is promised."
      />
      <StockRecords />
    </>
  );
}
