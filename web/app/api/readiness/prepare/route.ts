import { connection } from "next/server";
import { getModelPort } from "@/lib/ai/qvac/qvac-model-port";
import type { PrepareProgress } from "@/lib/ai/model-port";
import { requireAuth } from "@/lib/auth/server";
import { getSeededDb } from "@/lib/db/runtime";
import { errorResponse } from "@/lib/errors";

const encoder = new TextEncoder();

export async function POST() {
  try {
    await connection();
    await requireAuth(getSeededDb(), "readiness");
    const port = getModelPort();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (data: unknown) =>
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        try {
          await port.prepare((progress: PrepareProgress) => send({ type: "progress", ...progress }));
          send({ type: "done" });
        } catch (error) {
          send({
            type: "error",
            message:
              error instanceof Error
                ? `Preparing failed: ${error.message}. Check the network connection and try again.`
                : "Preparing failed.",
          });
        } finally {
          controller.close();
        }
      },
    });
    return new Response(stream, {
      headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
