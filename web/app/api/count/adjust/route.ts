import { getSeededDb } from "@/lib/db/runtime";
import { handle, readJson } from "@/lib/http";
import { adjustStockFromCount } from "@/lib/services/counting";

export function POST(request: Request) {
  return handle(async () => {
    const body = await readJson<{ countId: number; operatorId: string; shiftId: string }>(request);
    return Response.json(adjustStockFromCount(getSeededDb(), { now: new Date() }, body));
  });
}
