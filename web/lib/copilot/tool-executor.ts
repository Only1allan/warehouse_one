import type { Db } from "../db";
import {
  findProducts,
  isFollowUpReference,
  loadProducts,
  type ProductRow,
} from "../domain/product-search";
import { addDays, dayKey } from "../time";
import type { Card, ConversationContext, ProductRef } from "./cards";

export interface ToolOutcome {
  card: Card;
  text: string;
  context?: ConversationContext;
}

const ref = (p: ProductRow): ProductRef => ({
  sku: p.sku,
  name: p.name,
  unit: p.unit,
  category: p.category,
});

const plural = (unit: string, n: number) => (n === 1 ? unit : `${unit}s`);

function describeLocation(row: { id: string; aisle: string; rack: number; shelf: number }): string {
  if (row.id === "QUAR") return "the quarantine area (QUAR)";
  return `Aisle ${row.aisle}, Rack ${row.rack}, Shelf ${row.shelf} (${row.id})`;
}

function resolveProduct(
  db: Db,
  rawQuery: unknown,
  context: ConversationContext,
): { product: ProductRow } | { outcome: ToolOutcome } {
  const query = typeof rawQuery === "string" ? rawQuery.trim() : "";
  if (isFollowUpReference(query) && context.lastSku) {
    const hit = loadProducts(db).find((p) => p.sku === context.lastSku);
    if (hit) return { product: hit };
  }
  if (!query) {
    return {
      outcome: {
        card: { kind: "not_found", query: "", what: "product" },
        text: "Which product do you mean? Tell me its name or SKU.",
      },
    };
  }
  const found = findProducts(db, query);
  if (found.kind === "exact") return { product: found.product };
  if (found.kind === "ambiguous") {
    return {
      outcome: {
        card: {
          kind: "candidates",
          query,
          products: found.products.map((p) => ({ sku: p.sku, name: p.name, category: p.category })),
        },
        text: `I found ${found.products.length} products matching “${query}”. Which one do you mean?`,
      },
    };
  }
  return {
    outcome: {
      card: { kind: "not_found", query, what: "product" },
      text: `I couldn't find a product matching “${query}”. Check the name or the SKU.`,
    },
  };
}

export function getStockLevel(db: Db, args: Record<string, unknown>, context: ConversationContext): ToolOutcome {
  const resolved = resolveProduct(db, args.query, context);
  if ("outcome" in resolved) return resolved.outcome;
  const p = resolved.product;
  const locations = (
    db
      .prepare("SELECT location_id, qty, last_moved_at FROM stock WHERE sku = ? ORDER BY qty DESC, location_id")
      .all(p.sku) as Array<{ location_id: string; qty: number; last_moved_at: string }>
  ).map((r) => ({ locationId: r.location_id, qty: r.qty, lastMovedAt: r.last_moved_at }));
  const total = locations.reduce((sum, l) => sum + l.qty, 0);
  const belowMinimum = p.minStock > 0 && total <= p.minStock;
  let text = `We currently have ${total} ${plural(p.unit, total)} of ${p.name} in stock`;
  text += locations.length > 1 ? `, across ${locations.length} locations.` : ".";
  if (belowMinimum) text += ` That is at or below the minimum of ${p.minStock}.`;
  return {
    card: { kind: "stock", product: ref(p), total, minStock: p.minStock, belowMinimum, locations },
    text,
    context: { lastSku: p.sku, lastLocationId: locations[0]?.locationId },
  };
}

export function findLocation(db: Db, args: Record<string, unknown>, context: ConversationContext): ToolOutcome {
  const resolved = resolveProduct(db, args.query, context);
  if ("outcome" in resolved) return resolved.outcome;
  const p = resolved.product;
  const rows = db
    .prepare(
      `SELECT l.id, l.aisle, l.rack, l.shelf, s.qty
       FROM stock s JOIN locations l ON l.id = s.location_id
       WHERE s.sku = ? ORDER BY (l.id = ?) DESC, s.qty DESC, l.id`,
    )
    .all(p.sku, p.defaultLocationId) as Array<{ id: string; aisle: string; rack: number; shelf: number; qty: number }>;
  const locations = rows.map((r) => ({ locationId: r.id, label: describeLocation(r), qty: r.qty }));
  let text: string;
  if (rows.length === 0) {
    text = `${p.name} (SKU ${p.sku}) has no stock record at any location.`;
  } else if (rows.length === 1) {
    text = `${p.name} (SKU ${p.sku}) is in ${locations[0].label}.`;
  } else {
    text = `${p.name} (SKU ${p.sku}) is stored in ${rows.length} locations: ${locations
      .map((l) => `${l.label} with ${l.qty}`)
      .join("; ")}.`;
  }
  return {
    card: { kind: "location", product: ref(p), locations },
    text,
    context: { lastSku: p.sku, lastLocationId: rows[0]?.id },
  };
}

const PLACEHOLDER_CATEGORIES = new Set([
  "",
  "none",
  "null",
  "undefined",
  "all",
  "any",
  "everything",
  "running low",
  "low stock",
  "below minimum",
  "below minimum levels",
]);

export function listBelowMinimum(db: Db, args: Record<string, unknown>): ToolOutcome {
  const raw = typeof args.category === "string" ? args.category.trim() : "";
  const lower = raw.toLowerCase();

  // The model often fills an optional argument with a placeholder. A filter is
  // valid only when it names a category that actually exists in the seeded DB.
  const categories = (
    db.prepare("SELECT DISTINCT category FROM products").all() as Array<{ category: string }>
  ).map((row) => row.category.toLowerCase());

  const exact = categories.find((name) => name === lower);
  const partial = lower.length >= 4 ? categories.filter((name) => name.includes(lower)) : [];
  const valid =
    !PLACEHOLDER_CATEGORIES.has(lower) && (exact ?? (partial.length === 1 ? partial[0] : undefined));
  const category = valid ? (exact ?? partial[0] ?? "") : "";

  const rows = db
    .prepare(
      `SELECT p.sku, p.name, p.unit, p.category, p.min_stock, COALESCE(SUM(s.qty), 0) AS total
       FROM products p LEFT JOIN stock s ON s.sku = p.sku
       GROUP BY p.sku
       HAVING p.min_stock > 0 AND total <= p.min_stock
       ORDER BY (CAST(total AS REAL) / p.min_stock), p.name`,
    )
    .all() as Array<{ sku: string; name: string; unit: string; category: string; min_stock: number; total: number }>;
  const items = rows
    .filter((r) => !category || r.category.toLowerCase().includes(category))
    .map((r) => ({ sku: r.sku, name: r.name, unit: r.unit, total: r.total, minStock: r.min_stock }));
  const text =
    items.length === 0
      ? "Nothing is at or below its minimum level right now."
      : `${items.length} ${items.length === 1 ? "product is" : "products are"} at or below ${
          items.length === 1 ? "its" : "their"
        } minimum level.`;
  return { card: { kind: "below_minimum", items }, text };
}

function resolveDate(raw: unknown, now: Date): { date: string; label: string } {
  const value = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const label = value === dayKey(now) ? "today" : value === dayKey(addDays(now, 1)) ? "tomorrow" : `on ${value}`;
    return { date: value, label };
  }
  if (value.includes("tomorrow")) return { date: dayKey(addDays(now, 1)), label: "tomorrow" };
  if (value.includes("yesterday")) return { date: dayKey(addDays(now, -1)), label: "yesterday" };
  return { date: dayKey(now), label: "today" };
}

export function getReceivingSchedule(db: Db, args: Record<string, unknown>, now: Date): ToolOutcome {
  const { date, label } = resolveDate(args.date, now);
  const pos = db
    .prepare("SELECT po_number, supplier, status FROM purchase_orders WHERE expected_date = ? ORDER BY po_number")
    .all(date) as Array<{ po_number: string; supplier: string; status: "open" | "received" }>;
  const lineStmt = db.prepare("SELECT description, qty_ordered FROM po_lines WHERE po_number = ? ORDER BY id");
  const orders = pos.map((po) => ({
    poNumber: po.po_number,
    supplier: po.supplier,
    status: po.status,
    lines: (lineStmt.all(po.po_number) as Array<{ description: string; qty_ordered: number }>).map((l) => ({
      description: l.description,
      qty: l.qty_ordered,
    })),
  }));
  const text =
    orders.length === 0
      ? `No deliveries are due ${label}.`
      : `${orders.length} ${orders.length === 1 ? "delivery is" : "deliveries are"} due ${label}: ${orders
          .map((o) => `PO ${o.poNumber} from ${o.supplier}`)
          .join("; ")}.`;
  return { card: { kind: "schedule", date, label, orders }, text };
}

export function getPo(db: Db, args: Record<string, unknown>, now: Date): ToolOutcome {
  const raw = typeof args.po_number === "string" || typeof args.po_number === "number" ? String(args.po_number) : "";
  const poNumber = raw.replace(/\D/g, "");
  const po = poNumber
    ? (db.prepare("SELECT po_number, supplier, expected_date, status FROM purchase_orders WHERE po_number = ?").get(poNumber) as
        | { po_number: string; supplier: string; expected_date: string; status: "open" | "received" }
        | undefined)
    : undefined;
  if (!po) {
    return {
      card: { kind: "not_found", query: raw || "(none)", what: "purchase_order" },
      text: `I couldn't find purchase order ${raw || "with that number"}.`,
    };
  }
  const lines = (
    db.prepare("SELECT sku, description, qty_ordered FROM po_lines WHERE po_number = ? ORDER BY id").all(po.po_number) as Array<{
      sku: string;
      description: string;
      qty_ordered: number;
    }>
  ).map((l) => ({ sku: l.sku, description: l.description, qty: l.qty_ordered }));
  const when = resolveDate(po.expected_date, now).label;
  const state = po.status === "received" ? "was due" : "is due";
  return {
    card: {
      kind: "po",
      poNumber: po.po_number,
      supplier: po.supplier,
      expectedDate: po.expected_date,
      status: po.status,
      lines,
    },
    text: `PO ${po.po_number} from ${po.supplier} ${state} ${when}, with ${lines.length} ${
      lines.length === 1 ? "line" : "lines"
    }${po.status === "received" ? " and has been received" : ""}.`,
  };
}

export function executeDatabaseTool(
  db: Db,
  now: Date,
  name: string,
  args: Record<string, unknown>,
  context: ConversationContext,
): ToolOutcome | null {
  switch (name) {
    case "get_stock_level":
      return getStockLevel(db, args, context);
    case "find_location":
      return findLocation(db, args, context);
    case "list_below_minimum":
      return listBelowMinimum(db, args);
    case "get_receiving_schedule":
      return getReceivingSchedule(db, args, now);
    case "get_po":
      return getPo(db, args, now);
    default:
      return null;
  }
}
