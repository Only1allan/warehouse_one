import type { Db } from "./db";

export type EventType =
  | "receipt_confirmed"
  | "dispatch_confirmed"
  | "count_confirmed"
  | "stock_adjusted"
  | "equipment_issue_reported"
  | "demo_reset";

export interface EventInput {
  type: EventType;
  operatorId: string;
  shiftId: string;
  payload: Record<string, unknown>;
  at: Date;
}

export interface EventRecord {
  id: number;
  type: EventType;
  operatorId: string;
  shiftId: string;
  at: string;
  payload: Record<string, unknown>;
}

export function recordEvent(db: Db, input: EventInput): number {
  const result = db
    .prepare(
      "INSERT INTO events (type, operator_id, shift_id, at, payload) VALUES (?, ?, ?, ?, ?)",
    )
    .run(
      input.type,
      input.operatorId,
      input.shiftId,
      input.at.toISOString(),
      JSON.stringify(input.payload),
    );
  return Number(result.lastInsertRowid);
}

export function listEvents(
  db: Db,
  window?: { from: Date; to: Date },
): EventRecord[] {
  const rows = (
    window
      ? db
          .prepare(
            "SELECT * FROM events WHERE at >= ? AND at < ? ORDER BY at, id",
          )
          .all(window.from.toISOString(), window.to.toISOString())
      : db.prepare("SELECT * FROM events ORDER BY at, id").all()
  ) as Array<{
    id: number;
    type: EventType;
    operator_id: string;
    shift_id: string;
    at: string;
    payload: string;
  }>;
  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    operatorId: row.operator_id,
    shiftId: row.shift_id,
    at: row.at,
    payload: JSON.parse(row.payload) as Record<string, unknown>,
  }));
}
