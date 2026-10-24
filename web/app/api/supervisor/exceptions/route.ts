import { getSeededDb } from "@/lib/db/runtime";
import { handle } from "@/lib/http";
import { listExceptions } from "@/lib/services/exceptions";

export function GET(request: Request) {
  return handle(() => {
    const params = new URL(request.url).searchParams;
    return Response.json(
      listExceptions(getSeededDb(), { kind: params.get("kind"), shiftId: params.get("shift") }),
    );
  });
}
