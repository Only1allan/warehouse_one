import { describe, expect, it } from "vitest";
import { FakeModelPort } from "@/lib/ai/fake-model-port";
import { ModelUnavailableError, type ModelPort, type SopPassage } from "@/lib/ai/model-port";
import { askCopilot, SOP_REFUSAL, type AskStreamEvent } from "@/lib/services/ask";
import { FIXED_NOW, freshDb } from "./helpers";

const damaged: SopPassage = {
  document: "Damaged Goods Handling (SOP WH-QA-01)",
  section: "Immediate steps",
  text: "2. Place the damaged inventory in the quarantine area (location QUAR) immediately.\n4. Complete form WH-QA-04 before notifying the supervisor.",
  score: 0.82,
};
const chemical: SopPassage = {
  document: "Chemical Storage and Spill Response (SOP WH-SF-02)",
  section: "Storage rules",
  text: "1. Store chemicals only in Zone B racks 1 and 2 (bunded shelves).",
  score: 0.77,
};

async function run(model: ModelPort, message: string, signal?: AbortSignal) {
  const events: AskStreamEvent[] = [];
  for await (const e of askCopilot({ db: freshDb(), model, now: () => FIXED_NOW }, { message }, signal)) events.push(e);
  const sop = events.find((e) => e.type === "card" && e.card.kind === "sop");
  return {
    events,
    text: events.filter((e) => e.type === "token").map((e) => (e as { text: string }).text).join(""),
    sources: sop && sop.type === "card" && sop.card.kind === "sop" ? sop.card.sources : [],
    done: events.at(-1),
  };
}

const routeToSops = (model: FakeModelPort, question: string) =>
  model.queueTurn({ toolCalls: [{ name: "search_sops", arguments: { question } }] });

describe("ask: procedure questions", () => {
  it("answers 'damaged inventory' from the SOP and cites document and section", async () => {
    const model = routeToSops(new FakeModelPort(), "What should I do with damaged inventory?").queueTurn({
      tokens: [
        "Place the damaged inventory in the quarantine area ",
        "and complete form WH-QA-04 before notifying the supervisor.",
      ],
    });
    model.sopPassages = [damaged];
    const result = await run(model, "What should I do with damaged inventory?");
    expect(result.text).toContain("quarantine area");
    expect(result.text).toContain("WH-QA-04");
    expect(result.sources).toEqual([
      { document: damaged.document, section: damaged.section, excerpt: damaged.text },
    ]);
    expect(result.done).toEqual({ type: "done", reason: "complete" });
  });

  it("gives the model only the retrieved passages to answer from", async () => {
    const model = routeToSops(new FakeModelPort(), "How should chemicals be stored?").queueTurn({
      tokens: ["Store chemicals only in Zone B racks 1 and 2."],
    });
    model.sopPassages = [chemical];
    await run(model, "How should chemicals be stored?");
    const compose = model.askRequests[1];
    expect(compose.messages[0].content).toContain("Zone B racks 1 and 2");
    expect(compose.messages[0].content).toContain("ONLY");
    expect(compose.tools).toBeUndefined();
  });

  it("cites every passage it was given, once each, for a safety question", async () => {
    const model = routeToSops(new FakeModelPort(), "How do I handle a chemical spill?").queueTurn({
      tokens: ["Store chemicals on bunded shelves and place the damaged item in quarantine."],
    });
    model.sopPassages = [chemical, damaged, chemical];
    const result = await run(model, "How do I handle a chemical spill?");
    expect(result.sources.map((s) => s.document)).toEqual([chemical.document, damaged.document]);
  });

  it("says 'I don't have an SOP for that' when nothing relevant is found", async () => {
    const model = routeToSops(new FakeModelPort(), "How do I fly a helicopter?");
    model.sopPassages = [{ ...damaged, score: 0.05 }];
    const result = await run(model, "How do I fly a helicopter?");
    expect(result.text).toBe(SOP_REFUSAL);
    expect(result.sources).toEqual([]);
    expect(model.askRequests).toHaveLength(1);
  });

  it("refuses when retrieval returns nothing at all", async () => {
    const model = routeToSops(new FakeModelPort(), "something unrelated");
    const result = await run(model, "something unrelated");
    expect(result.text).toBe(SOP_REFUSAL);
  });

  it("refuses, without showing raw model output, when the passages do not answer it", async () => {
    const model = routeToSops(new FakeModelPort(), "What is the lunch menu?").queueTurn({ tokens: ["NOT_COVERED"] });
    model.sopPassages = [damaged];
    const result = await run(model, "What is the lunch menu?");
    expect(result.text).toBe(SOP_REFUSAL);
    expect(result.text).not.toContain("NOT_COVERED");
    expect(result.sources).toEqual([]);
  });

  it("strips an ANSWER: prefix the model may add", async () => {
    const model = routeToSops(new FakeModelPort(), "damaged").queueTurn({
      tokens: ["ANSWER: ", "Use the quarantine area and form WH-QA-04."],
    });
    model.sopPassages = [damaged];
    const result = await run(model, "damaged");
    expect(result.text).toBe("Use the quarantine area and form WH-QA-04.");
  });

  it("falls back to SOP search for a procedure question the model did not route", async () => {
    const model = new FakeModelPort().queueTurn({ tokens: ["Probably do something."] }).queueTurn({
      tokens: ["Place it in the quarantine area."],
    });
    model.sopPassages = [damaged];
    const result = await run(model, "What should I do with damaged inventory?");
    expect(result.text).toBe("Place it in the quarantine area.");
    expect(result.sources).toHaveLength(1);
  });

  it("tells the operator what to do when the search model is not ready", async () => {
    const model = routeToSops(new FakeModelPort(), "damaged");
    model.retrieveSop = async () => {
      throw new ModelUnavailableError("not ready");
    };
    const result = await run(model, "damaged");
    expect(result.text).toContain("Prepare offline");
    expect(result.done).toEqual({ type: "done", reason: "error" });
  });

  it("stops cleanly when cancelled during the answer", async () => {
    const controller = new AbortController();
    const model = routeToSops(new FakeModelPort(), "damaged").queueTurn({
      tokens: ["Place the damaged inventory ", "in the quarantine area ", "and complete form WH-QA-04 now."],
    });
    model.sopPassages = [damaged];
    const events: AskStreamEvent[] = [];
    for await (const e of askCopilot({ db: freshDb(), model, now: () => FIXED_NOW }, { message: "damaged" }, controller.signal)) {
      events.push(e);
      if (e.type === "token") controller.abort();
    }
    expect(events.at(-1)).toEqual({ type: "done", reason: "cancelled" });
    expect(events.some((e) => e.type === "card" && e.card.kind === "sop")).toBe(false);
  });
});
