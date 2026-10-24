import { getSeededDb } from "@/lib/db/runtime";
import { handle, readJson } from "@/lib/http";
import { confirmCount, type ConfirmCountInput } from "@/lib/services/counting";

export function POST(request: Request) {
  return handle(async () => {
    const body = await readJson<ConfirmCountInput>(request);
    return Response.json(confirmCount(getSeededDb(), { now: new Date() }, body));
  });
}
