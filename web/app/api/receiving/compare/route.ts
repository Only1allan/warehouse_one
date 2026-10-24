import { getSeededDb } from "@/lib/db/runtime";
import { handle, readJson } from "@/lib/http";
import { compareReceipt, type ReceivedLineInput } from "@/lib/services/receiving";

export function POST(request: Request) {
  return handle(async () => {
    const body = await readJson<{ poNumber: string; lines: ReceivedLineInput[] }>(request);
    return Response.json(compareReceipt(getSeededDb(), body));
  });
}
