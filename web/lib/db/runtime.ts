import { getDb, type Db } from "./index";
import { seedDatabase } from "./seed";

export function getSeededDb(): Db {
  const db = getDb();
  const hasData = db.prepare("SELECT 1 FROM operators LIMIT 1").get();
  if (!hasData) seedDatabase(db, new Date());
  return db;
}
