import { describe, expect, it } from "vitest";
import { FakeModelPort } from "@/lib/ai/fake-model-port";
import type { AskEvent } from "@/lib/ai/model-port";

async function collect(events: AsyncIterable<AskEvent>): Promise<AskEvent[]> {
  const out: AskEvent[] = [];
  for await (const event of events) out.push(event);
  return out;
}

describe("FakeModelPort", () => {
  it("replays a scripted tool call followed by text, then finishes", async () => {
    const port = new FakeModelPort().queueTurn({
      toolCalls: [{ name: "get_stock_level", arguments: { query: "generators" } }],
      tokens: ["We have ", "stock."],
    });
    const events = await collect(
      port.ask({ messages: [{ role: "user", content: "How many generators?" }] }),
    );
    expect(events.map((e) => e.type)).toEqual(["toolCall", "token", "token", "done"]);
    expect(events[0]).toMatchObject({
      name: "get_stock_level",
      arguments: { query: "generators" },
    });
  });

  it("records every request so tests can assert on what the app asked", async () => {
    const port = new FakeModelPort();
    await collect(port.ask({ messages: [{ role: "user", content: "hi" }] }));
    expect(port.askRequests).toHaveLength(1);
    expect(port.askRequests[0].messages[0].content).toBe("hi");
  });

  it("stops generating as soon as the request is cancelled", async () => {
    const port = new FakeModelPort().queueTurn({
      tokens: ["a", "b", "c", "d"],
    });
    const controller = new AbortController();
    const events: AskEvent[] = [];
    for await (const event of port.ask({
      messages: [{ role: "user", content: "go" }],
      signal: controller.signal,
    })) {
      events.push(event);
      if (event.type === "token" && event.text === "b") controller.abort();
    }
    const texts = events.filter((e) => e.type === "token");
    expect(texts).toHaveLength(2);
    expect(events.at(-1)).toEqual({ type: "done", stopReason: "cancelled" });
  });
});
