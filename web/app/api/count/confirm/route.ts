import { handleAuthed, readJson } from "@/lib/http";
import { confirmCount, type ConfirmCountInput } from "@/lib/services/counting";

export function POST(request: Request) {
  return handleAuthed("count", async (ctx) => {
    const body = await readJson<ConfirmCountInput>(request);
    return Response.json(
      confirmCount(ctx.db, { now: ctx.now }, { ...body, operatorId: ctx.user.id, shiftId: ctx.shiftId }),
    );
  });
}
