import { describe, expect, it } from "vitest";
import { computeHealth, DEFAULT_THRESHOLDS, type ProductStats } from "@/lib/domain/health";
import { confirmReceipt } from "@/lib/services/receiving";
import { getHealthReport } from "@/lib/services/health";
import { dump, FIXED_NOW, freshDb } from "./helpers";

const base: ProductStats = {
  sku: "X1",
  name: "Test Item",
  unit: "unit",
  qty: 100,
  minStock: 10,
  reorderLevel: 50,
  daysSinceMove: 1,
};
const categories = (p: Partial<ProductStats>) => computeHealth([{ ...base, ...p }]).map((f) => f.category);

describe("health rules at their thresholds", () => {
  it("is healthy in the middle of every range", () => {
    expect(categories({})).toEqual([]);
  });

  it.each([
    [89, []],
    [90, ["dead"]],
    [91, ["dead"]],
  ])("dead stock starts at 90 days (%i days)", (days, expected) => {
    expect(categories({ daysSinceMove: days }).filter((c) => c === "dead")).toEqual(expected);
  });

  it.each([
    [29, []],
    [30, ["slow"]],
    [89, ["slow"]],
  ])("slow moving is 30 to 89 days (%i days)", (days, expected) => {
    expect(categories({ daysSinceMove: days }).filter((c) => c === "slow")).toEqual(expected);
  });

  it("reports a dead product as dead only, not also slow", () => {
    expect(categories({ daysSinceMove: 120 })).toEqual(["dead"]);
  });

  it.each([
    [11, false],
    [10, true],
    [9, true],
  ])("stockout risk at or below the minimum (qty %i)", (qty, flagged) => {
    expect(categories({ qty }).includes("stockout")).toBe(flagged);
  });

  it.each([
    [149, false],
    [150, true],
    [151, true],
  ])("overstock at 3 times the reorder level or more (qty %i)", (qty, flagged) => {
    expect(categories({ qty }).includes("overstock")).toBe(flagged);
  });

  it("ignores empty stock for dead and slow, and products without a minimum", () => {
    expect(categories({ qty: 0, daysSinceMove: 200, minStock: 0 })).toEqual([]);
  });

  it("honours custom thresholds", () => {
    const findings = computeHealth([{ ...base, daysSinceMove: 10 }], { deadDays: 8, slowDays: 5, overstockMultiple: 3 });
    expect(findings.map((f) => f.category)).toEqual(["dead"]);
  });

  it("uses fixed recommendation templates with the real numbers", () => {
    const [dead] = computeHealth([{ ...base, sku: "P-324", daysSinceMove: 120 }]);
    expect(dead.recommendation).toBe("Product P-324 has not moved in 120 days. Consider promotion or transfer.");
    const [out] = computeHealth([{ ...base, qty: 5 }]);
    expect(out.recommendation).toBe("Product X1 is at or below its minimum of 10. Reorder now.");
  });

  it("mentions a delivery that is already on the way", () => {
    const [out] = computeHealth([{ ...base, qty: 5, incomingQty: 80, incomingPo: "4472", incomingDue: "2026-10-28" }]);
    expect(out.recommendation).toContain("A delivery of 80 is expected on PO 4472");
  });
});

describe("health report from the seeded data", () => {
  it("finds at least one product in every category", () => {
    const report = getHealthReport(freshDb(), FIXED_NOW);
    for (const category of ["dead", "slow", "stockout", "overstock"] as const) {
      expect(report.counts[category]).toBeGreaterThanOrEqual(1);
    }
    expect(report.thresholds).toEqual(DEFAULT_THRESHOLDS);
  });

  it("finds the named demo products", () => {
    const report = getHealthReport(freshDb(), FIXED_NOW);
    const at = (category: string) => report.findings.filter((f) => f.category === category).map((f) => f.sku);
    expect(at("dead")).toEqual(expect.arrayContaining(["P-324", "700010"]));
    expect(at("slow")).toContain("700020");
    expect(at("stockout")).toEqual(expect.arrayContaining(["100410", "300118"]));
    expect(at("overstock")).toContain("100305");
  });

  it("lists the most urgent categories first", () => {
    const report = getHealthReport(freshDb(), FIXED_NOW);
    expect(report.findings[0].category).toBe("stockout");
  });

  it("notes the delivery due for a product that is low on stock", () => {
    const report = getHealthReport(freshDb(), FIXED_NOW);
    const vest = report.findings.find((f) => f.sku === "300118" && f.category === "stockout")!;
    expect(vest.recommendation).toContain("PO 4472");
  });

  it("clears a stockout finding once the delivery is received", () => {
    const db = freshDb();
    confirmReceipt(db, { now: FIXED_NOW }, {
      poNumber: "4472",
      lines: [{ sku: "300118", qty: 80 }, { sku: "300125", qty: 40 }],
      operatorId: "o-amina",
      shiftId: "s-morning",
    });
    const report = getHealthReport(db, FIXED_NOW);
    expect(report.findings.some((f) => f.sku === "300118" && f.category === "stockout")).toBe(false);
  });

  it("does not change any data", () => {
    const db = freshDb();
    const before = dump(db);
    getHealthReport(db, FIXED_NOW);
    expect(dump(db)).toEqual(before);
  });
});
