import { getModelPort } from "@/lib/ai/qvac/qvac-model-port";
import { AppError } from "@/lib/errors";
import { handleAuthed, readJson } from "@/lib/http";
import { askCopilot, type AskInput } from "@/lib/services/ask";
import { sseResponse } from "@/lib/sse";

export function POST(request: Request) {
  return handleAuthed("ask", async (ctx) => {
    const input = await readJson<AskInput>(request);
    if (typeof input.message !== "string" || !input.message.trim()) {
      throw new AppError("invalid_request", "Type or say a question first.");
    }
    const controller = new AbortController();
    request.signal.addEventListener("abort", () => controller.abort(), { once: true });
    const events = askCopilot(
      { db: ctx.db, model: getModelPort(), now: () => new Date() },
      { message: input.message.trim(), history: input.history, context: input.context },
      controller.signal,
    );
    return sseResponse(events, controller.signal, () => controller.abort());
  });
}
