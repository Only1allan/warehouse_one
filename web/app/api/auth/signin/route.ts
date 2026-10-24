import { startSession } from "@/lib/auth/server";
import { getSeededDb } from "@/lib/db/runtime";
import { handle, readJson } from "@/lib/http";
import { signIn } from "@/lib/services/auth";

export function POST(request: Request) {
  return handle(async () => {
    const body = await readJson<{ username: string; password: string; shiftId?: string }>(request);
    const { user, shiftId } = signIn(getSeededDb(), body, new Date());
    await startSession(user, shiftId);
    return Response.json({ user, shiftId });
  });
}
