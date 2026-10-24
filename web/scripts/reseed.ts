import { defaultDbPath, openDatabase } from "../lib/db";
import { seedDatabase } from "../lib/db/seed";

const file = defaultDbPath();
const db = openDatabase(file);
const summary = seedDatabase(db, new Date());
db.close();

console.log(`Demo database reset at ${file}`);
console.table(summary);
