import { handle } from "@/lib/http";
import { listDemoLogins } from "@/lib/services/auth";

export function GET() {
  return handle(() => Response.json(listDemoLogins()));
}
