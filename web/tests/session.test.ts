import { describe, expect, it } from "vitest";
import { getSessionOptions, isValidActor } from "@/lib/services/session";
import { freshDb } from "./helpers";

describe("session options", () => {
  it("lists operators and shifts for the selector", () => {
    const options = getSessionOptions(freshDb(), new Date(2026, 9, 28, 10, 0));
    expect(options.operators.map((o) => o.name)).toContain("Amina Otieno");
    expect(options.operators.some((o) => o.role === "supervisor")).toBe(true);
    expect(options.shifts.map((s) => s.id)).toEqual(["s-morning", "s-afternoon", "s-night"]);
  });

  it.each([
    [new Date(2026, 9, 28, 6, 0), "s-morning"],
    [new Date(2026, 9, 28, 13, 59), "s-morning"],
    [new Date(2026, 9, 28, 14, 0), "s-afternoon"],
    [new Date(2026, 9, 28, 22, 0), "s-night"],
    [new Date(2026, 9, 28, 3, 30), "s-night"],
  ])("picks the current shift for %s", (now, expected) => {
    expect(getSessionOptions(freshDb(), now).currentShiftId).toBe(expected);
  });

  it("only accepts known operators and shifts as the actor of a write", () => {
    const db = freshDb();
    expect(isValidActor(db, "o-amina", "s-morning")).toBe(true);
    expect(isValidActor(db, "o-nobody", "s-morning")).toBe(false);
    expect(isValidActor(db, "o-amina", "s-weekend")).toBe(false);
  });
});
