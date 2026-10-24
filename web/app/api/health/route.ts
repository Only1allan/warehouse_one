import { handleAuthed } from "@/lib/http";
import { getHealthReport } from "@/lib/services/health";

export function GET() {
  return handleAuthed("health_view", (ctx) => Response.json(getHealthReport(ctx.db, ctx.now)));
}
