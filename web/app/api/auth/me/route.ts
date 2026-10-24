import { readSession } from "@/lib/auth/server";
import { getSeededDb } from "@/lib/db/runtime";
import { handle } from "@/lib/http";
import { listShifts } from "@/lib/services/auth";

export function GET() {
  return handle(async () => {
    const db = getSeededDb();
    const session = await readSession(db);
    return Response.json({
      user: session?.user ?? null,
      shiftId: session?.shiftId ?? null,
      shifts: listShifts(db),
    });
  });
}
