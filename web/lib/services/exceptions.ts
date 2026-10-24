import type { Db } from "../db";
import { inTransaction } from "../db";
import { AppError } from "../errors";
import { recordEvent } from "../events";
import { isValidActor } from "./session";

export type ExceptionKind = "receiving" | "count" | "dispatch" | "equipment";

export interface ExceptionRow {
  id: number;
  kind: ExceptionKind;
  refId: number;
  summary: string;
  operator: string;
  shiftId: string;
  shift: string;
  createdAt: string;
}

export interface ExceptionDetail {
  id: number;
  kind: ExceptionKind;
  title: string;
  fields: Array<{ label: string; value: string }>;
  table?: { columns: string[]; rows: string[][] };
}

const KINDS: ExceptionKind[] = ["receiving", "count", "dispatch", "equipment"];

export function listExceptions(
  db: Db,
  filter: { kind?: string | null; shiftId?: string | null } = {},
): ExceptionRow[] {
  const kind = filter.kind && (KINDS as string[]).includes(filter.kind) ? filter.kind : null;
  const shift = filter.shiftId || null;
  const rows = db
    .prepare(
      `SELECT e.id, e.kind, e.ref_id, e.summary, e.created_at, e.shift_id,
              o.name AS operator, s.name AS shift
       FROM exceptions e
       JOIN operators o ON o.id = e.operator_id
       JOIN shifts s ON s.id = e.shift_id
       WHERE (? IS NULL OR e.kind = ?) AND (? IS NULL OR e.shift_id = ?)
       ORDER BY e.created_at DESC, e.id DESC`,
    )
    .all(kind, kind, shift, shift) as Array<{
    id: number;
    kind: ExceptionKind;
    ref_id: number;
    summary: string;
    created_at: string;
    shift_id: string;
    operator: string;
    shift: string;
  }>;
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    refId: r.ref_id,
    summary: r.summary,
    operator: r.operator,
    shiftId: r.shift_id,
    shift: r.shift,
    createdAt: r.created_at,
  }));
}

export function getExceptionDetail(db: Db, id: number): ExceptionDetail {
  const ex = db.prepare("SELECT id, kind, ref_id FROM exceptions WHERE id = ?").get(id) as
    | { id: number; kind: ExceptionKind; ref_id: number }
    | undefined;
  if (!ex) throw new AppError("not_found", `Exception ${id} was not found.`, 404);

  if (ex.kind === "receiving") {
    const receipt = db
      .prepare("SELECT po_number, received_at FROM receipts WHERE id = ?")
      .get(ex.ref_id) as { po_number: string; received_at: string };
    const lines = db
      .prepare(
        `SELECT l.sku, COALESCE(p.name, l.sku) AS name, l.expected_qty, l.received_qty, l.status
         FROM receipt_lines l LEFT JOIN products p ON p.sku = l.sku WHERE l.receipt_id = ? ORDER BY l.id`,
      )
      .all(ex.ref_id) as Array<{ sku: string; name: string; expected_qty: number; received_qty: number; status: string }>;
    return {
      id,
      kind: ex.kind,
      title: `Receipt ${ex.ref_id} for PO ${receipt.po_number}`,
      fields: [{ label: "Received", value: receipt.received_at.slice(0, 16).replace("T", " ") }],
      table: {
        columns: ["Product", "Expected", "Received", "Result"],
        rows: lines.map((l) => [`${l.name} (${l.sku})`, String(l.expected_qty), String(l.received_qty), l.status]),
      },
    };
  }

  if (ex.kind === "count") {
    const c = db
      .prepare(
        `SELECT c.location_id, c.expected_qty, c.confirmed_qty, c.variance, c.counted_at, c.adjusted_at,
                p.name, c.sku
         FROM counts c JOIN products p ON p.sku = c.sku WHERE c.id = ?`,
      )
      .get(ex.ref_id) as {
      location_id: string;
      expected_qty: number;
      confirmed_qty: number;
      variance: number;
      counted_at: string;
      adjusted_at: string | null;
      name: string;
      sku: string;
    };
    return {
      id,
      kind: ex.kind,
      title: `Count ${ex.ref_id}: ${c.name} at ${c.location_id}`,
      fields: [
        { label: "SKU", value: c.sku },
        { label: "Expected", value: String(c.expected_qty) },
        { label: "Counted", value: String(c.confirmed_qty) },
        { label: "Variance", value: String(c.variance) },
        { label: "Counted at", value: c.counted_at.slice(0, 16).replace("T", " ") },
        { label: "Stock adjusted", value: c.adjusted_at ? "Yes" : "No" },
      ],
    };
  }

  if (ex.kind === "dispatch") {
    const d = db
      .prepare("SELECT order_number, dispatched_at FROM dispatches WHERE id = ?")
      .get(ex.ref_id) as { order_number: string; dispatched_at: string };
    const lines = db
      .prepare(
        `SELECT p.name, l.sku, l.qty_ordered, l.qty_loaded FROM order_lines l
         JOIN products p ON p.sku = l.sku WHERE l.order_number = ? ORDER BY l.id`,
      )
      .all(d.order_number) as Array<{ name: string; sku: string; qty_ordered: number; qty_loaded: number | null }>;
    return {
      id,
      kind: ex.kind,
      title: `Dispatch ${ex.ref_id} for order ${d.order_number}`,
      fields: [{ label: "Dispatched", value: d.dispatched_at.slice(0, 16).replace("T", " ") }],
      table: {
        columns: ["Product", "Ordered", "Loaded"],
        rows: lines.map((l) => [`${l.name} (${l.sku})`, String(l.qty_ordered), String(l.qty_loaded ?? 0)]),
      },
    };
  }

  const issue = db
    .prepare("SELECT equipment, description, reported_at, status FROM equipment_issues WHERE id = ?")
    .get(ex.ref_id) as { equipment: string; description: string; reported_at: string; status: string };
  return {
    id,
    kind: ex.kind,
    title: `${issue.equipment}`,
    fields: [
      { label: "Issue", value: issue.description },
      { label: "Reported", value: issue.reported_at.slice(0, 16).replace("T", " ") },
      { label: "Status", value: issue.status },
    ],
  };
}

export function reportEquipmentIssue(
  db: Db,
  deps: { now: Date },
  input: { equipment: string; description: string; operatorId: string; shiftId: string },
): { issueId: number; exceptionId: number } {
  if (!isValidActor(db, input.operatorId, input.shiftId)) {
    throw new AppError("unknown_actor", "Choose an operator and shift before reporting.");
  }
  const equipment = input.equipment?.trim();
  const description = input.description?.trim();
  if (!equipment || !description) {
    throw new AppError("invalid_request", "Say which equipment and what is wrong with it.");
  }
  const at = deps.now.toISOString();
  return inTransaction(db, () => {
    const issueId = Number(
      db
        .prepare(
          "INSERT INTO equipment_issues (equipment, description, reported_at, operator_id, shift_id, status) VALUES (?, ?, ?, ?, ?, 'open')",
        )
        .run(equipment, description, at, input.operatorId, input.shiftId).lastInsertRowid,
    );
    recordEvent(db, {
      type: "equipment_issue_reported",
      operatorId: input.operatorId,
      shiftId: input.shiftId,
      at: deps.now,
      payload: { issueId, equipment },
    });
    const exceptionId = Number(
      db
        .prepare(
          "INSERT INTO exceptions (kind, ref_id, summary, operator_id, shift_id, created_at) VALUES ('equipment', ?, ?, ?, ?, ?)",
        )
        .run(issueId, `${equipment}: ${description}`, input.operatorId, input.shiftId, at).lastInsertRowid,
    );
    return { issueId, exceptionId };
  });
}
