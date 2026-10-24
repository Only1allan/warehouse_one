"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Icon, type IconName } from "./icons";
import { useOperator } from "./operator-context";
import { Skeleton } from "./ui";
import { useEffect, useState } from "react";

const destinations: Array<{ href: string; label: string; icon: IconName }> = [
  { href: "/ask", label: "Ask", icon: "ask" },
  { href: "/receive", label: "Receive", icon: "receive" },
  { href: "/count", label: "Count", icon: "count" },
  { href: "/supervisor", label: "Supervisor", icon: "supervisor" },
];

export function LocalBadge() {
  return (
    <div
      data-testid="local-badge"
      className="inline-flex items-center gap-2 rounded-full border border-ok/30 bg-ok-fill px-3.5 py-2 text-sm font-semibold text-ok"
      title="All AI runs on this device. No data leaves it."
    >
      <Icon name="shield" size={20} />
      <span>100% local</span>
      <span className="hidden font-medium sm:inline">
        · nothing leaves this device
      </span>
    </div>
  );
}

type Warm = { llm: boolean; embeddings: boolean; busy: boolean; problem: string | null };

export function AiStatus() {
  const [warm, setWarm] = useState<Warm | null>(null);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const response = await fetch("/api/readiness");
        const data = (await response.json()) as { warm: Warm };
        if (stopped) return;
        setWarm(data.warm);
        if (!(data.warm.llm && data.warm.embeddings) && !data.warm.problem) timer = setTimeout(poll, 3000);
      } catch {
        if (!stopped) timer = setTimeout(poll, 5000);
      }
    };
    fetch("/api/readiness", { method: "POST" }).finally(() => void poll());
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, []);

  const ready = warm?.llm && warm.embeddings;
  const text = ready ? "AI ready" : warm?.problem ? "Set up AI" : "Preparing AI…";
  const tone = ready
    ? "border-ok/30 bg-ok-fill text-ok"
    : warm?.problem
      ? "border-warn/30 bg-warn-fill text-warn"
      : "border-line-strong bg-sunk text-ink";
  return (
    <Link
      href="/readiness"
      data-testid="ai-status"
      title={warm?.problem ?? "Models on this device"}
      className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-semibold ${tone}`}
    >
      <Icon name={ready ? "cpu" : warm?.problem ? "alert" : "info"} size={20} />
      {text}
    </Link>
  );
}

function OperatorPanel() {
  const { ready, options, operatorId, shiftId, setOperatorId, setShiftId } = useOperator();
  if (!ready || !options) {
    return (
      <div className="space-y-2" aria-busy="true">
        <Skeleton className="h-12" />
        <Skeleton className="h-12" />
      </div>
    );
  }
  const field =
    "min-h-12 w-full rounded-control border border-line-strong bg-surface px-3 text-sm font-medium text-ink";
  return (
    <div className="space-y-3">
      <label className="block">
        <span className="mb-1 flex items-center gap-1.5 text-xs font-medium text-soft">
          <Icon name="person" size={16} /> Operator
        </span>
        <select
          className={field}
          value={operatorId ?? ""}
          onChange={(e) => setOperatorId(e.target.value)}
        >
          {options.operators.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
              {o.role === "supervisor" ? " (supervisor)" : ""}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-soft">Shift</span>
        <select
          className={field}
          value={shiftId ?? ""}
          onChange={(e) => setShiftId(e.target.value)}
        >
          {options.shifts.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} · {String(s.startHour).padStart(2, "0")}:00 to{" "}
              {String(s.endHour).padStart(2, "0")}:00
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function NavLinks({ orientation }: { orientation: "rail" | "bar" }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className={
        orientation === "rail"
          ? "flex flex-col gap-1.5"
          : "grid grid-cols-4 gap-1 px-2 py-2"
      }
    >
      {destinations.map((d) => {
        const active = pathname === d.href || pathname.startsWith(`${d.href}/`);
        return (
          <Link
            key={d.href}
            href={d.href}
            aria-current={active ? "page" : undefined}
            className={
              orientation === "rail"
                ? `flex min-h-16 items-center gap-3.5 rounded-control px-4 text-base font-semibold ${
                    active
                      ? "bg-signal text-ink shadow-[0_1px_0_rgb(27_26_23/0.2)]"
                      : "text-ink hover:bg-sunk"
                  }`
                : `flex min-h-16 flex-col items-center justify-center gap-1 rounded-control text-xs font-semibold ${
                    active ? "bg-signal text-ink" : "text-ink hover:bg-sunk"
                  }`
            }
          >
            <Icon name={d.icon} size={orientation === "rail" ? 26 : 24} />
            {d.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[var(--nav-width)_1fr]">
      <aside className="hidden border-r border-line bg-surface md:sticky md:top-0 md:flex md:h-dvh md:flex-col md:gap-6 md:p-4">
        <div className="flex items-center gap-3 px-2 pt-2">
          <span
            aria-hidden="true"
            className="grid size-11 place-items-center rounded-control bg-signal text-ink"
          >
            <Icon name="shelf" size={26} />
          </span>
          <div className="leading-tight">
            <div className="text-base font-bold">Warehouse Copilot</div>
            <div className="text-xs font-medium text-soft">Operations assistant</div>
          </div>
        </div>
        <NavLinks orientation="rail" />
        <div className="mt-auto border-t border-line pt-4">
          <OperatorPanel />
        </div>
      </aside>

      <div className="flex min-h-dvh min-w-0 flex-col pb-24 md:pb-0">
        <header className="flex items-center justify-between gap-3 border-b border-line bg-surface px-4 py-3 md:px-8">
          <div className="flex items-center gap-2.5 md:hidden">
            <span
              aria-hidden="true"
              className="grid size-9 place-items-center rounded-control bg-signal text-ink"
            >
              <Icon name="shelf" size={20} />
            </span>
            <span className="text-sm font-bold">Copilot</span>
          </div>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            <AiStatus />
            <LocalBadge />
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 md:px-8 md:py-8">
          {children}
        </main>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface md:hidden">
        <details className="border-b border-line px-4 py-2 text-sm">
          <summary className="flex min-h-12 cursor-pointer items-center gap-2 font-semibold">
            <Icon name="person" size={18} /> Operator and shift
          </summary>
          <div className="pb-3 pt-2">
            <OperatorPanel />
          </div>
        </details>
        <NavLinks orientation="bar" />
      </div>
    </div>
  );
}
