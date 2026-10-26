import { getModelPort } from "@/lib/ai/qvac/qvac-model-port";
import { AppError } from "@/lib/errors";
import { handleAuthed } from "@/lib/http";
import { getCountTarget } from "@/lib/services/counting";
import { saveCountPhoto } from "@/lib/services/uploads";

const MAX_BYTES = 15 * 1024 * 1024;

export function POST(request: Request) {
  return handleAuthed("count", async (ctx) => {
    const form = await request.formData();
    const file = form.get("image");
    const sku = String(form.get("sku") ?? "");
    const locationId = String(form.get("locationId") ?? "");
    if (!(file instanceof File) || file.size === 0) throw new AppError("invalid_request", "Take or choose a photo of the shelf.");
    if (file.size > MAX_BYTES) throw new AppError("invalid_request", "That photo is too large. Try a smaller one.");
    const target = getCountTarget(ctx.db, sku, locationId);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const small = form.get("visionImage");
    const visionBytes = small instanceof File && small.size > 0 ? new Uint8Array(await small.arrayBuffer()) : bytes;
    const photoPath = saveCountPhoto(bytes);
    try {
      const proposal = await getModelPort().proposeCount(visionBytes, { sku, productName: target.name });
      return Response.json({ photoPath, proposedQty: proposal.count, note: proposal.note ?? null });
    } catch {
      return Response.json({
        photoPath,
        proposedQty: null,
        note: "Photo counting is not ready. Count by hand, or open Readiness and run Prepare offline.",
      });
    }
  });
}
