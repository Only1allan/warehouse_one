export interface HealthThresholds {
  deadDays: number;
  slowDays: number;
  overstockMultiple: number;
}

export const DEFAULT_THRESHOLDS: HealthThresholds = {
  deadDays: 90,
  slowDays: 30,
  overstockMultiple: 3,
};

export type HealthCategory = "dead" | "slow" | "stockout" | "overstock";

export interface ProductStats {
  sku: string;
  name: string;
  unit: string;
  qty: number;
  minStock: number;
  reorderLevel: number;
  daysSinceMove: number;
  incomingQty?: number;
  incomingPo?: string;
  incomingDue?: string;
}

export interface HealthFinding {
  category: HealthCategory;
  sku: string;
  name: string;
  qty: number;
  detail: string;
  recommendation: string;
}

const plural = (unit: string, n: number) => (n === 1 ? unit : `${unit}s`);

/**
 * Applies the health rules to products. Pure and deterministic: recommendations are fixed
 * templates, so a language model can rephrase them but never change a number.
 */
export function computeHealth(
  products: ProductStats[],
  thresholds: HealthThresholds = DEFAULT_THRESHOLDS,
): HealthFinding[] {
  const findings: HealthFinding[] = [];
  for (const p of products) {
    if (p.qty > 0 && p.daysSinceMove >= thresholds.deadDays) {
      findings.push({
        category: "dead",
        sku: p.sku,
        name: p.name,
        qty: p.qty,
        detail: `${p.qty} ${plural(p.unit, p.qty)} have not moved in ${p.daysSinceMove} days.`,
        recommendation: `Product ${p.sku} has not moved in ${p.daysSinceMove} days. Consider promotion or transfer.`,
      });
    } else if (p.qty > 0 && p.daysSinceMove >= thresholds.slowDays) {
      findings.push({
        category: "slow",
        sku: p.sku,
        name: p.name,
        qty: p.qty,
        detail: `Last moved ${p.daysSinceMove} days ago.`,
        recommendation: `Product ${p.sku} is slow moving (${p.daysSinceMove} days since it last moved). Review turnover and the reorder level.`,
      });
    }
    if (p.minStock > 0 && p.qty <= p.minStock) {
      const incoming = p.incomingQty
        ? ` A delivery of ${p.incomingQty} is expected on PO ${p.incomingPo} (${p.incomingDue}).`
        : "";
      findings.push({
        category: "stockout",
        sku: p.sku,
        name: p.name,
        qty: p.qty,
        detail: `${p.qty} in stock, at or below the minimum of ${p.minStock}.`,
        recommendation: p.incomingQty
          ? `Product ${p.sku} is at or below its minimum.${incoming}`
          : `Product ${p.sku} is at or below its minimum of ${p.minStock}. Reorder now.`,
      });
    }
    const overLimit = p.reorderLevel * thresholds.overstockMultiple;
    if (p.reorderLevel > 0 && p.qty >= overLimit) {
      findings.push({
        category: "overstock",
        sku: p.sku,
        name: p.name,
        qty: p.qty,
        detail: `${p.qty} in stock, at least ${thresholds.overstockMultiple} times the reorder level of ${p.reorderLevel}.`,
        recommendation: `Product ${p.sku} is overstocked. Pause reordering, or transfer or promote the surplus.`,
      });
    }
  }
  return findings;
}
