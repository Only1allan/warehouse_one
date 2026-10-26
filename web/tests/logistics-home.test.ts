import { describe, expect, it } from "vitest";
import { confirmCount } from "@/lib/services/counting";
import { confirmDispatch } from "@/lib/services/dispatch";
import { getHome } from "@/lib/services/home";
import { dispatchAccuracy, listShipments, processCompliance } from "@/lib/services/logistics";
import { confirmReceipt } from "@/lib/services/receiving";
import { FIXED_NOW, freshDb } from "./helpers";

const kevin = { operatorId: "o-kevin", shiftId: "s-morning" };

describe("shipments", () => {
  it("lists open orders first, with ordered and loaded units", () => {
    const rows = listShipments(freshDb());
    expect(rows[0].status).toBe("open");
    const open = rows.filter((r) => r.status === "open").map((r) => r.orderNumber);
    expect(open).toEqual(expect.arrayContaining(["5521", "5522", "5523", "5524", "5525"]));
    expect(rows.find((r) => r.orderNumber === "5521")).toMatchObject({ ordered: 50, loaded: null, shortBy: 0 });
    expect(rows.find((r) => r.orderNumber === "5520")).toMatchObject({ status: "dispatched", ordered: 20, loaded: 18, shortBy: 2 });
  });
});

describe("dispatch accuracy", () => {
  it("is computed from the dispatch records: 1 of 2 complete is 50%", () => {
    const acc = dispatchAccuracy(freshDb());
    expect(acc).toMatchObject({ dispatches: 2, inFull: 1, accuracyPct: 50, unitsOrdered: 60, unitsLoaded: 58, fillPct: 96.7 });
    expect(acc.shortfalls).toEqual([{ orderNumber: "5520", customer: "Machakos Retail", ordered: 20, loaded: 18, missing: 2 }]);
  });

  it("moves when a new dispatch is confirmed", () => {
    const db = freshDb();
    confirmDispatch(db, { now: FIXED_NOW }, { orderNumber: "5521", lines: [{ sku: "600100", qty: 50 }], ...kevin });
    expect(dispatchAccuracy(db)).toMatchObject({ dispatches: 3, inFull: 2, accuracyPct: 66.7 });
    confirmDispatch(db, { now: FIXED_NOW }, { orderNumber: "5522", lines: [{ sku: "600110", qty: 28 }, { sku: "600140", qty: 20 }], ...kevin });
    expect(dispatchAccuracy(db)).toMatchObject({ dispatches: 4, inFull: 2, accuracyPct: 50 });
    expect(dispatchAccuracy(db).shortfalls).toHaveLength(2);
  });

  it("reports no percentage when nothing has been dispatched", () => {
    const db = freshDb();
    db.exec("DELETE FROM dispatches");
    expect(dispatchAccuracy(db)).toMatchObject({ dispatches: 0, accuracyPct: null, fillPct: null });
  });
});

describe("process compliance", () => {
  it("counts clean and discrepant receipts, dispatches and counts", () => {
    const c = processCompliance(freshDb());
    expect(c.receipts).toEqual({ total: 2, clean: 1, ratePct: 50 });
    expect(c.dispatches).toEqual({ total: 2, clean: 1, ratePct: 50 });
    expect(c.counts).toEqual({ total: 2, exact: 1, ratePct: 50 });
    expect(c.openExceptions).toEqual({ receiving: 1, count: 1, dispatch: 1, equipment: 1 });
  });

  it("updates with new records", () => {
    const db = freshDb();
    confirmReceipt(db, { now: FIXED_NOW }, {
      poNumber: "4472",
      lines: [{ sku: "300118", qty: 80 }, { sku: "300125", qty: 40 }],
      operatorId: "o-amina",
      shiftId: "s-morning",
    });
    expect(processCompliance(db).receipts).toEqual({ total: 3, clean: 2, ratePct: 66.7 });
  });
});

describe("role home dashboards", () => {
  const db = freshDb();

  it("operator: deliveries due today, orders to load and their own recent actions", () => {
    const home = getHome(db, { id: "o-amina", role: "operator" }, FIXED_NOW);
    if (home.kind !== "operator") throw new Error("wrong home");
    expect(home.dueToday.map((p) => p.poNumber)).toEqual(["4471", "4472"]);
    expect(home.ordersToLoad.map((o) => o.orderNumber)).toContain("5521");
    expect(home.recent.every((r) => r.summary.length > 0)).toBe(true);
    expect(home.recent.map((r) => r.type)).toEqual(expect.arrayContaining(["equipment_issue_reported"]));
  });

  it("supervisor: open exceptions, products below minimum, health and pending reconciliations", () => {
    const home = getHome(db, { id: "o-daniel", role: "supervisor" }, FIXED_NOW);
    if (home.kind !== "supervisor") throw new Error("wrong home");
    expect(home.openExceptions).toBe(4);
    expect(home.exceptionsByKind).toEqual({ receiving: 1, count: 1, dispatch: 1, equipment: 1 });
    expect(home.belowMinimum).toBeGreaterThanOrEqual(2);
    expect(home.health.dead).toBeGreaterThanOrEqual(2);
    expect(home.pendingReconciliations).toBe(1);
    expect(home.today).toEqual({ receipts: 0, dispatches: 0, counts: 0, issues: 0 });
  });

  it("supervisor: today's operations feed shows who did what", () => {
    const local = freshDb();
    confirmCount(local, { now: FIXED_NOW }, { sku: "200310", locationId: "A-2-1", confirmedQty: 31, operatorId: "o-amina", shiftId: "s-morning" });
    const home = getHome(local, { id: "o-daniel", role: "supervisor" }, FIXED_NOW);
    if (home.kind !== "supervisor") throw new Error("wrong home");
    expect(home.today.counts).toBe(1);
    expect(home.feed[0]).toMatchObject({ summary: "Confirmed a count", who: "Amina Otieno" });
  });

  it("inventory controller: reconciliations waiting and count accuracy", () => {
    const home = getHome(db, { id: "o-esther", role: "inventory_controller" }, FIXED_NOW);
    if (home.kind !== "inventory_controller") throw new Error("wrong home");
    expect(home).toMatchObject({ pendingReconciliations: 1, countsDone: 2, countAccuracyPct: 50 });
    expect(home.nextToCount).toHaveLength(3);
  });

  it("logistics manager: open orders, dispatch accuracy and shortfalls", () => {
    const home = getHome(db, { id: "o-kevin", role: "logistics_manager" }, FIXED_NOW);
    if (home.kind !== "logistics_manager") throw new Error("wrong home");
    expect(home).toMatchObject({ dispatchAccuracyPct: 50, dispatches: 2, shortfalls: 1, receiptCleanPct: 50 });
    expect(home.openOrders).toBe(5);
  });

  it("changes when the underlying records change", () => {
    const local = freshDb();
    confirmCount(local, { now: FIXED_NOW }, { sku: "200310", locationId: "A-2-1", confirmedQty: 31, operatorId: "o-amina", shiftId: "s-morning" });
    const home = getHome(local, { id: "o-esther", role: "inventory_controller" }, FIXED_NOW);
    if (home.kind !== "inventory_controller") throw new Error("wrong home");
    expect(home.pendingReconciliations).toBe(2);
    expect(home.countsDone).toBe(3);
  });
});
