import { getModelPort } from "@/lib/ai/qvac/qvac-model-port";
import { sseResponse } from "@/lib/sse";

export async function POST(request: Request) {
  const { prompt } = (await request.json()) as { prompt?: string };
  if (!prompt?.trim()) {
    return Response.json({ error: "prompt is required" }, { status: 400 });
  }
  const controller = new AbortController();
  request.signal.addEventListener("abort", () => controller.abort(), {
    once: true,
  });
  const events = getModelPort().ask({
    messages: [{ role: "user", content: prompt }],
    signal: controller.signal,
  });
  return sseResponse(events, controller.signal, () => controller.abort());
}
