import { handleAuthed } from "@/lib/http";
import { listCountTargets } from "@/lib/services/counting";

export function GET(request: Request) {
  return handleAuthed("count", (ctx) => {
    const q = new URL(request.url).searchParams.get("q") ?? "";
    return Response.json(listCountTargets(ctx.db, q).slice(0, 40));
  });
}
