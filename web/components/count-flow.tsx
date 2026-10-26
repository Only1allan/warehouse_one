"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { computeVariance } from "@/lib/domain/variance";
import type { CountRecord, CountTarget } from "@/lib/services/counting";
import { Icon } from "./icons";
import { upload } from "@/lib/api-client";
import { useAuth } from "./auth-context";
import { QuantityField } from "./quantity-field";
import { Button, Panel, Skeleton, StatusPill } from "./ui";

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

function VarianceBanner({ expected, counted }: { expected: number; counted: number }) {
  const variance = computeVariance(expected, counted);
  const ok = variance === 0;
  return (
    <div
      data-testid="variance-banner"
      role="status"
      className={`flex flex-wrap items-center gap-x-6 gap-y-2 rounded-control px-4 py-3 ${
        ok ? "bg-ok-fill text-ok" : "bg-bad-fill text-bad"
      }`}
    >
      <Icon name={ok ? "check" : "alert"} size={24} />
      <span className="font-semibold">Expected {expected}</span>
      <span className="font-semibold">Counted {counted}</span>
      <span className="font-bold" data-testid="variance-value">
        {ok ? "No variance" : `Variance ${variance > 0 ? "+" : "−"}${Math.abs(variance)}`}
      </span>
    </div>
  );
}

export function CountFlow() {
  const { can } = useAuth();
  const initialQuery = useSearchParams().get("q") ?? "";
  const [query, setQuery] = useState(initialQuery);
  const [targets, setTargets] = useState<CountTarget[] | null>(null);
  const [target, setTarget] = useState<CountTarget | null>(null);
  const [counted, setCounted] = useState("");
  const [saved, setSaved] = useState<CountRecord | null>(null);
  const [adjusted, setAdjusted] = useState<{ newQty: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [proposed, setProposed] = useState<number | null>(null);
  const [proposalNote, setProposalNote] = useState<string | null>(null);
  const [estimating, setEstimating] = useState(false);
  const urlRef = useRef<string | null>(null);

  const canAdjust = can("stock_adjust");

  useEffect(() => {
    const handle = setTimeout(async () => {
      try {
        setTargets(await api<CountTarget[]>(`/api/count/targets?q=${encodeURIComponent(query)}`));
      } catch (e) {
        setError((e as Error).message);
      }
    }, 150);
    return () => clearTimeout(handle);
  }, [query]);

  async function estimate(file: File) {
    if (!target) return;
    setEstimating(true);
    setError(null);
    setProposalNote(null);
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = URL.createObjectURL(file);
    setPhotoUrl(urlRef.current);
    try {
      const form = new FormData();
      form.append("image", file);
      form.append("sku", target.sku);
      form.append("locationId", target.locationId);
      const result = await upload<{ photoPath: string; proposedQty: number | null; note: string | null }>(
        "/api/count/propose",
        form,
      );
      setPhotoPath(result.photoPath);
      setProposed(result.proposedQty);
      setProposalNote(result.note);
      if (result.proposedQty !== null) setCounted(String(result.proposedQty));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setEstimating(false);
    }
  }

  async function confirm() {
    if (!target) return;
    setBusy(true);
    setError(null);
    try {
      setSaved(
        await api<CountRecord>("/api/count/confirm", {
          sku: target.sku,
          locationId: target.locationId,
          confirmedQty: Number(counted),
          proposedQty: proposed,
          photoPath,
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function adjust() {
    if (!saved) return;
    setBusy(true);
    setError(null);
    try {
      setAdjusted(await api<{ newQty: number }>("/api/count/adjust", { countId: saved.id }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setTarget(null);
    setCounted("");
    setSaved(null);
    setAdjusted(null);
    setError(null);
    setPhotoUrl(null);
    setPhotoPath(null);
    setProposed(null);
    setProposalNote(null);
  }

  const errorBox = error ? (
    <div role="alert" className="flex items-start gap-3 rounded-control bg-bad-fill px-4 py-3 font-medium text-bad">
      <Icon name="alert" size={22} className="mt-0.5 shrink-0" />
      <span>{error}</span>
    </div>
  ) : null;

  if (saved) {
    return (
      <div className="space-y-4">
        {errorBox}
        <Panel>
          <h2 className="text-xl font-semibold" data-testid="count-saved">
            Count {saved.id} saved: {saved.name} at {saved.locationId}
          </h2>
          <div className="mt-4">
            <VarianceBanner expected={saved.expectedQty} counted={saved.confirmedQty} />
          </div>
          {saved.variance !== 0 ? (
            <div className="mt-4 space-y-3">
              <p className="flex items-start gap-2 font-medium">
                <Icon name="info" size={22} className="mt-0.5 shrink-0" />
                <span>
                  The variance was sent to the supervisor. Stock has not changed
                  {adjusted ? ", until now." : "."}
                </span>
              </p>
              {adjusted ? (
                <StatusPill status="ok" label={`Stock adjusted to ${adjusted.newQty}`} />
              ) : canAdjust ? (
                <Button variant="primary" icon="check" onClick={adjust} disabled={busy}>
                  Adjust stock to {saved.confirmedQty}
                </Button>
              ) : (
                <p className="text-sm text-soft">A supervisor or inventory controller must approve any stock adjustment.</p>
              )}
            </div>
          ) : null}
          <div className="mt-6">
            <Button variant={saved.variance === 0 ? "primary" : "secondary"} onClick={reset}>
              Count another location
            </Button>
          </div>
        </Panel>
      </div>
    );
  }

  const countedNumber = counted === "" ? null : Number(counted);

  return (
    <div className="space-y-6">
      {errorBox}
      <Panel>
        <h2 className="text-lg font-semibold">1. Choose what to count</h2>
        <label className="mt-3 block">
          <span className="mb-1 block text-sm font-medium text-soft">Search by product, SKU or location</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="For example hose, 200310 or A-2-1"
            className="h-14 w-full rounded-control border border-line-strong bg-surface px-4"
          />
        </label>
        <div className="mt-3 grid gap-2" role="radiogroup" aria-label="Count target">
          {targets === null ? (
            <>
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </>
          ) : targets.length === 0 ? (
            <p className="text-soft">Nothing matches that search.</p>
          ) : (
            targets.slice(0, 8).map((t) => {
              const selected = target?.sku === t.sku && target.locationId === t.locationId;
              return (
                <button
                  key={`${t.sku}-${t.locationId}`}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => {
                    setTarget(t);
                    setCounted("");
                    setPhotoUrl(null);
                    setPhotoPath(null);
                    setProposed(null);
                    setProposalNote(null);
                  }}
                  className={`flex min-h-16 flex-wrap items-center justify-between gap-x-4 rounded-control border px-4 py-2 text-left ${
                    selected ? "border-ink bg-signal" : "border-line-strong bg-surface hover:bg-sunk"
                  }`}
                >
                  <span className="font-semibold">{t.name}</span>
                  <span className="text-sm">
                    {t.locationId} · SKU {t.sku}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </Panel>

      {target ? (
        <Panel>
          <h2 className="text-lg font-semibold">2. Count it</h2>
          <p className="mt-1 text-sm text-soft">
            Count what you can see at {target.locationId}. The expected quantity appears after you enter your count.
          </p>
          <div className="mt-4 space-y-4">
            <div>
              <label
                className={`inline-flex min-h-14 cursor-pointer items-center gap-2.5 rounded-control border border-line-strong bg-surface px-5 font-semibold hover:bg-sunk ${
                  estimating ? "pointer-events-none opacity-60" : ""
                }`}
              >
                <Icon name="camera" size={22} />
                {estimating ? "Looking at the photo…" : photoUrl ? "Take another photo" : "Take a photo to get a proposed count"}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="sr-only"
                  aria-label="Shelf photo"
                  disabled={estimating}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void estimate(file);
                    e.target.value = "";
                  }}
                />
              </label>
              <p className="mt-2 text-sm text-soft">
                Photograph the whole shelf straight on, in good light. You can always count by hand instead.
              </p>
              {estimating ? (
                <div className="mt-3 space-y-2" aria-live="polite">
                  <p className="text-sm text-soft">This can take up to a minute on this device.</p>
                  <Skeleton className="h-5 w-1/2" />
                </div>
              ) : null}
            </div>
            {photoUrl ? (
              <div className="flex flex-wrap items-start gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoUrl} alt="The shelf you photographed" className="h-32 w-auto rounded-control border border-line" />
                <div className="min-w-0 flex-1 basis-56" data-testid="proposal">
                  {proposed !== null ? (
                    <p className="flex items-start gap-2 font-medium">
                      <Icon name="info" size={20} className="mt-0.5 shrink-0" />
                      <span>
                        The model proposes <strong data-testid="proposed-qty">{proposed}</strong>. It can be wrong. Check it
                        against the shelf and correct it below.
                      </span>
                    </p>
                  ) : proposalNote ? (
                    <p className="flex items-start gap-2 font-medium text-warn">
                      <Icon name="alert" size={20} className="mt-0.5 shrink-0" />
                      <span>{proposalNote}</span>
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}
            <QuantityField label={`Counted ${target.name}`} value={counted} onChange={setCounted} />
          </div>
          {countedNumber !== null ? (
            <div className="mt-4 space-y-4">
              <VarianceBanner expected={target.expectedQty} counted={countedNumber} />
              <div className="flex flex-wrap gap-3">
                <Button variant="primary" icon="check" onClick={confirm} disabled={busy}>
                  {busy ? "Saving…" : "Confirm count"}
                </Button>
                <Button variant="quiet" onClick={reset} disabled={busy}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}
        </Panel>
      ) : null}
    </div>
  );
}
