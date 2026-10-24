import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors";
import { compareDispatch, confirmDispatch, getOrder, listOrders } from "@/lib/services/dispatch";
import { dump, FIXED_NOW, freshDb } from "./helpers";

const actor = { operatorId: "o-kevin", shiftId: "s-morning" };
const stockOf = (db: ReturnType<typeof freshDb>, sku: string) =>
  (db.prepare("SELECT SUM(qty) AS q FROM stock WHERE sku = ?").get(sku) as { q: number }).q;
const roofing = (n: number) => [{ sku: "600100", qty: n }];

describe("dispatch: compare", () => {
  it("lists open orders and opens one with its lines", () => {
    const db = freshDb();
    const open = listOrders(db, { status: "open" });
    expect(open.map((o) => o.orderNumber)).toContain("5521");
    expect(open.every((o) => o.status === "open")).toBe(true);
    expect(getOrder(db, "5521").lines).toEqual([
      { sku: "600100", name: "Roofing Sheets (pallet of 100)", qtyOrdered: 50, qtyLoaded: null },
    ]);
  });

  it("reports the 50 ordered versus 48 loaded case as missing 2", () => {
    const report = compareDispatch(freshDb(), { orderNumber: "5521", lines: roofing(48) });
    expect(report.hasDiscrepancy).toBe(true);
    expect(report.lines[0]).toMatchObject({ expected: 50, actual: 48, difference: -2, status: "short" });
    expect(report.lines[0].message).toBe("Roofing Sheets (pallet of 100) ordered 50, loaded 48 (missing 2)");
  });

  it("recognises exact, over-loaded and wrong-item loads", () => {
    const db = freshDb();
    expect(compareDispatch(db, { orderNumber: "5521", lines: roofing(50) }).hasDiscrepancy).toBe(false);
    expect(compareDispatch(db, { orderNumber: "5521", lines: roofing(53) }).lines[0].status).toBe("over");
    const wrong = compareDispatch(db, { orderNumber: "5521", lines: [...roofing(50), { sku: "001254", qty: 2 }] });
    expect(wrong.lines.find((l) => l.sku === "001254")).toMatchObject({ status: "unexpected" });
  });

  it("changes nothing, and rejects unknown orders, SKUs and bad quantities", () => {
    const db = freshDb();
    const before = dump(db);
    compareDispatch(db, { orderNumber: "5521", lines: roofing(48) });
    expect(dump(db)).toEqual(before);
    expect(() => compareDispatch(db, { orderNumber: "0000", lines: [] })).toThrow(AppError);
    expect(() => compareDispatch(db, { orderNumber: "5521", lines: [{ sku: "NOPE", qty: 1 }] })).toThrow(/Unknown SKU/);
    expect(() => compareDispatch(db, { orderNumber: "5521", lines: roofing(-1) })).toThrow(/whole number/);
  });
});

describe("dispatch: confirm", () => {
  it("reduces stock by what was loaded, only on confirmation", () => {
    const db = freshDb();
    const before = stockOf(db, "600100");
    compareDispatch(db, { orderNumber: "5521", lines: roofing(48) });
    expect(stockOf(db, "600100")).toBe(before);
    confirmDispatch(db, { now: FIXED_NOW }, { orderNumber: "5521", lines: roofing(48), ...actor });
    expect(stockOf(db, "600100")).toBe(before - 48);
  });

  it("closes the order, records loaded quantity, a movement, an event, and raises the shortfall", () => {
    const db = freshDb();
    const exceptionsBefore = (db.prepare("SELECT COUNT(*) AS n FROM exceptions").get() as { n: number }).n;
    confirmDispatch(db, { now: FIXED_NOW }, { orderNumber: "5521", lines: roofing(48), ...actor });
    expect(getOrder(db, "5521")).toMatchObject({ status: "dispatched", lines: [expect.objectContaining({ qtyLoaded: 48 })] });
    expect(db.prepare("SELECT delta, kind FROM movements ORDER BY id DESC").get()).toEqual(
      expect.objectContaining({ delta: -48, kind: "dispatch" }),
    );
    expect(db.prepare("SELECT type, operator_id FROM events ORDER BY id DESC").get()).toEqual(
      expect.objectContaining({ type: "dispatch_confirmed", operator_id: "o-kevin" }),
    );
    const rows = db.prepare("SELECT kind, summary FROM exceptions ORDER BY id DESC").all() as Array<{ kind: string; summary: string }>;
    expect(rows).toHaveLength(exceptionsBefore + 1);
    expect(rows[0]).toMatchObject({ kind: "dispatch" });
    expect(rows[0].summary).toContain("missing 2");
  });

  it("raises no exception for a complete load", () => {
    const db = freshDb();
    const before = (db.prepare("SELECT COUNT(*) AS n FROM exceptions").get() as { n: number }).n;
    confirmDispatch(db, { now: FIXED_NOW }, { orderNumber: "5521", lines: roofing(50), ...actor });
    expect((db.prepare("SELECT COUNT(*) AS n FROM exceptions").get() as { n: number }).n).toBe(before);
  });

  it("takes stock from the default location first, then the others", () => {
    const db = freshDb();
    confirmDispatch(
      db,
      { now: FIXED_NOW },
      {
        orderNumber: "5523",
        lines: [{ sku: "001254", qty: 5 }, { sku: "001310", qty: 50 }],
        ...actor,
      },
    );
    const cable = db.prepare("SELECT location_id, qty FROM stock WHERE sku = '001310' ORDER BY location_id").all();
    expect(cable).toEqual([
      expect.objectContaining({ location_id: "B-4-1", qty: 0 }),
      expect.objectContaining({ location_id: "B-4-2", qty: 14 }),
    ]);
  });

  it("refuses to load more than the stock on record, changing nothing", () => {
    const db = freshDb();
    const before = dump(db);
    expect(() => confirmDispatch(db, { now: FIXED_NOW }, { orderNumber: "5521", lines: roofing(500), ...actor })).toThrow(
      /Not enough stock/,
    );
    expect(dump(db)).toEqual(before);
  });

  it("refuses a second dispatch of the same order and an unknown actor", () => {
    const db = freshDb();
    confirmDispatch(db, { now: FIXED_NOW }, { orderNumber: "5521", lines: roofing(50), ...actor });
    expect(() => confirmDispatch(db, { now: FIXED_NOW }, { orderNumber: "5521", lines: roofing(50), ...actor })).toThrow(
      /already been dispatched/,
    );
    const fresh = freshDb();
    expect(() =>
      confirmDispatch(fresh, { now: FIXED_NOW }, { orderNumber: "5522", lines: [], operatorId: "o-x", shiftId: "s-morning" }),
    ).toThrow(/Sign in/);
  });
});
