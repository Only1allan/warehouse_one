import type { Db } from "../db";
import { shiftForDate } from "../time";

export interface SessionOptions {
  operators: Array<{ id: string; name: string; role: "operator" | "supervisor" }>;
  shifts: Array<{ id: string; name: string; startHour: number; endHour: number }>;
  currentShiftId: string;
}

export function getSessionOptions(db: Db, now: Date): SessionOptions {
  const operators = db
    .prepare("SELECT id, name, role FROM operators ORDER BY name")
    .all() as SessionOptions["operators"];
  const shifts = (
    db
      .prepare("SELECT id, name, start_hour, end_hour FROM shifts ORDER BY start_hour")
      .all() as Array<{ id: string; name: string; start_hour: number; end_hour: number }>
  ).map((s) => ({
    id: s.id,
    name: s.name,
    startHour: s.start_hour,
    endHour: s.end_hour,
  }));
  return { operators, shifts, currentShiftId: shiftForDate(now).id };
}

export function isValidActor(db: Db, operatorId: string, shiftId: string): boolean {
  const op = db.prepare("SELECT 1 FROM operators WHERE id = ?").get(operatorId);
  const shift = db.prepare("SELECT 1 FROM shifts WHERE id = ?").get(shiftId);
  return Boolean(op && shift);
}
