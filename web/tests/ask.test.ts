import { describe, expect, it } from "vitest";
import { FakeModelPort } from "@/lib/ai/fake-model-port";
import { COPILOT_TOOLS } from "@/lib/copilot/tools";
import { askCopilot, fallbackRoute, type AskInput, type AskStreamEvent } from "@/lib/services/ask";
import { dump, FIXED_NOW, freshDb } from "./helpers";

async function run(model: FakeModelPort, input: AskInput, db = freshDb(), signal?: AbortSignal) {
  const events: AskStreamEvent[] = [];
  for await (const e of askCopilot({ db, model, now: () => FIXED_NOW }, input, signal)) events.push(e);
  const card = events.find((e) => e.type === "card");
  return {
    events,
    card: card && card.type === "card" ? card.card : undefined,
    text: events.filter((e) => e.type === "token").map((e) => (e as { text: string }).text).join(""),
    context: events.find((e) => e.type === "context"),
  };
}

describe("ask: the model has no way to write", () => {
  it("is offered only read-only tools", () => {
    expect(COPILOT_TOOLS.map((t) => t.name).sort()).toEqual([
      "find_location",
      "get_po",
      "get_receiving_schedule",
      "get_stock_level",
      "list_below_minimum",
      "not_warehouse",
      "search_sops",
    ]);
  });

  it("never changes the database, whatever the model asks for", async () => {
    const db = freshDb();
    const before = dump(db);
    const model = new FakeModelPort().queueTurn({
      toolCalls: [{ name: "get_stock_level", arguments: { query: "generators; DROP TABLE stock" } }],
    });
    await run(model, { message: "How many generators?" }, db);
    expect(dump(db)).toEqual(before);
  });
});

describe("ask: inventory lookup", () => {
  it("answers 'How many generators do we have?' with the database figure", async () => {
    const model = new FakeModelPort().queueTurn({
      toolCalls: [{ name: "get_stock_level", arguments: { query: "generators" } }],
      tokens: ["We have 9999 generators."],
    });
    const result = await run(model, { message: "How many generators do we have?" });
    expect(result.text).toBe("We currently have 43 units of Portable Generator 5kW in stock.");
    expect(result.text).not.toContain("9999");
    expect(result.card).toMatchObject({ kind: "stock", total: 43 });
    expect(model.askRequests).toHaveLength(1);
  });

  it("answers 'Where is SKU 001254 stored?' with aisle, rack and shelf", async () => {
    const model = new FakeModelPort().queueTurn({
      toolCalls: [{ name: "find_location", arguments: { query: "001254" } }],
    });
    const result = await run(model, { message: "Where is SKU 001254 stored?" });
    expect(result.text).toBe("Portable Generator 5kW (SKU 001254) is in Aisle B, Rack 4, Shelf 2 (B-4-2).");
  });

  it("lists candidates when the words match several products and does not guess", async () => {
    const model = new FakeModelPort().queueTurn({
      toolCalls: [{ name: "get_stock_level", arguments: { query: "gloves" } }],
    });
    const result = await run(model, { message: "How many gloves?" });
    expect(result.card).toMatchObject({ kind: "candidates" });
    expect((result.card as { products: unknown[] }).products).toHaveLength(2);
    expect(result.text).toContain("Which one do you mean?");
    expect(result.context).toBeUndefined();
  });

  it("says so when the product is unknown", async () => {
    const model = new FakeModelPort().queueTurn({
      toolCalls: [{ name: "get_stock_level", arguments: { query: "unicorn saddle" } }],
    });
    const result = await run(model, { message: "unicorn saddle stock" });
    expect(result.card).toMatchObject({ kind: "not_found" });
    expect(result.text).toContain("couldn't find");
  });

  it("flags stock at or below the minimum", async () => {
    const model = new FakeModelPort().queueTurn({
      toolCalls: [{ name: "get_stock_level", arguments: { query: "hi-vis vest" } }],
    });
    const result = await run(model, { message: "vests?" });
    expect(result.card).toMatchObject({ kind: "stock", belowMinimum: true });
    expect(result.text).toContain("at or below the minimum of 25");
  });

  it("resolves a follow-up like 'where is it?' from the previous product", async () => {
    const model = new FakeModelPort().queueTurn({
      toolCalls: [{ name: "find_location", arguments: { query: "it" } }],
    });
    const result = await run(model, {
      message: "where is it?",
      context: { lastSku: "001254" },
      history: [
        { role: "user", content: "How many generators do we have?" },
        { role: "assistant", content: "We currently have 43 units of Portable Generator 5kW in stock." },
      ],
    });
    expect(result.text).toContain("Portable Generator 5kW");
    expect(result.context).toMatchObject({ context: { lastSku: "001254" } });
    expect(model.askRequests[0].messages.at(-1)?.content).toContain("SKU 001254");
    expect(model.askRequests[0].messages[0].content).not.toContain("001254");
    expect(model.askRequests[0].cacheKey).toBe("copilot-router");
  });

  it("sends only the last four messages of history to the model", async () => {
    const model = new FakeModelPort().queueTurn({ toolCalls: [{ name: "list_below_minimum", arguments: {} }] });
    const history = Array.from({ length: 8 }, (_, i) => ({
      role: (i % 2 ? "assistant" : "user") as "user" | "assistant",
      content: `m${i}`,
    }));
    await run(model, { message: "low stock?", history });
    const sent = model.askRequests[0].messages;
    expect(sent.map((m) => m.content)).toEqual([sent[0].content, "m4", "m5", "m6", "m7", "low stock?"]);
    expect(sent[0].content).toBe(model.askRequests[0].messages[0].content);
  });
});

describe("ask: schedule, below minimum and PO lookup", () => {
  it("lists exactly the products at or below minimum", async () => {
    const db = freshDb();
    const model = new FakeModelPort().queueTurn({ toolCalls: [{ name: "list_below_minimum", arguments: {} }] });
    const result = await run(model, { message: "What stock is below minimum levels?" }, db);
    const skus = (result.card as { items: Array<{ sku: string }> }).items.map((i) => i.sku).sort();
    const expected = (
      db
        .prepare(
          `SELECT p.sku FROM products p JOIN stock s ON s.sku = p.sku
           GROUP BY p.sku HAVING p.min_stock > 0 AND SUM(s.qty) <= p.min_stock`,
        )
        .all() as Array<{ sku: string }>
    )
      .map((r) => r.sku)
      .sort();
    expect(skus).toEqual(expected);
    expect(skus).toEqual(expect.arrayContaining(["100410", "300118"]));
  });

  it.each([
    ["{}", "What stock is below minimum levels?", {}, ["100410", "300118"]],
    ["None", "What stock is below minimum levels?", { category: "None" }, ["100410", "300118"]],
    ["running low", "What stock is below minimum levels?", { category: "running low" }, ["100410", "300118"]],
    ["all", "What stock is below minimum levels?", { category: "all" }, ["100410", "300118"]],
    ["Safety", "Which safety items are below minimum?", { category: "Safety" }, ["300118"]],
    ["Packaging", "Which packaging items are below minimum?", { category: "Packaging" }, ["100410"]],
    ["Power Equipment", "Which power equipment items are below minimum?", { category: "Power Equipment" }, []],
  ])("list_below_minimum handles %s", async (_label, message, args, expected) => {
    const model = new FakeModelPort().queueTurn({
      toolCalls: [{ name: "list_below_minimum", arguments: args }],
    });
    const result = await run(model, { message });
    const items = (result.card as { items: Array<{ sku: string }> }).items;
    expect(items.map((item) => item.sku).sort()).toEqual(expected);
  });

  it("drops a category the user did not ask for", async () => {
    const model = new FakeModelPort().queueTurn({
      toolCalls: [{ name: "list_below_minimum", arguments: { category: "Safety" } }],
    });
    const result = await run(model, { message: "What stock is below minimum levels?" });
    const items = (result.card as { items: Array<{ sku: string }> }).items;
    expect(items.map((item) => item.sku).sort()).toEqual(["100410", "300118"]);
    expect(result.events.find((event) => event.type === "tool")).toMatchObject({
      name: "list_below_minimum",
      arguments: {},
      routedBy: "fallback",
    });
  });

  it("returns the purchase orders due today by default", async () => {
    const model = new FakeModelPort().queueTurn({ toolCalls: [{ name: "get_receiving_schedule", arguments: {} }] });
    const result = await run(model, { message: "Show today's receiving schedule." });
    const orders = (result.card as { orders: Array<{ poNumber: string }> }).orders.map((o) => o.poNumber);
    expect(orders).toEqual(["4471", "4472"]);
    expect(result.text).toContain("due today");
  });

  it("returns tomorrow's deliveries when asked", async () => {
    const model = new FakeModelPort().queueTurn({
      toolCalls: [{ name: "get_receiving_schedule", arguments: { date: "tomorrow" } }],
    });
    const result = await run(model, { message: "What deliveries are due tomorrow?" });
    expect((result.card as { orders: Array<{ poNumber: string }> }).orders.map((o) => o.poNumber)).toEqual(["4473"]);
  });

  it("returns a PO with its lines, and not-found for an unknown PO", async () => {
    const known = await run(
      new FakeModelPort().queueTurn({ toolCalls: [{ name: "get_po", arguments: { po_number: "4471" } }] }),
      { message: "What is on PO 4471?" },
    );
    expect(known.card).toMatchObject({ kind: "po", poNumber: "4471" });
    expect((known.card as { lines: unknown[] }).lines).toHaveLength(3);

    const unknown = await run(
      new FakeModelPort().queueTurn({ toolCalls: [{ name: "get_po", arguments: { po_number: "9999" } }] }),
      { message: "PO 9999" },
    );
    expect(unknown.card).toMatchObject({ kind: "not_found", what: "purchase_order" });
  });
});

describe("ask: routing guard and off-topic backstop", () => {
  it.each([
    ["Do we have any pressure washers?", "search_sops", "get_stock_level"],
    ["Do we have any pressure washers?", "list_below_minimum", "get_stock_level"],
    ["How do I process returns?", "get_stock_level", "search_sops"],
    ["What is the receiving process?", "get_receiving_schedule", "search_sops"],
    ["Give me the forklift inspection checklist.", "get_stock_level", "search_sops"],
    ["How much can one person lift?", "get_stock_level", "search_sops"],
    ["Where is the procedure for returns?", "find_location", "search_sops"],
  ])("guardRoute corrects %s", async (message, modelTool, expected) => {
    const model = new FakeModelPort().queueTurn({
      toolCalls: [{ name: modelTool, arguments: {} }],
    });
    const result = await run(model, { message });
    const tool = result.events.find((event) => event.type === "tool");
    expect(tool).toMatchObject({ name: expected, routedBy: "fallback" });
  });

  it("returns 11 pressure washers after correcting the model's SOP choice", async () => {
    const model = new FakeModelPort().queueTurn({
      toolCalls: [{ name: "search_sops", arguments: { question: "pressure washers" } }],
    });
    const result = await run(model, { message: "Do we have any pressure washers?" });
    expect(result.card).toMatchObject({ kind: "stock", total: 11 });
    expect(result.text).toContain("Pressure Washer");
  });

  it("returns 11 pressure washers instead of a low-stock list", async () => {
    const model = new FakeModelPort().queueTurn({
      toolCalls: [{ name: "list_below_minimum", arguments: { category: "Pressure Washers" } }],
    });
    const result = await run(model, { message: "Do we have any pressure washers?" });
    expect(result.card).toMatchObject({ kind: "stock", total: 11 });
    expect(result.text).toContain("Pressure Washer");
  });

  it("keeps a correct model choice", async () => {
    const model = new FakeModelPort().queueTurn({
      toolCalls: [{ name: "find_location", arguments: { query: "001254" } }],
    });
    const result = await run(model, { message: "Where is SKU 001254 stored?" });
    expect(result.events.find((event) => event.type === "tool")).toMatchObject({
      name: "find_location",
      routedBy: "model",
    });
  });

  it.each([
    "How much can one person lift?",
    "Where is the procedure for returns?",
  ])("keeps the model's SOP choice for %s", async (message) => {
    const model = new FakeModelPort().queueTurn({
      toolCalls: [{ name: "search_sops", arguments: { question: message } }],
    });
    const result = await run(model, { message });
    expect(result.events.find((event) => event.type === "tool")).toMatchObject({
      name: "search_sops",
      routedBy: "model",
    });
  });

  it("routes procedure wording before data words in the fallback", () => {
    expect(fallbackRoute("How much can one person lift?")).toMatchObject({
      name: "search_sops",
    });
    expect(fallbackRoute("Where is the procedure for returns?")).toMatchObject({
      name: "search_sops",
    });
  });

  it.each(["Tell me a joke", "What is the capital of France?"])(
    "refuses off-topic question %s",
    async (message) => {
      const model = new FakeModelPort().queueTurn({
        toolCalls: [{ name: "get_receiving_schedule", arguments: {} }],
      });
      const result = await run(model, { message });
      expect(result.text).toContain("I can help with stock levels");
      expect(result.events.find((event) => event.type === "tool")).toMatchObject({
        name: "not_warehouse",
        routedBy: "fallback",
      });
    },
  );

  it("prefers a confident fallback over the model's not_warehouse escape", async () => {
    const model = new FakeModelPort().queueTurn({
      toolCalls: [{ name: "not_warehouse", arguments: {} }],
    });
    const result = await run(model, { message: "How many generators do we have?" });
    expect(result.card).toMatchObject({ kind: "stock", total: 43 });
    expect(result.events.find((event) => event.type === "tool")).toMatchObject({
      name: "get_stock_level",
      routedBy: "fallback",
    });
  });

  it("corrects a spoken PO number", async () => {
    const model = new FakeModelPort().queueTurn({
      toolCalls: [{ name: "get_po", arguments: { po_number: "44714" } }],
    });
    const result = await run(model, {
      message: "What is on purchase order four four seven one?",
    });
    expect(result.events.find((event) => event.type === "tool")).toMatchObject({
      name: "get_po",
      arguments: { po_number: "4471" },
    });
    expect(result.card).toMatchObject({ kind: "po", poNumber: "4471" });
  });
});

describe("ask: when the model gives no usable tool call", () => {
  it("falls back to deterministic routing for a warehouse question, ignoring model prose", async () => {
    const model = new FakeModelPort().queueTurn({ tokens: ["There are 7 generators, I think."] });
    const result = await run(model, { message: "How many generators do we have?" });
    expect(result.text).toBe("We currently have 43 units of Portable Generator 5kW in stock.");
    const tool = result.events.find((e) => e.type === "tool");
    expect(tool).toMatchObject({ routedBy: "fallback", name: "get_stock_level" });
  });

  it("refuses an off-topic question instead of showing model prose", async () => {
    const model = new FakeModelPort().queueTurn({ tokens: ["I can only help with warehouse work."] });
    const result = await run(model, { message: "What is the weather in Nairobi?" });
    expect(result.text).toContain("I can help with stock levels");
    expect(result.card).toBeUndefined();
    expect(result.events.find((event) => event.type === "tool")).toMatchObject({
      name: "not_warehouse",
      routedBy: "fallback",
    });
  });

  it("shows a help message when the model says nothing", async () => {
    const result = await run(new FakeModelPort(), { message: "hmm" });
    expect(result.text).toContain("stock levels");
  });

  it("ignores a tool the model invented", async () => {
    const model = new FakeModelPort().queueTurn({ toolCalls: [{ name: "delete_stock", arguments: { sku: "001254" } }] });
    const db = freshDb();
    const before = dump(db);
    const result = await run(model, { message: "hmm" }, db);
    expect(result.card).toBeUndefined();
    expect(dump(db)).toEqual(before);
  });
});

describe("ask: cancellation", () => {
  it("stops without answering when cancelled", async () => {
    const controller = new AbortController();
    controller.abort();
    const model = new FakeModelPort().queueTurn({ toolCalls: [{ name: "get_stock_level", arguments: { query: "generators" } }] });
    const result = await run(model, { message: "How many generators?" }, freshDb(), controller.signal);
    expect(result.events.at(-1)).toEqual({ type: "done", reason: "cancelled" });
    expect(result.card).toBeUndefined();
  });
});

describe("fallbackRoute", () => {
  it.each([
    ["What is on PO 4471?", "get_po"],
    ["Show me purchase order 4473.", "get_po"],
    ["Which items need reordering?", "list_below_minimum"],
    ["What is arriving today?", "get_receiving_schedule"],
    ["Where can I find the hose kits?", "find_location"],
    ["How many cartons do we have?", "get_stock_level"],
    ["How should chemicals be stored?", "search_sops"],
  ])("routes %j to %s", (message, tool) => {
    expect(fallbackRoute(message)?.name).toBe(tool);
  });
  it("returns nothing for small talk", () => {
    expect(fallbackRoute("hello there")).toBeNull();
  });
});

describe("ask: late deliveries", () => {
  // Seeded six days before "now", so the open purchase orders are now overdue.
  const staleDb = () => freshDb(new Date(2026, 9, 22, 10, 0, 0));

  it.each([
    ["What stock is behind schedule?", "get_stock_level", { query: "stock behind schedule" }],
    ["Which deliveries are late?", "get_receiving_schedule", { date: "today" }],
    ["Any overdue purchase orders?", "list_below_minimum", {}],
  ])("%s lists the overdue open POs", async (message, modelTool, args) => {
    const model = new FakeModelPort().queueTurn({ toolCalls: [{ name: modelTool, arguments: args }] });
    const result = await run(model, { message }, staleDb());
    expect(result.card).toMatchObject({ kind: "schedule", label: "overdue" });
    const orders = (result.card as { orders: Array<{ poNumber: string; daysLate: number }> }).orders;
    expect(orders.map((o) => o.poNumber)).toEqual(["4471", "4472", "4473", "4474", "4476"]);
    expect(orders[0].daysLate).toBe(6);
    expect(result.text).toContain("behind schedule");
  });

  it("says nothing is late when every open PO is due today or later", async () => {
    const model = new FakeModelPort().queueTurn({
      toolCalls: [{ name: "get_receiving_schedule", arguments: { date: "overdue" } }],
    });
    const result = await run(model, { message: "What is behind schedule?" });
    expect(result.text).toContain("No deliveries are behind schedule");
  });

  it("keeps a procedure question about a late delivery on the SOPs", () => {
    expect(fallbackRoute("What should I do with a late delivery?")?.name).toBe("search_sops");
  });

  it("retries a failed product search with the rule router instead of dead-ending", async () => {
    const model = new FakeModelPort().queueTurn({
      toolCalls: [{ name: "get_stock_level", arguments: { query: "stuff to reorder" } }],
    });
    const result = await run(model, { message: "Show me stuff to reorder" });
    expect(result.card).toMatchObject({ kind: "below_minimum" });
  });
});
