import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { DROP_ALL_SQL, SCHEMA_SQL } from "./schema";

export type Db = DatabaseSync;

export function defaultDbPath(): string {
  return (
    process.env.WAREHOUSE_DB_PATH ??
    path.join(process.cwd(), "data", "warehouse.db")
  );
}

export function openDatabase(file: string = ":memory:"): Db {
  if (file !== ":memory:") {
    fs.mkdirSync(path.dirname(file), { recursive: true });
  }
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec(SCHEMA_SQL);
  return db;
}

export function resetSchema(db: Db): void {
  db.exec(DROP_ALL_SQL);
  db.exec(SCHEMA_SQL);
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
