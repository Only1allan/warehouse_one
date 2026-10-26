"use client";

import { useCallback, useEffect, useState } from "react";
import type { ExtractedDocument } from "@/lib/services/document-reading";
import { DOCUMENT_MAX_EDGE, resizeImage } from "@/lib/image-resize";
import type {
  PurchaseOrder,
  PurchaseOrderSummary,
  ReceiptReport,
} from "@/lib/services/receiving";
import { Icon } from "./icons";
import { QuantityField } from "./quantity-field";
import { Button, Panel, Skeleton, StatusPill, type Status } from "./ui";

const statusMap: Record<string, { status: Status; label: string }> = {
  exact: { status: "ok", label: "Matches" },
  short: { status: "discrepancy", label: "Short" },
  missing: { status: "discrepancy", label: "Missing" },
  over: { status: "warning", label: "Extra" },
  unexpected: { status: "warning", label: "Not on order" },
};

async function api<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message ?? "Something went wrong.");
  return data as T;
}

function dueLabel(date: string): string {
  const today = new Date();
  const key = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const tomorrow = new Date(today.getTime() + 86_400_000);
  if (date === key(today)) return "Due today";
  if (date === key(tomorrow)) return "Due tomorrow";
  return `Due ${date}`;
}

export function ReceiveFlow() {
  const [orders, setOrders] = useState<PurchaseOrderSummary[] | null>(null);
  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [received, setReceived] = useState<Record<string, string>>({});
  const [storedReport, setReport] = useState<ReceiptReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<{ receiptId: number; report: ReceiptReport } | null>(null);
  const [note, setNote] = useState<ExtractedDocument | null>(null);
  const [reading, setReading] = useState(false);

  const loadOrders = useCallback(async () => {
    try {
      setOrders(await api<PurchaseOrderSummary[]>("/api/receiving/pos"));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    fetch("/api/receiving/pos")
      .then((r) => r.json())
      .then((data) => alive && setOrders(data), (e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, []);

  async function choose(poNumber: string) {
    setError(null);
    setReport(null);
    setReceived({});
    try {
      setPo(await api<PurchaseOrder>(`/api/receiving/po/${poNumber}`));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function readNote(file: File) {
    setError(null);
    setReading(true);
    setNote(null);
    try {
      const body = new FormData();
      body.append("image", await resizeImage(file, DOCUMENT_MAX_EDGE), "delivery-note.jpg");
      const response = await fetch("/api/receiving/extract", { method: "POST", body });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error?.message ?? "I could not read that photo.");
      const result = data as ExtractedDocument;
      setNote(result);
      if (result.matchedPoNumber) await choose(result.matchedPoNumber);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setReading(false);
    }
  }

  const allEntered = po ? po.lines.every((l) => received[l.sku] !== undefined && received[l.sku] !== "") : false;
  const report = po && allEntered ? storedReport : null;

  useEffect(() => {
    if (!po || !allEntered) return;
    const handle = setTimeout(async () => {
      try {
        setReport(
          await api<ReceiptReport>("/api/receiving/compare", {
            poNumber: po.poNumber,
            lines: po.lines.map((l) => ({ sku: l.sku, qty: Number(received[l.sku]) })),
          }),
        );
        setError(null);
      } catch (e) {
        setError((e as Error).message);
      }
    }, 200);
    return () => clearTimeout(handle);
  }, [po, received, allEntered]);

  async function confirm() {
    if (!po || !report) return;
    setSaving(true);
    setError(null);
    try {
      const result = await api<{ receiptId: number; report: ReceiptReport }>("/api/receiving/confirm", {
        poNumber: po.poNumber,
        lines: po.lines.map((l) => ({ sku: l.sku, qty: Number(received[l.sku]) })),
      });
      setDone(result);
      void loadOrders();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setDone(null);
    setPo(null);
    setReport(null);
    setReceived({});
    setError(null);
    setNote(null);
  }

  if (done) {
    const issues = done.report.lines.filter((l) => l.status !== "exact");
    return (
      <Panel>
        <div className="flex items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-ok-fill text-ok">
            <Icon name="check" size={26} />
          </span>
          <div className="min-w-0">
            <h2 className="text-xl font-semibold" data-testid="receipt-saved">
              Receipt {done.receiptId} saved for PO {done.report.poNumber}
            </h2>
            <p className="mt-1 text-soft">Stock has been updated.</p>
            {issues.length > 0 ? (
              <p className="mt-3 flex items-start gap-2 font-medium text-bad" role="status">
                <Icon name="alert" size={22} className="mt-0.5 shrink-0" />
                <span>
                  {issues.length === 1 ? "1 discrepancy was" : `${issues.length} discrepancies were`} sent to
                  the supervisor.
                </span>
              </p>
            ) : null}
          </div>
        </div>
        <div className="mt-6">
          <Button variant="primary" onClick={reset}>
            Receive another delivery
          </Button>
        </div>
      </Panel>
    );
  }

  return (
    <div className="space-y-6">
      {error ? (
        <div role="alert" className="flex items-start gap-3 rounded-control bg-bad-fill px-4 py-3 font-medium text-bad">
          <Icon name="alert" size={22} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <Panel>
        <h2 className="text-lg font-semibold">1. Choose the purchase order</h2>
        <p className="mt-1 text-sm text-soft">Pick the order that matches the delivery note, or photograph the note and I will find it.</p>
        <div className="mt-4">
          <label
            className={`inline-flex min-h-14 cursor-pointer items-center gap-2.5 rounded-control border border-line-strong bg-surface px-5 font-semibold hover:bg-sunk ${
              reading ? "pointer-events-none opacity-60" : ""
            }`}
          >
            <Icon name="camera" size={22} />
            {reading ? "Reading the note…" : "Photograph the delivery note"}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              aria-label="Delivery note photo"
              disabled={reading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void readNote(file);
                e.target.value = "";
              }}
            />
          </label>
          {reading ? (
            <div className="mt-3 space-y-2" aria-live="polite">
              <p className="text-sm text-soft">This can take up to a minute on this device.</p>
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-5 w-1/2" />
            </div>
          ) : null}
          {note && note.warnings.length > 0 ? (
            <ul className="mt-3 space-y-1" data-testid="note-warnings">
              {note.warnings.map((w) => (
                <li key={w} className="flex items-start gap-2 text-sm font-medium text-warn">
                  <Icon name="alert" size={18} className="mt-0.5 shrink-0" />
                  {w}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="mt-4 grid gap-2" role="radiogroup" aria-label="Purchase order">
          {orders === null ? (
            <>
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </>
          ) : orders.length === 0 ? (
            <p className="text-soft">There are no open purchase orders.</p>
          ) : (
            orders.map((o) => {
              const selected = po?.poNumber === o.poNumber;
              return (
                <button
                  key={o.poNumber}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => choose(o.poNumber)}
                  className={`flex min-h-16 flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-control border px-4 py-2 text-left ${
                    selected ? "border-ink bg-signal" : "border-line-strong bg-surface hover:bg-sunk"
                  }`}
                >
                  <span className="font-semibold">
                    PO {o.poNumber} · {o.supplier}
                  </span>
                  <span className="text-sm">
                    {dueLabel(o.expectedDate)} · {o.lineCount} {o.lineCount === 1 ? "line" : "lines"}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </Panel>

      {po ? (
        <Panel>
          <h2 className="text-lg font-semibold">2. Enter what actually arrived</h2>
          <p className="mt-1 text-sm text-soft">Count every line. Do not copy the quantity from the delivery note.</p>
          <ul className="mt-4 divide-y divide-line">
            {po.lines.map((line) => {
              const row = report?.lines.find((l) => l.sku === line.sku);
              const mapped = row ? statusMap[row.status] : null;
              return (
                <li key={line.sku} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-4">
                  <div className="min-w-0 basis-60 grow">
                    <div className="font-semibold">{line.description}</div>
                    <div className="text-sm text-soft">
                      SKU {line.sku} · Ordered {line.qtyOrdered}
                      {(() => {
                        const onNote = note?.lines.find((l) => l.sku === line.sku);
                        if (!note) return null;
                        if (!onNote) return " · Not found on the note";
                        return ` · On note ${onNote.noteQty ?? "unclear"}`;
                      })()}
                    </div>
                    {note?.lines.find((l) => l.sku === line.sku)?.needsCheck ? (
                      <div className="mt-1">
                        <StatusPill
                          status="warning"
                          label={`Check: ${note.lines.find((l) => l.sku === line.sku)!.reasons.join(", ")}`}
                        />
                      </div>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    {mapped ? <StatusPill status={mapped.status} label={mapped.label} /> : null}
                    <QuantityField
                      label={`Received ${line.description}`}
                      value={received[line.sku] ?? ""}
                      onChange={(v) => setReceived((r) => ({ ...r, [line.sku]: v }))}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
      ) : null}

      {po && report ? (
        <Panel>
          <h2 className="text-lg font-semibold">3. Check and confirm</h2>
          <div
            className={`mt-3 flex items-center gap-2.5 rounded-control px-4 py-3 font-semibold ${
              report.hasDiscrepancy ? "bg-bad-fill text-bad" : "bg-ok-fill text-ok"
            }`}
            data-testid="report-summary"
            role="status"
          >
            <Icon name={report.hasDiscrepancy ? "alert" : "check"} size={24} />
            {report.hasDiscrepancy
              ? "This delivery does not match the order."
              : "Everything matches the order."}
          </div>
          {report.hasDiscrepancy ? (
            <ul className="mt-3 space-y-1.5" data-testid="report-lines">
              {report.lines
                .filter((l) => l.status !== "exact")
                .map((l) => (
                  <li key={l.sku} className="text-base">
                    {l.message}
                  </li>
                ))}
            </ul>
          ) : null}
          <div className="mt-5 flex flex-wrap gap-3">
            <Button variant="primary" icon="check" onClick={confirm} disabled={saving}>
              {saving ? "Saving…" : "Confirm receipt"}
            </Button>
            <Button variant="quiet" onClick={reset} disabled={saving}>
              Cancel
            </Button>
          </div>
          <p className="mt-3 text-sm text-soft">Stock only changes when you confirm.</p>
        </Panel>
      ) : null}
    </div>
  );
}
