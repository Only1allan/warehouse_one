import { endSession } from "@/lib/auth/server";
import { handle } from "@/lib/http";

export function POST() {
  return handle(async () => {
    await endSession();
    return Response.json({ signedOut: true });
  });
}
