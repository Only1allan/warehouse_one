import { handleAuthed } from "@/lib/http";
import { getPurchaseOrder } from "@/lib/services/receiving";

export function GET(_request: Request, route: RouteContext<"/api/receiving/po/[po]">) {
  return handleAuthed("receive", async (ctx) => {
    const { po } = await route.params;
    return Response.json(getPurchaseOrder(ctx.db, po));
  });
}
