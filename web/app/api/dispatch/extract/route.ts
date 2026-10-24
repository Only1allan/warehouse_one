import { getModelPort } from "@/lib/ai/qvac/qvac-model-port";
import { AppError } from "@/lib/errors";
import { handleAuthed } from "@/lib/http";
import { readDocument } from "@/lib/services/document-reading";

const MAX_BYTES = 15 * 1024 * 1024;

export function POST(request: Request) {
  return handleAuthed("dispatch", async (ctx) => {
    const form = await request.formData();
    const file = form.get("image");
    if (!(file instanceof File) || file.size === 0) {
      throw new AppError("invalid_request", "Choose or take a photo of the loading sheet.");
    }
    if (file.size > MAX_BYTES) throw new AppError("invalid_request", "That photo is too large. Try a smaller one.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    return Response.json(await readDocument({ db: ctx.db, model: getModelPort() }, bytes, "loading_sheet"));
  });
}
