import { describe, expect, it } from "vitest";
import { confirmCount } from "@/lib/services/counting";
import { confirmReceipt } from "@/lib/services/receiving";
import {
  getExceptionDetail,
  listExceptions,
  reportEquipmentIssue,
} from "@/lib/services/exceptions";
import { dump, FIXED_NOW, freshDb } from "./helpers";

const actor = { operatorId: "o-amina", shiftId: "s-afternoon" };

describe("supervisor exceptions", () => {
  it("lists the seeded exceptions of every kind, newest first", () => {
    const rows = listExceptions(freshDb());
    expect(new Set(rows.map((r) => r.kind))).toEqual(new Set(["receiving", "count", "dispatch", "equipment"]));
    const times = rows.map((r) => r.createdAt);
    expect([...times].sort().reverse()).toEqual(times);
  });

  it("shows a receipt with a discrepancy automatically, and an exact one not at all", () => {
    const db = freshDb();
    const before = listExceptions(db).length;
    confirmReceipt(db, { now: FIXED_NOW }, {
      poNumber: "4471",
      lines: [{ sku: "100201", qty: 142 }, { sku: "100305", qty: 60 }, { sku: "100410", qty: 120 }],
      ...actor,
    });
    confirmReceipt(db, { now: FIXED_NOW }, {
      poNumber: "4472",
      lines: [{ sku: "300118", qty: 80 }, { sku: "300125", qty: 40 }],
      ...actor,
    });
    const rows = listExceptions(db);
    expect(rows).toHaveLength(before + 1);
    expect(rows[0]).toMatchObject({ kind: "receiving", operator: "Amina Otieno", shift: "Afternoon" });
    expect(rows[0].summary).toContain("missing 8");
  });

  it("shows a count with variance automatically, and an exact one not at all", () => {
    const db = freshDb();
    const before = listExceptions(db, { kind: "count" }).length;
    confirmCount(db, { now: FIXED_NOW }, { sku: "200310", locationId: "A-2-1", confirmedQty: 31, ...actor });
    confirmCount(db, { now: FIXED_NOW }, { sku: "100520", locationId: "C-3-1", confirmedQty: 75, ...actor });
    const rows = listExceptions(db, { kind: "count" });
    expect(rows).toHaveLength(before + 1);
    expect(rows[0].summary).toContain("variance -4");
  });

  it("filters by type and by shift", () => {
    const db = freshDb();
    const equipment = listExceptions(db, { kind: "equipment" });
    expect(equipment.length).toBeGreaterThan(0);
    expect(equipment.every((r) => r.kind === "equipment")).toBe(true);

    const morning = listExceptions(db, { shiftId: "s-morning" });
    expect(morning.length).toBeGreaterThan(0);
    expect(morning.every((r) => r.shiftId === "s-morning")).toBe(true);

    expect(listExceptions(db, { kind: "count", shiftId: "s-night" })).toEqual([]);
    expect(listExceptions(db, { kind: "nonsense" }).length).toBe(listExceptions(db).length);
  });

  it("opens each kind to the underlying record", () => {
    const db = freshDb();
    for (const row of listExceptions(db)) {
      const detail = getExceptionDetail(db, row.id);
      expect(detail.kind).toBe(row.kind);
      expect(detail.title.length).toBeGreaterThan(0);
    }
    const receiving = listExceptions(db, { kind: "receiving" })[0];
    const detail = getExceptionDetail(db, receiving.id);
    expect(detail.table?.rows[0]).toEqual(["Corrugated Carton 60x40x40 (100202)", "100", "92", "short"]);
    expect(() => getExceptionDetail(db, 99999)).toThrow(/not found/);
  });

  it("records a reported equipment issue as an exception, an issue and an event", () => {
    const db = freshDb();
    const before = dump(db);
    const result = reportEquipmentIssue(db, { now: FIXED_NOW }, {
      equipment: "Forklift F01",
      description: "Brakes feel soft",
      ...actor,
    });
    const rows = listExceptions(db, { kind: "equipment" });
    expect(rows[0]).toMatchObject({ id: result.exceptionId, summary: "Forklift F01: Brakes feel soft" });
    expect(dump(db)).not.toEqual(before);
    expect(db.prepare("SELECT type FROM events ORDER BY id DESC").get()).toEqual(
      expect.objectContaining({ type: "equipment_issue_reported" }),
    );
  });

  it("rejects an empty report and an unknown actor, changing nothing", () => {
    const db = freshDb();
    const before = dump(db);
    expect(() => reportEquipmentIssue(db, { now: FIXED_NOW }, { equipment: " ", description: "x", ...actor })).toThrow(/which equipment/);
    expect(() => reportEquipmentIssue(db, { now: FIXED_NOW }, { equipment: "F1", description: "x", operatorId: "o-x", shiftId: "s-morning" })).toThrow(/operator and shift/);
    expect(dump(db)).toEqual(before);
  });
});
