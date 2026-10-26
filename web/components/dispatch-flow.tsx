"use client";

import { useCallback, useEffect, useState } from "react";
import { api, upload } from "@/lib/api-client";
import type { DispatchReport, Order, OrderSummary } from "@/lib/services/dispatch";
import type { ExtractedDocument } from "@/lib/services/document-reading";
import { DOCUMENT_MAX_EDGE, resizeImage } from "@/lib/image-resize";
import { Icon } from "./icons";
import { QuantityField } from "./quantity-field";
import { Button, Panel, Skeleton, StatusPill, type Status } from "./ui";

const statusMap: Record<string, { status: Status; label: string }> = {
  exact: { status: "ok", label: "Complete" },
  short: { status: "discrepancy", label: "Short" },
  missing: { status: "discrepancy", label: "Not loaded" },
  over: { status: "warning", label: "Too many" },
  unexpected: { status: "warning", label: "Not on order" },
};

export function DispatchFlow() {
  const [orders, setOrders] = useState<OrderSummary[] | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [loaded, setLoaded] = useState<Record<string, string>>({});
  const [storedReport, setReport] = useState<DispatchReport | null>(null);
  const [sheet, setSheet] = useState<ExtractedDocument | null>(null);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ dispatchId: number; report: DispatchReport } | null>(null);

  const loadOrders = useCallback(async () => {
    try {
      setOrders(await api<OrderSummary[]>("/api/dispatch/orders"));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    fetch("/api/dispatch/orders")
      .then((r) => r.json())
      .then((data) => alive && setOrders(data), (e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, []);

  async function choose(orderNumber: string) {
    setError(null);
    setReport(null);
    setLoaded({});
    try {
      setOrder(await api<Order>(`/api/dispatch/order/${orderNumber}`));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function readSheet(file: File) {
    setError(null);
    setReading(true);
    setSheet(null);
    try {
      const form = new FormData();
      form.append("image", await resizeImage(file, DOCUMENT_MAX_EDGE), "loading-sheet.jpg");
      const result = await upload<ExtractedDocument>("/api/dispatch/extract", form);
      setSheet(result);
      if (result.matchedOrderNumber) await choose(result.matchedOrderNumber);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setReading(false);
    }
  }

  const allEntered = order ? order.lines.every((l) => (loaded[l.sku] ?? "") !== "") : false;
  const report = order && allEntered ? storedReport : null;

  useEffect(() => {
    if (!order || !allEntered) return;
    const handle = setTimeout(async () => {
      try {
        setReport(
          await api<DispatchReport>("/api/dispatch/compare", {
            orderNumber: order.orderNumber,
            lines: order.lines.map((l) => ({ sku: l.sku, qty: Number(loaded[l.sku]) })),
          }),
        );
        setError(null);
      } catch (e) {
        setError((e as Error).message);
      }
    }, 200);
    return () => clearTimeout(handle);
  }, [order, loaded, allEntered]);

  async function confirm() {
    if (!order) return;
    setSaving(true);
    setError(null);
    try {
      setDone(
        await api("/api/dispatch/confirm", {
          orderNumber: order.orderNumber,
          lines: order.lines.map((l) => ({ sku: l.sku, qty: Number(loaded[l.sku]) })),
        }),
      );
      void loadOrders();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setDone(null);
    setOrder(null);
    setReport(null);
    setLoaded({});
    setSheet(null);
    setError(null);
  }

  if (done) {
    const issues = done.report.lines.filter((l) => l.status !== "exact");
    return (
      <Panel>
        <div className="flex items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-ok-fill text-ok">
            <Icon name="check" size={26} />
          </span>
          <div>
            <h2 className="text-xl font-semibold" data-testid="dispatch-saved">
              Order {done.report.orderNumber} dispatched
            </h2>
            <p className="mt-1 text-soft">Stock has been reduced by what was loaded.</p>
            {issues.length > 0 ? (
              <ul className="mt-3 space-y-1 font-medium text-bad" role="status">
                {issues.map((l) => (
                  <li key={l.sku} className="flex items-start gap-2">
                    <Icon name="alert" size={20} className="mt-0.5 shrink-0" />
                    {l.message}. Sent to the supervisor.
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
        <div className="mt-6">
          <Button variant="primary" onClick={reset}>
            Check another load
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
        <h2 className="text-lg font-semibold">1. Choose the order</h2>
        <p className="mt-1 text-sm text-soft">Pick the order on the loading sheet, or photograph the sheet and I will find it.</p>
        <div className="mt-4">
          <label
            className={`inline-flex min-h-14 cursor-pointer items-center gap-2.5 rounded-control border border-line-strong bg-surface px-5 font-semibold hover:bg-sunk ${
              reading ? "pointer-events-none opacity-60" : ""
            }`}
          >
            <Icon name="camera" size={22} />
            {reading ? "Reading the sheet…" : "Photograph the loading sheet"}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              aria-label="Loading sheet photo"
              disabled={reading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void readSheet(file);
                e.target.value = "";
              }}
            />
          </label>
          {reading ? (
            <div className="mt-3 space-y-2" aria-live="polite">
              <p className="text-sm text-soft">This can take up to a minute on this device.</p>
              <Skeleton className="h-5 w-2/3" />
            </div>
          ) : null}
          {sheet && sheet.warnings.length > 0 ? (
            <ul className="mt-3 space-y-1">
              {sheet.warnings.map((w) => (
                <li key={w} className="flex items-start gap-2 text-sm font-medium text-warn">
                  <Icon name="alert" size={18} className="mt-0.5 shrink-0" />
                  {w}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="mt-4 grid gap-2" role="radiogroup" aria-label="Sales order">
          {orders === null ? (
            <>
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </>
          ) : orders.length === 0 ? (
            <p className="text-soft">No orders are waiting to be loaded.</p>
          ) : (
            orders.map((o) => {
              const selected = order?.orderNumber === o.orderNumber;
              return (
                <button
                  key={o.orderNumber}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => choose(o.orderNumber)}
                  className={`flex min-h-16 flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-control border px-4 py-2 text-left ${
                    selected ? "border-ink bg-signal" : "border-line-strong bg-surface hover:bg-sunk"
                  }`}
                >
                  <span className="font-semibold">
                    Order {o.orderNumber} · {o.customer}
                  </span>
                  <span className="text-sm">
                    {o.destination} · {o.lineCount} {o.lineCount === 1 ? "line" : "lines"}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </Panel>

      {order ? (
        <Panel>
          <h2 className="text-lg font-semibold">2. Enter what was loaded</h2>
          <p className="mt-1 text-sm text-soft">Count what is on the truck. Do not copy the order quantity.</p>
          <ul className="mt-4 divide-y divide-line">
            {order.lines.map((line) => {
              const row = report?.lines.find((l) => l.sku === line.sku);
              const mapped = row ? statusMap[row.status] : null;
              const onSheet = sheet?.lines.find((l) => l.sku === line.sku);
              return (
                <li key={line.sku} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-4">
                  <div className="min-w-0 basis-60 grow">
                    <div className="font-semibold">{line.name}</div>
                    <div className="text-sm text-soft">
                      SKU {line.sku} · Ordered {line.qtyOrdered}
                      {sheet ? (onSheet ? ` · On sheet ${onSheet.noteQty ?? "unclear"}` : " · Not found on the sheet") : ""}
                    </div>
                    {onSheet?.needsCheck ? (
                      <div className="mt-1">
                        <StatusPill status="warning" label={`Check: ${onSheet.reasons.join(", ")}`} />
                      </div>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    {mapped ? <StatusPill status={mapped.status} label={mapped.label} /> : null}
                    <QuantityField
                      label={`Loaded ${line.name}`}
                      value={loaded[line.sku] ?? ""}
                      onChange={(v) => setLoaded((r) => ({ ...r, [line.sku]: v }))}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
      ) : null}

      {order && report ? (
        <Panel>
          <h2 className="text-lg font-semibold">3. Check and confirm</h2>
          <div
            data-testid="dispatch-summary"
            role="status"
            className={`mt-3 flex items-center gap-2.5 rounded-control px-4 py-3 font-semibold ${
              report.hasDiscrepancy ? "bg-bad-fill text-bad" : "bg-ok-fill text-ok"
            }`}
          >
            <Icon name={report.hasDiscrepancy ? "alert" : "check"} size={24} />
            {report.hasDiscrepancy ? "Dispatch incomplete." : "The load matches the order."}
          </div>
          {report.hasDiscrepancy ? (
            <ul className="mt-3 space-y-1.5" data-testid="dispatch-lines">
              {report.lines
                .filter((l) => l.status !== "exact")
                .map((l) => (
                  <li key={l.sku}>{l.message}</li>
                ))}
            </ul>
          ) : null}
          <div className="mt-5 flex flex-wrap gap-3">
            <Button variant="primary" icon="check" onClick={confirm} disabled={saving}>
              {saving ? "Saving…" : "Confirm dispatch"}
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
