import { handleAuthed, readJson } from "@/lib/http";
import { reportEquipmentIssue } from "@/lib/services/exceptions";

export function POST(request: Request) {
  return handleAuthed("equipment_report", async (ctx) => {
    const body = await readJson<{ equipment: string; description: string }>(request);
    return Response.json(
      reportEquipmentIssue(ctx.db, { now: ctx.now }, { ...body, operatorId: ctx.user.id, shiftId: ctx.shiftId }),
    );
  });
}
