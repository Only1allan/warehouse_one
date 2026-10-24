import { getDb } from "@/lib/db";
import { seedDatabase } from "@/lib/db/seed";
import { handle } from "@/lib/http";

export function POST() {
  return handle(() => Response.json({ reset: true, summary: seedDatabase(getDb(), new Date()) }));
}
