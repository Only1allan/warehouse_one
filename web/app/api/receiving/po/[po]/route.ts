import { getSeededDb } from "@/lib/db/runtime";
import { handle } from "@/lib/http";
import { getPurchaseOrder } from "@/lib/services/receiving";

export function GET(_request: Request, ctx: RouteContext<"/api/receiving/po/[po]">) {
  return handle(async () => {
    const { po } = await ctx.params;
    return Response.json(getPurchaseOrder(getSeededDb(), po));
  });
}
