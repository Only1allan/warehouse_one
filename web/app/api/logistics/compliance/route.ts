import { handleAuthed } from "@/lib/http";
import { processCompliance } from "@/lib/services/logistics";

export function GET() {
  return handleAuthed("logistics_metrics", (ctx) => Response.json(processCompliance(ctx.db)));
}
