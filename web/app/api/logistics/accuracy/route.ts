import { handleAuthed } from "@/lib/http";
import { dispatchAccuracy } from "@/lib/services/logistics";

export function GET() {
  return handleAuthed("logistics_metrics", (ctx) => Response.json(dispatchAccuracy(ctx.db)));
}
