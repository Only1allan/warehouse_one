import { handleAuthed, readJson } from "@/lib/http";
import { confirmDispatch, type ConfirmDispatchInput } from "@/lib/services/dispatch";

export function POST(request: Request) {
  return handleAuthed("dispatch", async (ctx) => {
    const body = await readJson<ConfirmDispatchInput>(request);
    return Response.json(
      confirmDispatch(ctx.db, { now: ctx.now }, { ...body, operatorId: ctx.user.id, shiftId: ctx.shiftId }),
    );
  });
}
