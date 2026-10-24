import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { DROP_ALL_SQL, SCHEMA_SQL, SCHEMA_VERSION } from "./schema";

export type Db = DatabaseSync;

export function defaultDbPath(): string {
  return (
    process.env.WAREHOUSE_DB_PATH ??
    path.join(process.cwd(), "data", "warehouse.db")
  );
}

export function schemaIsCurrent(db: Db): boolean {
  const row = db.prepare("PRAGMA user_version").get() as { user_version: number };
  return row.user_version === SCHEMA_VERSION;
}

function stampSchema(db: Db): void {
  db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
}

function hasTables(db: Db): boolean {
  return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'operators'").get());
}

export function openDatabase(file: string = ":memory:"): Db {
  if (file !== ":memory:") {
    fs.mkdirSync(path.dirname(file), { recursive: true });
  }
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL;");
  if (hasTables(db) && !schemaIsCurrent(db)) db.exec(DROP_ALL_SQL);
  db.exec(SCHEMA_SQL);
  stampSchema(db);
  return db;
}

export function resetSchema(db: Db): void {
  db.exec(DROP_ALL_SQL);
  db.exec(SCHEMA_SQL);
  stampSchema(db);
}

const globalForDb = globalThis as unknown as { __warehouseDb?: Db };

export function getDb(): Db {
  if (!globalForDb.__warehouseDb) {
    globalForDb.__warehouseDb = openDatabase(defaultDbPath());
  }
  return globalForDb.__warehouseDb;
}

export function inTransaction<T>(db: Db, fn: () => T): T {
  db.exec("BEGIN");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
