import { handleAuthed, readJson } from "@/lib/http";
import { compareReceipt, type ReceivedLineInput } from "@/lib/services/receiving";

export function POST(request: Request) {
  return handleAuthed("receive", async (ctx) => {
    const body = await readJson<{ poNumber: string; lines: ReceivedLineInput[] }>(request);
    return Response.json(compareReceipt(ctx.db, body));
  });
}
