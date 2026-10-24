import { handleAuthed } from "@/lib/http";
import { getExceptionDetail } from "@/lib/services/exceptions";

export function GET(_request: Request, route: RouteContext<"/api/supervisor/exceptions/[id]">) {
  return handleAuthed("exceptions_view", async (ctx) => {
    const { id } = await route.params;
    return Response.json(getExceptionDetail(ctx.db, Number(id)));
  });
}
