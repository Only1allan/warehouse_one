import { handleAuthed } from "@/lib/http";
import { getStockDetail } from "@/lib/services/stock";

export function GET(_request: Request, route: RouteContext<"/api/stock/[sku]">) {
  return handleAuthed("stock_records", async (ctx) => {
    const { sku } = await route.params;
    return Response.json(getStockDetail(ctx.db, decodeURIComponent(sku)));
  });
}
