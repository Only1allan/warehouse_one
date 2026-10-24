import { handleAuthed } from "@/lib/http";
import { listOrders } from "@/lib/services/dispatch";

export function GET() {
  return handleAuthed("dispatch", (ctx) => Response.json(listOrders(ctx.db, { status: "open" })));
}
