import { describe, expect, it } from "vitest";
import { buildDocumentRead, extractionPrompt, ocrBlocksToText } from "@/lib/ai/document-extraction";

describe("ocrBlocksToText", () => {
  it("reads blocks top to bottom and left to right, whatever order they arrive in", () => {
    const blocks = [
      { text: "Qty", bbox: [[400, 100], [440, 100], [440, 124], [400, 124]] },
      { text: "100201", bbox: [[20, 160], [100, 160], [100, 184], [20, 184]] },
      { text: "Item code", bbox: [[20, 102], [120, 102], [120, 126], [20, 126]] },
      { text: "150", bbox: [[400, 162], [440, 162], [440, 186], [400, 186]] },
      { text: "Carton", bbox: [[150, 161], [250, 161], [250, 185], [150, 185]] },
    ];
    expect(ocrBlocksToText(blocks)).toBe("Item code  Qty\n100201  Carton  150");
  });

  it("copes with flat [x1, y1, x2, y2] boxes and with blocks that have no position", () => {
    expect(ocrBlocksToText([{ text: "B", bbox: [200, 10, 220, 30] }, { text: "A", bbox: [10, 10, 30, 30] }])).toBe("A  B");
    expect(ocrBlocksToText([{ text: " one " }, { text: "two" }, { text: "  " }])).toBe("one two");
    expect(ocrBlocksToText([])).toBe("");
  });
});

describe("buildDocumentRead", () => {
  const ocr = "DELIVERY NOTE Kenya Packaging Ltd Your PO No. 4471\n100201  Corrugated Carton 40x30x30  150  carton\n100305  Stretch Wrap Roll  60  roll";

  it("trusts values it can find in the OCR text", () => {
    const read = buildDocumentRead(
      "delivery_note",
      ocr,
      JSON.stringify({
        reference: "4471",
        party: "Kenya Packaging Ltd",
        lines: [
          { sku: "100201", description: "Corrugated Carton 40x30x30", quantity: 150 },
          { sku: "100305", description: "Stretch Wrap Roll", quantity: 60 },
        ],
      }),
    );
    expect(read.reference).toEqual({ value: "4471", confidence: 0.95 });
    expect(read.party.confidence).toBe(0.9);
    expect(read.lines.map((l) => l.confidence)).toEqual([0.95, 0.95]);
    expect(read.ocrText).toBe(ocr);
  });

  it("gives low confidence to values that are not in the OCR text (model guesses)", () => {
    const read = buildDocumentRead(
      "delivery_note",
      ocr,
      JSON.stringify({
        reference: "9999",
        party: "Somebody Else",
        lines: [
          { sku: "100201", description: "Corrugated Carton 40x30x30", quantity: 999 },
          { sku: "XXXXXX", description: "Invented thing", quantity: 7 },
        ],
      }),
    );
    expect(read.reference.confidence).toBe(0.4);
    expect(read.party.confidence).toBe(0.4);
    expect(read.lines[0].confidence).toBe(0.75);
    expect(read.lines[1].confidence).toBe(0.2);
  });

  it("survives broken or empty model output", () => {
    for (const raw of ["not json", "{}", '{"lines":"nope"}', "null"]) {
      const read = buildDocumentRead("delivery_note", ocr, raw);
      expect(read.lines).toEqual([]);
      expect(read.reference).toEqual({ value: null, confidence: 0 });
    }
  });

  it("accepts a numeric string quantity and drops rows with no sku and no description", () => {
    const read = buildDocumentRead(
      "loading_sheet",
      "5521 600100 Roofing Sheets 48",
      JSON.stringify({
        reference: "5521",
        party: null,
        lines: [
          { sku: "600100", description: "Roofing Sheets", quantity: "48" },
          { sku: "", description: "", quantity: 1 },
        ],
      }),
    );
    expect(read.kind).toBe("loading_sheet");
    expect(read.lines).toEqual([
      { sku: "600100", description: "Roofing Sheets", quantity: 48, confidence: 0.95 },
    ]);
    expect(read.party).toEqual({ value: null, confidence: 0 });
  });

  it("asks for the right fields for each kind of document", () => {
    expect(extractionPrompt("delivery_note", "x")).toContain("purchase order (PO) number");
    expect(extractionPrompt("loading_sheet", "x")).toContain("sales order number");
  });
});
