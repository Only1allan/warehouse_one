import { handleAuthed } from "@/lib/http";
import { listCategories, searchStock } from "@/lib/services/stock";

export function GET(request: Request) {
  return handleAuthed("stock_records", (ctx) => {
    const params = new URL(request.url).searchParams;
    return Response.json({
      rows: searchStock(ctx.db, { q: params.get("q") ?? "", category: params.get("category") ?? "" }),
      categories: listCategories(ctx.db),
    });
  });
}
