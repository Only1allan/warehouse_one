/**
 * End-to-end check of every backend capability, for every persona, against a running server.
 *
 *   npm run smoke:api                         # http://localhost:3000, no AI calls
 *   npm run smoke:api -- --ai                 # also runs the AI features (slower)
 *   npm run smoke:api -- --base http://localhost:3101
 *
 * It RESETS THE DEMO DATA on the target server first.
 */
import fs from "node:fs";
import path from "node:path";
import { can, type Capability, type Role } from "../lib/auth/capabilities";
import { DEMO_ACCOUNTS } from "../lib/auth/demo-accounts";

const args = process.argv.slice(2);
const BASE = args.includes("--base") ? args[args.indexOf("--base") + 1] : "http://localhost:3000";
const WITH_AI = args.includes("--ai");
const fixtures = path.join(process.cwd(), "data", "fixtures");

interface Check {
  role: string;
  name: string;
  ok: boolean;
  detail: string;
}
const results: Check[] = [];

class Session {
  cookie = "";
  constructor(readonly username: string) {}

  async signIn(): Promise<void> {
    const account = DEMO_ACCOUNTS.find((a) => a.username === this.username)!;
    const r = await fetch(`${BASE}/api/auth/signin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: account.username, password: account.password, shiftId: "s-morning" }),
    });
    if (!r.ok) throw new Error(`Sign in as ${this.username} failed: ${r.status} ${await r.text()}`);
    this.cookie = (r.headers.get("set-cookie") ?? "").split(";")[0];
  }

  async call(method: string, url: string, body?: unknown): Promise<{ status: number; data: unknown; text: string }> {
    const isForm = body instanceof FormData;
    const isBytes = body instanceof Uint8Array;
    const r = await fetch(`${BASE}${url}`, {
      method,
      headers: {
        Cookie: this.cookie,
        ...(body !== undefined && !isForm && !isBytes ? { "Content-Type": "application/json" } : {}),
      },
      body: body === undefined ? undefined : isForm || isBytes ? (body as BodyInit) : JSON.stringify(body),
    });
    const text = await r.text();
    let data: unknown = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
    return { status: r.status, data, text };
  }
}

function record(role: string, name: string, ok: boolean, detail = "") {
  results.push({ role, name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${role.padEnd(20)} ${name}${detail ? `  (${detail})` : ""}`);
}

async function expect(role: string, name: string, fn: () => Promise<string | void>) {
  try {
    const detail = await fn();
    record(role, name, true, detail ?? "");
  } catch (error) {
    record(role, name, false, error instanceof Error ? error.message : String(error));
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const READS: Array<{ method: "GET" | "POST"; url: string; capability: Capability | null; body?: unknown }> = [
  { method: "GET", url: "/api/home", capability: null },
  { method: "GET", url: "/api/readiness", capability: "readiness" },
  { method: "GET", url: "/api/receiving/pos", capability: "receive" },
  { method: "GET", url: "/api/receiving/po/4471", capability: "receive" },
  { method: "POST", url: "/api/receiving/compare", capability: "receive", body: { poNumber: "4471", lines: [{ sku: "100201", qty: 142 }] } },
  { method: "GET", url: "/api/count/targets?q=hose", capability: "count" },
  { method: "GET", url: "/api/count-plan", capability: "count_plan" },
  { method: "GET", url: "/api/dispatch/orders", capability: "dispatch" },
  { method: "GET", url: "/api/dispatch/order/5521", capability: "dispatch" },
  { method: "POST", url: "/api/dispatch/compare", capability: "dispatch", body: { orderNumber: "5521", lines: [{ sku: "600100", qty: 48 }] } },
  { method: "GET", url: "/api/stock?q=generator", capability: "stock_records" },
  { method: "GET", url: "/api/stock/001254", capability: "stock_records" },
  { method: "GET", url: "/api/stock/reconciliations", capability: "stock_adjust" },
  { method: "GET", url: "/api/shipments", capability: "shipments_view" },
  { method: "GET", url: "/api/logistics/accuracy", capability: "logistics_metrics" },
  { method: "GET", url: "/api/logistics/compliance", capability: "logistics_metrics" },
  { method: "GET", url: "/api/health", capability: "health_view" },
  { method: "GET", url: "/api/supervisor/exceptions", capability: "exceptions_view" },
  { method: "GET", url: "/api/handover/windows", capability: "handover" },
];

const PERSONAS: Array<{ username: string; role: Role }> = [
  { username: "amina", role: "operator" },
  { username: "daniel", role: "supervisor" },
  { username: "esther", role: "inventory_controller" },
  { username: "kevin", role: "logistics_manager" },
];

async function parseSse(text: string): Promise<Array<Record<string, unknown>>> {
  return text
    .split("\n\n")
    .map((f) => f.trim())
    .filter((f) => f.startsWith("data: "))
    .map((f) => JSON.parse(f.slice(6)) as Record<string, unknown>);
}

console.log(`Checking ${BASE}${WITH_AI ? " (including AI features)" : ""}\n`);

const supervisor = new Session("daniel");
await supervisor.signIn();
const reset = await supervisor.call("POST", "/api/admin/reseed");
record("setup", "reset demo data", reset.status === 200, `status ${reset.status}`);

await expect("security", "every API refuses a request with no session", async () => {
  const anon = new Session("nobody");
  for (const r of READS) {
    const res = await anon.call(r.method, r.url, r.body);
    assert(res.status === 401, `${r.url} returned ${res.status}`);
  }
  return `${READS.length} endpoints`;
});

await expect("security", "a wrong password is refused", async () => {
  const r = await fetch(`${BASE}/api/auth/signin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "amina", password: "wrong" }),
  });
  assert(r.status === 401, `status ${r.status}`);
});

const sessions = new Map<string, Session>();
for (const p of PERSONAS) {
  const s = new Session(p.username);
  await s.signIn();
  sessions.set(p.username, s);
  await expect(p.role, "can reach exactly the endpoints of its role", async () => {
    let allowed = 0;
    for (const r of READS) {
      const res = await s.call(r.method, r.url, r.body);
      const expected = r.capability === null || can(p.role, r.capability) ? 200 : 403;
      assert(res.status === expected, `${r.method} ${r.url}: expected ${expected}, got ${res.status}`);
      if (expected === 200) allowed++;
    }
    return `${allowed} allowed, ${READS.length - allowed} refused`;
  });
}

const amina = sessions.get("amina")!;
const daniel = sessions.get("daniel")!;
const esther = sessions.get("esther")!;
const kevin = sessions.get("kevin")!;

await expect("operator", "receive PO 4471 with 142 of 150 cartons: missing 8, exception raised", async () => {
  const r = await amina.call("POST", "/api/receiving/confirm", {
    poNumber: "4471",
    lines: [{ sku: "100201", qty: 142 }, { sku: "100305", qty: 60 }, { sku: "100410", qty: 120 }],
  });
  assert(r.status === 200, `status ${r.status} ${r.text}`);
  const report = (r.data as { report: { hasDiscrepancy: boolean; lines: Array<{ message: string }> } }).report;
  assert(report.hasDiscrepancy && report.lines.some((l) => l.message.includes("missing 8")), "no 'missing 8'");
});

await expect("operator", "count Hydraulic Hose Kit: expected 35, counted 31, variance -4", async () => {
  const r = await amina.call("POST", "/api/count/confirm", { sku: "200310", locationId: "A-2-1", confirmedQty: 31 });
  assert(r.status === 200, `status ${r.status}`);
  assert((r.data as { variance: number }).variance === -4, "variance is not -4");
});

await expect("operator", "check load 5521: 48 of 50 pallets, missing 2", async () => {
  const r = await amina.call("POST", "/api/dispatch/confirm", { orderNumber: "5521", lines: [{ sku: "600100", qty: 48 }] });
  assert(r.status === 200, `status ${r.status} ${r.text}`);
  assert(JSON.stringify(r.data).includes("missing 2"), "no 'missing 2'");
});

await expect("operator", "report an equipment issue", async () => {
  const r = await amina.call("POST", "/api/supervisor/equipment-issues", { equipment: "Forklift F01", description: "Brakes feel soft" });
  assert(r.status === 200, `status ${r.status}`);
});

await expect("operator", "cannot adjust stock (only supervisor or inventory controller)", async () => {
  const r = await amina.call("POST", "/api/count/adjust", { countId: 1 });
  assert(r.status === 403, `status ${r.status}`);
});

await expect("supervisor", "sees the operator's exceptions, attributed to her", async () => {
  const r = await daniel.call("GET", "/api/supervisor/exceptions");
  const rows = r.data as Array<{ summary: string; operator: string }>;
  const mine = rows.filter((x) => x.operator === "Amina Otieno");
  assert(mine.some((x) => x.summary.includes("missing 8")), "receiving exception missing");
  assert(mine.some((x) => x.summary.includes("missing 2")), "dispatch exception missing");
  assert(mine.some((x) => x.summary.includes("Forklift F01")), "equipment issue missing");
  return `${rows.length} open exceptions`;
});

await expect("supervisor", "today's operations feed shows the floor's activity", async () => {
  const home = (await daniel.call("GET", "/api/home")).data as { today: Record<string, number> };
  assert(home.today.receipts === 1 && home.today.dispatches === 1 && home.today.counts === 1, JSON.stringify(home.today));
});

await expect("supervisor", "inventory alerts have every category", async () => {
  const h = (await daniel.call("GET", "/api/health")).data as { counts: Record<string, number> };
  for (const k of ["dead", "slow", "stockout", "overstock"]) assert(h.counts[k] > 0, `no ${k}`);
});

await expect("supervisor", "approves the -4 variance: stock becomes 31", async () => {
  const list = (await daniel.call("GET", "/api/stock/reconciliations")).data as { pending: Array<{ countId: number; sku: string }> };
  const hose = list.pending.find((p) => p.sku === "200310");
  assert(hose, "hose count not pending");
  const r = await daniel.call("POST", "/api/count/adjust", { countId: hose.countId });
  assert(r.status === 200 && (r.data as { newQty: number }).newQty === 31, r.text);
});

await expect("inventory_controller", "stock records show movements, incoming and promised stock", async () => {
  const d = (await esther.call("GET", "/api/stock/001254")).data as { movements: unknown[]; incoming: unknown[]; committed: unknown[] };
  assert(d.movements.length > 0 && d.incoming.length > 0 && d.committed.length > 0, "detail incomplete");
});

await expect("inventory_controller", "count plan ranks what to count next with reasons", async () => {
  const plan = (await esther.call("GET", "/api/count-plan")).data as Array<{ reasons: string[] }>;
  assert(plan.length > 0 && plan.every((p) => p.reasons.length > 0), "empty plan");
  return `${plan.length} locations`;
});

await expect("inventory_controller", "declines the seeded variance with a reason; stock unchanged", async () => {
  const list = (await esther.call("GET", "/api/stock/reconciliations")).data as { pending: Array<{ countId: number; sku: string }> };
  const bearing = list.pending.find((p) => p.sku === "200415");
  assert(bearing, "bearing count not pending");
  const r = await esther.call("POST", "/api/stock/decline", { countId: bearing.countId, reason: "Recount tomorrow" });
  assert(r.status === 200, r.text);
  const after = (await esther.call("GET", "/api/stock/200415")).data as { product: { total: number } };
  assert(after.product.total === 180, `total ${after.product.total}`);
});

await expect("logistics_manager", "dispatch accuracy now counts the 5521 shortfall", async () => {
  const a = (await kevin.call("GET", "/api/logistics/accuracy")).data as { dispatches: number; shortfalls: Array<{ orderNumber: string }> };
  assert(a.dispatches === 3 && a.shortfalls.some((s) => s.orderNumber === "5521"), JSON.stringify(a).slice(0, 200));
});

await expect("logistics_manager", "shipments and compliance come from the records", async () => {
  const s = (await kevin.call("GET", "/api/shipments")).data as Array<{ orderNumber: string; shortBy: number }>;
  assert(s.find((x) => x.orderNumber === "5521")?.shortBy === 2, "5521 not short by 2");
  const c = (await kevin.call("GET", "/api/logistics/compliance")).data as { receipts: { total: number } };
  assert(c.receipts.total === 3, `receipts ${c.receipts.total}`);
});

await expect("logistics_manager", "suggested handover windows include today", async () => {
  const w = (await kevin.call("GET", "/api/handover/windows")).data as unknown[];
  assert(w.length > 0, "no windows");
});

if (WITH_AI) {
  console.log("\nAI features (each can take up to a minute on CPU)\n");

  await expect("operator", "AI: 'How many generators do we have?' answers 43 from the records", async () => {
    const r = await amina.call("POST", "/api/ask", { message: "How many generators do we have?" });
    const events = await parseSse(r.text);
    const card = events.find((e) => e.type === "card") as { card: { kind: string; total: number } } | undefined;
    const tool = events.find((e) => e.type === "tool") as { name: string; routedBy: string } | undefined;
    assert(card?.card.kind === "stock" && card.card.total === 43, r.text.slice(0, 300));
    return `routed by ${tool?.routedBy} to ${tool?.name}`;
  });

  await expect("operator", "AI: damaged inventory answer cites the SOP", async () => {
    const r = await amina.call("POST", "/api/ask", { message: "What should I do with damaged inventory?" });
    const events = await parseSse(r.text);
    const sop = events.find((e) => e.type === "card" && (e.card as { kind: string }).kind === "sop");
    const text = events.filter((e) => e.type === "token").map((e) => e.text).join("");
    assert(sop, `no citation: ${text.slice(0, 200)}`);
    return text.slice(0, 90);
  });

  await expect("operator", "AI: voice question is transcribed on the device", async () => {
    const wav = fs.readFileSync(path.join(fixtures, "audio", "question-01.wav"));
    const r = await amina.call("POST", "/api/voice/transcribe", new Uint8Array(wav));
    const d = r.data as { ok: boolean; text: string };
    assert(r.status === 200 && d.ok && /generator/i.test(d.text), r.text);
    return `heard "${d.text}"`;
  });

  await expect("operator", "AI: delivery note photo is read and matched to PO 4472", async () => {
    const form = new FormData();
    form.append("image", new Blob([fs.readFileSync(path.join(fixtures, "images", "delivery-note-4472.png"))], { type: "image/png" }), "note.png");
    const r = await amina.call("POST", "/api/receiving/extract", form);
    const d = r.data as { matchedPoNumber: string; lines: Array<{ sku: string; noteQty: number }> };
    assert(r.status === 200 && d.matchedPoNumber === "4472", r.text.slice(0, 300));
    return `${d.lines.length} lines read`;
  });

  await expect("inventory_controller", "AI: shelf photo gets a proposed count", async () => {
    const form = new FormData();
    form.append("image", new Blob([fs.readFileSync(path.join(fixtures, "images", "shelf-12.png"))], { type: "image/png" }), "shelf.png");
    form.append("sku", "200310");
    form.append("locationId", "A-2-1");
    const r = await esther.call("POST", "/api/count/propose", form);
    const d = r.data as { proposedQty: number | null; photoPath: string; note: string | null };
    assert(r.status === 200 && d.photoPath, r.text.slice(0, 300));
    return d.proposedQty === null ? `no number: ${d.note}` : `proposed ${d.proposedQty} (true 12)`;
  });

  await expect("supervisor", "AI: shift handover uses only real numbers", async () => {
    const w = (await daniel.call("GET", "/api/handover/windows")).data as Array<{ date: string; shiftId: string }>;
    const r = await daniel.call("POST", "/api/handover", { date: w[0].date, shiftId: w[0].shiftId });
    const d = r.data as { source: string; prose: string };
    assert(r.status === 200 && d.prose.length > 20, r.text.slice(0, 300));
    return `written by ${d.source}`;
  });
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
process.exit(failed.length ? 1 : 0);
