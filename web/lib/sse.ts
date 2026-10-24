const encoder = new TextEncoder();

export function sseResponse<T>(
  source: AsyncIterable<T>,
  signal: AbortSignal,
  onAbort?: () => void,
): Response {
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (data: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      try {
        for await (const item of source) {
          if (signal.aborted) break;
          send(item);
        }
      } catch (error) {
        send({
          type: "error",
          message: error instanceof Error ? error.message : "Unexpected error",
        });
      } finally {
        controller.close();
      }
    },
    cancel() {
      onAbort?.();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
