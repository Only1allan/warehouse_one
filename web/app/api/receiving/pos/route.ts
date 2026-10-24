import { handleAuthed } from "@/lib/http";
import { listPurchaseOrders } from "@/lib/services/receiving";

export function GET() {
  return handleAuthed("receive", (ctx) => Response.json(listPurchaseOrders(ctx.db, { status: "open" })));
}
