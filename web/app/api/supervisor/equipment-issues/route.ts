import { getSeededDb } from "@/lib/db/runtime";
import { handle, readJson } from "@/lib/http";
import { reportEquipmentIssue } from "@/lib/services/exceptions";

export function POST(request: Request) {
  return handle(async () => {
    const body = await readJson<{ equipment: string; description: string; operatorId: string; shiftId: string }>(request);
    return Response.json(reportEquipmentIssue(getSeededDb(), { now: new Date() }, body));
  });
}
