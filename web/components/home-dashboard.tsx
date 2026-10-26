"use client";

import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import { motion } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";
import type { Home } from "@/lib/services/home";
import type { AuthUser } from "@/lib/services/auth";
import { api } from "@/lib/api-client";
import { rolePhoto, screenPhoto } from "@/lib/photos";
import { Avatar } from "./app-shell";
import { useAuth } from "./auth-context";
import { Icon, type IconName } from "./icons";
import { CountUp, easeOut, MotionLink, SettleIn, springSoft, Stagger, StaggerItem, TextReveal } from "./motion";
import { ReportIssue } from "./report-issue";
import { Panel, Skeleton, StatusPill } from "./ui";

type Tone = "neutral" | "bad" | "warn" | "ok";

const toneText: Record<Tone, string> = { neutral: "text-ink", bad: "text-bad", warn: "text-warn", ok: "text-ok" };
const toneBubble: Record<Tone, string> = {
  neutral: "bg-sunk text-ink",
  bad: "bg-bad-fill text-bad",
  warn: "bg-warn-fill text-warn",
  ok: "bg-ok-fill text-ok",
};
const toneDot: Record<Tone, string> = {
  neutral: "bg-canvas/70",
  bad: "bg-[#ff8a80]",
  warn: "bg-signal",
  ok: "bg-[#7ee2a1]",
};

const pct = (n: number | null) => (n === null ? "No data" : `${n}%`);
const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

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
  tone?: Tone;
  hint?: string;
}) {
  return (
    <StaggerItem as="li">
      <Link href={href} className="group flex min-h-16 items-center gap-4 rounded-control px-2 py-3 hover:bg-sunk/70">
        <span className={`grid size-11 shrink-0 place-items-center rounded-control ${toneBubble[tone]}`}>
          <Icon name={icon} size={22} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{label}</span>
          {hint ? <span className="block text-sm text-soft">{hint}</span> : null}
        </span>
        <CountUp value={count} className={`text-2xl font-bold ${toneText[tone]}`} data-testid={`count-${label}`} />
        <Icon
          name="chevron"
          size={20}
          className="shrink-0 text-soft transition-transform duration-300 ease-[var(--ease-out)] group-hover:translate-x-1"
        />
      </Link>
    </StaggerItem>
  );
}

function ActionTile({
  href,
  icon,
  label,
  hint,
  photo,
}: {
  href: string;
  icon: IconName;
  label: string;
  hint?: string;
  photo?: StaticImageData;
}) {
  const src = photo ?? screenPhoto[href];
  return (
    <StaggerItem>
      <MotionLink
        href={href}
        whileHover={{ y: -5 }}
        whileTap={{ scale: 0.98 }}
        transition={springSoft}
        className="group relative isolate flex min-h-48 flex-col justify-between overflow-hidden rounded-panel bg-ink p-4 text-canvas shadow-panel hover:shadow-lift"
      >
        {src ? (
          <Image
            src={src}
            alt=""
            fill
            placeholder="blur"
            sizes="(min-width: 1024px) 320px, 50vw"
            className="zoom-photo -z-10 object-cover"
          />
        ) : null}
        <span aria-hidden="true" className="photo-fade-up absolute inset-0 -z-10" />
        <span className="flex items-start justify-between">
          <span className="grid size-11 place-items-center rounded-control bg-signal text-ink shadow-panel">
            <Icon name={icon} size={22} />
          </span>
          <span
            aria-hidden="true"
            className="glass-dark grid size-9 place-items-center rounded-full transition-transform duration-300 ease-[var(--ease-out)] group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
          >
            <Icon name="arrowUpRight" size={18} />
          </span>
        </span>
        <span>
          <span className="block text-lg font-semibold leading-snug">{label}</span>
          {hint ? <span className="mt-0.5 block text-sm text-canvas/80">{hint}</span> : null}
        </span>
      </MotionLink>
    </StaggerItem>
  );
}

function ActionGrid({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title}>
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      <Stagger className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-3">{children}</Stagger>
    </section>
  );
}

function Section({
  title,
  icon,
  action,
  children,
  className = "",
}: {
  title: string;
  icon: IconName;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Panel className={className}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="grid size-9 place-items-center rounded-control bg-sunk">
            <Icon name={icon} size={20} />
          </span>
          <h2 className="text-lg font-semibold">{title}</h2>
        </div>
        {action}
      </div>
      <div className="mt-3">{children}</div>
    </Panel>
  );
}

function SectionLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="group inline-flex min-h-11 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-3 text-sm font-semibold hover:bg-sunk"
    >
      {children}
      <Icon name="chevron" size={16} className="transition-transform duration-300 group-hover:translate-x-0.5" />
    </Link>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-3 rounded-control bg-sunk/60 px-4 py-4 text-soft">
      <Icon name="check" size={20} className="text-ok" />
      {children}
    </p>
  );
}

function Ring({ value, label }: { value: number | null; label: string }) {
  const tone = value === null ? "var(--line-strong)" : value >= 95 ? "var(--ok-ink)" : value >= 75 ? "var(--warn-ink)" : "var(--bad-ink)";
  return (
    <figure className="flex flex-col items-center gap-2 text-center">
      <div className="relative size-36">
        <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden="true">
          <circle cx="50" cy="50" r="42" fill="none" stroke="var(--surface-sunk)" strokeWidth="9" />
          {value !== null ? (
            <motion.circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke={tone}
              strokeWidth="9"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: Math.max(value, 1) / 100 }}
              transition={{ duration: 1.4, ease: easeOut, delay: 0.3 }}
            />
          ) : null}
        </svg>
        <span className="absolute inset-0 grid place-items-center text-xl font-bold tracking-tight">
          {value === null ? <span className="text-base text-soft">No data</span> : <CountUp value={`${value}%`} />}
        </span>
      </div>
      <figcaption className="max-w-36 text-sm font-semibold text-soft">{label}</figcaption>
    </figure>
  );
}

type HeroStat = { label: string; value: string | number; icon: IconName; tone?: Tone };

function greetingFor(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function RoleHero({ user, stats }: { user: AuthUser; stats: HeroStat[] }) {
  const { shifts, shiftId } = useAuth();
  const photo = rolePhoto[user.role];
  const now = new Date();
  const shift = shifts.find((s) => s.id === shiftId);
  const first = user.name.split(" ")[0];
  const when = now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  const hours = shift
    ? `${shift.name}, ${String(shift.startHour).padStart(2, "0")}:00 to ${String(shift.endHour).padStart(2, "0")}:00`
    : null;

  return (
    <section
      aria-labelledby="home-title"
      className="relative isolate overflow-hidden rounded-hero bg-ink text-canvas shadow-lift"
      data-testid="role-hero"
    >
      <SettleIn className="absolute inset-0 -z-10">
        <Image
          src={photo.src}
          alt={photo.alt}
          fill
          preload
          placeholder="blur"
          sizes="(min-width: 1024px) 1000px, 100vw"
          className="object-cover object-[70%_center]"
        />
      </SettleIn>
      <div aria-hidden="true" className="photo-fade-side absolute inset-0 -z-10" />

      <div className="flex min-h-80 flex-col justify-between gap-8 p-6 md:p-9 xl:flex-row xl:items-end">
        <div className="max-w-xl">
          <motion.div
            className="flex flex-wrap items-center gap-3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: easeOut }}
          >
            <Avatar username={user.username} name={user.name} size={56} ring="ring-signal" />
            <div className="leading-tight">
              <div className="eyebrow text-signal">{user.title}</div>
              <div className="mt-1 text-sm text-canvas/75">{when}</div>
            </div>
          </motion.div>
          <TextReveal
            as="h1"
            id="home-title"
            text={`${greetingFor(now.getHours())}, ${first}.`}
            delay={0.15}
            className="mt-6 text-[clamp(2.1rem,4.6vw,3.25rem)] font-bold leading-[1.05] tracking-tight"
          />
          <motion.p
            data-testid="home-greeting"
            className="mt-3 max-w-lg text-canvas/80"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: easeOut, delay: 0.45 }}
          >
            Signed in as {user.name}, {user.title}.{hours ? ` ${hours}.` : ""}
          </motion.p>
        </div>

        <Stagger onMount delay={0.4} className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:flex xl:shrink-0">
          {stats.map((s) => (
            <StaggerItem key={s.label} className="glass-dark min-w-36 rounded-panel px-4 py-3.5">
              <div className="flex items-center gap-2 text-sm font-medium text-canvas/80">
                <span aria-hidden="true" className={`size-2 rounded-full ${toneDot[s.tone ?? "neutral"]}`} />
                {s.label}
              </div>
              <div className="mt-1 flex items-end justify-between gap-3">
                <CountUp value={s.value} className="text-3xl font-bold tracking-tight" />
                <Icon name={s.icon} size={22} className="mb-1 text-canvas/60" />
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}

function Loading() {
  return (
    <div className="space-y-6" aria-busy="true">
      <Skeleton className="h-80 !rounded-hero" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    </div>
  );
}

function feedAvatar(who?: string) {
  return who ? who.split(" ")[0].toLowerCase() : undefined;
}

export function HomeDashboard() {
  const { user } = useAuth();
  const [home, setHome] = useState<Home | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Home>("/api/home").then(setHome, (e) => setError(e.message));
  }, []);

  if (error) return <p role="alert" className="font-medium text-bad">{error}</p>;
  if (!home || !user) return <Loading />;

  if (home.kind === "operator") {
    const due = home.dueToday.filter((p) => p.status !== "received").length;
    return (
      <div className="space-y-8">
        <RoleHero
          user={user}
          stats={[
            { label: "Deliveries due", value: due, icon: "receive", tone: due ? "warn" : "ok" },
            { label: "Orders to load", value: home.ordersToLoad.length, icon: "truck" },
            { label: "Confirmed by you", value: home.recent.length, icon: "check", tone: "ok" },
          ]}
        />

        <ActionGrid title="Quick actions">
          <ActionTile href="/ask" icon="ask" label="Ask a question" hint="Stock, locations and procedures" />
          <ActionTile href="/voice" icon="mic" label="Hands-free" hint="Ask by voice while you work" />
          <ActionTile href="/receive" icon="receive" label="Receive a delivery" hint="Check it against the purchase order" />
          <ActionTile href="/count" icon="count" label="Count a shelf" hint="By hand or from a photo" />
          <ActionTile href="/dispatch" icon="send" label="Check a load" hint="Before the truck leaves" />
          <ActionTile href="/safety" icon="shield" label="Safety" hint="PPE, chemicals, forklifts and lifting" />
        </ActionGrid>

        <div className="grid gap-6 lg:grid-cols-2">
          <Section title="Deliveries due today" icon="receive" action={<SectionLink href="/receive">Receive</SectionLink>}>
            {home.dueToday.length === 0 ? (
              <Empty>No deliveries are due today.</Empty>
            ) : (
              <Stagger as="ul" className="divide-y divide-line">
                {home.dueToday.map((p) => (
                  <StaggerItem as="li" key={p.poNumber} className="flex min-h-16 items-center gap-3 py-3">
                    <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-sunk text-sm font-bold">
                      {initials(p.supplier)}
                    </span>
                    <span className="min-w-0 flex-1 font-semibold">
                      PO {p.poNumber} · {p.supplier}
                    </span>
                    {p.status === "received" ? (
                      <StatusPill status="ok" label="Received" />
                    ) : (
                      <Link
                        href="/receive"
                        className="inline-flex min-h-11 items-center rounded-full bg-signal px-4 text-sm font-semibold text-ink hover:bg-signal-press"
                      >
                        Receive
                      </Link>
                    )}
                  </StaggerItem>
                ))}
              </Stagger>
            )}
          </Section>

          <Section title="Orders waiting to be loaded" icon="truck" action={<SectionLink href="/dispatch">Check a load</SectionLink>}>
            {home.ordersToLoad.length === 0 ? (
              <Empty>Nothing is waiting to be loaded.</Empty>
            ) : (
              <Stagger as="ul" className="divide-y divide-line">
                {home.ordersToLoad.map((o) => (
                  <StaggerItem as="li" key={o.orderNumber} className="flex min-h-16 items-center gap-3 py-3">
                    <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-ink text-signal">
                      <Icon name="truck" size={20} />
                    </span>
                    <span className="min-w-0 flex-1 font-semibold">
                      Order {o.orderNumber} · {o.customer}
                    </span>
                    <span className="rounded-full bg-sunk px-3 py-1 text-sm font-medium text-soft">{o.destination}</span>
                  </StaggerItem>
                ))}
              </Stagger>
            )}
          </Section>

          <Section title="Report an equipment issue" icon="alert">
            <ReportIssue />
          </Section>

          <Section title="Your recent actions" icon="check">
            {home.recent.length === 0 ? (
              <p className="py-3 text-soft">You have not confirmed anything yet.</p>
            ) : (
              <Stagger as="ol" className="relative ml-2 border-l-2 border-line">
                {home.recent.map((r, i) => (
                  <StaggerItem as="li" key={i} className="relative flex min-h-12 flex-wrap items-center justify-between gap-x-3 py-2.5 pl-6">
                    <span aria-hidden="true" className="absolute -left-[7px] top-1/2 size-3 -translate-y-1/2 rounded-full border-2 border-surface bg-ok" />
                    <span>{r.summary}</span>
                    <span className="text-sm text-soft">{r.at.slice(0, 16).replace("T", " ")}</span>
                  </StaggerItem>
                ))}
              </Stagger>
            )}
          </Section>
        </div>
      </div>
    );
  }

  if (home.kind === "supervisor") {
    return (
      <div className="space-y-8">
        <RoleHero
          user={user}
          stats={[
            { label: "Exceptions", value: home.openExceptions, icon: "alert", tone: home.openExceptions ? "bad" : "ok" },
            { label: "To approve", value: home.pendingReconciliations, icon: "check", tone: home.pendingReconciliations ? "warn" : "ok" },
            { label: "Below minimum", value: home.belowMinimum, icon: "pulse", tone: home.belowMinimum ? "warn" : "ok" },
          ]}
        />

        <div className="grid gap-6 lg:grid-cols-2">
          <Section title="Today on the floor" icon="pulse" className="lg:col-span-2">
            <Stagger as="dl" className="grid grid-cols-2 gap-3 py-1 sm:grid-cols-4" data-testid="today">
              {(
                [
                  ["Receipts", home.today.receipts, "receive"],
                  ["Dispatches", home.today.dispatches, "send"],
                  ["Counts", home.today.counts, "count"],
                  ["Issues", home.today.issues, "alert"],
                ] as const
              ).map(([label, value, icon]) => (
                <StaggerItem key={label} className="rounded-panel bg-sunk/60 p-4">
                  <dt className="flex items-center justify-between text-sm font-medium text-soft">
                    {label}
                    <Icon name={icon} size={18} />
                  </dt>
                  <dd className="mt-1 text-3xl font-bold">
                    <CountUp value={value} />
                  </dd>
                </StaggerItem>
              ))}
            </Stagger>
            <h3 className="mt-5 text-sm font-semibold text-soft">Latest activity</h3>
            {home.feed.length === 0 ? (
              <p className="py-3 text-soft">Nothing has been confirmed yet today.</p>
            ) : (
              <Stagger as="ul" className="divide-y divide-line" data-testid="feed">
                {home.feed.map((f, i) => (
                  <StaggerItem as="li" key={i} className="flex min-h-14 flex-wrap items-center justify-between gap-3 py-2.5">
                    <span className="flex items-center gap-3">
                      <Avatar username={feedAvatar(f.who)} name={f.who ?? "?"} size={34} />
                      <span>
                        <span className="font-semibold">{f.who}</span> · {f.summary}
                      </span>
                    </span>
                    <span className="text-sm text-soft">{f.at.slice(11, 16)}</span>
                  </StaggerItem>
                ))}
              </Stagger>
            )}
          </Section>

          <Section title="Needs your attention" icon="alert">
            <Stagger as="ul" className="divide-y divide-line">
              <AttentionRow href="/supervisor" icon="alert" label="Open exceptions" count={home.openExceptions} tone={home.openExceptions ? "bad" : "ok"} hint="Receiving, counts, dispatch and equipment" />
              <AttentionRow href="/approvals" icon="check" label="Counts waiting for a decision" count={home.pendingReconciliations} tone={home.pendingReconciliations ? "warn" : "ok"} hint="Approve or decline the stock adjustment" />
              <AttentionRow href="/health" icon="pulse" label="Products at or below minimum" count={home.belowMinimum} tone={home.belowMinimum ? "warn" : "ok"} hint="Reorder before they run out" />
            </Stagger>
          </Section>

          <Section title="Inventory alerts" icon="pulse">
            <Stagger as="ul" className="divide-y divide-line">
              <AttentionRow href="/health" icon="pulse" label="Dead stock" count={home.health.dead} hint="No movement for 90 days or more" />
              <AttentionRow href="/health" icon="pulse" label="Slow moving" count={home.health.slow} hint="No movement for 30 days or more" />
              <AttentionRow href="/health" icon="pulse" label="Overstock" count={home.health.overstock} hint="At least 3 times the reorder level" />
            </Stagger>
          </Section>
        </div>

        <ActionGrid title="Next steps">
          <ActionTile href="/handover" icon="note" label="Write the shift handover" hint="Summarise the shift for the next lead" />
          <ActionTile href="/approvals" icon="check" label="Stock approvals" hint="Decide on count adjustments" />
          <ActionTile href="/ask" icon="ask" label="Ask the copilot" hint="Stock, procedures and safety" />
        </ActionGrid>
      </div>
    );
  }

  if (home.kind === "inventory_controller") {
    return (
      <div className="space-y-8">
        <RoleHero
          user={user}
          stats={[
            { label: "Counts done", value: home.countsDone, icon: "count" },
            { label: "Accuracy", value: pct(home.countAccuracyPct), icon: "pulse", tone: home.countAccuracyPct === 100 ? "ok" : "warn" },
            { label: "To decide", value: home.pendingReconciliations, icon: "check", tone: home.pendingReconciliations ? "warn" : "ok" },
          ]}
        />

        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <Section title="Count next" icon="count" action={<SectionLink href="/count-plan">See the whole count plan</SectionLink>}>
            {home.nextToCount.length === 0 ? (
              <Empty>Every location has been counted recently.</Empty>
            ) : (
              <Stagger as="ul" className="divide-y divide-line" data-testid="next-to-count">
                {home.nextToCount.map((n) => (
                  <StaggerItem as="li" key={`${n.sku}-${n.locationId}`}>
                    <Link href={`/count?q=${encodeURIComponent(n.sku)}`} className="group flex min-h-16 items-center gap-4 rounded-control px-2 py-3 hover:bg-sunk/70">
                      <span className="grid min-w-16 shrink-0 place-items-center rounded-control bg-ink px-2 py-2 text-sm font-bold text-signal">
                        {n.locationId}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold">{n.name}</span>
                        <span className="block text-sm text-soft">{n.reasons.join(" · ")}</span>
                      </span>
                      <Icon name="chevron" size={20} className="shrink-0 text-soft transition-transform duration-300 group-hover:translate-x-1" />
                    </Link>
                  </StaggerItem>
                ))}
              </Stagger>
            )}
          </Section>

          <Section title="Count accuracy" icon="pulse">
            <div className="grid place-items-center py-3">
              <Ring value={home.countAccuracyPct} label="Counts that matched the record" />
            </div>
          </Section>

          <Section title="Reconciliation" icon="check">
            <Stagger as="ul" className="divide-y divide-line">
              <AttentionRow href="/reconciliation" icon="check" label="Counts waiting for a decision" count={home.pendingReconciliations} tone={home.pendingReconciliations ? "warn" : "ok"} hint="Approve or decline each variance" />
              <AttentionRow href="/count" icon="count" label="Counts done" count={home.countsDone} hint={`Count accuracy ${pct(home.countAccuracyPct)}`} />
            </Stagger>
          </Section>

          <Section title="Accuracy risks" icon="alert">
            <Stagger as="ul" className="divide-y divide-line">
              <AttentionRow href="/stock" icon="shelf" label="Dead stock" count={home.health.dead} hint="Check these records are still right" />
              <AttentionRow href="/stock" icon="shelf" label="Slow moving" count={home.health.slow} />
              <AttentionRow href="/count-plan" icon="note" label="Stockout risk" count={home.health.stockout} tone={home.health.stockout ? "warn" : "ok"} hint="Low stock is counted first" />
            </Stagger>
          </Section>
        </div>

        <ActionGrid title="Your tools">
          <ActionTile href="/stock" icon="shelf" label="Stock records" hint="Every product and where it is" />
          <ActionTile href="/count" icon="count" label="Cycle count" hint="By hand or from a photo" />
          <ActionTile href="/reconciliation" icon="check" label="Reconcile variances" hint="Approve or decline adjustments" />
        </ActionGrid>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <RoleHero
        user={user}
        stats={[
          { label: "Orders to go", value: home.openOrders, icon: "truck" },
          { label: "Loads in full", value: pct(home.dispatchAccuracyPct), icon: "send", tone: home.dispatchAccuracyPct === 100 ? "ok" : "warn" },
          { label: "Clean receipts", value: pct(home.receiptCleanPct), icon: "receive", tone: home.receiptCleanPct === 100 ? "ok" : "warn" },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="At a glance" icon="pulse" className="lg:col-span-2">
          <div className="flex flex-wrap items-start justify-around gap-6 py-2">
            <Ring value={home.dispatchAccuracyPct} label="Loads that matched their order" />
            <Ring value={home.receiptCleanPct} label="Receipts with no discrepancy" />
          </div>
        </Section>

        <Section title="Shipments" icon="truck" action={<SectionLink href="/shipments">All shipments</SectionLink>}>
          <Stagger as="ul" className="divide-y divide-line">
            <AttentionRow href="/shipments" icon="truck" label="Orders waiting to go out" count={home.openOrders} />
            <AttentionRow href="/accuracy" icon="send" label="Dispatch accuracy" count={pct(home.dispatchAccuracyPct)} tone={home.dispatchAccuracyPct === 100 ? "ok" : "warn"} hint={`${home.dispatches} dispatches, ${home.shortfalls} with a shortfall`} />
          </Stagger>
        </Section>

        <Section title="Process compliance" icon="check">
          <Stagger as="ul" className="divide-y divide-line">
            <AttentionRow href="/compliance" icon="receive" label="Receipts with no discrepancy" count={pct(home.receiptCleanPct)} tone={home.receiptCleanPct === 100 ? "ok" : "warn"} />
          </Stagger>
        </Section>
      </div>

      <ActionGrid title="Quick actions">
        <ActionTile href="/dispatch" icon="send" label="Verify a dispatch" hint="Compare what was loaded with the order" />
        <ActionTile href="/shipments" icon="truck" label="Follow shipments" hint="Where every order is going" />
        <ActionTile href="/handover" icon="note" label="Write the shift handover" />
      </ActionGrid>
    </div>
  );
}
