import { connection } from "next/server";
import { getModelPort } from "@/lib/ai/qvac/qvac-model-port";
import { getSeededDb } from "@/lib/db/runtime";
import { AppError, errorResponse } from "@/lib/errors";
import { readJson } from "@/lib/http";
import { askCopilot, type AskInput } from "@/lib/services/ask";
import { sseResponse } from "@/lib/sse";

export async function POST(request: Request) {
  try {
    await connection();
    const input = await readJson<AskInput>(request);
    if (typeof input.message !== "string" || !input.message.trim()) {
      throw new AppError("invalid_request", "Type or say a question first.");
    }
    const controller = new AbortController();
    request.signal.addEventListener("abort", () => controller.abort(), { once: true });
    const events = askCopilot(
      { db: getSeededDb(), model: getModelPort(), now: () => new Date() },
      { message: input.message.trim(), history: input.history, context: input.context },
      controller.signal,
    );
    return sseResponse(events, controller.signal, () => controller.abort());
  } catch (error) {
    return errorResponse(error);
  }
}
