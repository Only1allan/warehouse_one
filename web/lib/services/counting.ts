import type { Db } from "../db";
import { inTransaction } from "../db";
import { computeVariance, describeVariance } from "../domain/variance";
import { AppError } from "../errors";
import { recordEvent } from "../events";
import { isValidActor } from "./session";

export interface CountTarget {
  sku: string;
  name: string;
  locationId: string;
  expectedQty: number;
}

export interface CountRecord {
  id: number;
  sku: string;
  name: string;
  locationId: string;
  expectedQty: number;
  proposedQty: number | null;
  confirmedQty: number;
  variance: number;
  photoPath: string | null;
  countedAt: string;
  adjustedAt: string | null;
}

export function listCountTargets(db: Db, query = ""): CountTarget[] {
  const like = `%${query.trim().toLowerCase()}%`;
  const rows = db
    .prepare(
      `SELECT s.sku, p.name, s.location_id, s.qty
       FROM stock s JOIN products p ON p.sku = s.sku
       WHERE (? = '%%' OR lower(p.name) LIKE ? OR lower(s.sku) LIKE ? OR lower(s.location_id) LIKE ?)
       ORDER BY s.location_id, p.name`,
    )
    .all(like, like, like, like) as Array<{ sku: string; name: string; location_id: string; qty: number }>;
  return rows.map((r) => ({ sku: r.sku, name: r.name, locationId: r.location_id, expectedQty: r.qty }));
}

function getTarget(db: Db, sku: string, locationId: string): CountTarget {
  const row = db
    .prepare(
      `SELECT s.sku, p.name, s.location_id, s.qty FROM stock s JOIN products p ON p.sku = s.sku
       WHERE s.sku = ? AND s.location_id = ?`,
    )
    .get(sku, locationId) as { sku: string; name: string; location_id: string; qty: number } | undefined;
  if (!row) {
    throw new AppError("not_found", `There is no stock record for ${sku} at ${locationId}.`, 404);
  }
  return { sku: row.sku, name: row.name, locationId: row.location_id, expectedQty: row.qty };
}

export interface ConfirmCountInput {
  sku: string;
  locationId: string;
  confirmedQty: number;
  proposedQty?: number | null;
  photoPath?: string | null;
  operatorId: string;
  shiftId: string;
}

export function confirmCount(
  db: Db,
  deps: { now: Date },
  input: ConfirmCountInput,
): CountRecord {
  if (!isValidActor(db, input.operatorId, input.shiftId)) {
    throw new AppError("unknown_actor", "Choose an operator and shift before confirming.");
  }
  if (!Number.isInteger(input.confirmedQty) || input.confirmedQty < 0) {
    throw new AppError("invalid_request", "The counted quantity must be a whole number of zero or more.");
  }
  const target = getTarget(db, input.sku, input.locationId);
  const variance = computeVariance(target.expectedQty, input.confirmedQty);
  const at = deps.now.toISOString();

  return inTransaction(db, () => {
    const id = Number(
      db
        .prepare(
          `INSERT INTO counts (sku, location_id, expected_qty, proposed_qty, confirmed_qty, variance, photo_path, operator_id, shift_id, counted_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          input.sku,
          input.locationId,
          target.expectedQty,
          input.proposedQty ?? null,
          input.confirmedQty,
          variance,
          input.photoPath ?? null,
          input.operatorId,
          input.shiftId,
          at,
        ).lastInsertRowid,
    );
    recordEvent(db, {
      type: "count_confirmed",
      operatorId: input.operatorId,
      shiftId: input.shiftId,
      at: deps.now,
      payload: {
        countId: id,
        sku: input.sku,
        locationId: input.locationId,
        expected: target.expectedQty,
        confirmed: input.confirmedQty,
        variance,
      },
    });
    if (variance !== 0) {
      db.prepare(
        "INSERT INTO exceptions (kind, ref_id, summary, operator_id, shift_id, created_at) VALUES ('count', ?, ?, ?, ?, ?)",
      ).run(
        id,
        `Count ${input.locationId}: ${describeVariance(target.name, target.expectedQty, input.confirmedQty)}`,
        input.operatorId,
        input.shiftId,
        at,
      );
    }
    return {
      id,
      sku: input.sku,
      name: target.name,
      locationId: input.locationId,
      expectedQty: target.expectedQty,
      proposedQty: input.proposedQty ?? null,
      confirmedQty: input.confirmedQty,
      variance,
      photoPath: input.photoPath ?? null,
      countedAt: at,
      adjustedAt: null,
    };
  });
}

export function adjustStockFromCount(
  db: Db,
  deps: { now: Date },
  input: { countId: number; operatorId: string; shiftId: string },
): { countId: number; newQty: number; delta: number } {
  if (!isValidActor(db, input.operatorId, input.shiftId)) {
    throw new AppError("unknown_actor", "Choose an operator and shift before adjusting stock.");
  }
  const role = (
    db.prepare("SELECT role FROM operators WHERE id = ?").get(input.operatorId) as { role: string }
  ).role;
  if (role !== "supervisor") {
    throw new AppError("forbidden", "Only a supervisor can adjust stock.", 403);
  }
  const count = db
    .prepare("SELECT * FROM counts WHERE id = ?")
    .get(input.countId) as
    | { id: number; sku: string; location_id: string; variance: number; adjusted_at: string | null }
    | undefined;
  if (!count) throw new AppError("not_found", `Count ${input.countId} was not found.`, 404);
  if (count.adjusted_at) {
    throw new AppError("conflict", "Stock was already adjusted for this count.", 409);
  }
  if (count.variance === 0) {
    throw new AppError("invalid_request", "This count has no variance to adjust.");
  }
  const at = deps.now.toISOString();

  return inTransaction(db, () => {
    const current = (
      db.prepare("SELECT qty FROM stock WHERE sku = ? AND location_id = ?").get(count.sku, count.location_id) as {
        qty: number;
      }
    ).qty;
    const newQty = Math.max(0, current + count.variance);
    const delta = newQty - current;
    db.prepare("UPDATE stock SET qty = ?, last_moved_at = ? WHERE sku = ? AND location_id = ?").run(
      newQty,
      at,
      count.sku,
      count.location_id,
    );
    db.prepare(
      "INSERT INTO movements (sku, location_id, delta, kind, at) VALUES (?, ?, ?, 'adjustment', ?)",
    ).run(count.sku, count.location_id, delta, at);
    db.prepare("UPDATE counts SET adjusted_at = ? WHERE id = ?").run(at, count.id);
    recordEvent(db, {
      type: "stock_adjusted",
      operatorId: input.operatorId,
      shiftId: input.shiftId,
      at: deps.now,
      payload: { countId: count.id, sku: count.sku, locationId: count.location_id, delta, newQty },
    });
    return { countId: count.id, newQty, delta };
  });
}

export function getCount(db: Db, id: number): CountRecord {
  const row = db
    .prepare(
      `SELECT c.*, p.name FROM counts c JOIN products p ON p.sku = c.sku WHERE c.id = ?`,
    )
    .get(id) as
    | {
        id: number;
        sku: string;
        name: string;
        location_id: string;
        expected_qty: number;
        proposed_qty: number | null;
        confirmed_qty: number;
        variance: number;
        photo_path: string | null;
        counted_at: string;
        adjusted_at: string | null;
      }
    | undefined;
  if (!row) throw new AppError("not_found", `Count ${id} was not found.`, 404);
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    locationId: row.location_id,
    expectedQty: row.expected_qty,
    proposedQty: row.proposed_qty,
    confirmedQty: row.confirmed_qty,
    variance: row.variance,
    photoPath: row.photo_path,
    countedAt: row.counted_at,
    adjustedAt: row.adjusted_at,
  };
}
