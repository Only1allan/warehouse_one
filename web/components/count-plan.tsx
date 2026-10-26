"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import type { CountPlanItem } from "@/lib/services/count-plan";
import { Icon } from "./icons";
import { Panel, Skeleton } from "./ui";

export function CountPlan() {
  const [plan, setPlan] = useState<CountPlanItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api<CountPlanItem[]>("/api/count-plan").then(setPlan, (e) => setError(e.message));
  }, []);
  if (error) return <p role="alert" className="font-medium text-bad">{error}</p>;
  return (
    <Panel>
      <p className="text-sm text-soft">
        Ranked by rule: never or not recently counted, at or below minimum, off on the last count, and busy locations
        that drift. Counting the top of this list first finds most errors in the least time.
      </p>
      <ol className="mt-4 divide-y divide-line" data-testid="count-plan">
        {plan === null ? (
          <>
            <Skeleton className="my-2 h-16" />
            <Skeleton className="my-2 h-16" />
          </>
        ) : plan.length === 0 ? (
          <li className="flex items-center gap-2 py-6 font-medium text-ok">
            <Icon name="check" size={22} /> Every location has been counted recently.
          </li>
        ) : (
          plan.map((p, i) => (
            <li key={`${p.sku}-${p.locationId}`} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-4">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-ink text-sm font-bold text-signal">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1 basis-60">
                <div className="font-semibold">
                  {p.locationId} · {p.name}
                </div>
                <div className="text-sm text-soft">{p.reasons.join(" · ")}</div>
              </div>
              <Link
                href={`/count?q=${encodeURIComponent(p.sku)}`}
                className="inline-flex min-h-12 items-center rounded-control border border-line-strong bg-surface px-4 font-semibold hover:bg-sunk"
              >
                Count now
              </Link>
            </li>
          ))
        )}
      </ol>
    </Panel>
  );
}
