import type { Db } from "../db";
import { inTransaction } from "../db";
import {
  computeDiscrepancy,
  describeDiscrepancy,
  type DiscrepancyLine,
  type QuantityLine,
} from "../domain/discrepancy";
import { AppError } from "../errors";
import { recordEvent } from "../events";
import { dayKey } from "../time";
import { isValidActor } from "./session";

export interface PurchaseOrderSummary {
  poNumber: string;
  supplier: string;
  expectedDate: string;
  status: "open" | "received";
  lineCount: number;
}

export interface PurchaseOrderLine {
  sku: string;
  description: string;
  qtyOrdered: number;
}

export interface PurchaseOrder extends PurchaseOrderSummary {
  lines: PurchaseOrderLine[];
}

export interface NamedDiscrepancyLine extends DiscrepancyLine {
  name: string;
  message: string;
}

export interface ReceiptReport {
  poNumber: string;
  lines: NamedDiscrepancyLine[];
  hasDiscrepancy: boolean;
}

export interface ReceivedLineInput {
  sku: string;
  qty: number;
}

export function listPurchaseOrders(
  db: Db,
  filter: { status?: "open" | "received" } = {},
): PurchaseOrderSummary[] {
  const rows = db
    .prepare(
      `SELECT p.po_number, p.supplier, p.expected_date, p.status,
              (SELECT COUNT(*) FROM po_lines l WHERE l.po_number = p.po_number) AS line_count
       FROM purchase_orders p
       WHERE (? IS NULL OR p.status = ?)
       ORDER BY p.expected_date, p.po_number`,
    )
    .all(filter.status ?? null, filter.status ?? null) as Array<{
    po_number: string;
    supplier: string;
    expected_date: string;
    status: "open" | "received";
    line_count: number;
  }>;
  return rows.map((r) => ({
    poNumber: r.po_number,
    supplier: r.supplier,
    expectedDate: r.expected_date,
    status: r.status,
    lineCount: r.line_count,
  }));
}

export function getPurchaseOrder(db: Db, poNumber: string): PurchaseOrder {
  const header = db
    .prepare("SELECT po_number, supplier, expected_date, status FROM purchase_orders WHERE po_number = ?")
    .get(poNumber) as
    | { po_number: string; supplier: string; expected_date: string; status: "open" | "received" }
    | undefined;
  if (!header) throw new AppError("not_found", `Purchase order ${poNumber} was not found.`, 404);
  const lines = (
    db
      .prepare("SELECT sku, description, qty_ordered FROM po_lines WHERE po_number = ? ORDER BY id")
      .all(poNumber) as Array<{ sku: string; description: string; qty_ordered: number }>
  ).map((l) => ({ sku: l.sku, description: l.description, qtyOrdered: l.qty_ordered }));
  return {
    poNumber: header.po_number,
    supplier: header.supplier,
    expectedDate: header.expected_date,
    status: header.status,
    lineCount: lines.length,
    lines,
  };
}

function validateLines(db: Db, lines: ReceivedLineInput[]): void {
  if (!Array.isArray(lines)) {
    throw new AppError("invalid_request", "Received lines are required.");
  }
  const known = db.prepare("SELECT 1 FROM products WHERE sku = ?");
  for (const line of lines) {
    if (!Number.isInteger(line.qty) || line.qty < 0) {
      throw new AppError(
        "invalid_request",
        `Quantity for ${line.sku} must be a whole number of zero or more.`,
      );
    }
    if (!known.get(line.sku)) {
      throw new AppError("invalid_request", `Unknown SKU ${line.sku}.`);
    }
  }
}

function productName(db: Db, sku: string): string {
  const row = db.prepare("SELECT name FROM products WHERE sku = ?").get(sku) as
    | { name: string }
    | undefined;
  return row?.name ?? sku;
}

export function compareReceipt(
  db: Db,
  input: { poNumber: string; lines: ReceivedLineInput[] },
): ReceiptReport {
  const po = getPurchaseOrder(db, input.poNumber);
  validateLines(db, input.lines);
  const expected: QuantityLine[] = po.lines.map((l) => ({ sku: l.sku, qty: l.qtyOrdered }));
  const report = computeDiscrepancy(expected, input.lines);
  return {
    poNumber: po.poNumber,
    hasDiscrepancy: report.hasDiscrepancy,
    lines: report.lines.map((line) => {
      const name = productName(db, line.sku);
      return { ...line, name, message: describeDiscrepancy(line, name) };
    }),
  };
}

export interface ConfirmReceiptInput {
  poNumber: string;
  lines: ReceivedLineInput[];
  operatorId: string;
  shiftId: string;
}

export function confirmReceipt(
  db: Db,
  deps: { now: Date },
  input: ConfirmReceiptInput,
): { receiptId: number; report: ReceiptReport } {
  if (!isValidActor(db, input.operatorId, input.shiftId)) {
    throw new AppError("unknown_actor", "Choose an operator and shift before confirming.");
  }
  const po = getPurchaseOrder(db, input.poNumber);
  if (po.status === "received") {
    throw new AppError("conflict", `Purchase order ${po.poNumber} has already been received.`, 409);
  }
  const report = compareReceipt(db, { poNumber: input.poNumber, lines: input.lines });
  const at = deps.now.toISOString();

  return inTransaction(db, () => {
    const receiptId = Number(
      db
        .prepare(
          "INSERT INTO receipts (po_number, operator_id, shift_id, received_at, has_discrepancy) VALUES (?, ?, ?, ?, ?)",
        )
        .run(po.poNumber, input.operatorId, input.shiftId, at, report.hasDiscrepancy ? 1 : 0)
        .lastInsertRowid,
    );

    const insLine = db.prepare(
      "INSERT INTO receipt_lines (receipt_id, sku, expected_qty, received_qty, status) VALUES (?, ?, ?, ?, ?)",
    );
    const addStock = db.prepare(
      `INSERT INTO stock (sku, location_id, qty, last_moved_at)
       VALUES (?, (SELECT default_location_id FROM products WHERE sku = ?), ?, ?)
       ON CONFLICT(sku, location_id) DO UPDATE SET qty = qty + excluded.qty, last_moved_at = excluded.last_moved_at`,
    );
    const addMovement = db.prepare(
      `INSERT INTO movements (sku, location_id, delta, kind, at)
       VALUES (?, (SELECT default_location_id FROM products WHERE sku = ?), ?, 'receipt', ?)`,
    );
    for (const line of report.lines) {
      insLine.run(receiptId, line.sku, line.expected, line.actual, line.status);
      if (line.actual > 0) {
        addStock.run(line.sku, line.sku, line.actual, at);
        addMovement.run(line.sku, line.sku, line.actual, at);
      }
    }

    db.prepare("UPDATE purchase_orders SET status = 'received' WHERE po_number = ?").run(po.poNumber);

    recordEvent(db, {
      type: "receipt_confirmed",
      operatorId: input.operatorId,
      shiftId: input.shiftId,
      at: deps.now,
      payload: {
        receiptId,
        poNumber: po.poNumber,
        hasDiscrepancy: report.hasDiscrepancy,
        lines: report.lines.length,
        discrepancies: report.lines
          .filter((l) => l.status !== "exact")
          .map((l) => ({ sku: l.sku, status: l.status, difference: l.difference })),
      },
    });

    if (report.hasDiscrepancy) {
      const summary = `PO ${po.poNumber}: ${report.lines
        .filter((l) => l.status !== "exact")
        .map((l) => l.message)
        .join("; ")}`;
      db.prepare(
        "INSERT INTO exceptions (kind, ref_id, summary, operator_id, shift_id, created_at) VALUES ('receiving', ?, ?, ?, ?, ?)",
      ).run(receiptId, summary, input.operatorId, input.shiftId, at);
    }

    return { receiptId, report };
  });
}

export interface RegisterPurchaseOrderInput {
  poNumber: string;
  supplier: string | null;
  lines: ReceivedLineInput[];
  operatorId: string;
  shiftId: string;
}

/**
 * Adds a purchase order the warehouse did not have yet, from a delivery note the clerk
 * photographed and checked. The note is the only record of the order, so its quantities
 * become the ordered quantities. Only known products can be added; the received
 * quantities are still counted and confirmed separately.
 */
export function registerPurchaseOrder(
  db: Db,
  deps: { now: Date },
  input: RegisterPurchaseOrderInput,
): PurchaseOrder {
  if (!isValidActor(db, input.operatorId, input.shiftId)) {
    throw new AppError("unknown_actor", "Choose an operator and shift before adding an order.");
  }
  const poNumber = String(input.poNumber ?? "").replace(/\D/g, "");
  if (poNumber.length < 3) {
    throw new AppError("invalid_request", "A delivery note without a PO number cannot be received.");
  }
  if (db.prepare("SELECT 1 FROM purchase_orders WHERE po_number = ?").get(poNumber)) {
    throw new AppError("conflict", `Purchase order ${poNumber} is already in the system.`, 409);
  }
  const lines = (Array.isArray(input.lines) ? input.lines : []).filter((l) => l && l.qty > 0);
  if (lines.length === 0) {
    throw new AppError("invalid_request", "The note has no product lines that could be added to the order.");
  }
  validateLines(db, lines);
  const merged = new Map<string, number>();
  for (const line of lines) merged.set(line.sku, (merged.get(line.sku) ?? 0) + line.qty);
  const supplier = input.supplier?.trim() || "Unknown supplier";
  const day = dayKey(deps.now);

  inTransaction(db, () => {
    db.prepare("INSERT INTO purchase_orders (po_number, supplier, expected_date, status) VALUES (?, ?, ?, 'open')").run(
      poNumber,
      supplier,
      day,
    );
    const insLine = db.prepare("INSERT INTO po_lines (po_number, sku, description, qty_ordered) VALUES (?, ?, ?, ?)");
    for (const [sku, qty] of merged) insLine.run(poNumber, sku, productName(db, sku), qty);
    recordEvent(db, {
      type: "po_registered",
      operatorId: input.operatorId,
      shiftId: input.shiftId,
      at: deps.now,
      payload: { poNumber, supplier, lines: merged.size },
    });
  });
  return getPurchaseOrder(db, poNumber);
}
