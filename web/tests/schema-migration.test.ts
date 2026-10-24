import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { openDatabase, schemaIsCurrent } from "@/lib/db";
import { ensureSeeded } from "@/lib/db/runtime";
import { SCHEMA_VERSION } from "@/lib/db/schema";
import { signIn } from "@/lib/services/auth";
import { FIXED_NOW } from "./helpers";

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

/** The tables as they were before accounts existed: no username, no password hash. */
function makeLegacyDatabase(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wh-legacy-"));
  dirs.push(dir);
  const file = path.join(dir, "warehouse.db");
  const legacy = new DatabaseSync(file);
  legacy.exec(`
    CREATE TABLE operators (id TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL);
    INSERT INTO operators VALUES ('o-amina', 'Amina Otieno', 'operator');
    CREATE TABLE counts (id INTEGER PRIMARY KEY, sku TEXT, adjusted_at TEXT);
  `);
  legacy.close();
  return file;
}

describe("database schema versions", () => {
  it("a new database is stamped with the current version", () => {
    expect(schemaIsCurrent(openDatabase(":memory:"))).toBe(true);
    expect(SCHEMA_VERSION).toBeGreaterThan(0);
  });

  it("rebuilds a database from an earlier version instead of failing with 'no such column'", () => {
    const db = openDatabase(makeLegacyDatabase());
    expect(schemaIsCurrent(db)).toBe(true);
    const columns = (db.prepare("PRAGMA table_info(operators)").all() as Array<{ name: string }>).map((c) => c.name);
    expect(columns).toEqual(expect.arrayContaining(["username", "password_hash"]));
    const countColumns = (db.prepare("PRAGMA table_info(counts)").all() as Array<{ name: string }>).map((c) => c.name);
    expect(countColumns).toContain("declined_at");
  });

  it("reseeds the rebuilt database so every demo login works straight away", () => {
    const db = ensureSeeded(openDatabase(makeLegacyDatabase()), FIXED_NOW);
    for (const [username, password] of [
      ["amina", "Operator@123"],
      ["daniel", "Supervisor@123"],
      ["esther", "Controller@123"],
      ["kevin", "Logistics@123"],
    ]) {
      expect(signIn(db, { username, password }, FIXED_NOW).user.username).toBe(username);
    }
  });

  it("repairs a connection that was opened on the old schema, without a restart", () => {
    const file = makeLegacyDatabase();
    const stale = new DatabaseSync(file);
    expect(() => stale.prepare("SELECT username FROM operators").get()).toThrow(/no such column/);
    const repaired = ensureSeeded(stale as never, FIXED_NOW);
    expect(signIn(repaired, { username: "amina", password: "Operator@123" }, FIXED_NOW).user.name).toBe("Amina Otieno");
  });

  it("leaves a current database and its data alone", () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "wh-current-")), "warehouse.db");
    dirs.push(path.dirname(file));
    const first = ensureSeeded(openDatabase(file), FIXED_NOW);
    first.exec("UPDATE stock SET qty = 7 WHERE sku = '001254'");
    first.close();
    const again = ensureSeeded(openDatabase(file), FIXED_NOW);
    expect((again.prepare("SELECT qty FROM stock WHERE sku = '001254'").get() as { qty: number }).qty).toBe(7);
  });
});
