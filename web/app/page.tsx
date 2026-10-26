import Image from "next/image";
import { LocalBadge } from "@/components/app-shell";
import { type IconName } from "@/components/icons";
import { CapabilityTile, HeroVisual, LandingHeader, OfflineSteps, PhotoPanel, PhotoStrip, RoleCard } from "@/components/landing";
import { ClosingCta, HeroCta } from "@/components/landing-cta";
import { CountUp, Parallax, Reveal, ScrollProgress, Stagger, StaggerItem, TextReveal } from "@/components/motion";
import { photos, rolePhoto } from "@/lib/photos";
import type { StaticImageData } from "next/image";

export const metadata = {
  title: "Warehouse Operations Copilot: the AI assistant that works with the network off",
  description:
    "Ask your warehouse in plain words, read delivery notes, count shelves from a photo and verify dispatch. All AI runs on this device.",
};

const guarantees = [
  {
    title: "The model never writes a number",
    text: "Stock, locations and discrepancies come from your records and plain arithmetic. The language model only works out what you asked.",
  },
  {
    title: "A person confirms every change",
    text: "Receipts, counts and dispatches change stock only when someone confirms them. The model has no way to edit inventory.",
  },
  {
    title: "Procedures cite their source",
    text: "Answers about safety and process show the document and section they came from. If there is no SOP for it, the copilot says so.",
  },
  {
    title: "Nothing leaves this device",
    text: "No cloud AI, no accounts to create, no analytics. The only network use is a one-time model download.",
  },
];

const roles = [
  {
    title: "Warehouse Operator",
    who: "amina",
    person: "Amina Otieno",
    role: "operator" as const,
    text: "Asks about stock and procedures by typing or voice, receives deliveries from a photo of the note, counts shelves and checks loads.",
  },
  {
    title: "Warehouse Supervisor",
    who: "daniel",
    person: "Daniel Odhiambo",
    role: "supervisor" as const,
    text: "Sees every exception in one list, watches inventory health, approves stock adjustments and writes the shift handover.",
  },
  {
    title: "Inventory Controller",
    who: "esther",
    person: "Esther Wanjiru",
    role: "inventory_controller" as const,
    text: "Searches stock records and their movement history, runs cycle counts and reconciles every variance.",
  },
  {
    title: "Logistics Manager",
    who: "kevin",
    person: "Kevin Mutua",
    role: "logistics_manager" as const,
    text: "Follows shipments, tracks dispatch accuracy and process compliance, and hands over the shift.",
  },
];

const capabilities: Array<{ icon: IconName; title: string; text: string; photo?: StaticImageData; span: string }> = [
  { icon: "ask", title: "Ask about anything on the floor", text: "Stock levels, where things are, deliveries due, procedures and safety.", photo: photos.askTablet, span: "md:col-span-4" },
  { icon: "mic", title: "Hands-free by voice", text: "Hold a button, speak, and check what the copilot heard before it answers.", photo: photos.voiceForklift, span: "md:col-span-2" },
  { icon: "receive", title: "Check deliveries from a photo", text: "Reads the delivery note, matches the purchase order and shows what is missing.", photo: photos.receiveDock, span: "md:col-span-2" },
  { icon: "camera", title: "Count a shelf from a photo", text: "Proposes a count. You confirm it, and the variance is worked out for you.", photo: photos.countBins, span: "md:col-span-2" },
  { icon: "send", title: "Verify dispatch", text: "Compares what was loaded with what was ordered before the truck leaves.", photo: photos.forkliftTruck, span: "md:col-span-2" },
  { icon: "pulse", title: "Spot problems early", text: "Dead stock, slow movers, stockout risk and overstock, each with a next step.", span: "md:col-span-2" },
  { icon: "note", title: "Hand over the shift", text: "A summary of the shift's receipts, dispatches and issues, with the numbers beside it.", span: "md:col-span-2" },
  { icon: "alert", title: "Keep safety in reach", text: "PPE by zone, chemical storage and the forklift checklist, one question away.", span: "md:col-span-2" },
];

const heroStats = [
  { value: "0", label: "cloud calls" },
  { value: "5", label: "on-device models" },
  { value: "4", label: "roles, one app" },
];

export default function LandingPage() {
  return (
    <div className="bg-canvas">
      <ScrollProgress />
      <LandingHeader />

      <main>
        <section className="relative overflow-hidden">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-40 -top-56 size-[42rem] rounded-full bg-signal/30 blur-3xl"
          />
          <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 pb-24 pt-8 md:px-8 md:pb-32 md:pt-14 lg:grid-cols-[1fr_1.02fr] lg:gap-16">
            <div>
              <Reveal y={10}>
                <LocalBadge />
              </Reveal>
              <TextReveal
                as="h1"
                text="Ask your warehouse. Even with the network off."
                highlight="network off."
                delay={0.15}
                className="display mt-6"
              />
              <Reveal delay={0.55}>
                <p className="mt-6 max-w-xl text-lg text-soft">
                  An assistant for the people on the floor. It answers from your own procedures and stock records, reads
                  delivery notes, counts shelves from a photo and checks loads. All of it runs on this device.
                </p>
              </Reveal>
              <Reveal delay={0.7} className="mt-8">
                <HeroCta />
              </Reveal>
              <Reveal delay={0.85}>
                <dl className="mt-10 grid max-w-md grid-cols-3 gap-6 border-t border-line pt-6">
                  {heroStats.map((s) => (
                    <div key={s.label} className="flex flex-col-reverse justify-end">
                      <dt className="text-sm text-soft">{s.label}</dt>
                      <dd>
                        <CountUp value={s.value} onView className="block text-3xl font-bold tracking-tight" />
                      </dd>
                    </div>
                  ))}
                </dl>
              </Reveal>
            </div>

            <HeroVisual />
          </div>
        </section>

        <PhotoStrip />

        <section id="trust" className="relative isolate mt-16 overflow-hidden bg-ink text-canvas md:mt-24">
          <Parallax className="absolute inset-0 -z-10 opacity-40" distance={90}>
            <Image src={photos.darkShelves} alt="" fill placeholder="blur" sizes="100vw" className="object-cover" />
          </Parallax>
          <div aria-hidden="true" className="absolute inset-0 -z-10 bg-linear-to-b from-ink via-ink/85 to-ink" />
          <div className="mx-auto max-w-7xl px-4 py-20 md:px-8 md:py-32">
            <Reveal y={10}>
              <span className="eyebrow text-signal">Why trust it</span>
            </Reveal>
            <TextReveal as="h2" inView text="Useful on the floor only if you can trust it." className="display-2 mt-4 max-w-3xl" />
            <Stagger as="dl" step={0.1} className="mt-14 grid gap-4 md:grid-cols-2">
              {guarantees.map((g, i) => (
                <StaggerItem
                  key={g.title}
                  className="glass-dark rounded-panel p-6 transition-colors duration-300 hover:bg-white/10 md:p-8"
                >
                  <dt className="flex items-baseline gap-4 text-xl font-semibold">
                    <span aria-hidden="true" className="text-sm font-bold text-signal">
                      0{i + 1}
                    </span>
                    {g.title}
                  </dt>
                  <dd className="mt-3 max-w-md pl-9 text-canvas/75">{g.text}</dd>
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        </section>

        <section id="roles" className="mx-auto max-w-7xl px-4 py-20 md:px-8 md:py-28">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <Reveal y={10}>
                <span className="eyebrow text-soft">For each role</span>
              </Reveal>
              <TextReveal as="h2" inView text="One copilot, built for each job." className="display-2 mt-4 max-w-3xl" />
            </div>
            <Reveal delay={0.2}>
              <p className="max-w-md text-lg text-soft">
                Everyone signs in and lands on a screen made for their work, with only the tools their role needs.
              </p>
            </Reveal>
          </div>
          <Stagger step={0.1} className="mt-12 grid gap-6 md:grid-cols-2">
            {roles.map((r) => (
              <StaggerItem key={r.title} className="h-full">
                <RoleCard
                  title={r.title}
                  who={r.who}
                  person={r.person}
                  text={r.text}
                  photo={rolePhoto[r.role].src}
                  alt={rolePhoto[r.role].alt}
                />
              </StaggerItem>
            ))}
          </Stagger>
        </section>

        <section className="border-y border-line bg-surface">
          <div className="mx-auto max-w-7xl px-4 py-20 md:px-8 md:py-28">
            <Reveal y={10}>
              <span className="eyebrow text-soft">What it does</span>
            </Reveal>
            <TextReveal as="h2" inView text="Everything a shift needs." className="display-2 mt-4 max-w-3xl" />
            <Stagger step={0.06} className="mt-12 grid gap-4 md:grid-cols-6">
              {capabilities.map((c) => (
                <CapabilityTile key={c.title} icon={c.icon} title={c.title} text={c.text} photo={c.photo} className={c.span} />
              ))}
            </Stagger>
          </div>
        </section>

        <section id="offline" className="mx-auto max-w-7xl px-4 py-20 md:px-8 md:py-28">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center lg:gap-16">
            <div>
              <Reveal y={10}>
                <span className="eyebrow text-soft">Offline</span>
              </Reveal>
              <TextReveal as="h2" inView text="Prepare once. Then switch the network off." className="display-2 mt-4" />
              <OfflineSteps />
            </div>
            <Reveal>
              <PhotoPanel
                src={photos.forkliftAisle}
                alt="A forklift between pallet racks in a warehouse"
                className="min-h-[34rem] p-7 md:p-9"
              >
                <h3 className="text-2xl font-semibold">Under the hood</h3>
                <p className="mt-2 max-w-lg text-canvas/80">
                  Built with the QVAC local AI SDK for the AI Yako hackathon, Offline AI apps track. Language, speech,
                  document reading, vision and search models all run on the CPU of this machine.
                </p>
                <ul className="mt-5 space-y-2.5 text-sm">
                  {[
                    "QVAC SDK 0.22 runs inside the Next.js server, not in the cloud.",
                    "Inventory lives in a local SQLite database on this device.",
                    "Accounts and sessions are local too. There is no sign-in service.",
                  ].map((t) => (
                    <li key={t} className="flex gap-3">
                      <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-signal" />
                      {t}
                    </li>
                  ))}
                </ul>
                <a
                  href="https://github.com/Only1allan/warehouse_one"
                  className="mt-6 inline-flex min-h-12 items-center self-start rounded-control bg-signal px-5 font-semibold text-ink hover:bg-signal-press"
                >
                  Source code
                </a>
              </PhotoPanel>
            </Reveal>
          </div>
        </section>

        <section className="px-4 pb-20 md:px-8 md:pb-28">
          <Reveal className="relative isolate mx-auto max-w-7xl overflow-hidden rounded-hero bg-signal text-ink">
            <Image
              src={photos.yellowFloor}
              alt=""
              fill
              placeholder="blur"
              sizes="(min-width: 1280px) 1280px, 100vw"
              className="-z-10 object-cover opacity-30 mix-blend-multiply"
            />
            <div className="grid items-end gap-8 p-8 md:p-14 lg:grid-cols-[1.3fr_1fr]">
              <TextReveal as="h2" inView text="Your next shift can start offline." className="display-2" />
              <div>
                <p className="mb-6 max-w-md text-lg font-medium">
                  Pick a role, sign in with a demo login and try it with the network switched off.
                </p>
                <ClosingCta />
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-soft md:px-8">
          <span>Warehouse Operations Copilot · built for AI Yako: Own Your AI (QVAC Hackathon)</span>
          <span>Photography from Unsplash · MIT licence</span>
        </div>
      </footer>
    </div>
  );
}
