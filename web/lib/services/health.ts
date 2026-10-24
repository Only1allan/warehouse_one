import type { Db } from "../db";
import {
  computeHealth,
  DEFAULT_THRESHOLDS,
  type HealthCategory,
  type HealthFinding,
  type HealthThresholds,
  type ProductStats,
} from "../domain/health";
import { daysBetween } from "../time";

export interface HealthReport {
  generatedAt: string;
  thresholds: HealthThresholds;
  counts: Record<HealthCategory, number>;
  findings: HealthFinding[];
}

export function loadProductStats(db: Db, now: Date): ProductStats[] {
  const rows = db
    .prepare(
      `SELECT p.sku, p.name, p.unit, p.min_stock, p.reorder_level,
              COALESCE(SUM(s.qty), 0) AS qty, MAX(s.last_moved_at) AS last_moved
       FROM products p LEFT JOIN stock s ON s.sku = p.sku
       GROUP BY p.sku ORDER BY p.sku`,
    )
    .all() as Array<{
    sku: string;
    name: string;
    unit: string;
    min_stock: number;
    reorder_level: number;
    qty: number;
    last_moved: string | null;
  }>;
  const incoming = db
    .prepare(
      `SELECT l.sku, l.qty_ordered, p.po_number, p.expected_date
       FROM po_lines l JOIN purchase_orders p ON p.po_number = l.po_number
       WHERE p.status = 'open' ORDER BY p.expected_date`,
    )
    .all() as Array<{ sku: string; qty_ordered: number; po_number: string; expected_date: string }>;
  const firstIncoming = new Map<string, (typeof incoming)[number]>();
  for (const row of incoming) if (!firstIncoming.has(row.sku)) firstIncoming.set(row.sku, row);

  return rows.map((r) => {
    const inc = firstIncoming.get(r.sku);
    return {
      sku: r.sku,
      name: r.name,
      unit: r.unit,
      qty: r.qty,
      minStock: r.min_stock,
      reorderLevel: r.reorder_level,
      daysSinceMove: r.last_moved ? Math.max(0, daysBetween(new Date(r.last_moved), now)) : 9999,
      incomingQty: inc?.qty_ordered,
      incomingPo: inc?.po_number,
      incomingDue: inc?.expected_date,
    };
  });
}

export function getHealthReport(
  db: Db,
  now: Date,
  thresholds: HealthThresholds = DEFAULT_THRESHOLDS,
): HealthReport {
  const findings = computeHealth(loadProductStats(db, now), thresholds);
  const counts: Record<HealthCategory, number> = { dead: 0, slow: 0, stockout: 0, overstock: 0 };
  for (const f of findings) counts[f.category]++;
  const order: HealthCategory[] = ["stockout", "dead", "slow", "overstock"];
  findings.sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category) || a.name.localeCompare(b.name));
  return { generatedAt: now.toISOString(), thresholds, counts, findings };
}
