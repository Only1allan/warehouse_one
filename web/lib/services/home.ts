import type { Db } from "../db";
import type { Role } from "../auth/capabilities";
import { listEvents } from "../events";
import { dayKey } from "../time";
import { buildCountPlan } from "./count-plan";
import { getHealthReport } from "./health";
import { dispatchAccuracy, processCompliance } from "./logistics";
import { listReconciliations } from "./stock";

export interface RecentActivity {
  type: string;
  at: string;
  summary: string;
  who?: string;
}

export type Home =
  | {
      kind: "operator";
      dueToday: Array<{ poNumber: string; supplier: string; status: string }>;
      ordersToLoad: Array<{ orderNumber: string; customer: string; destination: string }>;
      recent: RecentActivity[];
    }
  | {
      kind: "supervisor";
      today: { receipts: number; dispatches: number; counts: number; issues: number };
      feed: RecentActivity[];
      openExceptions: number;
      exceptionsByKind: Record<string, number>;
      belowMinimum: number;
      health: Record<string, number>;
      pendingReconciliations: number;
    }
  | {
      kind: "inventory_controller";
      nextToCount: Array<{ sku: string; name: string; locationId: string; reasons: string[] }>;
      pendingReconciliations: number;
      countsDone: number;
      countAccuracyPct: number | null;
      health: Record<string, number>;
    }
  | {
      kind: "logistics_manager";
      openOrders: number;
      dispatchAccuracyPct: number | null;
      dispatches: number;
      shortfalls: number;
      receiptCleanPct: number | null;
    };

const eventSummary: Record<string, string> = {
  receipt_confirmed: "Confirmed a receipt",
  po_registered: "Added a purchase order from a delivery note",
  dispatch_confirmed: "Confirmed a dispatch",
  count_confirmed: "Confirmed a count",
  stock_adjusted: "Adjusted stock",
  adjustment_declined: "Declined an adjustment",
  equipment_issue_reported: "Reported an equipment issue",
};

export function getHome(db: Db, user: { id: string; role: Role }, now: Date): Home {
  const today = dayKey(now);
  const health = getHealthReport(db, now).counts;
  const exceptions = processCompliance(db).openExceptions;
  const openExceptions = Object.values(exceptions).reduce((a, b) => a + b, 0);

  switch (user.role) {
    case "operator":
      return {
        kind: "operator",
        dueToday: (
          db
            .prepare("SELECT po_number, supplier, status FROM purchase_orders WHERE expected_date = ? ORDER BY po_number")
            .all(today) as Array<{ po_number: string; supplier: string; status: string }>
        ).map((r) => ({ poNumber: r.po_number, supplier: r.supplier, status: r.status })),
        ordersToLoad: (
          db
            .prepare("SELECT order_number, customer, destination FROM sales_orders WHERE status = 'open' ORDER BY order_number LIMIT 5")
            .all() as Array<{ order_number: string; customer: string; destination: string }>
        ).map((r) => ({ orderNumber: r.order_number, customer: r.customer, destination: r.destination })),
        recent: (
          db
            .prepare("SELECT type, at FROM events WHERE operator_id = ? ORDER BY at DESC, id DESC LIMIT 5")
            .all(user.id) as Array<{ type: string; at: string }>
        ).map((r) => ({ type: r.type, at: r.at, summary: eventSummary[r.type] ?? r.type })),
      };
    case "supervisor": {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      const events = listEvents(db, { from: start, to: new Date(start.getTime() + 86_400_000) });
      const names = new Map(
        (db.prepare("SELECT id, name FROM operators").all() as Array<{ id: string; name: string }>).map((o) => [o.id, o.name]),
      );
      const of = (t: string) => events.filter((e) => e.type === t).length;
      return {
        kind: "supervisor",
        today: {
          receipts: of("receipt_confirmed"),
          dispatches: of("dispatch_confirmed"),
          counts: of("count_confirmed"),
          issues: of("equipment_issue_reported"),
        },
        feed: [...events]
          .reverse()
          .slice(0, 8)
          .map((e) => ({ type: e.type, at: e.at, summary: eventSummary[e.type] ?? e.type, who: names.get(e.operatorId) })),
        openExceptions,
        exceptionsByKind: exceptions,
        belowMinimum: health.stockout,
        health,
        pendingReconciliations: listReconciliations(db).pending.length,
      };
    }
    case "inventory_controller": {
      const c = processCompliance(db).counts;
      return {
        kind: "inventory_controller",
        nextToCount: buildCountPlan(db, now, 3).map((p) => ({ sku: p.sku, name: p.name, locationId: p.locationId, reasons: p.reasons })),
        pendingReconciliations: listReconciliations(db).pending.length,
        countsDone: c.total,
        countAccuracyPct: c.ratePct,
        health,
      };
    }
    case "logistics_manager": {
      const acc = dispatchAccuracy(db);
      return {
        kind: "logistics_manager",
        openOrders: (db.prepare("SELECT COUNT(*) AS n FROM sales_orders WHERE status = 'open'").get() as { n: number }).n,
        dispatchAccuracyPct: acc.accuracyPct,
        dispatches: acc.dispatches,
        shortfalls: acc.shortfalls.length,
        receiptCleanPct: processCompliance(db).receipts.ratePct,
      };
    }
  }
}
