import { describe, expect, it } from "vitest";
import { findProducts, isFollowUpReference } from "@/lib/domain/product-search";
import { freshDb } from "./helpers";

const db = freshDb();
const skuOf = (query: string) => {
  const r = findProducts(db, query);
  return r.kind === "exact" ? r.product.sku : r.kind === "ambiguous" ? r.products.map((p) => p.sku).sort() : null;
};

describe("findProducts", () => {
  it.each([
    ["001254", "001254"],
    ["sku 001254", "001254"],
    ["Where is item A340?", "A340"],
    ["a340", "A340"],
    ["P-324", "P-324"],
  ])("finds %s by SKU", (query, sku) => {
    expect(skuOf(query)).toBe(sku);
  });

  it.each([
    ["generators", "001254"],
    ["How many generators do we have?", "001254"],
    ["safety helmets", "300125"],
    ["helmet", "300125"],
    ["the hydraulic hose kits", "200310"],
    ["hose", "200310"],
    ["work light", "001420"],
    ["pressure washer", "800110"],
    ["cement", "600110"],
    ["pipes", "600140"],
    ["hi-vis vests", "300118"],
    ["boxes", "100201"],
    ["tape", "100410"],
  ])("resolves the plain word %s to one product", (query, sku) => {
    expect(skuOf(query)).toBe(sku);
  });

  it("asks which product when words match several (gloves, cartons)", () => {
    expect(skuOf("gloves")).toEqual(["300210", "300211"]);
    expect(skuOf("cartons")).toEqual(["100201", "100202"]);
  });

  it("asks which product when a loose word covers several (cable, pallet)", () => {
    const cable = skuOf("cable");
    expect(Array.isArray(cable)).toBe(true);
    expect((cable as string[]).length).toBeGreaterThan(1);
    expect(Array.isArray(skuOf("pallet"))).toBe(true);
  });

  it("reports nothing for unknown or empty input", () => {
    expect(findProducts(db, "unicorn saddle").kind).toBe("none");
    expect(findProducts(db, "").kind).toBe("none");
    expect(findProducts(db, "how many do we have").kind).toBe("none");
  });
});

describe("isFollowUpReference", () => {
  it.each(["it", "where is it", "that one", "them", ""])("treats %j as a follow-up", (q) => {
    expect(isFollowUpReference(q)).toBe(true);
  });
  it.each(["generators", "001254", "cement"])("treats %j as a real product", (q) => {
    expect(isFollowUpReference(q)).toBe(false);
  });
});
