"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import type { Handover, WindowSuggestion } from "@/lib/services/handover";
import { useAuth } from "./auth-context";
import { Icon } from "./icons";
import { Button, Panel, Skeleton, StatusPill } from "./ui";

const when = (iso: string) => iso.slice(0, 16).replace("T", " ");

export function HandoverPanel() {
  const { shifts } = useAuth();
  const [windows, setWindows] = useState<WindowSuggestion[] | null>(null);
  const [date, setDate] = useState("");
  const [shiftId, setShiftId] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Handover | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<WindowSuggestion[]>("/api/handover/windows").then((list) => {
      setWindows(list);
      if (list[0]) {
        setDate(list[0].date);
        setShiftId(list[0].shiftId);
      } else {
        const now = new Date();
        setDate(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`);
        setShiftId("s-morning");
      }
    }, (e) => setError(e.message));
  }, []);

  async function generate() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(await api<Handover>("/api/handover", { date, shiftId }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const field = "h-14 rounded-control border border-line-strong bg-surface px-3 font-medium";

  return (
    <div className="space-y-6">
      {error ? <p role="alert" className="font-medium text-bad">{error}</p> : null}
      <Panel>
        <h2 className="text-lg font-semibold">Choose the shift</h2>
        {windows === null ? (
          <Skeleton className="mt-3 h-14" />
        ) : (
          <>
            {windows.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Recent shifts with activity">
                {windows.slice(0, 6).map((w) => {
                  const selected = w.date === date && w.shiftId === shiftId;
                  return (
                    <button
                      key={`${w.date}-${w.shiftId}`}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => {
                        setDate(w.date);
                        setShiftId(w.shiftId);
                      }}
                      className={`min-h-12 rounded-full border px-4 text-sm font-semibold ${
                        selected ? "border-ink bg-signal" : "border-line-strong bg-surface hover:bg-sunk"
                      }`}
                    >
                      {w.date} · {w.shiftName} · {w.events} events
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="mt-2 text-sm text-soft">No recent shifts have recorded activity. Choose a date and shift.</p>
            )}
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <label>
                <span className="mb-1 block text-sm font-medium text-soft">Date</span>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field} />
              </label>
              <label>
                <span className="mb-1 block text-sm font-medium text-soft">Shift</span>
                <select value={shiftId} onChange={(e) => setShiftId(e.target.value)} className={field}>
                  {shifts.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <Button variant="primary" icon="note" onClick={generate} disabled={busy || !date || !shiftId}>
                {busy ? "Writing the handover…" : "Write the handover"}
              </Button>
            </div>
          </>
        )}
      </Panel>

      {busy ? (
        <Panel>
          <div className="space-y-2" aria-live="polite">
            <p className="text-sm text-soft">The local model is writing the summary. This can take a minute.</p>
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-5 w-1/2" />
          </div>
        </Panel>
      ) : null}

      {result ? (
        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]" data-testid="handover-result">
          <Panel>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">
                {result.data.window.shiftName} shift, {result.data.window.date}
              </h2>
              <StatusPill status="info" label={result.source === "model" ? "Written by the local model" : "Standard summary"} />
            </div>
            <p className="mt-3 whitespace-pre-line" data-testid="handover-prose">
              {result.prose}
            </p>
            <p className="mt-4 text-sm text-soft">
              Every number in the summary matches the figures beside it. The model is not allowed to add its own.
            </p>
          </Panel>
          <Panel>
            <h2 className="text-lg font-semibold">The numbers</h2>
            <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm" data-testid="handover-numbers">
              <dt>Deliveries received</dt>
              <dd className="font-semibold">{result.data.received.deliveries}</dd>
              <dt>Units received</dt>
              <dd className="font-semibold">{result.data.received.units}</dd>
              <dt>Receipts with a discrepancy</dt>
              <dd className="font-semibold">{result.data.received.withDiscrepancy}</dd>
              <dt>Orders dispatched</dt>
              <dd className="font-semibold">{result.data.dispatched.orders}</dd>
              <dt>Units dispatched</dt>
              <dd className="font-semibold">{result.data.dispatched.units}</dd>
              <dt>Dispatches with a shortfall</dt>
              <dd className="font-semibold">{result.data.dispatched.withShortfall}</dd>
              <dt>Counts done</dt>
              <dd className="font-semibold">{result.data.counts.done}</dd>
              <dt>Counts with a variance</dt>
              <dd className="font-semibold">{result.data.counts.withVariance}</dd>
              <dt>Stock adjustments</dt>
              <dd className="font-semibold">{result.data.adjustments}</dd>
              <dt>Open exceptions overall</dt>
              <dd className="font-semibold">{result.data.openExceptions}</dd>
            </dl>
            {result.data.issues.length > 0 ? (
              <div className="mt-4">
                <h3 className="text-sm font-semibold text-soft">Equipment</h3>
                <ul className="mt-1 space-y-1 text-sm">
                  {result.data.issues.map((i, n) => (
                    <li key={n} className="flex items-start gap-2">
                      <Icon name="alert" size={18} className="mt-0.5 shrink-0 text-warn" />
                      <span>
                        {i.equipment}: {i.description} ({i.status}
                        {i.carriedOver ? ", carried over" : ""})
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {result.data.discrepancies.length > 0 ? (
              <div className="mt-4">
                <h3 className="text-sm font-semibold text-soft">Discrepancies</h3>
                <ul className="mt-1 space-y-1 text-sm">
                  {result.data.discrepancies.map((d, n) => (
                    <li key={n}>{d}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <p className="mt-4 text-xs text-soft">
              Window {when(result.data.window.from)} to {when(result.data.window.to)}
            </p>
          </Panel>
        </div>
      ) : null}
    </div>
  );
}
