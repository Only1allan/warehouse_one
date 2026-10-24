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
import { isValidActor } from "./session";

export interface OrderSummary {
  orderNumber: string;
  customer: string;
  destination: string;
  status: "open" | "dispatched";
  lineCount: number;
}

export interface OrderLine {
  sku: string;
  name: string;
  qtyOrdered: number;
  qtyLoaded: number | null;
}

export interface Order extends OrderSummary {
  lines: OrderLine[];
}

export interface NamedLine extends DiscrepancyLine {
  name: string;
  message: string;
}

export interface DispatchReport {
  orderNumber: string;
  lines: NamedLine[];
  hasDiscrepancy: boolean;
}

export interface LoadedLineInput {
  sku: string;
  qty: number;
}

export function listOrders(db: Db, filter: { status?: "open" | "dispatched" } = {}): OrderSummary[] {
  const rows = db
    .prepare(
      `SELECT o.order_number, o.customer, o.destination, o.status,
              (SELECT COUNT(*) FROM order_lines l WHERE l.order_number = o.order_number) AS line_count
       FROM sales_orders o WHERE (? IS NULL OR o.status = ?) ORDER BY o.order_number`,
    )
    .all(filter.status ?? null, filter.status ?? null) as Array<{
    order_number: string;
    customer: string;
    destination: string;
    status: "open" | "dispatched";
    line_count: number;
  }>;
  return rows.map((r) => ({
    orderNumber: r.order_number,
    customer: r.customer,
    destination: r.destination,
    status: r.status,
    lineCount: r.line_count,
  }));
}

export function getOrder(db: Db, orderNumber: string): Order {
  const header = db
    .prepare("SELECT order_number, customer, destination, status FROM sales_orders WHERE order_number = ?")
    .get(orderNumber) as
    | { order_number: string; customer: string; destination: string; status: "open" | "dispatched" }
    | undefined;
  if (!header) throw new AppError("not_found", `Order ${orderNumber} was not found.`, 404);
  const lines = (
    db
      .prepare(
        `SELECT l.sku, p.name, l.qty_ordered, l.qty_loaded FROM order_lines l
         JOIN products p ON p.sku = l.sku WHERE l.order_number = ? ORDER BY l.id`,
      )
      .all(orderNumber) as Array<{ sku: string; name: string; qty_ordered: number; qty_loaded: number | null }>
  ).map((l) => ({ sku: l.sku, name: l.name, qtyOrdered: l.qty_ordered, qtyLoaded: l.qty_loaded }));
  return {
    orderNumber: header.order_number,
    customer: header.customer,
    destination: header.destination,
    status: header.status,
    lineCount: lines.length,
    lines,
  };
}

function validateLines(db: Db, lines: LoadedLineInput[]): void {
  if (!Array.isArray(lines)) throw new AppError("invalid_request", "Loaded quantities are required.");
  const known = db.prepare("SELECT 1 FROM products WHERE sku = ?");
  for (const line of lines) {
    if (!Number.isInteger(line.qty) || line.qty < 0) {
      throw new AppError("invalid_request", `Quantity for ${line.sku} must be a whole number of zero or more.`);
    }
    if (!known.get(line.sku)) throw new AppError("invalid_request", `Unknown SKU ${line.sku}.`);
  }
}

export function compareDispatch(db: Db, input: { orderNumber: string; lines: LoadedLineInput[] }): DispatchReport {
  const order = getOrder(db, input.orderNumber);
  validateLines(db, input.lines);
  const expected: QuantityLine[] = order.lines.map((l) => ({ sku: l.sku, qty: l.qtyOrdered }));
  const report = computeDiscrepancy(expected, input.lines);
  const names = new Map(order.lines.map((l) => [l.sku, l.name]));
  return {
    orderNumber: order.orderNumber,
    hasDiscrepancy: report.hasDiscrepancy,
    lines: report.lines.map((line) => {
      const name =
        names.get(line.sku) ??
        (db.prepare("SELECT name FROM products WHERE sku = ?").get(line.sku) as { name: string }).name;
      return { ...line, name, message: describeDiscrepancy(line, name, "dispatch") };
    }),
  };
}

export interface ConfirmDispatchInput {
  orderNumber: string;
  lines: LoadedLineInput[];
  operatorId: string;
  shiftId: string;
}

export function confirmDispatch(
  db: Db,
  deps: { now: Date },
  input: ConfirmDispatchInput,
): { dispatchId: number; report: DispatchReport } {
  if (!isValidActor(db, input.operatorId, input.shiftId)) {
    throw new AppError("unknown_actor", "Sign in before confirming a dispatch.");
  }
  const order = getOrder(db, input.orderNumber);
  if (order.status === "dispatched") {
    throw new AppError("conflict", `Order ${order.orderNumber} has already been dispatched.`, 409);
  }
  const report = compareDispatch(db, { orderNumber: input.orderNumber, lines: input.lines });
  const at = deps.now.toISOString();

  // Check stock for every line first, so a failure changes nothing.
  const available = db.prepare("SELECT COALESCE(SUM(qty), 0) AS q FROM stock WHERE sku = ?");
  for (const line of report.lines) {
    const have = (available.get(line.sku) as { q: number }).q;
    if (line.actual > have) {
      throw new AppError(
        "conflict",
        `Not enough stock of ${line.name}: ${have} on record, ${line.actual} being loaded.`,
        409,
      );
    }
  }

  return inTransaction(db, () => {
    const dispatchId = Number(
      db
        .prepare(
          "INSERT INTO dispatches (order_number, operator_id, shift_id, dispatched_at, has_shortfall) VALUES (?, ?, ?, ?, ?)",
        )
        .run(order.orderNumber, input.operatorId, input.shiftId, at, report.hasDiscrepancy ? 1 : 0).lastInsertRowid,
    );

    const locationsFor = db.prepare(
      `SELECT s.location_id, s.qty FROM stock s JOIN products p ON p.sku = s.sku
       WHERE s.sku = ? AND s.qty > 0 ORDER BY (s.location_id = p.default_location_id) DESC, s.qty DESC`,
    );
    const take = db.prepare("UPDATE stock SET qty = qty - ?, last_moved_at = ? WHERE sku = ? AND location_id = ?");
    const move = db.prepare(
      "INSERT INTO movements (sku, location_id, delta, kind, at) VALUES (?, ?, ?, 'dispatch', ?)",
    );
    const setLoaded = db.prepare("UPDATE order_lines SET qty_loaded = ? WHERE order_number = ? AND sku = ?");
    for (const line of report.lines) {
      if (line.status !== "unexpected") setLoaded.run(line.actual, order.orderNumber, line.sku);
      let remaining = line.actual;
      for (const loc of locationsFor.all(line.sku) as Array<{ location_id: string; qty: number }>) {
        if (remaining <= 0) break;
        const n = Math.min(remaining, loc.qty);
        take.run(n, at, line.sku, loc.location_id);
        move.run(line.sku, loc.location_id, -n, at);
        remaining -= n;
      }
    }
    db.prepare("UPDATE sales_orders SET status = 'dispatched' WHERE order_number = ?").run(order.orderNumber);

    recordEvent(db, {
      type: "dispatch_confirmed",
      operatorId: input.operatorId,
      shiftId: input.shiftId,
      at: deps.now,
      payload: {
        dispatchId,
        orderNumber: order.orderNumber,
        hasShortfall: report.hasDiscrepancy,
        discrepancies: report.lines
          .filter((l) => l.status !== "exact")
          .map((l) => ({ sku: l.sku, status: l.status, difference: l.difference })),
      },
    });
    if (report.hasDiscrepancy) {
      const summary = `Order ${order.orderNumber}: ${report.lines
        .filter((l) => l.status !== "exact")
        .map((l) => l.message)
        .join("; ")}`;
      db.prepare(
        "INSERT INTO exceptions (kind, ref_id, summary, operator_id, shift_id, created_at) VALUES ('dispatch', ?, ?, ?, ?, ?)",
      ).run(dispatchId, summary, input.operatorId, input.shiftId, at);
    }
    return { dispatchId, report };
  });
}
