"use client";

import Link from "next/link";
import { useAuth } from "./auth-context";

const primary =
  "inline-flex min-h-14 items-center justify-center gap-2 rounded-control border border-ink/15 bg-signal px-6 text-base font-semibold text-ink shadow-[0_1px_0_rgb(27_26_23/0.2)] hover:bg-signal-press";
const secondary =
  "inline-flex min-h-14 items-center justify-center gap-2 rounded-control border border-line-strong bg-surface px-6 text-base font-semibold text-ink hover:bg-sunk";

export function HeaderCta() {
  const { status, user } = useAuth();
  if (status === "ready" && user) {
    return (
      <Link href="/home" className={primary} data-testid="open-app">
        Open the app
      </Link>
    );
  }
  return (
    <Link href="/signin" className={primary} data-testid="header-signin">
      Sign in
    </Link>
  );
}

export function HeroCta() {
  const { status, user } = useAuth();
  return (
    <div className="flex flex-wrap gap-3">
      {status === "ready" && user ? (
        <Link href="/home" className={primary} data-testid="hero-open-app">
          Open the app as {user.name.split(" ")[0]}
        </Link>
      ) : (
        <Link href="/signin" className={primary} data-testid="hero-signin">
          Sign in
        </Link>
      )}
      <Link href="/signin#demo-heading" className={secondary} data-testid="hero-demo-logins">
        See the demo logins
      </Link>
    </div>
  );
}
