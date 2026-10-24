import { describe, expect, it } from "vitest";
import { openDatabase } from "@/lib/db";
import { seedDatabase } from "@/lib/db/seed";
import { listEvents, recordEvent } from "@/lib/events";
import { addDays, dayKey } from "@/lib/time";
import { dump, FIXED_NOW, freshDb } from "./helpers";

const one = <T>(db: ReturnType<typeof freshDb>, sql: string, ...args: never[]) =>
  db.prepare(sql).get(...args) as T;

describe("reseed", () => {
  it("gives identical data when run twice at the same moment", () => {
    const db = openDatabase(":memory:");
    seedDatabase(db, FIXED_NOW);
    const first = dump(db);
    seedDatabase(db, FIXED_NOW);
    expect(dump(db)).toEqual(first);
  });

  it("restores the demo state after the data has been changed", () => {
    const db = freshDb();
    const before = dump(db);
    db.exec("UPDATE stock SET qty = 0; DELETE FROM events;");
    seedDatabase(db, FIXED_NOW);
    expect(dump(db)).toEqual(before);
  });

  it("seeds roughly the agreed volume of data", () => {
    const db = openDatabase(":memory:");
    const summary = seedDatabase(db, FIXED_NOW);
    expect(summary.products).toBe(40);
    expect(summary.locations).toBeGreaterThanOrEqual(30);
    expect(summary.purchaseOrders).toBeGreaterThanOrEqual(5);
    expect(summary.salesOrders).toBeGreaterThanOrEqual(6);
  });
});

describe("named demo cases", () => {
  it("has the generators case: 43 units in one location", () => {
    const db = freshDb();
    const row = one<{ qty: number; location_id: string }>(
      db,
      "SELECT qty, location_id FROM stock WHERE sku = '001254'",
    );
    expect(row).toEqual(expect.objectContaining({ qty: 43, location_id: "B-4-2" }));
  });

  it("has PO 4471 due today expecting 150 cartons", () => {
    const db = freshDb();
    const po = one<{ expected_date: string }>(
      db,
      "SELECT expected_date FROM purchase_orders WHERE po_number = '4471'",
    );
    expect(po.expected_date).toBe(dayKey(FIXED_NOW));
    const line = one<{ qty_ordered: number }>(
      db,
      "SELECT qty_ordered FROM po_lines WHERE po_number = '4471' AND sku = '100201'",
    );
    expect(line.qty_ordered).toBe(150);
  });

  it("has sales order 5521 for 50 pallets, not yet loaded", () => {
    const db = freshDb();
    const line = one<{ qty_ordered: number; qty_loaded: number | null }>(
      db,
      "SELECT qty_ordered, qty_loaded FROM order_lines WHERE order_number = '5521'",
    );
    expect(line).toEqual({ qty_ordered: 50, qty_loaded: null });
  });

  it("has a shelf expected to hold 35 units", () => {
    const db = freshDb();
    const row = one<{ qty: number }>(
      db,
      "SELECT qty FROM stock WHERE sku = '200310' AND location_id = 'A-2-1'",
    );
    expect(row.qty).toBe(35);
  });

  it("keeps stock equal to the sum of its movements", () => {
    const db = freshDb();
    const mismatches = db
      .prepare(
        `SELECT s.sku, s.location_id FROM stock s
         WHERE s.qty != (SELECT COALESCE(SUM(delta), 0) FROM movements m
                         WHERE m.sku = s.sku AND m.location_id = s.location_id)`,
      )
      .all();
    expect(mismatches).toEqual([]);
  });
});

describe("health categories are all represented", () => {
  const daysSinceMove = (db: ReturnType<typeof freshDb>) =>
    db
      .prepare(
        `SELECT p.sku, p.min_stock, p.reorder_level,
                SUM(s.qty) AS qty, MAX(s.last_moved_at) AS last_moved
         FROM products p JOIN stock s ON s.sku = p.sku GROUP BY p.sku`,
      )
      .all() as Array<{
      sku: string;
      min_stock: number;
      reorder_level: number;
      qty: number;
      last_moved: string;
    }>;
  const age = (iso: string) =>
    Math.floor((FIXED_NOW.getTime() - new Date(iso).getTime()) / 86_400_000);

  it("has dead, slow-moving, stockout-risk and overstock products", () => {
    const rows = daysSinceMove(freshDb());
    expect(rows.filter((r) => age(r.last_moved) >= 90).length).toBeGreaterThanOrEqual(1);
    expect(
      rows.filter((r) => age(r.last_moved) >= 30 && age(r.last_moved) < 90).length,
    ).toBeGreaterThanOrEqual(1);
    expect(rows.filter((r) => r.qty <= r.min_stock && r.min_stock > 0).length).toBeGreaterThanOrEqual(1);
    expect(rows.filter((r) => r.qty >= 3 * r.reorder_level).length).toBeGreaterThanOrEqual(1);
  });
});

describe("event recording", () => {
  it("stores type, operator, shift, time and payload", () => {
    const db = freshDb();
    const at = addDays(FIXED_NOW, 0);
    const id = recordEvent(db, {
      type: "count_confirmed",
      operatorId: "o-amina",
      shiftId: "s-morning",
      at,
      payload: { sku: "200310", variance: -4 },
    });
    const stored = listEvents(db).find((e) => e.id === id);
    expect(stored).toEqual({
      id,
      type: "count_confirmed",
      operatorId: "o-amina",
      shiftId: "s-morning",
      at: at.toISOString(),
      payload: { sku: "200310", variance: -4 },
    });
  });

  it("returns only events inside a time window", () => {
    const db = freshDb();
    const from = addDays(FIXED_NOW, -1);
    from.setHours(0, 0, 0, 0);
    const to = new Date(from.getTime() + 86_400_000);
    const inside = listEvents(db, { from, to });
    expect(inside.length).toBeGreaterThan(0);
    for (const e of inside) {
      expect(new Date(e.at).getTime()).toBeGreaterThanOrEqual(from.getTime());
      expect(new Date(e.at).getTime()).toBeLessThan(to.getTime());
    }
  });
});
