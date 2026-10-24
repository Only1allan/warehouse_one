import { getDb, resetSchema, schemaIsCurrent, type Db } from "./index";
import { seedDatabase } from "./seed";

/**
 * Makes sure a database is ready to use: on the current schema, and holding demo data.
 * An out-of-date database (for example one created by an earlier version of the app) is
 * rebuilt and reseeded.
 */
export function ensureSeeded(db: Db, now: Date = new Date()): Db {
  if (!schemaIsCurrent(db)) resetSchema(db);
  const hasData = db.prepare("SELECT 1 FROM operators LIMIT 1").get();
  if (!hasData) seedDatabase(db, now);
  return db;
}

export function getSeededDb(): Db {
  return ensureSeeded(getDb());
}
