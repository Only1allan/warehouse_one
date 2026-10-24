import { getSeededDb } from "@/lib/db/runtime";
import { handle, readJson } from "@/lib/http";
import { confirmReceipt, type ConfirmReceiptInput } from "@/lib/services/receiving";

export function POST(request: Request) {
  return handle(async () => {
    const body = await readJson<ConfirmReceiptInput>(request);
    return Response.json(confirmReceipt(getSeededDb(), { now: new Date() }, body));
  });
}
