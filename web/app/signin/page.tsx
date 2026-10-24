import Link from "next/link";
import { Suspense } from "react";
import { Icon } from "@/components/icons";
import { LocalBadge } from "@/components/app-shell";
import { SignInForm } from "@/components/signin-form";
import { Skeleton } from "@/components/ui";

export const metadata = { title: "Sign in · Warehouse Operations Copilot" };

export default function SignInPage() {
  return (
    <div className="min-h-dvh bg-canvas">
      <header className="flex items-center justify-between gap-3 border-b border-line bg-surface px-4 py-3 md:px-8">
        <Link href="/" className="flex items-center gap-3" aria-label="Warehouse Copilot overview">
          <span aria-hidden="true" className="grid size-10 place-items-center rounded-control bg-signal text-ink">
            <Icon name="shelf" size={24} />
          </span>
          <span className="font-bold">Warehouse Copilot</span>
        </Link>
        <LocalBadge />
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 md:px-8 md:py-12">
        <Suspense fallback={<Skeleton className="h-96" />}>
          <SignInForm />
        </Suspense>
      </main>
    </div>
  );
}
