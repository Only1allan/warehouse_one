import { handleAuthed } from "@/lib/http";
import { buildCountPlan } from "@/lib/services/count-plan";

export function GET() {
  return handleAuthed("count_plan", (ctx) => Response.json(buildCountPlan(ctx.db, ctx.now, 20)));
}
