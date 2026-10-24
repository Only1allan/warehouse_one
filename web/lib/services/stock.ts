import type { Db } from "../db";
import { inTransaction } from "../db";
import { can, isRole } from "../auth/capabilities";
import { AppError } from "../errors";
import { recordEvent } from "../events";
import { isValidActor } from "./session";

export interface StockRow {
  sku: string;
  name: string;
  category: string;
  unit: string;
  total: number;
  minStock: number;
  reorderLevel: number;
  locations: number;
  lastMovedAt: string | null;
}

export function searchStock(db: Db, input: { q?: string; category?: string } = {}): StockRow[] {
  const like = `%${(input.q ?? "").trim().toLowerCase()}%`;
  const category = input.category?.trim() || null;
  const rows = db
    .prepare(
      `SELECT p.sku, p.name, p.category, p.unit, p.min_stock, p.reorder_level,
              COALESCE(SUM(s.qty), 0) AS total, COUNT(s.location_id) AS locations, MAX(s.last_moved_at) AS last_moved
       FROM products p LEFT JOIN stock s ON s.sku = p.sku
       WHERE (? = '%%' OR lower(p.name) LIKE ? OR lower(p.sku) LIKE ?
              OR EXISTS (SELECT 1 FROM product_synonyms y WHERE y.sku = p.sku AND y.synonym LIKE ?))
         AND (? IS NULL OR p.category = ?)
       GROUP BY p.sku ORDER BY p.name`,
    )
    .all(like, like, like, like, category, category) as Array<{
    sku: string;
    name: string;
    category: string;
    unit: string;
    min_stock: number;
    reorder_level: number;
    total: number;
    locations: number;
    last_moved: string | null;
  }>;
  return rows.map((r) => ({
    sku: r.sku,
    name: r.name,
    category: r.category,
    unit: r.unit,
    total: r.total,
    minStock: r.min_stock,
    reorderLevel: r.reorder_level,
    locations: r.locations,
    lastMovedAt: r.last_moved,
  }));
}

export function listCategories(db: Db): string[] {
  return (db.prepare("SELECT DISTINCT category FROM products ORDER BY category").all() as Array<{ category: string }>).map(
    (r) => r.category,
  );
}

export interface StockDetail {
  product: StockRow;
  locations: Array<{ locationId: string; qty: number; lastMovedAt: string }>;
  movements: Array<{ at: string; locationId: string; delta: number; kind: string }>;
  incoming: Array<{ poNumber: string; expectedDate: string; qty: number }>;
  committed: Array<{ orderNumber: string; customer: string; qty: number }>;
  counts: Array<{ id: number; locationId: string; expected: number; confirmed: number; variance: number; countedAt: string }>;
}

export function getStockDetail(db: Db, sku: string): StockDetail {
  const product = searchStock(db, { q: sku }).find((p) => p.sku === sku);
  if (!product) throw new AppError("not_found", `Product ${sku} was not found.`, 404);
  const locations = (
    db.prepare("SELECT location_id, qty, last_moved_at FROM stock WHERE sku = ? ORDER BY qty DESC").all(sku) as Array<{
      location_id: string;
      qty: number;
      last_moved_at: string;
    }>
  ).map((r) => ({ locationId: r.location_id, qty: r.qty, lastMovedAt: r.last_moved_at }));
  const movements = (
    db
      .prepare("SELECT at, location_id, delta, kind FROM movements WHERE sku = ? ORDER BY at DESC, id DESC LIMIT 20")
      .all(sku) as Array<{ at: string; location_id: string; delta: number; kind: string }>
  ).map((r) => ({ at: r.at, locationId: r.location_id, delta: r.delta, kind: r.kind }));
  const incoming = (
    db
      .prepare(
        `SELECT p.po_number, p.expected_date, l.qty_ordered FROM po_lines l
         JOIN purchase_orders p ON p.po_number = l.po_number WHERE l.sku = ? AND p.status = 'open' ORDER BY p.expected_date`,
      )
      .all(sku) as Array<{ po_number: string; expected_date: string; qty_ordered: number }>
  ).map((r) => ({ poNumber: r.po_number, expectedDate: r.expected_date, qty: r.qty_ordered }));
  const committed = (
    db
      .prepare(
        `SELECT o.order_number, o.customer, l.qty_ordered FROM order_lines l
         JOIN sales_orders o ON o.order_number = l.order_number WHERE l.sku = ? AND o.status = 'open' ORDER BY o.order_number`,
      )
      .all(sku) as Array<{ order_number: string; customer: string; qty_ordered: number }>
  ).map((r) => ({ orderNumber: r.order_number, customer: r.customer, qty: r.qty_ordered }));
  const counts = (
    db
      .prepare(
        "SELECT id, location_id, expected_qty, confirmed_qty, variance, counted_at FROM counts WHERE sku = ? ORDER BY counted_at DESC LIMIT 5",
      )
      .all(sku) as Array<{
      id: number;
      location_id: string;
      expected_qty: number;
      confirmed_qty: number;
      variance: number;
      counted_at: string;
    }>
  ).map((r) => ({
    id: r.id,
    locationId: r.location_id,
    expected: r.expected_qty,
    confirmed: r.confirmed_qty,
    variance: r.variance,
    countedAt: r.counted_at,
  }));
  return { product, locations, movements, incoming, committed, counts };
}

export interface Reconciliation {
  countId: number;
  sku: string;
  name: string;
  locationId: string;
  expected: number;
  confirmed: number;
  variance: number;
  countedAt: string;
  countedBy: string;
  status: "pending" | "adjusted" | "declined";
  declineReason: string | null;
}

export function listReconciliations(db: Db): { pending: Reconciliation[]; resolved: Reconciliation[] } {
  const rows = db
    .prepare(
      `SELECT c.id, c.sku, p.name, c.location_id, c.expected_qty, c.confirmed_qty, c.variance, c.counted_at,
              c.adjusted_at, c.declined_at, c.decline_reason, o.name AS counted_by
       FROM counts c JOIN products p ON p.sku = c.sku JOIN operators o ON o.id = c.operator_id
       WHERE c.variance != 0 ORDER BY c.counted_at DESC, c.id DESC`,
    )
    .all() as Array<{
    id: number;
    sku: string;
    name: string;
    location_id: string;
    expected_qty: number;
    confirmed_qty: number;
    variance: number;
    counted_at: string;
    adjusted_at: string | null;
    declined_at: string | null;
    decline_reason: string | null;
    counted_by: string;
  }>;
  const all: Reconciliation[] = rows.map((r) => ({
    countId: r.id,
    sku: r.sku,
    name: r.name,
    locationId: r.location_id,
    expected: r.expected_qty,
    confirmed: r.confirmed_qty,
    variance: r.variance,
    countedAt: r.counted_at,
    countedBy: r.counted_by,
    status: r.adjusted_at ? "adjusted" : r.declined_at ? "declined" : "pending",
    declineReason: r.decline_reason,
  }));
  return {
    pending: all.filter((r) => r.status === "pending"),
    resolved: all.filter((r) => r.status !== "pending").slice(0, 10),
  };
}

export function declineAdjustment(
  db: Db,
  deps: { now: Date },
  input: { countId: number; reason?: string; operatorId: string; shiftId: string },
): { countId: number } {
  if (!isValidActor(db, input.operatorId, input.shiftId)) {
    throw new AppError("unknown_actor", "Sign in before declining an adjustment.");
  }
  const role = (db.prepare("SELECT role FROM operators WHERE id = ?").get(input.operatorId) as { role: string }).role;
  if (!isRole(role) || !can(role, "stock_adjust")) {
    throw new AppError("forbidden", "Only a supervisor or inventory controller can decline an adjustment.", 403);
  }
  const count = db
    .prepare("SELECT id, variance, adjusted_at, declined_at FROM counts WHERE id = ?")
    .get(input.countId) as { id: number; variance: number; adjusted_at: string | null; declined_at: string | null } | undefined;
  if (!count) throw new AppError("not_found", `Count ${input.countId} was not found.`, 404);
  if (count.adjusted_at || count.declined_at) {
    throw new AppError("conflict", "This count has already been reconciled.", 409);
  }
  if (count.variance === 0) throw new AppError("invalid_request", "This count has no variance to reconcile.");
  const reason = input.reason?.trim() || "No reason given";
  const at = deps.now.toISOString();
  return inTransaction(db, () => {
    db.prepare("UPDATE counts SET declined_at = ?, decline_reason = ? WHERE id = ?").run(at, reason, count.id);
    recordEvent(db, {
      type: "adjustment_declined",
      operatorId: input.operatorId,
      shiftId: input.shiftId,
      at: deps.now,
      payload: { countId: count.id, reason },
    });
    return { countId: count.id };
  });
}
