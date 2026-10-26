"use client";

import { useCallback, useEffect, useState } from "react";
import type { ExceptionDetail, ExceptionKind, ExceptionRow } from "@/lib/services/exceptions";
import { Icon, type IconName } from "./icons";
import { useAuth } from "./auth-context";
import { ReportIssue } from "./report-issue";
import { Panel, Skeleton } from "./ui";

const kinds: Array<{ value: ExceptionKind | ""; label: string }> = [
  { value: "", label: "All" },
  { value: "receiving", label: "Receiving" },
  { value: "count", label: "Counts" },
  { value: "dispatch", label: "Dispatch" },
  { value: "equipment", label: "Equipment" },
];

const kindIcon: Record<ExceptionKind, IconName> = {
  receiving: "receive",
  count: "count",
  dispatch: "send",
  equipment: "alert",
};

async function getJson<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message ?? "Something went wrong.");
  return data as T;
}

function when(iso: string): string {
  return iso.slice(0, 16).replace("T", " ");
}

function Detail({ id }: { id: number }) {
  const [detail, setDetail] = useState<ExceptionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    getJson<ExceptionDetail>(`/api/supervisor/exceptions/${id}`).then(setDetail, (e) => setError(e.message));
  }, [id]);
  if (error) return <p className="text-bad">{error}</p>;
  if (!detail) return <Skeleton className="h-16" />;
  return (
    <div className="space-y-3">
      <h3 className="font-semibold">{detail.title}</h3>
      {detail.fields.length ? (
        <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
          {detail.fields.map((f) => (
            <div key={f.label} className="contents">
              <dt className="text-soft">{f.label}</dt>
              <dd className="font-medium">{f.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {detail.table ? (
        <table className="w-full text-sm">
          <thead className="text-left text-soft">
            <tr>
              {detail.table.columns.map((c) => (
                <th key={c} className="py-1 font-medium">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {detail.table.rows.map((row, i) => (
              <tr key={i} className="border-t border-line">
                {row.map((cell, j) => (
                  <td key={j} className="py-1.5">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}

export function SupervisorExceptions() {
  const { shifts } = useAuth();
  const [kind, setKind] = useState<ExceptionKind | "">("");
  const [shift, setShift] = useState("");
  const [rows, setRows] = useState<ExceptionRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (kind) params.set("kind", kind);
      if (shift) params.set("shift", shift);
      setRows(await getJson<ExceptionRow[]>(`/api/supervisor/exceptions?${params}`));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [kind, shift]);

  useEffect(() => {
    let alive = true;
    const params = new URLSearchParams();
    if (kind) params.set("kind", kind);
    if (shift) params.set("shift", shift);
    getJson<ExceptionRow[]>(`/api/supervisor/exceptions?${params}`).then(
      (r) => alive && setRows(r),
      (e: Error) => alive && setError(e.message),
    );
    return () => {
      alive = false;
    };
  }, [kind, shift]);


  return (
    <div className="space-y-6">
      {error ? (
        <div role="alert" className="flex items-start gap-3 rounded-control bg-bad-fill px-4 py-3 font-medium text-bad">
          <Icon name="alert" size={22} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <Panel>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div role="radiogroup" aria-label="Exception type" className="flex flex-wrap gap-2">
            {kinds.map((k) => (
              <button
                key={k.value}
                type="button"
                role="radio"
                aria-checked={kind === k.value}
                onClick={() => setKind(k.value)}
                className={`min-h-12 rounded-full border px-5 font-semibold ${
                  kind === k.value ? "border-ink bg-signal" : "border-line-strong bg-surface hover:bg-sunk"
                }`}
              >
                {k.label}
              </button>
            ))}
          </div>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-soft">Filter by shift</span>
            <select value={shift} onChange={(e) => setShift(e.target.value)} className="h-12 rounded-control border border-line-strong bg-surface px-3 font-medium">
              <option value="">All shifts</option>
              {shifts.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <ul className="mt-4 divide-y divide-line" data-testid="exception-list">
          {rows === null ? (
            <>
              <Skeleton className="my-2 h-16" />
              <Skeleton className="my-2 h-16" />
            </>
          ) : rows.length === 0 ? (
            <li className="py-6 text-soft">No exceptions match these filters.</li>
          ) : (
            rows.map((r) => (
              <li key={r.id} data-kind={r.kind}>
                <details className="group">
                  <summary className="flex min-h-16 cursor-pointer items-start gap-3 py-3">
                    <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-control bg-bad-fill text-bad">
                      <Icon name={kindIcon[r.kind]} size={20} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{r.summary}</span>
                      <span className="block text-sm text-soft">
                        {r.operator} · {r.shift} shift · {when(r.createdAt)}
                      </span>
                    </span>
                  </summary>
                  <div className="pb-4 pl-12">
                    <Detail id={r.id} />
                  </div>
                </details>
              </li>
            ))
          )}
        </ul>
      </Panel>

      <Panel>
        <h2 className="text-lg font-semibold">Report an equipment issue</h2>
        <div className="mt-2">
          <ReportIssue onReported={() => void load()} />
        </div>
      </Panel>
    </div>
  );
}
