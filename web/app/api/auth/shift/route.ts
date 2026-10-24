import { startSession } from "@/lib/auth/server";
import { AppError } from "@/lib/errors";
import { handleAuthed, readJson } from "@/lib/http";
import { isValidShift } from "@/lib/services/auth";

export function POST(request: Request) {
  return handleAuthed(null, async (ctx) => {
    const { shiftId } = await readJson<{ shiftId: string }>(request);
    if (!isValidShift(ctx.db, shiftId)) throw new AppError("invalid_request", "Unknown shift.");
    await startSession(ctx.user, shiftId);
    return Response.json({ shiftId });
  });
}
