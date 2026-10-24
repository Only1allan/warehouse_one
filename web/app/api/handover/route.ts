import { getModelPort } from "@/lib/ai/qvac/qvac-model-port";
import { handleAuthed, readJson } from "@/lib/http";
import { generateHandover } from "@/lib/services/handover";

export function POST(request: Request) {
  return handleAuthed("handover", async (ctx) => {
    const body = await readJson<{ date: string; shiftId: string }>(request);
    return Response.json(await generateHandover({ db: ctx.db, model: getModelPort() }, body));
  });
}
