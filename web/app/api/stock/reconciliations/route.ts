import { handleAuthed } from "@/lib/http";
import { listReconciliations } from "@/lib/services/stock";

export function GET() {
  return handleAuthed("stock_adjust", (ctx) => Response.json(listReconciliations(ctx.db)));
}
