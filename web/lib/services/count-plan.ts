import type { Db } from "../db";
import { addDays, daysBetween } from "../time";

export interface CountPlanItem {
  sku: string;
  name: string;
  locationId: string;
  score: number;
  reasons: string[];
  lastCountedAt: string | null;
}

/**
 * A ranked list of what to count next, so cycle counts go where they matter most.
 * Deterministic rules: locations never counted or not counted lately, stock at or below
 * minimum, a variance on the last count, and busy locations (more movements, more drift).
 */
export function buildCountPlan(db: Db, now: Date, limit = 12): CountPlanItem[] {
  const since = addDays(now, -30).toISOString();
  const rows = db
    .prepare(
      `SELECT s.sku, p.name, s.location_id, p.min_stock,
              (SELECT SUM(qty) FROM stock t WHERE t.sku = s.sku) AS total,
              (SELECT MAX(counted_at) FROM counts c WHERE c.sku = s.sku AND c.location_id = s.location_id) AS last_counted,
              (SELECT variance FROM counts c WHERE c.sku = s.sku AND c.location_id = s.location_id
                 ORDER BY counted_at DESC, id DESC LIMIT 1) AS last_variance,
              (SELECT COUNT(*) FROM movements m WHERE m.sku = s.sku AND m.location_id = s.location_id AND m.at >= ?) AS moves
       FROM stock s JOIN products p ON p.sku = s.sku WHERE s.qty > 0`,
    )
    .all(since) as Array<{
    sku: string;
    name: string;
    location_id: string;
    min_stock: number;
    total: number;
    last_counted: string | null;
    last_variance: number | null;
    moves: number;
  }>;

  const plan: CountPlanItem[] = [];
  for (const r of rows) {
    const reasons: string[] = [];
    let score = 0;
    const age = r.last_counted ? daysBetween(new Date(r.last_counted), now) : null;
    if (age === null) {
      score += 30;
      reasons.push("Never counted");
    } else if (age >= 30) {
      score += 30;
      reasons.push(`Not counted for ${age} days`);
    } else if (age >= 14) {
      score += 15;
      reasons.push(`Last counted ${age} days ago`);
    }
    if (r.last_variance !== null && r.last_variance !== 0) {
      score += 40;
      reasons.push(`Last count was off by ${r.last_variance > 0 ? "+" : ""}${r.last_variance}`);
    }
    if (r.min_stock > 0 && r.total <= r.min_stock) {
      score += 25;
      reasons.push("At or below minimum");
    }
    if (r.moves > 0) {
      score += Math.min(30, r.moves * 3);
      if (r.moves >= 4) reasons.push(`${r.moves} movements in 30 days`);
    }
    if (age !== null && age < 1 && (r.last_variance ?? 0) === 0) continue;
    if (score === 0) continue;
    plan.push({ sku: r.sku, name: r.name, locationId: r.location_id, score, reasons, lastCountedAt: r.last_counted });
  }
  return plan.sort((a, b) => b.score - a.score || a.locationId.localeCompare(b.locationId)).slice(0, limit);
}
