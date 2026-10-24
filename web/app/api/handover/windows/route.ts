import { handleAuthed } from "@/lib/http";
import { suggestWindows } from "@/lib/services/handover";

export function GET() {
  return handleAuthed("handover", (ctx) => Response.json(suggestWindows(ctx.db, ctx.now)));
}
