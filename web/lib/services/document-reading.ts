import type { Db } from "../db";
import type { DocumentKind, DocumentRead, ModelPort } from "../ai/model-port";
import { findProducts, loadProducts } from "../domain/product-search";

export interface ExtractedLine {
  sku: string | null;
  description: string;
  noteQty: number | null;
  onOrder: boolean;
  needsCheck: boolean;
  reasons: string[];
}

export interface ExtractedDocument {
  kind: DocumentKind;
  ocrText: string;
  reference: string | null;
  party: string | null;
  matchedPoNumber: string | null;
  matchedOrderNumber: string | null;
  lines: ExtractedLine[];
  warnings: string[];
}

const LOW_CONFIDENCE = 0.6;

function digits(value: string | null): string | null {
  const d = (value ?? "").replace(/\D/g, "");
  return d.length >= 3 ? d : null;
}

/**
 * Turns what the model read from a photo into fields the clerk can review.
 * Nothing here is saved, and every value the model could have got wrong is checked
 * against the product and order records.
 */
export async function readDocument(
  deps: { db: Db; model: ModelPort },
  image: Uint8Array,
  kind: DocumentKind,
): Promise<ExtractedDocument> {
  const read: DocumentRead = await deps.model.readDocument(image, kind);
  const reference = digits(read.reference.value);
  const warnings: string[] = [];
  if (!reference) {
    warnings.push(
      kind === "delivery_note"
        ? "No PO number was found on this note, so it cannot be received from the photo. Take a clearer photo, or choose the order from the list."
        : "I could not read the order number. Choose it from the list.",
    );
  }
  else if (read.reference.confidence < LOW_CONFIDENCE) {
    warnings.push(`I am not sure the order number ${reference} is right. Please check it.`);
  }

  let matchedPoNumber: string | null = null;
  let matchedOrderNumber: string | null = null;
  let orderSkus = new Set<string>();
  if (reference && kind === "delivery_note") {
    const po = deps.db
      .prepare("SELECT po_number, status FROM purchase_orders WHERE po_number = ?")
      .get(reference) as { po_number: string; status: string } | undefined;
    if (po) {
      matchedPoNumber = po.po_number;
      if (po.status === "received") warnings.push(`PO ${po.po_number} has already been received.`);
      orderSkus = new Set(
        (deps.db.prepare("SELECT sku FROM po_lines WHERE po_number = ?").all(po.po_number) as Array<{ sku: string }>).map(
          (r) => r.sku,
        ),
      );
    } else {
      warnings.push(`PO ${reference} is not in the system yet. Check the lines read from the note, then add it.`);
    }
  }
  if (reference && kind === "loading_sheet") {
    const order = deps.db
      .prepare("SELECT order_number FROM sales_orders WHERE order_number = ?")
      .get(reference) as { order_number: string } | undefined;
    if (order) {
      matchedOrderNumber = order.order_number;
      orderSkus = new Set(
        (
          deps.db.prepare("SELECT sku FROM order_lines WHERE order_number = ?").all(order.order_number) as Array<{
            sku: string;
          }>
        ).map((r) => r.sku),
      );
    } else {
      warnings.push(`Order ${reference} is not in the system. Choose the order from the list.`);
    }
  }

  const known = new Set(loadProducts(deps.db).map((p) => p.sku));
  const lines: ExtractedLine[] = read.lines.map((line) => {
    const reasons: string[] = [];
    let sku = line.sku?.trim() || null;
    if (sku && !known.has(sku)) {
      const upper = sku.toUpperCase();
      sku = known.has(upper) ? upper : null;
    }
    if (!sku && line.description) {
      const found = findProducts(deps.db, line.description);
      if (found.kind === "exact") sku = found.product.sku;
    }
    if (!sku) reasons.push("Product not recognised");
    if (line.confidence < LOW_CONFIDENCE) reasons.push("Low confidence");
    if (line.quantity === null || !Number.isInteger(line.quantity) || line.quantity < 0) {
      reasons.push("Quantity unclear");
    }
    const onOrder = sku !== null && (orderSkus.size === 0 ? false : orderSkus.has(sku));
    if (sku && orderSkus.size > 0 && !onOrder) reasons.push("Not on the order");
    return {
      sku,
      description: line.description,
      noteQty: Number.isInteger(line.quantity) && (line.quantity ?? -1) >= 0 ? line.quantity : null,
      onOrder,
      needsCheck: reasons.length > 0,
      reasons,
    };
  });
  if (lines.length === 0) warnings.push("I could not read any lines. Try a clearer photo, or enter the quantities by hand.");

  return {
    kind,
    ocrText: read.ocrText,
    reference,
    party: read.party.value,
    matchedPoNumber,
    matchedOrderNumber,
    lines,
    warnings,
  };
}
