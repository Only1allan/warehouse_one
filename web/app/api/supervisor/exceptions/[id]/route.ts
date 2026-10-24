import { getSeededDb } from "@/lib/db/runtime";
import { handle } from "@/lib/http";
import { getExceptionDetail } from "@/lib/services/exceptions";

export function GET(_request: Request, ctx: RouteContext<"/api/supervisor/exceptions/[id]">) {
  return handle(async () => {
    const { id } = await ctx.params;
    return Response.json(getExceptionDetail(getSeededDb(), Number(id)));
  });
}
