import { connection } from "next/server";
import { getDb } from "@/lib/db";
import { getSessionOptions } from "@/lib/services/session";
import { seedDatabase } from "@/lib/db/seed";

export async function GET() {
  await connection();
  const db = getDb();
  const hasData = db.prepare("SELECT 1 FROM operators LIMIT 1").get();
  if (!hasData) seedDatabase(db, new Date());
  return Response.json(getSessionOptions(db, new Date()));
}
