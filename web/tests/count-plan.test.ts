import { describe, expect, it } from "vitest";
import { confirmCount } from "@/lib/services/counting";
import { buildCountPlan } from "@/lib/services/count-plan";
import { dump, FIXED_NOW, freshDb } from "./helpers";

describe("count plan", () => {
  it("ranks locations that need counting most, with the reasons", () => {
    const plan = buildCountPlan(freshDb(), FIXED_NOW);
    expect(plan.length).toBeGreaterThan(0);
    expect(plan.length).toBeLessThanOrEqual(12);
    const scores = plan.map((p) => p.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
    for (const item of plan) expect(item.reasons.length).toBeGreaterThan(0);
  });

  it("puts stock at or below minimum that was never counted near the top", () => {
    const plan = buildCountPlan(freshDb(), FIXED_NOW);
    const vest = plan.find((p) => p.sku === "300118");
    expect(vest).toBeDefined();
    expect(vest!.reasons).toEqual(expect.arrayContaining(["Never counted", "At or below minimum"]));
    expect(plan.indexOf(vest!)).toBeLessThan(6);
  });

  it("flags a location whose last count was off", () => {
    const plan = buildCountPlan(freshDb(), FIXED_NOW, 50);
    const bearing = plan.find((p) => p.sku === "200415" && p.locationId === "A-3-1");
    expect(bearing?.reasons).toContain("Last count was off by -4");
  });

  it("drops a location once it is counted today with no variance", () => {
    const db = freshDb();
    expect(buildCountPlan(db, FIXED_NOW, 100).some((p) => p.sku === "300118")).toBe(true);
    confirmCount(db, { now: FIXED_NOW }, { sku: "300118", locationId: "D-1-1", confirmedQty: 18, operatorId: "o-esther", shiftId: "s-morning" });
    expect(buildCountPlan(db, FIXED_NOW, 100).some((p) => p.sku === "300118")).toBe(false);
  });

  it("keeps a location on the plan when today's count found a variance", () => {
    const db = freshDb();
    confirmCount(db, { now: FIXED_NOW }, { sku: "300118", locationId: "D-1-1", confirmedQty: 15, operatorId: "o-esther", shiftId: "s-morning" });
    const vest = buildCountPlan(db, FIXED_NOW, 100).find((p) => p.sku === "300118");
    expect(vest?.reasons).toContain("Last count was off by -3");
  });

  it("does not change any data", () => {
    const db = freshDb();
    const before = dump(db);
    buildCountPlan(db, FIXED_NOW);
    expect(dump(db)).toEqual(before);
  });
});
