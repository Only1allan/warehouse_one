import { describe, expect, it } from "vitest";
import { can, capabilityForPath, CAPABILITIES, navFor, ROLES, type Capability } from "@/lib/auth/capabilities";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSessionToken, verifySessionToken } from "@/lib/auth/session-token";

describe("passwords", () => {
  it("verifies the right password and rejects the wrong one", () => {
    const stored = hashPassword("Operator@123");
    expect(verifyPassword("Operator@123", stored)).toBe(true);
    expect(verifyPassword("operator@123", stored)).toBe(false);
    expect(verifyPassword("", stored)).toBe(false);
  });

  it("does not store the password and uses a different salt each time", () => {
    const a = hashPassword("same-password");
    const b = hashPassword("same-password");
    expect(a).not.toContain("same-password");
    expect(a).not.toBe(b);
    expect(verifyPassword("same-password", a)).toBe(true);
    expect(verifyPassword("same-password", b)).toBe(true);
  });

  it("is repeatable with a fixed salt (used for seeded demo accounts)", () => {
    expect(hashPassword("x", "fixedsalt")).toBe(hashPassword("x", "fixedsalt"));
  });

  it("rejects a malformed stored value instead of throwing", () => {
    expect(verifyPassword("x", "")).toBe(false);
    expect(verifyPassword("x", "nocolon")).toBe(false);
  });
});

describe("session tokens", () => {
  const secret = "test-secret";
  const now = new Date(2026, 9, 28, 10, 0, 0);

  it("round-trips a valid token", () => {
    const token = createSessionToken({ uid: "o-amina", sid: "s-morning" }, secret, now);
    expect(verifySessionToken(token, secret, now)).toMatchObject({ uid: "o-amina", sid: "s-morning" });
  });

  it("rejects a token signed with another secret", () => {
    const token = createSessionToken({ uid: "o-amina", sid: "s-morning" }, "other", now);
    expect(verifySessionToken(token, secret, now)).toBeNull();
  });

  it("rejects a token whose payload was edited (privilege escalation attempt)", () => {
    const token = createSessionToken({ uid: "o-amina", sid: "s-morning" }, secret, now);
    const [, signature] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ uid: "o-daniel", sid: "s-morning", exp: now.getTime() + 1e9 })).toString("base64url");
    expect(verifySessionToken(`${forged}.${signature}`, secret, now)).toBeNull();
  });

  it("rejects an expired token", () => {
    const token = createSessionToken({ uid: "o-amina", sid: "s-morning" }, secret, now, 12);
    const later = new Date(now.getTime() + 13 * 3_600_000);
    expect(verifySessionToken(token, secret, later)).toBeNull();
    expect(verifySessionToken(token, secret, new Date(now.getTime() + 11 * 3_600_000))).not.toBeNull();
  });

  it.each([undefined, null, "", "garbage", "a.b", "a.b.c"])("rejects %j", (token) => {
    expect(verifySessionToken(token as string | undefined, secret, now)).toBeNull();
  });
});

describe("roles and capabilities", () => {
  it("gives every role the shared basics", () => {
    for (const role of ROLES) {
      expect(can(role, "ask")).toBe(true);
      expect(can(role, "equipment_report")).toBe(true);
    }
  });

  it.each<[Capability, string[]]>([
    ["receive", ["operator", "supervisor"]],
    ["count", ["operator", "supervisor", "inventory_controller"]],
    ["stock_adjust", ["supervisor", "inventory_controller"]],
    ["dispatch", ["operator", "supervisor", "logistics_manager"]],
    ["handover", ["supervisor", "logistics_manager"]],
    ["admin_reseed", ["supervisor"]],
  ])("%s belongs to exactly %j", (capability, roles) => {
    expect([...CAPABILITIES[capability]].sort()).toEqual([...roles].sort());
  });

  it("gives each persona a navigation made for their job", () => {
    const labels = (role: Parameters<typeof navFor>[0]) => navFor(role).map((n) => n.label);
    expect(labels("operator")).toEqual(["Home", "Ask", "Receive", "Count", "Dispatch"]);
    expect(labels("inventory_controller")).toContain("Stock records");
    expect(labels("inventory_controller")).not.toContain("Receive");
    expect(labels("logistics_manager")).toEqual(
      expect.arrayContaining(["Dispatch", "Shipments", "Inventory health", "Shift handover"]),
    );
    expect(labels("logistics_manager")).not.toContain("Count");
    expect(labels("supervisor").length).toBe(navFor("supervisor").length);
    expect(labels("supervisor")).toContain("Exceptions");
  });

  it("maps a path to the capability it needs", () => {
    expect(capabilityForPath("/receive")).toBe("receive");
    expect(capabilityForPath("/stock/123")).toBe("stock_records");
    expect(capabilityForPath("/nowhere")).toBeNull();
  });
});
