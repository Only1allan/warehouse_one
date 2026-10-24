import { describe, expect, it } from "vitest";
import { computeDiscrepancy, describeDiscrepancy } from "@/lib/domain/discrepancy";

describe("computeDiscrepancy", () => {
  it("reports an exact match as no discrepancy", () => {
    const report = computeDiscrepancy([{ sku: "A", qty: 10 }], [{ sku: "A", qty: 10 }]);
    expect(report.hasDiscrepancy).toBe(false);
    expect(report.lines).toEqual([
      { sku: "A", expected: 10, actual: 10, difference: 0, status: "exact" },
    ]);
  });

  it("flags a short delivery: 150 expected, 142 received, missing 8", () => {
    const report = computeDiscrepancy([{ sku: "100201", qty: 150 }], [{ sku: "100201", qty: 142 }]);
    expect(report.hasDiscrepancy).toBe(true);
    expect(report.lines[0]).toMatchObject({ status: "short", difference: -8 });
    expect(describeDiscrepancy(report.lines[0], "Carton")).toBe(
      "Carton expected 150, received 142 (missing 8)",
    );
  });

  it("flags an over delivery", () => {
    const report = computeDiscrepancy([{ sku: "A", qty: 10 }], [{ sku: "A", qty: 14 }]);
    expect(report.lines[0]).toMatchObject({ status: "over", difference: 4 });
  });

  it("treats a line that never arrived as missing", () => {
    const report = computeDiscrepancy(
      [{ sku: "A", qty: 10 }, { sku: "B", qty: 5 }],
      [{ sku: "A", qty: 10 }],
    );
    expect(report.lines.find((l) => l.sku === "B")).toMatchObject({
      status: "missing",
      actual: 0,
      difference: -5,
    });
    expect(report.hasDiscrepancy).toBe(true);
  });

  it("flags a line that is not on the order as unexpected", () => {
    const report = computeDiscrepancy([{ sku: "A", qty: 10 }], [{ sku: "A", qty: 10 }, { sku: "Z", qty: 3 }]);
    expect(report.lines.find((l) => l.sku === "Z")).toMatchObject({
      status: "unexpected",
      expected: 0,
      actual: 3,
    });
  });

  it("ignores an unexpected line with zero quantity", () => {
    const report = computeDiscrepancy([{ sku: "A", qty: 10 }], [{ sku: "A", qty: 10 }, { sku: "Z", qty: 0 }]);
    expect(report.hasDiscrepancy).toBe(false);
  });

  it("sums repeated lines for the same SKU", () => {
    const report = computeDiscrepancy(
      [{ sku: "A", qty: 5 }, { sku: "A", qty: 5 }],
      [{ sku: "A", qty: 4 }, { sku: "A", qty: 6 }],
    );
    expect(report.lines).toEqual([
      { sku: "A", expected: 10, actual: 10, difference: 0, status: "exact" },
    ]);
  });
});
