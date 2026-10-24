import { describe, expect, it } from "vitest";
import {
  chunkSop,
  chunkToIndexText,
  indexTextToChunk,
  loadSopDocuments,
} from "@/lib/copilot/sop";

describe("SOP chunking", () => {
  const doc = {
    name: "demo",
    markdown: "# Demo Procedure (SOP X-1)\n\n## Purpose\nWhy it exists.\n\n## Steps\n1. First\n2. Second\n\n## Empty\n\n",
  };

  it("makes one chunk per section, named after the document title", () => {
    const chunks = chunkSop(doc);
    expect(chunks.map((c) => c.section)).toEqual(["Purpose", "Steps"]);
    expect(chunks[0]).toEqual({ document: "Demo Procedure (SOP X-1)", section: "Purpose", text: "Why it exists." });
    expect(chunks[1].text).toContain("2. Second");
  });

  it("round-trips through the indexed text so a citation can be rebuilt", () => {
    const chunk = chunkSop(doc)[1];
    expect(indexTextToChunk(chunkToIndexText(chunk))).toEqual(chunk);
    expect(indexTextToChunk("no header here")).toBeNull();
  });
});

describe("the real SOP documents", () => {
  const docs = loadSopDocuments();
  it("has at least 8 documents, each with titled sections", () => {
    expect(docs.length).toBeGreaterThanOrEqual(8);
    for (const d of docs) expect(chunkSop(d).length).toBeGreaterThan(0);
  });

  it("covers the quarantine area and form WH-QA-04 for damaged goods", () => {
    const damaged = docs.find((d) => d.name === "damaged-goods")!;
    const text = chunkSop(damaged).map((c) => c.text).join(" ");
    expect(text).toContain("quarantine area");
    expect(text).toContain("WH-QA-04");
  });
});
