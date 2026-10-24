import { openDatabase, type Db } from "@/lib/db";
import { seedDatabase } from "@/lib/db/seed";

export const FIXED_NOW = new Date(2026, 9, 28, 10, 0, 0);

export function freshDb(now: Date = FIXED_NOW): Db {
  const db = openDatabase(":memory:");
  seedDatabase(db, now);
  return db;
}

export function dump(db: Db): Record<string, unknown[]> {
  const tables = [
    "operators",
    "shifts",
    "locations",
    "products",
    "product_synonyms",
    "stock",
    "movements",
    "purchase_orders",
    "po_lines",
    "receipts",
    "receipt_lines",
    "sales_orders",
    "order_lines",
    "dispatches",
    "counts",
    "equipment_issues",
    "exceptions",
    "events",
  ];
  const out: Record<string, unknown[]> = {};
  for (const t of tables) {
    out[t] = db.prepare(`SELECT * FROM ${t} ORDER BY 1, 2`).all();
  }
  return JSON.parse(JSON.stringify(out));
}
