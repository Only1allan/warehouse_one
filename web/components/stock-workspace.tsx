"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import type { Reconciliation, StockDetail, StockRow } from "@/lib/services/stock";
import { useAuth } from "./auth-context";
import { Icon } from "./icons";
import { Button, Panel, Skeleton, StatusPill } from "./ui";

const when = (iso: string) => iso.slice(0, 16).replace("T", " ");

function Detail({ sku }: { sku: string }) {
  const [detail, setDetail] = useState<StockDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api<StockDetail>(`/api/stock/${encodeURIComponent(sku)}`).then(setDetail, (e) => setError(e.message));
  }, [sku]);
  if (error) return <p className="text-bad">{error}</p>;
  if (!detail) return <Skeleton className="h-24" />;
  return (
    <div className="space-y-5 text-sm" data-testid="stock-detail">
      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <h3 className="font-semibold">Locations</h3>
          <ul className="mt-1 divide-y divide-line">
            {detail.locations.map((l) => (
              <li key={l.locationId} className="flex justify-between py-1.5">
                <span className="font-medium">{l.locationId}</span>
                <span>{l.qty}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="font-semibold">On the way and promised</h3>
          <ul className="mt-1 divide-y divide-line">
            {detail.incoming.map((i) => (
              <li key={i.poNumber} className="flex justify-between py-1.5">
                <span>Incoming on PO {i.poNumber} ({i.expectedDate})</span>
                <span>+{i.qty}</span>
              </li>
            ))}
            {detail.committed.map((c) => (
              <li key={c.orderNumber} className="flex justify-between py-1.5">
                <span>Order {c.orderNumber} for {c.customer}</span>
                <span>-{c.qty}</span>
              </li>
            ))}
            {detail.incoming.length + detail.committed.length === 0 ? <li className="py-1.5 text-soft">None</li> : null}
          </ul>
        </div>
      </div>
      <div>
        <h3 className="font-semibold">Recent movements</h3>
        <table className="mt-1 w-full">
          <thead className="text-left text-soft">
            <tr>
              <th className="py-1 font-medium">When</th>
              <th className="py-1 font-medium">Location</th>
              <th className="py-1 font-medium">Type</th>
              <th className="py-1 text-right font-medium">Change</th>
            </tr>
          </thead>
          <tbody>
            {detail.movements.map((m, i) => (
              <tr key={i} className="border-t border-line">
                <td className="py-1.5">{when(m.at)}</td>
                <td className="py-1.5">{m.locationId}</td>
                <td className="py-1.5">{m.kind}</td>
                <td className={`py-1.5 text-right font-semibold ${m.delta < 0 ? "text-bad" : "text-ok"}`}>
                  {m.delta > 0 ? `+${m.delta}` : m.delta}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {detail.counts.length > 0 ? (
        <div>
          <h3 className="font-semibold">Recent counts</h3>
          <ul className="mt-1 divide-y divide-line">
            {detail.counts.map((c) => (
              <li key={c.id} className="flex flex-wrap justify-between gap-2 py-1.5">
                <span>
                  {c.locationId}: expected {c.expected}, counted {c.confirmed}
                </span>
                <span className={c.variance === 0 ? "text-ok" : "font-semibold text-bad"}>
                  {c.variance === 0 ? "No variance" : `Variance ${c.variance > 0 ? "+" : ""}${c.variance}`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function Records() {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [rows, setRows] = useState<StockRow[] | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handle = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q, category });
        const data = await api<{ rows: StockRow[]; categories: string[] }>(`/api/stock?${params}`);
        setRows(data.rows);
        setCategories(data.categories);
      } catch (e) {
        setError((e as Error).message);
      }
    }, 150);
    return () => clearTimeout(handle);
  }, [q, category]);

  return (
    <Panel>
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-0 flex-1 basis-64">
          <span className="mb-1 block text-sm font-medium text-soft">Search by product, SKU or common name</span>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="For example generator or 200310"
            className="h-14 w-full rounded-control border border-line-strong bg-surface px-4"
          />
        </label>
        <label>
          <span className="mb-1 block text-sm font-medium text-soft">Category</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-14 rounded-control border border-line-strong bg-surface px-3 font-medium"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error ? <p role="alert" className="mt-3 font-medium text-bad">{error}</p> : null}
      <ul className="mt-4 divide-y divide-line" data-testid="stock-list">
        {rows === null ? (
          <>
            <Skeleton className="my-2 h-14" />
            <Skeleton className="my-2 h-14" />
          </>
        ) : rows.length === 0 ? (
          <li className="py-6 text-soft">No products match that search.</li>
        ) : (
          rows.map((r) => (
            <li key={r.sku}>
              <details>
                <summary className="flex min-h-16 cursor-pointer flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3">
                  <span className="min-w-0">
                    <span className="block font-semibold">{r.name}</span>
                    <span className="block text-sm text-soft">
                      SKU {r.sku} · {r.category} · {r.locations} {r.locations === 1 ? "location" : "locations"}
                    </span>
                  </span>
                  <span className="flex items-center gap-3">
                    {r.minStock > 0 && r.total <= r.minStock ? <StatusPill status="warning" label="At or below minimum" /> : null}
                    <span className="text-xl font-bold">{r.total}</span>
                  </span>
                </summary>
                <div className="pb-4">
                  <Detail sku={r.sku} />
                </div>
              </details>
            </li>
          ))
        )}
      </ul>
    </Panel>
  );
}

function Reconcile() {
  const { can } = useAuth();
  const [data, setData] = useState<{ pending: Reconciliation[]; resolved: Reconciliation[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await api("/api/stock/reconciliations"));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function act(countId: number, kind: "approve" | "decline") {
    setBusy(countId);
    setError(null);
    try {
      if (kind === "approve") await api("/api/count/adjust", { countId });
      else await api("/api/stock/decline", { countId, reason: reasons[countId] });
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      {error ? <p role="alert" className="font-medium text-bad">{error}</p> : null}
      <Panel>
        <h2 className="text-lg font-semibold">Waiting for a decision</h2>
        <p className="mt-1 text-sm text-soft">
          Approving changes stock to match the count. Declining keeps stock as it is and records why.
        </p>
        <ul className="mt-3 divide-y divide-line" data-testid="pending-list">
          {data === null ? (
            <Skeleton className="my-2 h-20" />
          ) : data.pending.length === 0 ? (
            <li className="flex items-center gap-2 py-6 font-medium text-ok">
              <Icon name="check" size={22} /> Every count with a variance has been reconciled.
            </li>
          ) : (
            data.pending.map((r) => (
              <li key={r.countId} className="py-4" data-testid={`pending-${r.countId}`}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-semibold">
                    {r.name} at {r.locationId}
                  </span>
                  <span className="font-bold text-bad">
                    Variance {r.variance > 0 ? "+" : "−"}
                    {Math.abs(r.variance)}
                  </span>
                </div>
                <div className="text-sm text-soft">
                  Expected {r.expected}, counted {r.confirmed} by {r.countedBy} · {when(r.countedAt)}
                </div>
                {can("stock_adjust") ? (
                  <div className="mt-3 flex flex-wrap items-end gap-3">
                    <Button variant="primary" icon="check" onClick={() => act(r.countId, "approve")} disabled={busy === r.countId}>
                      Approve: set stock to {r.confirmed}
                    </Button>
                    <label className="min-w-0 basis-56 grow">
                      <span className="sr-only">Reason for declining</span>
                      <input
                        value={reasons[r.countId] ?? ""}
                        onChange={(e) => setReasons((s) => ({ ...s, [r.countId]: e.target.value }))}
                        placeholder="Reason, for example recount tomorrow"
                        className="h-14 w-full rounded-control border border-line-strong bg-surface px-4"
                      />
                    </label>
                    <Button variant="secondary" onClick={() => act(r.countId, "decline")} disabled={busy === r.countId}>
                      Decline
                    </Button>
                  </div>
                ) : null}
              </li>
            ))
          )}
        </ul>
      </Panel>
      {data && data.resolved.length > 0 ? (
        <Panel>
          <h2 className="text-lg font-semibold">Recently reconciled</h2>
          <ul className="mt-2 divide-y divide-line">
            {data.resolved.map((r) => (
              <li key={r.countId} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <span>
                  {r.name} at {r.locationId}: variance {r.variance > 0 ? "+" : ""}
                  {r.variance}
                  {r.declineReason ? ` (${r.declineReason})` : ""}
                </span>
                <StatusPill status={r.status === "adjusted" ? "ok" : "info"} label={r.status === "adjusted" ? "Stock adjusted" : "Declined"} />
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}

export function StockWorkspace() {
  const [tab, setTab] = useState<"records" | "reconcile">("records");
  const tabs = [
    { id: "records" as const, label: "Stock records" },
    { id: "reconcile" as const, label: "Reconciliation" },
  ];
  return (
    <div className="space-y-6">
      <div role="tablist" aria-label="Stock views" className="flex gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`min-h-12 rounded-full border px-5 font-semibold ${
              tab === t.id ? "border-ink bg-signal" : "border-line-strong bg-surface hover:bg-sunk"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "records" ? <Records /> : <Reconcile />}
    </div>
  );
}
