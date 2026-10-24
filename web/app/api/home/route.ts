import { handleAuthed } from "@/lib/http";
import { getHome } from "@/lib/services/home";

export function GET() {
  return handleAuthed(null, (ctx) => Response.json(getHome(ctx.db, ctx.user, ctx.now)));
}
