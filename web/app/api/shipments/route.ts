import { handleAuthed } from "@/lib/http";
import { dispatchAccuracy, listShipments, processCompliance } from "@/lib/services/logistics";

export function GET() {
  return handleAuthed("shipments_view", (ctx) =>
    Response.json({
      shipments: listShipments(ctx.db),
      accuracy: dispatchAccuracy(ctx.db),
      compliance: processCompliance(ctx.db),
    }),
  );
}
