import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors";
import {
  compareReceipt,
  confirmReceipt,
  getPurchaseOrder,
  listPurchaseOrders,
} from "@/lib/services/receiving";
import { dump, FIXED_NOW, freshDb } from "./helpers";

const stockOf = (db: ReturnType<typeof freshDb>, sku: string) =>
  (db.prepare("SELECT SUM(qty) AS q FROM stock WHERE sku = ?").get(sku) as { q: number }).q;

const CARTON_SHORT = [
  { sku: "100201", qty: 142 },
  { sku: "100305", qty: 60 },
  { sku: "100410", qty: 120 },
];

describe("receiving: compare", () => {
  it("lists only open purchase orders when asked", () => {
    const open = listPurchaseOrders(freshDb(), { status: "open" });
    expect(open.map((p) => p.poNumber)).toContain("4471");
    expect(open.every((p) => p.status === "open")).toBe(true);
  });

  it("reports the 150 versus 142 demo case as missing 8, and nothing else", () => {
    const report = compareReceipt(freshDb(), { poNumber: "4471", lines: CARTON_SHORT });
    expect(report.hasDiscrepancy).toBe(true);
    const carton = report.lines.find((l) => l.sku === "100201")!;
    expect(carton).toMatchObject({ expected: 150, actual: 142, difference: -8, status: "short" });
    expect(carton.message).toContain("missing 8");
    expect(report.lines.filter((l) => l.status !== "exact")).toHaveLength(1);
  });

  it("does not change anything", () => {
    const db = freshDb();
    const before = dump(db);
    compareReceipt(db, { poNumber: "4471", lines: CARTON_SHORT });
    expect(dump(db)).toEqual(before);
  });

  it("rejects an unknown purchase order and an unknown SKU", () => {
    const db = freshDb();
    expect(() => compareReceipt(db, { poNumber: "9999", lines: [] })).toThrow(AppError);
    expect(() => compareReceipt(db, { poNumber: "4471", lines: [{ sku: "NOPE", qty: 1 }] })).toThrow(
      /Unknown SKU/,
    );
    expect(() => compareReceipt(db, { poNumber: "4471", lines: [{ sku: "100201", qty: -3 }] })).toThrow(
      /whole number/,
    );
  });
});

describe("receiving: confirm", () => {
  const actor = { operatorId: "o-amina", shiftId: "s-morning" };

  it("adds the received quantities to stock only when confirmed", () => {
    const db = freshDb();
    const before = stockOf(db, "100201");
    compareReceipt(db, { poNumber: "4471", lines: CARTON_SHORT });
    expect(stockOf(db, "100201")).toBe(before);

    confirmReceipt(db, { now: FIXED_NOW }, { poNumber: "4471", lines: CARTON_SHORT, ...actor });
    expect(stockOf(db, "100201")).toBe(before + 142);
    expect(stockOf(db, "100305")).toBeGreaterThan(0);
  });

  it("updates last-moved, writes a movement, an audit event and closes the PO", () => {
    const db = freshDb();
    const { receiptId } = confirmReceipt(db, { now: FIXED_NOW }, { poNumber: "4471", lines: CARTON_SHORT, ...actor });

    const moved = db
      .prepare("SELECT last_moved_at FROM stock WHERE sku = '100201' AND location_id = 'C-1-1'")
      .get() as { last_moved_at: string };
    expect(moved.last_moved_at).toBe(FIXED_NOW.toISOString());
    expect(db.prepare("SELECT delta FROM movements WHERE sku = '100201' ORDER BY id DESC").get()).toEqual(
      expect.objectContaining({ delta: 142 }),
    );
    expect(getPurchaseOrder(db, "4471").status).toBe("received");

    const event = db.prepare("SELECT type, operator_id, shift_id, payload FROM events ORDER BY id DESC").get() as {
      type: string;
      operator_id: string;
      shift_id: string;
      payload: string;
    };
    expect(event).toMatchObject({ type: "receipt_confirmed", operator_id: "o-amina", shift_id: "s-morning" });
    expect(JSON.parse(event.payload)).toMatchObject({ receiptId, poNumber: "4471", hasDiscrepancy: true });
  });

  it("raises an exception for a discrepancy and none for an exact receipt", () => {
    const db = freshDb();
    const exceptionsBefore = (db.prepare("SELECT COUNT(*) AS n FROM exceptions").get() as { n: number }).n;
    confirmReceipt(db, { now: FIXED_NOW }, { poNumber: "4471", lines: CARTON_SHORT, ...actor });
    const ex = db.prepare("SELECT kind, summary FROM exceptions ORDER BY id DESC").get() as {
      kind: string;
      summary: string;
    };
    expect(ex.kind).toBe("receiving");
    expect(ex.summary).toContain("missing 8");

    confirmReceipt(
      db,
      { now: FIXED_NOW },
      { poNumber: "4472", lines: [{ sku: "300118", qty: 80 }, { sku: "300125", qty: 40 }], ...actor },
    );
    const exceptionsAfter = (db.prepare("SELECT COUNT(*) AS n FROM exceptions").get() as { n: number }).n;
    expect(exceptionsAfter).toBe(exceptionsBefore + 1);
  });

  it("refuses to receive the same purchase order twice", () => {
    const db = freshDb();
    confirmReceipt(db, { now: FIXED_NOW }, { poNumber: "4471", lines: CARTON_SHORT, ...actor });
    expect(() =>
      confirmReceipt(db, { now: FIXED_NOW }, { poNumber: "4471", lines: CARTON_SHORT, ...actor }),
    ).toThrow(/already been received/);
  });

  it("changes nothing when the actor is unknown or a line is invalid", () => {
    const db = freshDb();
    const before = dump(db);
    expect(() =>
      confirmReceipt(db, { now: FIXED_NOW }, { poNumber: "4471", lines: CARTON_SHORT, operatorId: "o-x", shiftId: "s-morning" }),
    ).toThrow(/operator and shift/);
    expect(() =>
      confirmReceipt(db, { now: FIXED_NOW }, { poNumber: "4471", lines: [{ sku: "NOPE", qty: 2 }], ...actor }),
    ).toThrow(/Unknown SKU/);
    expect(dump(db)).toEqual(before);
  });

  it("records a missing line as received zero without touching its stock", () => {
    const db = freshDb();
    const before = stockOf(db, "100410");
    confirmReceipt(
      db,
      { now: FIXED_NOW },
      { poNumber: "4471", lines: [{ sku: "100201", qty: 150 }, { sku: "100305", qty: 60 }], ...actor },
    );
    expect(stockOf(db, "100410")).toBe(before);
    const line = db
      .prepare("SELECT received_qty, status FROM receipt_lines WHERE sku = '100410' ORDER BY id DESC")
      .get();
    expect(line).toMatchObject({ received_qty: 0, status: "missing" });
  });
});
