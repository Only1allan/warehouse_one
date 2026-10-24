import { afterEach, describe, expect, it } from "vitest";
import { DEMO_ACCOUNTS } from "@/lib/auth/demo-accounts";
import { AppError } from "@/lib/errors";
import { getUserById, listDemoLogins, signIn } from "@/lib/services/auth";
import { freshDb } from "./helpers";

const morning = new Date(2026, 9, 28, 10, 0, 0);
const afternoon = new Date(2026, 9, 28, 15, 0, 0);

describe("sign-in", () => {
  it.each(DEMO_ACCOUNTS.map((a) => [a.username, a.password, a.role] as const))(
    "lets the seeded user %s sign in with the documented password and returns their role",
    (username, password, role) => {
      const result = signIn(freshDb(), { username, password }, morning);
      expect(result.user.role).toBe(role);
      expect(result.user.username).toBe(username);
    },
  );

  it("covers all four personas from the brief", () => {
    const roles = new Set(DEMO_ACCOUNTS.map((a) => a.role));
    expect(roles).toEqual(new Set(["operator", "supervisor", "inventory_controller", "logistics_manager"]));
  });

  it("ignores case and spaces around the username", () => {
    expect(signIn(freshDb(), { username: "  AMINA ", password: "Operator@123" }, morning).user.id).toBe("o-amina");
  });

  it("rejects a wrong password and an unknown user with the same message", () => {
    const db = freshDb();
    const wrongPassword = (() => {
      try {
        signIn(db, { username: "amina", password: "nope" }, morning);
      } catch (e) {
        return e as AppError;
      }
    })();
    const unknownUser = (() => {
      try {
        signIn(db, { username: "nobody", password: "Operator@123" }, morning);
      } catch (e) {
        return e as AppError;
      }
    })();
    expect(wrongPassword).toBeInstanceOf(AppError);
    expect(wrongPassword?.code).toBe("invalid_credentials");
    expect(wrongPassword?.status).toBe(401);
    expect(unknownUser?.message).toBe(wrongPassword?.message);
  });

  it("rejects empty credentials", () => {
    const db = freshDb();
    expect(() => signIn(db, { username: "", password: "" }, morning)).toThrow(/Wrong username or password/);
    expect(() => signIn(db, { username: "amina", password: "" }, morning)).toThrow(/Wrong username or password/);
  });

  it("starts the shift at the current one unless a valid shift is chosen", () => {
    const db = freshDb();
    expect(signIn(db, { username: "amina", password: "Operator@123" }, morning).shiftId).toBe("s-morning");
    expect(signIn(db, { username: "amina", password: "Operator@123" }, afternoon).shiftId).toBe("s-afternoon");
    expect(signIn(db, { username: "amina", password: "Operator@123", shiftId: "s-night" }, morning).shiftId).toBe("s-night");
    expect(signIn(db, { username: "amina", password: "Operator@123", shiftId: "s-bogus" }, morning).shiftId).toBe("s-morning");
  });

  it("never stores a plain-text password", () => {
    const db = freshDb();
    const rows = db.prepare("SELECT password_hash FROM operators").all() as Array<{ password_hash: string }>;
    for (const row of rows) {
      for (const account of DEMO_ACCOUNTS) expect(row.password_hash).not.toContain(account.password);
    }
  });

  it("looks a user up by id, and returns null for an unknown id", () => {
    const db = freshDb();
    expect(getUserById(db, "o-kevin")).toMatchObject({ name: "Kevin Mutua", role: "logistics_manager", title: "Logistics Manager" });
    expect(getUserById(db, "o-ghost")).toBeNull();
  });
});

describe("demo logins shown on the sign-in page", () => {
  const original = process.env.DEMO_ACCOUNTS;
  afterEach(() => {
    if (original === undefined) delete process.env.DEMO_ACCOUNTS;
    else process.env.DEMO_ACCOUNTS = original;
  });

  it("lists one featured login per persona, and each one really signs in", () => {
    const featured = listDemoLogins().filter((l) => l.featured);
    expect(featured.map((l) => l.role)).toEqual(["operator", "supervisor", "inventory_controller", "logistics_manager"]);
    const db = freshDb();
    for (const login of featured) {
      expect(signIn(db, { username: login.username, password: login.password }, morning).user.role).toBe(login.role);
    }
  });

  it("can be switched off for a real deployment", () => {
    process.env.DEMO_ACCOUNTS = "off";
    expect(listDemoLogins()).toEqual([]);
  });
});
