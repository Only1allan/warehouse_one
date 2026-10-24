import { handleAuthed, readJson } from "@/lib/http";
import { adjustStockFromCount } from "@/lib/services/counting";

export function POST(request: Request) {
  return handleAuthed("stock_adjust", async (ctx) => {
    const body = await readJson<{ countId: number }>(request);
    return Response.json(
      adjustStockFromCount(ctx.db, { now: ctx.now }, { countId: body.countId, operatorId: ctx.user.id, shiftId: ctx.shiftId }),
    );
  });
}
