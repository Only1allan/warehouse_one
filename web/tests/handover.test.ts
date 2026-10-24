import { describe, expect, it } from "vitest";
import { FakeModelPort } from "@/lib/ai/fake-model-port";
import {
  buildHandoverData,
  generateHandover,
  resolveWindow,
  suggestWindows,
  templateProse,
  usesOnlyKnownNumbers,
} from "@/lib/services/handover";
import { confirmCount } from "@/lib/services/counting";
import { confirmReceipt } from "@/lib/services/receiving";
import { dump, FIXED_NOW, freshDb } from "./helpers";

const YESTERDAY = "2026-10-27";

describe("shift windows", () => {
  it("covers a day shift in one day and the night shift across midnight", () => {
    const db = freshDb();
    const morning = resolveWindow(db, YESTERDAY, "s-morning");
    expect(new Date(morning.window.to).getTime() - new Date(morning.window.from).getTime()).toBe(8 * 3_600_000);
    const night = resolveWindow(db, YESTERDAY, "s-night");
    expect(new Date(night.window.to).getTime() - new Date(night.window.from).getTime()).toBe(8 * 3_600_000);
    expect(new Date(night.to).getDate()).toBe(28);
  });

  it("rejects a bad date or shift", () => {
    const db = freshDb();
    expect(() => resolveWindow(db, "yesterday", "s-morning")).toThrow(/date/);
    expect(() => resolveWindow(db, YESTERDAY, "s-bogus")).toThrow(/shift/);
  });
});

describe("handover data", () => {
  it("summarises the morning shift from its recorded events only", () => {
    const data = buildHandoverData(freshDb(), YESTERDAY, "s-morning");
    expect(data.received).toEqual({ deliveries: 0, units: 0, withDiscrepancy: 0 });
    expect(data.dispatched).toEqual({ orders: 1, units: 40, withShortfall: 0 });
    expect(data.counts).toEqual({ done: 2, withVariance: 1 });
    expect(data.issues).toEqual([
      expect.objectContaining({ equipment: "Forklift F03", status: "open", carriedOver: false }),
    ]);
  });

  it("summarises the afternoon shift with its discrepancies", () => {
    const data = buildHandoverData(freshDb(), YESTERDAY, "s-afternoon");
    expect(data.received).toEqual({ deliveries: 1, units: 92, withDiscrepancy: 1 });
    expect(data.dispatched).toEqual({ orders: 1, units: 18, withShortfall: 1 });
    expect(data.discrepancies.join(" ")).toContain("missing 8");
    expect(data.discrepancies.join(" ")).toContain("missing 2");
    expect(data.issues[0]).toMatchObject({ equipment: "Forklift F03", carriedOver: true });
  });

  it("leaves out events from other shifts", () => {
    const night = buildHandoverData(freshDb(), YESTERDAY, "s-night");
    expect(night.received.deliveries + night.dispatched.orders + night.counts.done).toBe(0);
  });

  it("picks up new activity inside the window", () => {
    const db = freshDb();
    const at = new Date(2026, 9, 28, 9, 0, 0);
    confirmReceipt(db, { now: at }, {
      poNumber: "4472",
      lines: [{ sku: "300118", qty: 80 }, { sku: "300125", qty: 40 }],
      operatorId: "o-amina",
      shiftId: "s-morning",
    });
    confirmCount(db, { now: at }, { sku: "200310", locationId: "A-2-1", confirmedQty: 31, operatorId: "o-amina", shiftId: "s-morning" });
    const data = buildHandoverData(db, "2026-10-28", "s-morning");
    expect(data.received).toEqual({ deliveries: 1, units: 120, withDiscrepancy: 0 });
    expect(data.counts).toEqual({ done: 1, withVariance: 1 });
  });

  it("changes nothing", () => {
    const db = freshDb();
    const before = dump(db);
    buildHandoverData(db, YESTERDAY, "s-afternoon");
    expect(dump(db)).toEqual(before);
  });
});

describe("handover prose", () => {
  const data = () => buildHandoverData(freshDb(), YESTERDAY, "s-afternoon");

  it("the template states every figure from the data", () => {
    const text = templateProse(data());
    expect(text).toContain("1 delivery (92 units)");
    expect(text).toContain("1 with a discrepancy");
    expect(text).toContain("Forklift F03");
    expect(usesOnlyKnownNumbers(text, data())).toBe(true);
  });

  it("accepts model prose that keeps to the numbers", async () => {
    const model = new FakeModelPort().queueTurn({
      tokens: ["One delivery of 92 units was received, with a discrepancy. One order of 18 units had a shortfall."],
    });
    const result = await generateHandover({ db: freshDb(), model }, { date: YESTERDAY, shiftId: "s-afternoon" });
    expect(result.source).toBe("model");
    expect(result.prose).toContain("92 units");
  });

  it("rejects model prose that invents a number and uses the template instead", async () => {
    const model = new FakeModelPort().queueTurn({
      tokens: ["A total of 777 units were received and 12 orders were dispatched during the shift."],
    });
    const result = await generateHandover({ db: freshDb(), model }, { date: YESTERDAY, shiftId: "s-afternoon" });
    expect(result.source).toBe("template");
    expect(result.prose).not.toContain("777");
    expect(result.prose).toContain("92 units");
  });

  it("falls back to the template when the model is empty or fails", async () => {
    const empty = await generateHandover({ db: freshDb(), model: new FakeModelPort() }, { date: YESTERDAY, shiftId: "s-afternoon" });
    expect(empty.source).toBe("template");
    const broken = new FakeModelPort();
    broken.ask = () => {
      throw new Error("model not ready");
    };
    const result = await generateHandover({ db: freshDb(), model: broken }, { date: YESTERDAY, shiftId: "s-afternoon" });
    expect(result.source).toBe("template");
  });

  it("always returns the structured numbers beside the prose", async () => {
    const result = await generateHandover({ db: freshDb(), model: new FakeModelPort() }, { date: YESTERDAY, shiftId: "s-afternoon" });
    expect(result.data.received.units).toBe(92);
  });
});

describe("suggested windows", () => {
  it("lists recent shifts that have activity, newest first", () => {
    const suggestions = suggestWindows(freshDb(), FIXED_NOW);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0].date >= suggestions[suggestions.length - 1].date).toBe(true);
    expect(suggestions.every((s) => s.events > 0)).toBe(true);
    expect(suggestions.map((s) => `${s.date}/${s.shiftId}`)).toEqual(
      expect.arrayContaining([`${YESTERDAY}/s-morning`, `${YESTERDAY}/s-afternoon`]),
    );
  });
});
