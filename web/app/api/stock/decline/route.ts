import { handleAuthed, readJson } from "@/lib/http";
import { declineAdjustment } from "@/lib/services/stock";

export function POST(request: Request) {
  return handleAuthed("stock_adjust", async (ctx) => {
    const body = await readJson<{ countId: number; reason?: string }>(request);
    return Response.json(
      declineAdjustment(ctx.db, { now: ctx.now }, { ...body, operatorId: ctx.user.id, shiftId: ctx.shiftId }),
    );
  });
}
