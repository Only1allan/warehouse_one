import { describe, expect, it } from "vitest";
import { computeVariance, describeVariance } from "@/lib/domain/variance";
import {
  adjustStockFromCount,
  confirmCount,
  getCount,
  listCountTargets,
} from "@/lib/services/counting";
import { dump, FIXED_NOW, freshDb } from "./helpers";

const operator = { operatorId: "o-chebet", shiftId: "s-morning" };
const supervisor = { operatorId: "o-daniel", shiftId: "s-morning" };
const qtyAt = (db: ReturnType<typeof freshDb>, sku: string, loc: string) =>
  (db.prepare("SELECT qty FROM stock WHERE sku = ? AND location_id = ?").get(sku, loc) as { qty: number }).qty;
const exceptions = (db: ReturnType<typeof freshDb>) =>
  (db.prepare("SELECT COUNT(*) AS n FROM exceptions WHERE kind = 'count'").get() as { n: number }).n;

describe("variance", () => {
  it.each([
    [35, 31, -4],
    [35, 38, 3],
    [35, 35, 0],
  ])("expected %i, counted %i gives %i", (expected, counted, variance) => {
    expect(computeVariance(expected, counted)).toBe(variance);
  });

  it("describes the demo case in plain words", () => {
    expect(describeVariance("Hydraulic Hose Kit", 35, 31)).toBe(
      "Hydraulic Hose Kit: expected 35, counted 31 (variance -4)",
    );
  });
});

describe("counting", () => {
  it("lists stock locations to count and filters by text", () => {
    const db = freshDb();
    const all = listCountTargets(db);
    expect(all.length).toBeGreaterThan(30);
    const hose = listCountTargets(db, "hose");
    expect(hose).toEqual([
      { sku: "200310", name: "Hydraulic Hose Kit", locationId: "A-2-1", expectedQty: 35 },
    ]);
  });

  it("the 35 expected versus 31 counted case records variance -4 and raises an exception", () => {
    const db = freshDb();
    const before = exceptions(db);
    const record = confirmCount(db, { now: FIXED_NOW }, {
      sku: "200310", locationId: "A-2-1", confirmedQty: 31, ...operator,
    });
    expect(record).toMatchObject({ expectedQty: 35, confirmedQty: 31, variance: -4 });
    expect(exceptions(db)).toBe(before + 1);
    const event = db.prepare("SELECT type FROM events ORDER BY id DESC").get();
    expect(event).toEqual(expect.objectContaining({ type: "count_confirmed" }));
  });

  it("does not change stock when a count with variance is confirmed", () => {
    const db = freshDb();
    confirmCount(db, { now: FIXED_NOW }, { sku: "200310", locationId: "A-2-1", confirmedQty: 31, ...operator });
    expect(qtyAt(db, "200310", "A-2-1")).toBe(35);
  });

  it("a matching count closes with no exception", () => {
    const db = freshDb();
    const before = exceptions(db);
    const record = confirmCount(db, { now: FIXED_NOW }, { sku: "200310", locationId: "A-2-1", confirmedQty: 35, ...operator });
    expect(record.variance).toBe(0);
    expect(exceptions(db)).toBe(before);
  });

  it("keeps the model's proposal separate from the confirmed value", () => {
    const db = freshDb();
    const record = confirmCount(db, { now: FIXED_NOW }, {
      sku: "200310", locationId: "A-2-1", confirmedQty: 33, proposedQty: 31, photoPath: "uploads/a.jpg", ...operator,
    });
    expect(getCount(db, record.id)).toMatchObject({ proposedQty: 31, confirmedQty: 33, photoPath: "uploads/a.jpg" });
  });

  it("rejects bad input and changes nothing", () => {
    const db = freshDb();
    const before = dump(db);
    expect(() => confirmCount(db, { now: FIXED_NOW }, { sku: "200310", locationId: "A-2-1", confirmedQty: -1, ...operator })).toThrow(/whole number/);
    expect(() => confirmCount(db, { now: FIXED_NOW }, { sku: "200310", locationId: "Z-9-9", confirmedQty: 3, ...operator })).toThrow(/no stock record/);
    expect(() => confirmCount(db, { now: FIXED_NOW }, { sku: "200310", locationId: "A-2-1", confirmedQty: 3, operatorId: "o-x", shiftId: "s-morning" })).toThrow(/operator and shift/);
    expect(dump(db)).toEqual(before);
  });
});

describe("adjusting stock from a count", () => {
  const counted = () => {
    const db = freshDb();
    const record = confirmCount(db, { now: FIXED_NOW }, { sku: "200310", locationId: "A-2-1", confirmedQty: 31, ...operator });
    return { db, record };
  };

  it("lets a supervisor adjust stock, writing a movement and an event", () => {
    const { db, record } = counted();
    const result = adjustStockFromCount(db, { now: FIXED_NOW }, { countId: record.id, ...supervisor });
    expect(result).toEqual({ countId: record.id, delta: -4, newQty: 31 });
    expect(qtyAt(db, "200310", "A-2-1")).toBe(31);
    expect(db.prepare("SELECT delta, kind FROM movements ORDER BY id DESC").get()).toEqual(
      expect.objectContaining({ delta: -4, kind: "adjustment" }),
    );
    expect(db.prepare("SELECT type FROM events ORDER BY id DESC").get()).toEqual(
      expect.objectContaining({ type: "stock_adjusted" }),
    );
    expect(getCount(db, record.id).adjustedAt).not.toBeNull();
  });

  it("refuses an operator who is not a supervisor", () => {
    const { db, record } = counted();
    expect(() => adjustStockFromCount(db, { now: FIXED_NOW }, { countId: record.id, ...operator })).toThrow(/Only a supervisor/);
    expect(qtyAt(db, "200310", "A-2-1")).toBe(35);
  });

  it("refuses to adjust twice, or a count with no variance", () => {
    const { db, record } = counted();
    adjustStockFromCount(db, { now: FIXED_NOW }, { countId: record.id, ...supervisor });
    expect(() => adjustStockFromCount(db, { now: FIXED_NOW }, { countId: record.id, ...supervisor })).toThrow(/already adjusted/);

    const exact = confirmCount(db, { now: FIXED_NOW }, { sku: "200310", locationId: "A-2-1", confirmedQty: qtyAt(db, "200310", "A-2-1"), ...operator });
    expect(() => adjustStockFromCount(db, { now: FIXED_NOW }, { countId: exact.id, ...supervisor })).toThrow(/no variance/);
  });
});
