export type LineStatus = "exact" | "short" | "over" | "missing" | "unexpected";

export interface QuantityLine {
  sku: string;
  qty: number;
}

export interface DiscrepancyLine {
  sku: string;
  expected: number;
  actual: number;
  difference: number;
  status: LineStatus;
}

export interface DiscrepancyReport {
  lines: DiscrepancyLine[];
  hasDiscrepancy: boolean;
}

/**
 * Compares what was expected (ordered) with what is actual (received or loaded).
 * Quantities are summed per SKU. Pure and deterministic: the model is never involved.
 */
export function computeDiscrepancy(
  expected: QuantityLine[],
  actual: QuantityLine[],
): DiscrepancyReport {
  const expectedBySku = new Map<string, number>();
  for (const line of expected) {
    expectedBySku.set(line.sku, (expectedBySku.get(line.sku) ?? 0) + line.qty);
  }
  const actualBySku = new Map<string, number>();
  for (const line of actual) {
    actualBySku.set(line.sku, (actualBySku.get(line.sku) ?? 0) + line.qty);
  }

  const lines: DiscrepancyLine[] = [];
  for (const [sku, expectedQty] of expectedBySku) {
    const actualQty = actualBySku.get(sku) ?? 0;
    lines.push({
      sku,
      expected: expectedQty,
      actual: actualQty,
      difference: actualQty - expectedQty,
      status:
        actualQty === expectedQty
          ? "exact"
          : actualQty === 0
            ? "missing"
            : actualQty < expectedQty
              ? "short"
              : "over",
    });
  }
  for (const [sku, actualQty] of actualBySku) {
    if (!expectedBySku.has(sku) && actualQty > 0) {
      lines.push({
        sku,
        expected: 0,
        actual: actualQty,
        difference: actualQty,
        status: "unexpected",
      });
    }
  }
  return {
    lines,
    hasDiscrepancy: lines.some((line) => line.status !== "exact"),
  };
}

export function describeDiscrepancy(line: DiscrepancyLine, name: string): string {
  switch (line.status) {
    case "exact":
      return `${name}: ${line.actual} as expected`;
    case "short":
    case "missing":
      return `${name} expected ${line.expected}, received ${line.actual} (missing ${-line.difference})`;
    case "over":
      return `${name} expected ${line.expected}, received ${line.actual} (${line.difference} extra)`;
    case "unexpected":
      return `${name} not on the order, received ${line.actual}`;
  }
}
