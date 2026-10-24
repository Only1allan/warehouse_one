import { getSeededDb } from "@/lib/db/runtime";
import { handle } from "@/lib/http";
import { listPurchaseOrders } from "@/lib/services/receiving";

export function GET() {
  return handle(() => Response.json(listPurchaseOrders(getSeededDb(), { status: "open" })));
}
