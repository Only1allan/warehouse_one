import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { Icon } from "@/components/icons";
import { Avatar, LocalBadge } from "@/components/app-shell";
import { Reveal, SettleIn, TextReveal } from "@/components/motion";
import { SignInForm } from "@/components/signin-form";
import { Skeleton } from "@/components/ui";
import { photos } from "@/lib/photos";

export const metadata = { title: "Sign in · Warehouse Operations Copilot" };

const crew = [
  { username: "amina", name: "Amina Otieno" },
  { username: "daniel", name: "Daniel Odhiambo" },
  { username: "esther", name: "Esther Wanjiru" },
  { username: "kevin", name: "Kevin Mutua" },
];

export default function SignInPage() {
  return (
    <div className="min-h-dvh bg-canvas">
      <header className="glass sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-line px-4 py-3 md:px-8">
        <Link href="/" className="flex items-center gap-3" aria-label="Warehouse Copilot overview">
          <span aria-hidden="true" className="grid size-10 place-items-center rounded-control bg-signal text-ink">
            <Icon name="shelf" size={24} />
          </span>
          <span className="font-bold">Warehouse Copilot</span>
        </Link>
        <LocalBadge />
      </header>
      <main className="mx-auto grid max-w-7xl gap-8 px-4 py-8 md:px-8 md:py-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-12">
        <aside className="relative isolate order-last flex min-h-64 lg:order-none flex-col justify-end overflow-hidden rounded-hero bg-ink p-6 text-canvas shadow-float md:p-9 lg:sticky lg:top-24 lg:h-[calc(100dvh-8rem)] lg:min-h-[34rem]">
          <SettleIn className="absolute inset-0 -z-10">
            <Image
              src={photos.yellowFloor}
              alt="A busy warehouse floor stacked with yellow crates and boxes"
              fill
              preload
              placeholder="blur"
              sizes="(min-width: 1024px) 560px, 100vw"
              className="object-cover"
            />
          </SettleIn>
          <div aria-hidden="true" className="absolute inset-0 -z-10 bg-linear-to-t from-ink via-ink/70 to-ink/5" />
          <Reveal y={10}>
            <span className="eyebrow text-signal">Works with the network off</span>
          </Reveal>
          <TextReveal
            as="p"
            text="Every shift, one copilot."
            delay={0.2}
            className="mt-4 text-[clamp(2rem,4vw,3rem)] font-bold leading-[1.05] tracking-tight"
          />
          <Reveal delay={0.6} className="mt-6 flex items-center gap-4">
            <div className="flex -space-x-3">
              {crew.map((c) => (
                <Avatar key={c.username} username={c.username} name={c.name} size={44} ring="ring-ink" />
              ))}
            </div>
            <p className="max-w-xs text-sm text-canvas/80">
              Four roles, four home screens. Pick a demo login to see the one made for that job.
            </p>
          </Reveal>
        </aside>
        <Suspense fallback={<Skeleton className="h-96" />}>
          <SignInForm />
        </Suspense>
      </main>
    </div>
  );
}
