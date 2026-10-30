import { describe, expect, it } from "vitest";
import { FakeModelPort } from "@/lib/ai/fake-model-port";
import type { DocumentRead } from "@/lib/ai/model-port";
import { readDocument } from "@/lib/services/document-reading";
import { dump, freshDb } from "./helpers";

const note = (over: Partial<DocumentRead> = {}): DocumentRead => ({
  kind: "delivery_note",
  ocrText: "DELIVERY NOTE Kenya Packaging Ltd PO 4471 100201 Corrugated Carton 150",
  reference: { value: "4471", confidence: 0.95 },
  party: { value: "Kenya Packaging Ltd", confidence: 0.9 },
  lines: [
    { sku: "100201", description: "Corrugated Carton 40x30x30", quantity: 150, confidence: 0.95 },
    { sku: "100305", description: "Stretch Wrap Roll", quantity: 60, confidence: 0.9 },
    { sku: "100410", description: "Packing Tape 48mm", quantity: 120, confidence: 0.92 },
  ],
  ...over,
});

async function read(documentRead: DocumentRead, kind: "delivery_note" | "loading_sheet" = "delivery_note") {
  const model = new FakeModelPort();
  model.documentRead = documentRead;
  const db = freshDb();
  const before = dump(db);
  const result = await readDocument({ db, model }, new Uint8Array([1]), kind);
  expect(dump(db)).toEqual(before);
  return result;
}

describe("reading a delivery note", () => {
  it("matches the purchase order and keeps clean lines unflagged", async () => {
    const result = await read(note());
    expect(result.matchedPoNumber).toBe("4471");
    expect(result.warnings).toEqual([]);
    expect(result.lines.map((l) => [l.sku, l.noteQty, l.onOrder, l.needsCheck])).toEqual([
      ["100201", 150, true, false],
      ["100305", 60, true, false],
      ["100410", 120, true, false],
    ]);
  });

  it("reads the order number from messy text like 'PO# 4471'", async () => {
    const result = await read(note({ reference: { value: "PO# 4471", confidence: 0.9 } }));
    expect(result.reference).toBe("4471");
    expect(result.matchedPoNumber).toBe("4471");
  });

  it("asks the clerk to choose when the PO is unreadable or unknown", async () => {
    const unreadable = await read(note({ reference: { value: null, confidence: 0 } }));
    expect(unreadable.matchedPoNumber).toBeNull();
    expect(unreadable.warnings[0]).toContain("No PO number was found");

    const unknown = await read(note({ reference: { value: "9999", confidence: 0.9 } }));
    expect(unknown.matchedPoNumber).toBeNull();
    expect(unknown.warnings[0]).toContain("PO 9999 is not in the system yet");
  });

  it("warns when the model is unsure of the order number or the PO is already received", async () => {
    const unsure = await read(note({ reference: { value: "4471", confidence: 0.3 } }));
    expect(unsure.warnings[0]).toContain("not sure");
    const received = await read(note({ reference: { value: "4475", confidence: 0.9 } }));
    expect(received.warnings.join(" ")).toContain("already been received");
  });

  it("recovers the SKU from the description when the code is misread", async () => {
    const result = await read(
      note({ lines: [{ sku: "1OO2O1", description: "Corrugated Carton 40x30x30", quantity: 150, confidence: 0.9 }] }),
    );
    expect(result.lines[0]).toMatchObject({ sku: "100201", needsCheck: false });
  });

  it("flags lines it cannot trust, without dropping them", async () => {
    const result = await read(
      note({
        lines: [
          { sku: "ZZZ999", description: "Mystery item", quantity: 5, confidence: 0.9 },
          { sku: "100305", description: "Stretch Wrap Roll", quantity: null, confidence: 0.9 },
          { sku: "100410", description: "Packing Tape 48mm", quantity: 120, confidence: 0.4 },
          { sku: "001254", description: "Portable Generator 5kW", quantity: 2, confidence: 0.9 },
        ],
      }),
    );
    expect(result.lines).toHaveLength(4);
    expect(result.lines[0].reasons).toContain("Product not recognised");
    expect(result.lines[1].reasons).toContain("Quantity unclear");
    expect(result.lines[2].reasons).toContain("Low confidence");
    expect(result.lines[3].reasons).toContain("Not on the order");
    expect(result.lines.every((l) => l.needsCheck)).toBe(true);
  });

  it("tells the clerk when nothing could be read", async () => {
    const result = await read(note({ lines: [] }));
    expect(result.warnings.join(" ")).toContain("could not read any lines");
  });

  it("changes nothing in the database (reading is not saving)", async () => {
    await read(note());
  });
});

describe("reading a loading sheet", () => {
  it("matches the sales order and its lines", async () => {
    const result = await read(
      {
        kind: "loading_sheet",
        ocrText: "LOADING SHEET Order 5521 Roofing Sheets 50 pallet",
        reference: { value: "5521", confidence: 0.9 },
        party: { value: "Mombasa Hardware Ltd", confidence: 0.9 },
        lines: [{ sku: "600100", description: "Roofing Sheets (pallet of 100)", quantity: 48, confidence: 0.9 }],
      },
      "loading_sheet",
    );
    expect(result.matchedOrderNumber).toBe("5521");
    expect(result.matchedPoNumber).toBeNull();
    expect(result.lines[0]).toMatchObject({ sku: "600100", noteQty: 48, onOrder: true, needsCheck: false });
  });
});
