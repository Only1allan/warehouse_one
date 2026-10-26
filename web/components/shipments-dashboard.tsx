"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import type { DispatchAccuracy, ProcessCompliance, Shipment } from "@/lib/services/logistics";
import { Panel, Skeleton, StatusPill } from "./ui";

const pct = (n: number | null) => (n === null ? "No data yet" : `${n}%`);

function useData<T>(url: string): { data: T | null; error: string | null } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api<T>(url).then(setData, (e) => setError(e.message));
  }, [url]);
  return { data, error };
}

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

export function DispatchAccuracyPanel() {
  const { data: accuracy, error } = useData<DispatchAccuracy>("/api/logistics/accuracy");
  if (error) return <p role="alert" className="font-medium text-bad">{error}</p>;
  if (!accuracy) return <Skeleton className="h-48" />;
  return (
    <div className="space-y-6">
      <Panel>
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
      </Panel>
      <Panel>
        <h2 className="text-lg font-semibold">Shortfalls</h2>
        {accuracy.shortfalls.length === 0 ? (
          <p className="mt-2 text-soft">Every dispatch so far was loaded in full.</p>
        ) : (
          <ul className="mt-2 divide-y divide-line" data-testid="shortfalls">
            {accuracy.shortfalls.map((s) => (
              <li key={s.orderNumber} className="flex flex-wrap justify-between gap-2 py-3">
                <span className="font-semibold">
                  Order {s.orderNumber} · {s.customer}
                </span>
                <span className="font-semibold text-bad">
                  loaded {s.loaded} of {s.ordered}, missing {s.missing}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

export function CompliancePanel() {
  const { data: compliance, error } = useData<ProcessCompliance>("/api/logistics/compliance");
  if (error) return <p role="alert" className="font-medium text-bad">{error}</p>;
  if (!compliance) return <Skeleton className="h-48" />;
  const open = compliance.openExceptions;
  return (
    <div className="space-y-6">
      <Panel>
        <ul className="divide-y divide-line">
          <Meter
            label="Receipts with no discrepancy"
            value={compliance.receipts.ratePct}
            detail={`${compliance.receipts.clean} of ${compliance.receipts.total} receipts were checked and matched the order`}
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
      </Panel>
      <Panel>
        <h2 className="text-lg font-semibold">Open exceptions by process</h2>
        <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-2" data-testid="open-exceptions">
          <dt>Receiving</dt>
          <dd className="font-semibold">{open.receiving}</dd>
          <dt>Dispatch</dt>
          <dd className="font-semibold">{open.dispatch}</dd>
          <dt>Cycle counts</dt>
          <dd className="font-semibold">{open.count}</dd>
          <dt>Equipment</dt>
          <dd className="font-semibold">{open.equipment}</dd>
        </dl>
      </Panel>
    </div>
  );
}

export function ShipmentList() {
  const { data: shipments, error } = useData<Shipment[]>("/api/shipments");
  if (error) return <p role="alert" className="font-medium text-bad">{error}</p>;
  if (!shipments) return <Skeleton className="h-64" />;
  return (
    <Panel>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" data-testid="shipment-table">
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
  );
}
