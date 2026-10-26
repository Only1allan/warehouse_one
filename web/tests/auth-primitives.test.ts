import { describe, expect, it } from "vitest";
import { can, capabilityForPath, CAPABILITIES, navFor, ROLE_NAV, ROLES, type Capability, type Role } from "@/lib/auth/capabilities";
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
    ["receive", ["operator"]],
    ["count", ["operator", "inventory_controller"]],
    ["dispatch", ["operator", "logistics_manager"]],
    ["stock_records", ["inventory_controller"]],
    ["count_plan", ["inventory_controller"]],
    ["stock_adjust", ["supervisor", "inventory_controller"]],
    ["exceptions_view", ["supervisor"]],
    ["health_view", ["supervisor"]],
    ["shipments_view", ["logistics_manager"]],
    ["logistics_metrics", ["logistics_manager"]],
    ["handover", ["supervisor", "logistics_manager"]],
    ["admin_reseed", ["supervisor"]],
  ])("%s belongs to exactly %j", (capability, roles) => {
    expect([...CAPABILITIES[capability]].sort()).toEqual([...roles].sort());
  });

  it("groups each sidebar by the needs listed for that persona in the brief", () => {
    const needs = (role: Role) => ROLE_NAV[role].map((g) => g.need);
    expect(needs("operator")).toEqual(expect.arrayContaining(["Quick access to information", "Voice interaction", "Inventory verification"]));
    expect(needs("supervisor")).toEqual(expect.arrayContaining(["Operational visibility", "Exception reporting", "Inventory alerts"]));
    expect(needs("inventory_controller")).toEqual(expect.arrayContaining(["Accurate stock records", "Faster cycle counts", "Reconciliation support"]));
    expect(needs("logistics_manager")).toEqual(expect.arrayContaining(["Dispatch accuracy", "Shipment visibility", "Process compliance"]));
  });

  it("gives every persona a different sidebar", () => {
    const signatures = ROLES.map((role) => navFor(role).map((n) => n.href).join("|"));
    expect(new Set(signatures).size).toBe(ROLES.length);
    const labels = (role: Role) => navFor(role).map((n) => n.label);
    expect(labels("operator")).toEqual(["My shift", "Ask the copilot", "Safety", "Hands-free", "Receive delivery", "Count a shelf", "Check a load"]);
    expect(labels("supervisor")).toEqual(["Operations overview", "Shift handover", "Exceptions", "Inventory alerts", "Stock approvals", "Ask the copilot"]);
    expect(labels("inventory_controller")).toEqual(["Accuracy overview", "Stock records", "Count plan", "Cycle count", "Reconciliation", "Ask the copilot"]);
    expect(labels("logistics_manager")).toEqual(["Logistics overview", "Dispatch accuracy", "Check a load", "Shipments", "Compliance", "Shift handover", "Ask the copilot"]);
  });

  it("only links to screens the role can open", () => {
    for (const role of ROLES) {
      for (const entry of navFor(role)) {
        expect(can(role, entry.capability), `${role} ${entry.href}`).toBe(true);
        const needed = capabilityForPath(entry.href);
        expect(needed && can(role, needed), `${role} ${entry.href}`).toBe(true);
      }
    }
  });

  it("maps a path to the capability it needs", () => {
    expect(capabilityForPath("/receive")).toBe("receive");
    expect(capabilityForPath("/stock/123")).toBe("stock_records");
    expect(capabilityForPath("/count-plan")).toBe("count_plan");
    expect(capabilityForPath("/count")).toBe("count");
    expect(capabilityForPath("/nowhere")).toBeNull();
  });
});
