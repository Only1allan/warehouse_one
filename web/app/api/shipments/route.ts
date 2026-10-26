import { handleAuthed } from "@/lib/http";
import { listShipments } from "@/lib/services/logistics";

export function GET() {
  return handleAuthed("shipments_view", (ctx) => Response.json(listShipments(ctx.db)));
}
