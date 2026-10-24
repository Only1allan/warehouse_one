import { getSeededDb } from "@/lib/db/runtime";
import { handle } from "@/lib/http";
import { getSessionOptions } from "@/lib/services/session";

export function GET() {
  return handle(() => Response.json(getSessionOptions(getSeededDb(), new Date())));
}
