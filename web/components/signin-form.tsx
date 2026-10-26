"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion, useAnimate } from "motion/react";
import { useEffect, useState, type FormEvent } from "react";
import type { DemoLogin } from "@/lib/services/auth";
import { Avatar } from "./app-shell";
import { useAuth } from "./auth-context";
import { Icon } from "./icons";
import { easeOut, springSoft, Stagger, StaggerItem, TextReveal } from "./motion";
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
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [logins, setLogins] = useState<DemoLogin[] | null>(null);
  const [scope, animate] = useAnimate<HTMLFormElement>();

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

  const hour = new Date().getHours();
  const currentShift = shifts.find((s) =>
    s.startHour < s.endHour ? hour >= s.startHour && hour < s.endHour : hour >= s.startHour || hour < s.endHour,
  );
  const chosenShift = shift || shiftId || currentShift?.id || shifts[0]?.id || "";

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(username, password, chosenShift || undefined);
      router.replace(next);
    } catch (e) {
      setError((e as Error).message);
      setAttempt((n) => n + 1);
      setBusy(false);
    }
  }

  function fillLogin(l: DemoLogin) {
    setUsername(l.username);
    setPassword(l.password);
    setError(null);
    if (scope.current) {
      void animate(
        "input[name=username], input[name=password]",
        { boxShadow: ["0 0 0 0px rgb(255 196 0 / 0)", "0 0 0 5px rgb(255 196 0 / 0.75)", "0 0 0 0px rgb(255 196 0 / 0)"] },
        { duration: 0.9, ease: easeOut },
      );
    }
  }

  const featured = logins?.filter((l) => l.featured) ?? [];
  const others = logins?.filter((l) => !l.featured) ?? [];
  const field = "h-14 w-full rounded-control border border-line-strong bg-surface px-4";

  return (
    <div className="space-y-6">
      <motion.section
        aria-labelledby="signin-heading"
        className="rounded-hero border border-line bg-surface p-6 shadow-panel md:p-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: easeOut }}
      >
        <TextReveal as="h1" id="signin-heading" text="Sign in" className="text-[2rem] font-semibold" delay={0.1} />
        <p className="mt-1.5 text-soft">Use your warehouse login. Nothing here is sent over the network.</p>

        {status === "ready" && user ? (
          <div className="mt-6 flex flex-wrap items-center gap-4 rounded-panel bg-sunk/70 p-4" data-testid="already-signed-in">
            <Avatar username={user.username} name={user.name} size={44} />
            <p className="min-w-0 flex-1 font-medium">
              You are signed in as {user.name} ({user.title}).
            </p>
            <Button variant="primary" onClick={() => router.replace(next)}>
              Open the app
            </Button>
          </div>
        ) : null}

        <form ref={scope} onSubmit={submit} className="mt-6 space-y-4" noValidate>
          <AnimatePresence initial={false}>
            {error ? (
              <motion.div
                key={attempt}
                role="alert"
                data-testid="signin-error"
                className="flex items-start gap-3 rounded-control bg-bad-fill px-4 py-3 font-medium text-bad"
                initial={{ opacity: 0, x: 0 }}
                animate={{ opacity: 1, x: [0, -10, 9, -6, 4, 0] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5, ease: easeOut }}
              >
                <Icon name="alert" size={22} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </motion.div>
            ) : null}
          </AnimatePresence>
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
            <select value={chosenShift} onChange={(e) => setShift(e.target.value)} className={field}>
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
      </motion.section>

      <motion.section
        aria-labelledby="demo-heading"
        className="min-w-0 scroll-mt-24 rounded-hero border border-line bg-surface p-6 shadow-panel md:p-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: easeOut, delay: 0.15 }}
      >
        <h2 id="demo-heading" className="text-lg font-semibold">
          Demo logins
        </h2>
        <p className="mt-1 text-sm text-soft">
          One user for each job in the warehouse. These accounts belong to seeded demo data only. Choose one to fill the
          form, then sign in.
        </p>
        {logins === null ? (
          <ul className="mt-4 divide-y divide-line" data-testid="demo-logins">
            <Skeleton className="my-2 h-20" />
            <Skeleton className="my-2 h-20" />
          </ul>
        ) : featured.length === 0 ? (
          <ul className="mt-4" data-testid="demo-logins">
            <li className="py-4 text-soft">Demo logins are switched off on this device.</li>
          </ul>
        ) : (
          <Stagger as="ul" onMount delay={0.3} className="mt-4 space-y-1" data-testid="demo-logins">
            {featured.map((l) => {
              const selected = username === l.username;
              return (
                <StaggerItem
                  as="li"
                  key={l.username}
                  className="relative flex flex-wrap items-center justify-between gap-x-4 gap-y-3 rounded-panel p-3"
                >
                  {selected ? (
                    <motion.span
                      layoutId="demo-selected"
                      transition={springSoft}
                      className="absolute inset-0 rounded-panel border border-signal-press bg-warn-fill/70"
                    />
                  ) : null}
                  <div className="relative flex min-w-0 basis-60 grow items-center gap-3.5">
                    <Avatar username={l.username} name={l.name} size={52} />
                    <div className="min-w-0">
                      <div className="font-semibold">{l.title}</div>
                      <div className="text-sm text-soft">{roleBlurb[l.role]}</div>
                      <div className="mt-1 text-sm">
                        <span className="font-medium">{l.name}</span> · username{" "}
                        <code className="rounded bg-sunk px-1.5 py-0.5 font-medium">{l.username}</code> · password{" "}
                        <code className="rounded bg-sunk px-1.5 py-0.5 font-medium">{l.password}</code>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant={selected ? "primary" : "secondary"}
                    icon={selected ? "check" : undefined}
                    className="relative"
                    onClick={() => fillLogin(l)}
                    aria-label={`Use the ${l.title} login`}
                    data-testid={`use-${l.username}`}
                  >
                    Use this login
                  </Button>
                </StaggerItem>
              );
            })}
          </Stagger>
        )}
        {others.length > 0 ? (
          <details className="mt-3 border-t border-line pt-3">
            <summary className="flex min-h-12 cursor-pointer items-center font-semibold">More operators</summary>
            <ul className="space-y-2 pb-1 pt-1 text-sm">
              {others.map((l) => (
                <li key={l.username} className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-3">
                    <Avatar username={l.username} name={l.name} size={34} />
                    <span>
                      {l.name} · <code className="rounded bg-sunk px-1.5 py-0.5">{l.username}</code> ·{" "}
                      <code className="rounded bg-sunk px-1.5 py-0.5">{l.password}</code>
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => fillLogin(l)}
                    className="min-h-11 rounded-control border border-line-strong px-4 font-semibold hover:bg-sunk"
                  >
                    Use
                  </button>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </motion.section>
    </div>
  );
}
