import { getDb } from "@/lib/db";
import { seedDatabase } from "@/lib/db/seed";
import { handleAuthed } from "@/lib/http";

export function POST() {
  return handleAuthed("admin_reseed", () =>
    Response.json({ reset: true, summary: seedDatabase(getDb(), new Date()) }),
  );
}
