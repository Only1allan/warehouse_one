"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import type { Home } from "@/lib/services/home";
import { api } from "@/lib/api-client";
import { useAuth } from "./auth-context";
import { Icon, type IconName } from "./icons";
import { ReportIssue } from "./report-issue";
import { Panel, Skeleton, StatusPill } from "./ui";

function AttentionRow({
  href,
  icon,
  label,
  count,
  tone = "neutral",
  hint,
}: {
  href: string;
  icon: IconName;
  label: string;
  count: string | number;
  tone?: "neutral" | "bad" | "warn" | "ok";
  hint?: string;
}) {
  const color = tone === "bad" ? "text-bad" : tone === "warn" ? "text-warn" : tone === "ok" ? "text-ok" : "text-ink";
  return (
    <li>
      <Link href={href} className="flex min-h-16 items-center gap-4 py-3 hover:bg-sunk/60 sm:px-2">
        <span className="grid size-10 shrink-0 place-items-center rounded-control bg-sunk">
          <Icon name={icon} size={22} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{label}</span>
          {hint ? <span className="block text-sm text-soft">{hint}</span> : null}
        </span>
        <span className={`text-xl font-bold ${color}`} data-testid={`count-${label}`}>
          {count}
        </span>
        <Icon name="chevron" size={20} className="shrink-0 text-soft" />
      </Link>
    </li>
  );
}

const pct = (n: number | null) => (n === null ? "No data" : `${n}%`);

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Panel>
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-2">{children}</div>
    </Panel>
  );
}

export function HomeDashboard() {
  const { user } = useAuth();
  const [home, setHome] = useState<Home | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Home>("/api/home").then(setHome, (e) => setError(e.message));
  }, []);

  if (error) return <p role="alert" className="font-medium text-bad">{error}</p>;
  if (!home) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  const greeting = (
    <p className="mb-6 max-w-2xl text-soft" data-testid="home-greeting">
      Signed in as {user?.name}, {user?.title}.
    </p>
  );

  if (home.kind === "operator") {
    return (
      <div>
        {greeting}
        <div className="grid gap-6 lg:grid-cols-2">
          <Section title="Deliveries due today">
            {home.dueToday.length === 0 ? (
              <p className="py-3 text-soft">No deliveries are due today.</p>
            ) : (
              <ul className="divide-y divide-line">
                {home.dueToday.map((p) => (
                  <li key={p.poNumber} className="flex min-h-14 items-center justify-between gap-3 py-3">
                    <span className="font-semibold">
                      PO {p.poNumber} · {p.supplier}
                    </span>
                    {p.status === "received" ? <StatusPill status="ok" label="Received" /> : (
                      <Link href="/receive" className="font-semibold underline underline-offset-4">Receive</Link>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Section>
          <Section title="Orders waiting to be loaded">
            {home.ordersToLoad.length === 0 ? (
              <p className="py-3 text-soft">Nothing is waiting to be loaded.</p>
            ) : (
              <ul className="divide-y divide-line">
                {home.ordersToLoad.map((o) => (
                  <li key={o.orderNumber} className="flex min-h-14 items-center justify-between gap-3 py-3">
                    <span className="font-semibold">
                      Order {o.orderNumber} · {o.customer}
                    </span>
                    <span className="text-sm text-soft">{o.destination}</span>
                  </li>
                ))}
              </ul>
            )}
            <Link href="/dispatch" className="mt-2 inline-block font-semibold underline underline-offset-4">
              Check a load
            </Link>
          </Section>
          <Section title="Quick actions">
            <ul className="divide-y divide-line">
              <AttentionRow href="/ask" icon="ask" label="Ask a question" count="" hint="Stock, locations and procedures" />
              <AttentionRow href="/voice" icon="mic" label="Hands-free" count="" hint="Ask by voice while you work" />
              <AttentionRow href="/safety" icon="shield" label="Safety" count="" hint="PPE, chemicals, forklifts and lifting" />
              <AttentionRow href="/receive" icon="receive" label="Receive a delivery" count="" hint="Check it against the purchase order" />
              <AttentionRow href="/count" icon="count" label="Count a shelf" count="" hint="By hand or from a photo" />
            </ul>
          </Section>
          <Section title="Report an equipment issue">
            <ReportIssue />
          </Section>
          <Section title="Your recent actions">
            {home.recent.length === 0 ? (
              <p className="py-3 text-soft">You have not confirmed anything yet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {home.recent.map((r, i) => (
                  <li key={i} className="flex min-h-12 items-center justify-between gap-3 py-2.5">
                    <span>{r.summary}</span>
                    <span className="text-sm text-soft">{r.at.slice(0, 16).replace("T", " ")}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>
    );
  }

  if (home.kind === "supervisor") {
    return (
      <div>
        {greeting}
        <div className="grid gap-6 lg:grid-cols-2">
          <Section title="Today on the floor">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 py-2 sm:grid-cols-4" data-testid="today">
              {[
                ["Receipts", home.today.receipts],
                ["Dispatches", home.today.dispatches],
                ["Counts", home.today.counts],
                ["Issues", home.today.issues],
              ].map(([label, value]) => (
                <div key={label as string}>
                  <dt className="text-sm text-soft">{label}</dt>
                  <dd className="text-2xl font-bold">{value}</dd>
                </div>
              ))}
            </dl>
            <h3 className="mt-3 text-sm font-semibold text-soft">Latest activity</h3>
            {home.feed.length === 0 ? (
              <p className="py-3 text-soft">Nothing has been confirmed yet today.</p>
            ) : (
              <ul className="divide-y divide-line" data-testid="feed">
                {home.feed.map((f, i) => (
                  <li key={i} className="flex min-h-12 flex-wrap items-center justify-between gap-2 py-2.5">
                    <span>
                      <span className="font-semibold">{f.who}</span> · {f.summary}
                    </span>
                    <span className="text-sm text-soft">{f.at.slice(11, 16)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
          <Section title="Needs your attention">
            <ul className="divide-y divide-line">
              <AttentionRow href="/supervisor" icon="alert" label="Open exceptions" count={home.openExceptions} tone={home.openExceptions ? "bad" : "ok"} hint="Receiving, counts, dispatch and equipment" />
              <AttentionRow href="/approvals" icon="check" label="Counts waiting for a decision" count={home.pendingReconciliations} tone={home.pendingReconciliations ? "warn" : "ok"} hint="Approve or decline the stock adjustment" />
              <AttentionRow href="/health" icon="pulse" label="Products at or below minimum" count={home.belowMinimum} tone={home.belowMinimum ? "warn" : "ok"} hint="Reorder before they run out" />
            </ul>
          </Section>
          <Section title="Inventory alerts">
            <ul className="divide-y divide-line">
              <AttentionRow href="/health" icon="pulse" label="Dead stock" count={home.health.dead} hint="No movement for 90 days or more" />
              <AttentionRow href="/health" icon="pulse" label="Slow moving" count={home.health.slow} hint="No movement for 30 days or more" />
              <AttentionRow href="/health" icon="pulse" label="Overstock" count={home.health.overstock} hint="At least 3 times the reorder level" />
            </ul>
          </Section>
          <Section title="Next steps">
            <ul className="divide-y divide-line">
              <AttentionRow href="/handover" icon="note" label="Write the shift handover" count="" hint="Summarise the shift for the next lead" />
              <AttentionRow href="/ask" icon="ask" label="Ask the copilot" count="" />
            </ul>
          </Section>
        </div>
      </div>
    );
  }

  if (home.kind === "inventory_controller") {
    return (
      <div>
        {greeting}
        <div className="grid gap-6 lg:grid-cols-2">
          <Section title="Count next">
            {home.nextToCount.length === 0 ? (
              <p className="py-3 text-soft">Every location has been counted recently.</p>
            ) : (
              <ul className="divide-y divide-line" data-testid="next-to-count">
                {home.nextToCount.map((n) => (
                  <li key={`${n.sku}-${n.locationId}`} className="py-3">
                    <Link href={`/count?q=${encodeURIComponent(n.sku)}`} className="font-semibold underline underline-offset-4">
                      {n.locationId} · {n.name}
                    </Link>
                    <div className="text-sm text-soft">{n.reasons.join(" · ")}</div>
                  </li>
                ))}
              </ul>
            )}
            <Link href="/count-plan" className="mt-2 inline-block font-semibold underline underline-offset-4">
              See the whole count plan
            </Link>
          </Section>
          <Section title="Reconciliation">
            <ul className="divide-y divide-line">
              <AttentionRow href="/reconciliation" icon="check" label="Counts waiting for a decision" count={home.pendingReconciliations} tone={home.pendingReconciliations ? "warn" : "ok"} hint="Approve or decline each variance" />
              <AttentionRow href="/count" icon="count" label="Counts done" count={home.countsDone} hint={`Count accuracy ${pct(home.countAccuracyPct)}`} />
            </ul>
          </Section>
          <Section title="Accuracy risks">
            <ul className="divide-y divide-line">
              <AttentionRow href="/stock" icon="shelf" label="Dead stock" count={home.health.dead} hint="Check these records are still right" />
              <AttentionRow href="/stock" icon="shelf" label="Slow moving" count={home.health.slow} />
              <AttentionRow href="/count-plan" icon="note" label="Stockout risk" count={home.health.stockout} tone={home.health.stockout ? "warn" : "ok"} hint="Low stock is counted first" />
            </ul>
          </Section>
        </div>
      </div>
    );
  }

  return (
    <div>
      {greeting}
      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Shipments">
          <ul className="divide-y divide-line">
            <AttentionRow href="/shipments" icon="truck" label="Orders waiting to go out" count={home.openOrders} />
            <AttentionRow href="/accuracy" icon="send" label="Dispatch accuracy" count={pct(home.dispatchAccuracyPct)} tone={home.dispatchAccuracyPct === 100 ? "ok" : "warn"} hint={`${home.dispatches} dispatches, ${home.shortfalls} with a shortfall`} />
          </ul>
        </Section>
        <Section title="Process compliance">
          <ul className="divide-y divide-line">
            <AttentionRow href="/compliance" icon="receive" label="Receipts with no discrepancy" count={pct(home.receiptCleanPct)} tone={home.receiptCleanPct === 100 ? "ok" : "warn"} />
          </ul>
        </Section>
        <Section title="Quick actions">
          <ul className="divide-y divide-line">
            <AttentionRow href="/dispatch" icon="send" label="Verify a dispatch" count="" hint="Compare what was loaded with the order" />
            <AttentionRow href="/handover" icon="note" label="Write the shift handover" count="" />
          </ul>
        </Section>
      </div>
    </div>
  );
}
