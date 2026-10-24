import { handleAuthed } from "@/lib/http";
import { listExceptions } from "@/lib/services/exceptions";

export function GET(request: Request) {
  return handleAuthed("exceptions_view", (ctx) => {
    const params = new URL(request.url).searchParams;
    return Response.json(listExceptions(ctx.db, { kind: params.get("kind"), shiftId: params.get("shift") }));
  });
}
