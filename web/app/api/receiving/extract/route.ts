import { getModelPort } from "@/lib/ai/qvac/qvac-model-port";
import { getSeededDb } from "@/lib/db/runtime";
import { AppError } from "@/lib/errors";
import { handle } from "@/lib/http";
import { readDocument } from "@/lib/services/document-reading";

const MAX_BYTES = 15 * 1024 * 1024;

export function POST(request: Request) {
  return handle(async () => {
    const form = await request.formData();
    const file = form.get("image");
    if (!(file instanceof File) || file.size === 0) {
      throw new AppError("invalid_request", "Choose or take a photo of the delivery note.");
    }
    if (file.size > MAX_BYTES) {
      throw new AppError("invalid_request", "That photo is too large. Try a smaller one.");
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const result = await readDocument({ db: getSeededDb(), model: getModelPort() }, bytes, "delivery_note");
    return Response.json(result);
  });
}
