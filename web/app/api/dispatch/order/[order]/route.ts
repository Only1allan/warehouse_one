import { handleAuthed } from "@/lib/http";
import { getOrder } from "@/lib/services/dispatch";

export function GET(_request: Request, route: RouteContext<"/api/dispatch/order/[order]">) {
  return handleAuthed("dispatch", async (ctx) => {
    const { order } = await route.params;
    return Response.json(getOrder(ctx.db, order));
  });
}
