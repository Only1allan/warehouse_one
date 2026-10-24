"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import type { DemoLogin } from "@/lib/services/auth";
import { useAuth } from "./auth-context";
import { Icon } from "./icons";
import { Button, Skeleton } from "./ui";

function safeNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/home";
}

const roleBlurb: Record<string, string> = {
  operator: "Ask, receive deliveries, count shelves, verify dispatch",
  supervisor: "Exceptions, inventory health, shift handover, approvals",
  inventory_controller: "Stock records, cycle counts, reconciliation",
  logistics_manager: "Shipments, dispatch accuracy, process compliance",
};

export function SignInForm() {
  const { status, user, shifts, shiftId, signIn } = useAuth();
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [shift, setShift] = useState<string>("");
  const [reveal, setReveal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [logins, setLogins] = useState<DemoLogin[] | null>(null);

  const as = useSearchParams().get("as");
  useEffect(() => {
    fetch("/api/auth/demo-logins")
      .then((r) => r.json())
      .then((list: DemoLogin[]) => {
        setLogins(list);
        const pick = list.find((l) => l.username === as);
        if (pick) {
          setUsername(pick.username);
          setPassword(pick.password);
        }
      }, () => setLogins([]));
  }, [as]);

  useEffect(() => {
    if (!shift && shifts.length > 0) {
      const hour = new Date().getHours();
      const current = shifts.find((s) =>
        s.startHour < s.endHour ? hour >= s.startHour && hour < s.endHour : hour >= s.startHour || hour < s.endHour,
      );
      setShift(current?.id ?? shifts[0].id);
    }
  }, [shifts, shift]);

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(username, password, shift || undefined);
      router.replace(next);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const featured = logins?.filter((l) => l.featured) ?? [];
  const others = logins?.filter((l) => !l.featured) ?? [];
  const field = "h-14 w-full rounded-control border border-line-strong bg-surface px-4";

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,26rem)_1fr] lg:gap-14">
      <section aria-labelledby="signin-heading">
        <h1 id="signin-heading" className="text-2xl font-semibold">
          Sign in
        </h1>
        <p className="mt-1.5 text-soft">Use your warehouse login. Nothing here is sent over the network.</p>

        {status === "ready" && user ? (
          <div className="mt-6 rounded-panel border border-line bg-surface p-5 shadow-panel" data-testid="already-signed-in">
            <p className="font-medium">
              You are signed in as {user.name} ({user.title}).
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button variant="primary" onClick={() => router.replace(next)}>
                Open the app
              </Button>
            </div>
          </div>
        ) : null}

        <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
          {error ? (
            <div role="alert" data-testid="signin-error" className="flex items-start gap-3 rounded-control bg-bad-fill px-4 py-3 font-medium text-bad">
              <Icon name="alert" size={22} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Username</span>
            <input
              name="username"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={field}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Password</span>
            <div className="flex gap-2">
              <input
                name="password"
                type={reveal ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={field}
              />
              <button
                type="button"
                onClick={() => setReveal((v) => !v)}
                aria-pressed={reveal}
                className="min-h-14 shrink-0 rounded-control border border-line-strong bg-surface px-4 text-sm font-semibold hover:bg-sunk"
              >
                {reveal ? "Hide" : "Show"}
              </button>
            </div>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Shift</span>
            <select value={shift || shiftId || ""} onChange={(e) => setShift(e.target.value)} className={field}>
              {shifts.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {String(s.startHour).padStart(2, "0")}:00 to {String(s.endHour).padStart(2, "0")}:00
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" variant="primary" icon="check" className="w-full" disabled={busy || !username || !password}>
            {busy ? "Signing in…" : "Sign in"}
          </Button>
        </form>
        <p className="mt-6 text-sm text-soft">
          <Link href="/" className="font-semibold text-ink underline underline-offset-4">
            Back to the overview
          </Link>
        </p>
      </section>

      <section aria-labelledby="demo-heading" className="min-w-0">
        <div className="rounded-panel border border-line bg-surface p-5 shadow-panel">
          <h2 id="demo-heading" className="text-lg font-semibold">
            Demo logins
          </h2>
          <p className="mt-1 text-sm text-soft">
            One user for each job in the warehouse. These accounts belong to seeded demo data only. Choose one to fill
            the form, then sign in.
          </p>
          <ul className="mt-4 divide-y divide-line" data-testid="demo-logins">
            {logins === null ? (
              <>
                <Skeleton className="my-2 h-16" />
                <Skeleton className="my-2 h-16" />
              </>
            ) : featured.length === 0 ? (
              <li className="py-4 text-soft">Demo logins are switched off on this device.</li>
            ) : (
              featured.map((l) => (
                <li key={l.username} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 py-4">
                  <div className="min-w-0 basis-56 grow">
                    <div className="font-semibold">{l.title}</div>
                    <div className="text-sm text-soft">{roleBlurb[l.role]}</div>
                    <div className="mt-1 text-sm">
                      <span className="font-medium">{l.name}</span> · username{" "}
                      <code className="rounded bg-sunk px-1.5 py-0.5 font-medium">{l.username}</code> · password{" "}
                      <code className="rounded bg-sunk px-1.5 py-0.5 font-medium">{l.password}</code>
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setUsername(l.username);
                      setPassword(l.password);
                      setError(null);
                    }}
                    aria-label={`Use the ${l.title} login`}
                    data-testid={`use-${l.username}`}
                  >
                    Use this login
                  </Button>
                </li>
              ))
            )}
          </ul>
          {others.length > 0 ? (
            <details className="mt-2 border-t border-line pt-3">
              <summary className="flex min-h-12 cursor-pointer items-center font-semibold">More operators</summary>
              <ul className="space-y-2 pb-1 pt-1 text-sm">
                {others.map((l) => (
                  <li key={l.username} className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      {l.name} · <code className="rounded bg-sunk px-1.5 py-0.5">{l.username}</code> ·{" "}
                      <code className="rounded bg-sunk px-1.5 py-0.5">{l.password}</code>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setUsername(l.username);
                        setPassword(l.password);
                        setError(null);
                      }}
                      className="min-h-11 rounded-control border border-line-strong px-4 font-semibold hover:bg-sunk"
                    >
                      Use
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      </section>
    </div>
  );
}
