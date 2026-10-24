import { describe, expect, it } from "vitest";
import { adjustStockFromCount, confirmCount } from "@/lib/services/counting";
import { confirmReceipt } from "@/lib/services/receiving";
import {
  declineAdjustment,
  getStockDetail,
  listCategories,
  listReconciliations,
  searchStock,
} from "@/lib/services/stock";
import { dump, FIXED_NOW, freshDb } from "./helpers";

const controller = { operatorId: "o-esther", shiftId: "s-morning" };
const operator = { operatorId: "o-chebet", shiftId: "s-morning" };
const logistics = { operatorId: "o-kevin", shiftId: "s-morning" };

describe("stock records", () => {
  it("finds products by name, SKU or a common word", () => {
    const db = freshDb();
    expect(searchStock(db, { q: "generator" }).map((r) => r.sku)).toEqual(["001254"]);
    expect(searchStock(db, { q: "001254" })[0].total).toBe(43);
    expect(searchStock(db, { q: "gloves" }).map((r) => r.sku).sort()).toEqual(["300210", "300211"]);
  });

  it("lists everything without a query, and filters by category", () => {
    const db = freshDb();
    expect(searchStock(db).length).toBe(40);
    const chemicals = searchStock(db, { category: "Chemicals" });
    expect(chemicals.length).toBeGreaterThan(0);
    expect(chemicals.every((r) => r.category === "Chemicals")).toBe(true);
    expect(listCategories(db)).toContain("Chemicals");
  });

  it("shows locations, movement history, incoming orders and committed orders", () => {
    const detail = getStockDetail(freshDb(), "001254");
    expect(detail.product.total).toBe(43);
    expect(detail.locations).toEqual([expect.objectContaining({ locationId: "B-4-2", qty: 43 })]);
    expect(detail.movements.length).toBeGreaterThan(3);
    const times = detail.movements.map((m) => m.at);
    expect([...times].sort().reverse()).toEqual(times);
    expect(detail.incoming).toEqual([{ poNumber: "4473", expectedDate: "2026-10-29", qty: 10 }]);
    expect(detail.committed).toEqual([{ orderNumber: "5523", customer: "Nakuru Power Co", qty: 5 }]);
  });

  it("includes recent counts and reflects new receipts in the history", () => {
    const db = freshDb();
    confirmReceipt(db, { now: FIXED_NOW }, {
      poNumber: "4473",
      lines: [{ sku: "001254", qty: 10 }, { sku: "800120", qty: 20 }],
      operatorId: "o-amina",
      shiftId: "s-morning",
    });
    const detail = getStockDetail(db, "001254");
    expect(detail.movements[0]).toMatchObject({ delta: 10, kind: "receipt" });
    expect(detail.product.total).toBe(53);
    expect(getStockDetail(db, "200415").counts[0]).toMatchObject({ variance: -4 });
  });

  it("rejects an unknown product", () => {
    expect(() => getStockDetail(freshDb(), "NOPE")).toThrow(/not found/);
  });
});

describe("reconciliation", () => {
  it("lists the seeded count with a variance as pending", () => {
    const { pending, resolved } = listReconciliations(freshDb());
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({ sku: "200415", variance: -4, status: "pending", countedBy: "Chebet Kiprop" });
    expect(resolved).toEqual([]);
  });

  it("adds a new variance, and leaves out a count that matches", () => {
    const db = freshDb();
    confirmCount(db, { now: FIXED_NOW }, { sku: "200310", locationId: "A-2-1", confirmedQty: 31, ...operator });
    confirmCount(db, { now: FIXED_NOW }, { sku: "100520", locationId: "C-3-1", confirmedQty: 75, ...operator });
    expect(listReconciliations(db).pending.map((r) => r.sku).sort()).toEqual(["200310", "200415"]);
  });

  it("lets an inventory controller approve: stock changes and the count is resolved", () => {
    const db = freshDb();
    const { pending } = listReconciliations(db);
    adjustStockFromCount(db, { now: FIXED_NOW }, { countId: pending[0].countId, ...controller });
    expect(db.prepare("SELECT qty FROM stock WHERE sku = '200415'").get()).toEqual(expect.objectContaining({ qty: 176 }));
    const after = listReconciliations(db);
    expect(after.pending).toEqual([]);
    expect(after.resolved[0]).toMatchObject({ status: "adjusted" });
  });

  it("lets an inventory controller decline: stock is unchanged and the reason is kept", () => {
    const db = freshDb();
    const { pending } = listReconciliations(db);
    declineAdjustment(db, { now: FIXED_NOW }, { countId: pending[0].countId, reason: "Recount tomorrow", ...controller });
    expect(db.prepare("SELECT qty FROM stock WHERE sku = '200415'").get()).toEqual(expect.objectContaining({ qty: 180 }));
    expect(listReconciliations(db).resolved[0]).toMatchObject({ status: "declined", declineReason: "Recount tomorrow" });
    expect(db.prepare("SELECT type FROM events ORDER BY id DESC").get()).toEqual(
      expect.objectContaining({ type: "adjustment_declined" }),
    );
  });

  it("does not allow an adjustment after a decline, or a decline after an adjustment", () => {
    const db = freshDb();
    const id = listReconciliations(db).pending[0].countId;
    declineAdjustment(db, { now: FIXED_NOW }, { countId: id, ...controller });
    expect(() => adjustStockFromCount(db, { now: FIXED_NOW }, { countId: id, ...controller })).toThrow(/declined/);
    const other = freshDb();
    const otherId = listReconciliations(other).pending[0].countId;
    adjustStockFromCount(other, { now: FIXED_NOW }, { countId: otherId, ...controller });
    expect(() => declineAdjustment(other, { now: FIXED_NOW }, { countId: otherId, ...controller })).toThrow(/already been reconciled/);
  });

  it("refuses roles without the capability, changing nothing", () => {
    const db = freshDb();
    const before = dump(db);
    const id = listReconciliations(db).pending[0].countId;
    expect(() => adjustStockFromCount(db, { now: FIXED_NOW }, { countId: id, ...operator })).toThrow(/Only a supervisor or inventory controller/);
    expect(() => adjustStockFromCount(db, { now: FIXED_NOW }, { countId: id, ...logistics })).toThrow(/Only a supervisor or inventory controller/);
    expect(() => declineAdjustment(db, { now: FIXED_NOW }, { countId: id, ...operator })).toThrow(/Only a supervisor or inventory controller/);
    expect(dump(db)).toEqual(before);
  });
});
