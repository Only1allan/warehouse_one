"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import type { DispatchAccuracy, ProcessCompliance, Shipment } from "@/lib/services/logistics";
import { Panel, Skeleton, StatusPill } from "./ui";

interface Data {
  shipments: Shipment[];
  accuracy: DispatchAccuracy;
  compliance: ProcessCompliance;
}

const pct = (n: number | null) => (n === null ? "No data yet" : `${n}%`);

function Meter({ label, value, detail }: { label: string; value: number | null; detail: string }) {
  return (
    <li className="py-3" data-testid={`meter-${label}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-semibold">{label}</span>
        <span className="font-bold">{pct(value)}</span>
      </div>
      <div
        className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-sunk"
        role="meter"
        aria-label={label}
        aria-valuenow={value ?? 0}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="h-full bg-ink" style={{ width: `${value ?? 0}%` }} />
      </div>
      <div className="mt-1 text-sm text-soft">{detail}</div>
    </li>
  );
}

export function ShipmentsDashboard() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api<Data>("/api/shipments").then(setData, (e) => setError(e.message));
  }, []);
  if (error) return <p role="alert" className="font-medium text-bad">{error}</p>;
  if (!data) return <Skeleton className="h-64" />;
  const { accuracy, compliance, shipments } = data;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel>
          <h2 className="text-lg font-semibold">Dispatch accuracy</h2>
          <ul className="divide-y divide-line">
            <Meter
              label="Dispatches loaded in full"
              value={accuracy.accuracyPct}
              detail={`${accuracy.inFull} of ${accuracy.dispatches} dispatches matched the order`}
            />
            <Meter
              label="Units loaded versus ordered"
              value={accuracy.fillPct}
              detail={`${accuracy.unitsLoaded} of ${accuracy.unitsOrdered} units`}
            />
          </ul>
          {accuracy.shortfalls.length > 0 ? (
            <div className="mt-3">
              <h3 className="text-sm font-semibold text-soft">Shortfalls</h3>
              <ul className="mt-1 divide-y divide-line" data-testid="shortfalls">
                {accuracy.shortfalls.map((s) => (
                  <li key={s.orderNumber} className="flex flex-wrap justify-between gap-2 py-2">
                    <span>
                      Order {s.orderNumber} · {s.customer}
                    </span>
                    <span className="font-semibold text-bad">
                      loaded {s.loaded} of {s.ordered}, missing {s.missing}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Panel>

        <Panel>
          <h2 className="text-lg font-semibold">Process compliance</h2>
          <ul className="divide-y divide-line">
            <Meter
              label="Receipts with no discrepancy"
              value={compliance.receipts.ratePct}
              detail={`${compliance.receipts.clean} of ${compliance.receipts.total} receipts`}
            />
            <Meter
              label="Dispatches with no shortfall"
              value={compliance.dispatches.ratePct}
              detail={`${compliance.dispatches.clean} of ${compliance.dispatches.total} dispatches`}
            />
            <Meter
              label="Counts with no variance"
              value={compliance.counts.ratePct}
              detail={`${compliance.counts.exact} of ${compliance.counts.total} counts`}
            />
          </ul>
          <p className="mt-3 text-sm text-soft">
            Open exceptions: {compliance.openExceptions.receiving} receiving, {compliance.openExceptions.dispatch}{" "}
            dispatch, {compliance.openExceptions.count} count, {compliance.openExceptions.equipment} equipment.
          </p>
        </Panel>
      </div>

      <Panel>
        <h2 className="text-lg font-semibold">Shipments</h2>
        <div className="overflow-x-auto">
          <table className="mt-2 w-full text-sm" data-testid="shipment-table">
            <thead className="text-left text-soft">
              <tr>
                <th className="py-2 font-medium">Order</th>
                <th className="py-2 font-medium">Customer</th>
                <th className="py-2 font-medium">Destination</th>
                <th className="py-2 text-right font-medium">Ordered</th>
                <th className="py-2 text-right font-medium">Loaded</th>
                <th className="py-2 pl-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {shipments.map((s) => (
                <tr key={s.orderNumber} className="border-t border-line">
                  <td className="py-2.5 font-semibold">{s.orderNumber}</td>
                  <td className="py-2.5">{s.customer}</td>
                  <td className="py-2.5">{s.destination}</td>
                  <td className="py-2.5 text-right">{s.ordered}</td>
                  <td className="py-2.5 text-right">{s.loaded ?? "-"}</td>
                  <td className="py-2.5 pl-4">
                    {s.status === "open" ? (
                      <StatusPill status="info" label="Waiting to load" />
                    ) : s.shortBy > 0 ? (
                      <StatusPill status="discrepancy" label={`Dispatched, short ${s.shortBy}`} />
                    ) : (
                      <StatusPill status="ok" label="Dispatched in full" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
