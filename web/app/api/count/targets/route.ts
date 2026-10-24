import { getSeededDb } from "@/lib/db/runtime";
import { handle } from "@/lib/http";
import { listCountTargets } from "@/lib/services/counting";

export function GET(request: Request) {
  return handle(() => {
    const q = new URL(request.url).searchParams.get("q") ?? "";
    return Response.json(listCountTargets(getSeededDb(), q).slice(0, 40));
  });
}
