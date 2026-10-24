import { handleAuthed, readJson } from "@/lib/http";
import { compareDispatch, type LoadedLineInput } from "@/lib/services/dispatch";

export function POST(request: Request) {
  return handleAuthed("dispatch", async (ctx) => {
    const body = await readJson<{ orderNumber: string; lines: LoadedLineInput[] }>(request);
    return Response.json(compareDispatch(ctx.db, body));
  });
}
