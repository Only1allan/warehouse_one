import { handleAuthed, readJson } from "@/lib/http";
import { confirmReceipt, type ConfirmReceiptInput } from "@/lib/services/receiving";

export function POST(request: Request) {
  return handleAuthed("receive", async (ctx) => {
    const body = await readJson<ConfirmReceiptInput>(request);
    return Response.json(
      confirmReceipt(ctx.db, { now: ctx.now }, { ...body, operatorId: ctx.user.id, shiftId: ctx.shiftId }),
    );
  });
}
