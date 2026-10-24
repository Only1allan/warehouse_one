import type { DocumentKind, DocumentRead } from "./model-port";

export interface OcrBlock {
  text: string;
  bbox?: unknown;
  confidence?: number;
}

function topLeft(bbox: unknown): { x: number; y: number; h: number } | null {
  if (!Array.isArray(bbox) || bbox.length === 0) return null;
  if (Array.isArray(bbox[0])) {
    const pts = bbox as number[][];
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    return { x: Math.min(...xs), y: Math.min(...ys), h: Math.max(...ys) - Math.min(...ys) };
  }
  const flat = bbox as number[];
  if (flat.length >= 8) {
    const xs = flat.filter((_, i) => i % 2 === 0);
    const ys = flat.filter((_, i) => i % 2 === 1);
    return { x: Math.min(...xs), y: Math.min(...ys), h: Math.max(...ys) - Math.min(...ys) };
  }
  if (flat.length >= 4) {
    return { x: flat[0], y: flat[1], h: Math.abs(flat[3] - flat[1]) };
  }
  return null;
}

/** Joins OCR blocks into reading-order lines: top to bottom, left to right within a line. */
export function ocrBlocksToText(blocks: OcrBlock[]): string {
  const positioned = blocks
    .map((b) => ({ b, pos: topLeft(b.bbox) }))
    .filter((p) => p.b.text.trim());
  if (positioned.some((p) => !p.pos)) return positioned.map((p) => p.b.text.trim()).join(" ");
  const heights = positioned.map((p) => p.pos!.h).filter((h) => h > 0).sort((a, b) => a - b);
  const tolerance = (heights[Math.floor(heights.length / 2)] ?? 20) * 0.6;
  const sorted = [...positioned].sort((a, b) => a.pos!.y - b.pos!.y || a.pos!.x - b.pos!.x);
  const lines: Array<{ y: number; items: typeof sorted }> = [];
  for (const item of sorted) {
    const line = lines.find((l) => Math.abs(l.y - item.pos!.y) <= tolerance);
    if (line) line.items.push(item);
    else lines.push({ y: item.pos!.y, items: [item] });
  }
  return lines
    .sort((a, b) => a.y - b.y)
    .map((l) =>
      l.items
        .sort((a, b) => a.pos!.x - b.pos!.x)
        .map((i) => i.b.text.trim())
        .join("  "),
    )
    .join("\n");
}

export const EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    reference: { type: ["string", "null"] },
    party: { type: ["string", "null"] },
    lines: {
      type: "array",
      items: {
        type: "object",
        properties: {
          sku: { type: "string" },
          description: { type: "string" },
          quantity: { type: "integer" },
        },
        required: ["sku", "description", "quantity"],
      },
    },
  },
  required: ["reference", "party", "lines"],
} as const;

export function extractionPrompt(kind: DocumentKind, ocrText: string): string {
  const doc = kind === "delivery_note" ? "delivery note" : "loading sheet";
  const ref =
    kind === "delivery_note"
      ? "the purchase order (PO) number the supplier refers to"
      : "the sales order number";
  const party = kind === "delivery_note" ? "the supplier name" : "the customer name";
  return [
    `Below is text read by OCR from a ${doc}. Extract the data as JSON.`,
    `reference: ${ref}, as printed. party: ${party}.`,
    "lines: one entry per item row. sku is the item code exactly as printed, description is the item name, quantity is the whole number in the quantity column.",
    "Use null for reference or party if you cannot find it. Do not invent lines. Copy values exactly as they appear.",
    "",
    "OCR text:",
    ocrText,
  ].join("\n");
}

interface ParsedExtraction {
  reference?: unknown;
  party?: unknown;
  lines?: unknown;
}

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Builds the document read from the model's JSON. Confidence is evidence-based:
 * a value is trusted when it can be found in the OCR text, not because the model said so.
 */
export function buildDocumentRead(kind: DocumentKind, ocrText: string, raw: string): DocumentRead {
  let parsed: ParsedExtraction = {};
  try {
    const value = JSON.parse(raw) as unknown;
    parsed = value && typeof value === "object" ? (value as ParsedExtraction) : {};
  } catch {
    parsed = {};
  }
  const haystack = squash(ocrText);
  const found = (value: string) => value.length > 0 && haystack.includes(squash(value));
  const foundNumber = (n: number) => new RegExp(`(^|[^0-9])${n}([^0-9]|$)`).test(ocrText);

  const reference = typeof parsed.reference === "string" ? parsed.reference.trim() : "";
  const party = typeof parsed.party === "string" ? parsed.party.trim() : "";
  const rawLines = Array.isArray(parsed.lines) ? (parsed.lines as Array<Record<string, unknown>>) : [];

  const lines = rawLines
    .filter((l) => l && typeof l === "object")
    .map((l) => {
      const sku = typeof l.sku === "string" ? l.sku.trim() : "";
      const description = typeof l.description === "string" ? l.description.trim() : "";
      const q = typeof l.quantity === "number" ? l.quantity : Number(l.quantity);
      const quantity = Number.isFinite(q) ? Math.trunc(q) : null;
      const evidence = [found(sku), found(description), quantity !== null && foundNumber(quantity)];
      const hits = evidence.filter(Boolean).length;
      return {
        sku: sku || null,
        description,
        quantity,
        confidence: hits === 3 ? 0.95 : hits === 2 ? 0.75 : hits === 1 ? 0.45 : 0.2,
      };
    })
    .filter((l) => l.sku || l.description);

  return {
    kind,
    ocrText,
    reference: { value: reference || null, confidence: reference && found(reference) ? 0.95 : reference ? 0.4 : 0 },
    party: { value: party || null, confidence: party && found(party) ? 0.9 : party ? 0.4 : 0 },
    lines,
  };
}
