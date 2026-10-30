import { handleAuthed, readJson } from "@/lib/http";
import { registerPurchaseOrder, type RegisterPurchaseOrderInput } from "@/lib/services/receiving";

export function POST(request: Request) {
  return handleAuthed("receive", async (ctx) => {
    const body = await readJson<Omit<RegisterPurchaseOrderInput, "operatorId" | "shiftId">>(request);
    return Response.json(
      registerPurchaseOrder(ctx.db, { now: ctx.now }, { ...body, operatorId: ctx.user.id, shiftId: ctx.shiftId }),
    );
  });
}
