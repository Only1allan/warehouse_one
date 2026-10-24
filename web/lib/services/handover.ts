import type { Db } from "../db";
import type { ModelPort } from "../ai/model-port";
import { AppError } from "../errors";
import { listEvents } from "../events";
import { addDays, dayKey } from "../time";

export interface HandoverWindow {
  date: string;
  shiftId: string;
  shiftName: string;
  from: string;
  to: string;
}

export interface HandoverData {
  window: HandoverWindow;
  received: { deliveries: number; units: number; withDiscrepancy: number };
  dispatched: { orders: number; units: number; withShortfall: number };
  counts: { done: number; withVariance: number };
  adjustments: number;
  discrepancies: string[];
  issues: Array<{ equipment: string; description: string; status: string; carriedOver: boolean }>;
  openExceptions: number;
}

export interface Handover {
  data: HandoverData;
  prose: string;
  source: "model" | "template";
}

export function resolveWindow(db: Db, date: string, shiftId: string): { window: HandoverWindow; from: Date; to: Date } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new AppError("invalid_request", "Choose a date for the handover.");
  const shift = db
    .prepare("SELECT id, name, start_hour, end_hour FROM shifts WHERE id = ?")
    .get(shiftId) as { id: string; name: string; start_hour: number; end_hour: number } | undefined;
  if (!shift) throw new AppError("invalid_request", "Choose a shift for the handover.");
  const [y, m, d] = date.split("-").map(Number);
  const from = new Date(y, m - 1, d, shift.start_hour, 0, 0, 0);
  const to = new Date(y, m - 1, d + (shift.end_hour > shift.start_hour ? 0 : 1), shift.end_hour, 0, 0, 0);
  return {
    window: { date, shiftId: shift.id, shiftName: shift.name, from: from.toISOString(), to: to.toISOString() },
    from,
    to,
  };
}

const ids = (list: unknown[]): number[] => list.filter((n): n is number => typeof n === "number");
const placeholders = (n: number) => Array(n).fill("?").join(",") || "NULL";

export function buildHandoverData(db: Db, date: string, shiftId: string): HandoverData {
  const { window, from, to } = resolveWindow(db, date, shiftId);
  const events = listEvents(db, { from, to });
  const of = (type: string) => events.filter((e) => e.type === type);

  const receiptIds = ids(of("receipt_confirmed").map((e) => e.payload.receiptId));
  const received = {
    deliveries: receiptIds.length,
    units: receiptIds.length
      ? (db
          .prepare(`SELECT COALESCE(SUM(received_qty), 0) AS q FROM receipt_lines WHERE receipt_id IN (${placeholders(receiptIds.length)})`)
          .get(...receiptIds) as { q: number }).q
      : 0,
    withDiscrepancy: of("receipt_confirmed").filter((e) => e.payload.hasDiscrepancy === true).length,
  };

  const orderNumbers = of("dispatch_confirmed").map((e) => String(e.payload.orderNumber));
  const dispatched = {
    orders: orderNumbers.length,
    units: orderNumbers.length
      ? (db
          .prepare(`SELECT COALESCE(SUM(qty_loaded), 0) AS q FROM order_lines WHERE order_number IN (${placeholders(orderNumbers.length)})`)
          .get(...orderNumbers) as { q: number }).q
      : 0,
    withShortfall: of("dispatch_confirmed").filter((e) => e.payload.hasShortfall === true).length,
  };

  const countEvents = of("count_confirmed");
  const counts = {
    done: countEvents.length,
    withVariance: countEvents.filter((e) => Number(e.payload.variance) !== 0).length,
  };

  const fromIso = from.toISOString();
  const toIso = to.toISOString();
  const discrepancies = (
    db
      .prepare("SELECT summary FROM exceptions WHERE created_at >= ? AND created_at < ? AND kind != 'equipment' ORDER BY created_at, id")
      .all(fromIso, toIso) as Array<{ summary: string }>
  ).map((r) => r.summary);

  const issueRows = db
    .prepare(
      `SELECT equipment, description, status, reported_at FROM equipment_issues
       WHERE (reported_at >= ? AND reported_at < ?) OR (status = 'open' AND reported_at < ?)
       ORDER BY reported_at`,
    )
    .all(fromIso, toIso, fromIso) as Array<{ equipment: string; description: string; status: string; reported_at: string }>;
  const issues = issueRows.map((r) => ({
    equipment: r.equipment,
    description: r.description,
    status: r.status,
    carriedOver: r.reported_at < fromIso,
  }));

  return {
    window,
    received,
    dispatched,
    counts,
    adjustments: of("stock_adjusted").length,
    discrepancies,
    issues,
    openExceptions: (db.prepare("SELECT COUNT(*) AS n FROM exceptions").get() as { n: number }).n,
  };
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** The always-correct summary. Used when the model is unavailable or strays from the numbers. */
export function templateProse(data: HandoverData): string {
  const lines = [
    `Shift handover for the ${data.window.shiftName} shift on ${data.window.date}.`,
    `Received: ${plural(data.received.deliveries, "delivery", "deliveries")} (${data.received.units} units)${
      data.received.withDiscrepancy ? `, ${plural(data.received.withDiscrepancy, "with a discrepancy", "with discrepancies")}` : ""
    }.`,
    `Dispatched: ${plural(data.dispatched.orders, "order", "orders")} (${data.dispatched.units} units)${
      data.dispatched.withShortfall ? `, ${plural(data.dispatched.withShortfall, "with a shortfall", "with shortfalls")}` : ""
    }.`,
    `Counts: ${plural(data.counts.done, "count", "counts")}${
      data.counts.withVariance ? `, ${plural(data.counts.withVariance, "with a variance", "with variances")}` : ""
    }.`,
  ];
  if (data.discrepancies.length) lines.push(`Discrepancies: ${data.discrepancies.join("; ")}.`);
  if (data.issues.length) {
    lines.push(
      `Equipment: ${data.issues
        .map((i) => `${i.equipment} (${i.description}, ${i.status}${i.carriedOver ? ", carried over" : ""})`)
        .join("; ")}.`,
    );
  } else {
    lines.push("Equipment: no issues reported.");
  }
  lines.push(`Open exceptions overall: ${data.openExceptions}.`);
  return lines.join("\n");
}

export function numbersIn(text: string): string[] {
  return text.match(/\d+/g) ?? [];
}

/** True when every number in the prose also appears in the structured data. */
export function usesOnlyKnownNumbers(prose: string, data: HandoverData): boolean {
  const known = new Set(numbersIn(JSON.stringify(data)));
  return numbersIn(prose).every((n) => known.has(n));
}

export function handoverPrompt(data: HandoverData): string {
  return [
    "You write the shift handover for the incoming shift lead of a warehouse.",
    "Write 3 to 6 short sentences in plain language from the JSON below.",
    "Use only numbers that appear in the JSON. Do not add advice, guesses or numbers of your own.",
    "Mention discrepancies and equipment issues first if there are any.",
    "",
    JSON.stringify(data),
  ].join("\n");
}

export async function generateHandover(
  deps: { db: Db; model: ModelPort },
  input: { date: string; shiftId: string },
): Promise<Handover> {
  const data = buildHandoverData(deps.db, input.date, input.shiftId);
  const template = templateProse(data);
  try {
    let text = "";
    for await (const event of deps.model.ask({
      messages: [{ role: "user", content: handoverPrompt(data) }],
      maxTokens: 260,
    })) {
      if (event.type === "token") text += event.text;
    }
    const prose = text.trim();
    if (prose.length >= 20 && usesOnlyKnownNumbers(prose, data)) return { data, prose, source: "model" };
  } catch {
    // The model is not available: the template below is complete on its own.
  }
  return { data, prose: template, source: "template" };
}

export interface WindowSuggestion {
  date: string;
  shiftId: string;
  shiftName: string;
  events: number;
}

/** Recent shifts that have recorded activity, newest first. */
export function suggestWindows(db: Db, now: Date, days = 4): WindowSuggestion[] {
  const shifts = db
    .prepare("SELECT id FROM shifts ORDER BY start_hour")
    .all() as Array<{ id: string }>;
  const out: WindowSuggestion[] = [];
  for (let back = 0; back < days; back++) {
    const date = dayKey(addDays(now, -back));
    for (const s of shifts) {
      const { window, from, to } = resolveWindow(db, date, s.id);
      if (from.getTime() > now.getTime()) continue;
      const events = listEvents(db, { from, to }).length;
      if (events > 0) out.push({ date, shiftId: s.id, shiftName: window.shiftName, events });
    }
  }
  return out.sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1));
}
