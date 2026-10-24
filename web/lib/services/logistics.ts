import type { Db } from "../db";

export interface Shipment {
  orderNumber: string;
  customer: string;
  destination: string;
  status: "open" | "dispatched";
  ordered: number;
  loaded: number | null;
  shortBy: number;
  dispatchedAt: string | null;
}

export function listShipments(db: Db): Shipment[] {
  const rows = db
    .prepare(
      `SELECT o.order_number, o.customer, o.destination, o.status,
              (SELECT COALESCE(SUM(qty_ordered), 0) FROM order_lines l WHERE l.order_number = o.order_number) AS ordered,
              (SELECT SUM(qty_loaded) FROM order_lines l WHERE l.order_number = o.order_number) AS loaded,
              (SELECT MAX(dispatched_at) FROM dispatches d WHERE d.order_number = o.order_number) AS dispatched_at
       FROM sales_orders o ORDER BY (o.status = 'open') DESC, o.order_number DESC`,
    )
    .all() as Array<{
    order_number: string;
    customer: string;
    destination: string;
    status: "open" | "dispatched";
    ordered: number;
    loaded: number | null;
    dispatched_at: string | null;
  }>;
  return rows.map((r) => ({
    orderNumber: r.order_number,
    customer: r.customer,
    destination: r.destination,
    status: r.status,
    ordered: r.ordered,
    loaded: r.loaded,
    shortBy: r.status === "dispatched" && r.loaded !== null ? Math.max(0, r.ordered - r.loaded) : 0,
    dispatchedAt: r.dispatched_at,
  }));
}

export interface DispatchAccuracy {
  dispatches: number;
  inFull: number;
  accuracyPct: number | null;
  unitsOrdered: number;
  unitsLoaded: number;
  fillPct: number | null;
  shortfalls: Array<{ orderNumber: string; customer: string; ordered: number; loaded: number; missing: number }>;
}

const pct = (part: number, whole: number): number | null =>
  whole === 0 ? null : Math.round((1000 * part) / whole) / 10;

export function dispatchAccuracy(db: Db): DispatchAccuracy {
  const rows = db
    .prepare(
      `SELECT d.order_number, o.customer, d.has_shortfall,
              (SELECT SUM(qty_ordered) FROM order_lines l WHERE l.order_number = d.order_number) AS ordered,
              (SELECT SUM(COALESCE(qty_loaded, 0)) FROM order_lines l WHERE l.order_number = d.order_number) AS loaded
       FROM dispatches d JOIN sales_orders o ON o.order_number = d.order_number ORDER BY d.dispatched_at DESC`,
    )
    .all() as Array<{ order_number: string; customer: string; has_shortfall: number; ordered: number; loaded: number }>;
  const inFull = rows.filter((r) => r.has_shortfall === 0).length;
  const unitsOrdered = rows.reduce((s, r) => s + r.ordered, 0);
  const unitsLoaded = rows.reduce((s, r) => s + r.loaded, 0);
  return {
    dispatches: rows.length,
    inFull,
    accuracyPct: pct(inFull, rows.length),
    unitsOrdered,
    unitsLoaded,
    fillPct: pct(unitsLoaded, unitsOrdered),
    shortfalls: rows
      .filter((r) => r.has_shortfall === 1)
      .map((r) => ({
        orderNumber: r.order_number,
        customer: r.customer,
        ordered: r.ordered,
        loaded: r.loaded,
        missing: Math.max(0, r.ordered - r.loaded),
      })),
  };
}

export interface ProcessCompliance {
  receipts: { total: number; clean: number; ratePct: number | null };
  dispatches: { total: number; clean: number; ratePct: number | null };
  counts: { total: number; exact: number; ratePct: number | null };
  openExceptions: Record<string, number>;
}

export function processCompliance(db: Db): ProcessCompliance {
  const n = (sql: string) => (db.prepare(sql).get() as { n: number }).n;
  const receipts = n("SELECT COUNT(*) AS n FROM receipts");
  const receiptsClean = n("SELECT COUNT(*) AS n FROM receipts WHERE has_discrepancy = 0");
  const dispatches = n("SELECT COUNT(*) AS n FROM dispatches");
  const dispatchesClean = n("SELECT COUNT(*) AS n FROM dispatches WHERE has_shortfall = 0");
  const counts = n("SELECT COUNT(*) AS n FROM counts");
  const countsExact = n("SELECT COUNT(*) AS n FROM counts WHERE variance = 0");
  const open: Record<string, number> = { receiving: 0, count: 0, dispatch: 0, equipment: 0 };
  for (const r of db.prepare("SELECT kind, COUNT(*) AS n FROM exceptions GROUP BY kind").all() as Array<{ kind: string; n: number }>) {
    open[r.kind] = r.n;
  }
  return {
    receipts: { total: receipts, clean: receiptsClean, ratePct: pct(receiptsClean, receipts) },
    dispatches: { total: dispatches, clean: dispatchesClean, ratePct: pct(dispatchesClean, dispatches) },
    counts: { total: counts, exact: countsExact, ratePct: pct(countsExact, counts) },
    openExceptions: open,
  };
}
