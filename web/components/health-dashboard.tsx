"use client";

import { useEffect, useState } from "react";
import type { HealthCategory } from "@/lib/domain/health";
import { api } from "@/lib/api-client";
import type { HealthReport } from "@/lib/services/health";
import { Icon } from "./icons";
import { Panel, Skeleton, StatusPill, type Status } from "./ui";

const categories: Array<{ id: HealthCategory | ""; label: string; status: Status }> = [
  { id: "", label: "All", status: "info" },
  { id: "stockout", label: "Stockout risk", status: "discrepancy" },
  { id: "dead", label: "Dead stock", status: "discrepancy" },
  { id: "slow", label: "Slow moving", status: "warning" },
  { id: "overstock", label: "Overstock", status: "warning" },
];

export function HealthDashboard() {
  const [report, setReport] = useState<HealthReport | null>(null);
  const [filter, setFilter] = useState<HealthCategory | "">("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<HealthReport>("/api/health").then(setReport, (e) => setError(e.message));
  }, []);

  if (error) return <p role="alert" className="font-medium text-bad">{error}</p>;
  if (!report) return <Skeleton className="h-64" />;

  const shown = report.findings.filter((f) => !filter || f.category === filter);
  const total = report.findings.length;
  const count = (id: HealthCategory | "") => (id ? report.counts[id] : total);

  return (
    <div className="space-y-6">
      <Panel>
        <div role="radiogroup" aria-label="Finding type" className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={filter === c.id}
              onClick={() => setFilter(c.id)}
              className={`min-h-12 rounded-full border px-5 font-semibold ${
                filter === c.id ? "border-ink bg-signal" : "border-line-strong bg-surface hover:bg-sunk"
              }`}
            >
              {c.label} <span data-testid={`health-count-${c.id || "all"}`}>{count(c.id)}</span>
            </button>
          ))}
        </div>
        <p className="mt-3 text-sm text-soft">
          Dead stock: no movement for {report.thresholds.deadDays} days or more. Slow moving: {report.thresholds.slowDays} days
          or more. Overstock: at least {report.thresholds.overstockMultiple} times the reorder level. Every
          recommendation below is a fixed rule applied to the stock records.
        </p>
      </Panel>

      <Panel>
        <ul className="divide-y divide-line" data-testid="health-list">
          {shown.length === 0 ? (
            <li className="flex items-center gap-2 py-6 font-medium text-ok">
              <Icon name="check" size={22} /> Nothing to act on here.
            </li>
          ) : (
            shown.map((f) => {
              const meta = categories.find((c) => c.id === f.category)!;
              return (
                <li key={`${f.category}-${f.sku}`} className="py-4" data-category={f.category}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold">
                      {f.name} <span className="font-normal text-soft">SKU {f.sku}</span>
                    </span>
                    <StatusPill status={meta.status} label={meta.label} />
                  </div>
                  <div className="mt-1 text-sm text-soft">{f.detail}</div>
                  <p className="mt-1.5 flex items-start gap-2 font-medium">
                    <Icon name="info" size={20} className="mt-0.5 shrink-0" />
                    {f.recommendation}
                  </p>
                </li>
              );
            })
          )}
        </ul>
      </Panel>
    </div>
  );
}
