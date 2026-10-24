import Link from "next/link";
import { LocalBadge } from "@/components/app-shell";
import { CopilotCard } from "@/components/copilot-cards";
import { Icon, type IconName } from "@/components/icons";
import { HeaderCta, HeroCta } from "@/components/landing-cta";

export const metadata = {
  title: "Warehouse Operations Copilot: the AI assistant that works with the network off",
  description:
    "Ask your warehouse in plain words, read delivery notes, count shelves from a photo and verify dispatch. All AI runs on this device.",
};

const noop = () => {};

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
    text: "Asks about stock and procedures by typing or voice, receives deliveries from a photo of the note, counts shelves and checks loads.",
  },
  {
    title: "Warehouse Supervisor",
    who: "daniel",
    text: "Sees every exception in one list, watches inventory health, approves stock adjustments and writes the shift handover.",
  },
  {
    title: "Inventory Controller",
    who: "esther",
    text: "Searches stock records and their movement history, runs cycle counts and reconciles every variance.",
  },
  {
    title: "Logistics Manager",
    who: "kevin",
    text: "Follows shipments, tracks dispatch accuracy and process compliance, and hands over the shift.",
  },
];

const capabilities: Array<{ icon: IconName; title: string; text: string }> = [
  { icon: "ask", title: "Ask about anything on the floor", text: "Stock levels, where things are, deliveries due, procedures and safety." },
  { icon: "mic", title: "Hands-free by voice", text: "Hold a button, speak, and check what the copilot heard before it answers." },
  { icon: "receive", title: "Check deliveries from a photo", text: "Reads the delivery note, matches the purchase order and shows what is missing." },
  { icon: "camera", title: "Count a shelf from a photo", text: "Proposes a count. You confirm it, and the variance is worked out for you." },
  { icon: "send", title: "Verify dispatch", text: "Compares what was loaded with what was ordered before the truck leaves." },
  { icon: "pulse", title: "Spot problems early", text: "Dead stock, slow movers, stockout risk and overstock, each with a next step." },
  { icon: "note", title: "Hand over the shift", text: "A summary of the shift's receipts, dispatches and issues, with the numbers beside it." },
  { icon: "alert", title: "Keep safety in reach", text: "PPE by zone, chemical storage and the forklift checklist, one question away." },
];

export default function LandingPage() {
  return (
    <div className="bg-canvas">
      <header className="sticky top-0 z-20 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 md:px-8">
          <Link href="/" className="flex items-center gap-3" aria-label="Warehouse Copilot">
            <span aria-hidden="true" className="grid size-10 place-items-center rounded-control bg-signal text-ink">
              <Icon name="shelf" size={24} />
            </span>
            <span className="font-bold">Warehouse Copilot</span>
          </Link>
          <nav aria-label="Sections" className="hidden items-center gap-6 text-sm font-semibold md:flex">
            <a href="#trust" className="hover:underline underline-offset-4">Why trust it</a>
            <a href="#roles" className="hover:underline underline-offset-4">For each role</a>
            <a href="#offline" className="hover:underline underline-offset-4">Offline</a>
          </nav>
          <HeaderCta />
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-12 md:px-8 md:pb-24 md:pt-20 lg:grid-cols-[1.05fr_1fr]">
          <div>
            <LocalBadge />
            <h1 className="display mt-6">Ask your warehouse. Even with the network off.</h1>
            <p className="mt-6 max-w-xl text-lg text-soft">
              An assistant for the people on the floor. It answers from your own procedures and stock records, reads
              delivery notes, counts shelves from a photo and checks loads. All of it runs on this device.
            </p>
            <div className="mt-8">
              <HeroCta />
            </div>
          </div>

          <div aria-label="Example of the Ask screen" role="img" className="relative">
            <div className="rounded-panel border border-line bg-surface p-4 shadow-panel md:p-5">
              <div className="flex items-center justify-between gap-3 border-b border-line pb-3 text-sm">
                <span className="font-semibold">Ask</span>
                <span className="inline-flex items-center gap-2 rounded-full bg-sunk px-3 py-1 font-semibold">
                  <span aria-hidden="true" className="size-2 rounded-full bg-bad" />
                  Network off
                </span>
              </div>
              <div className="space-y-4 pt-4">
                <div className="rise flex justify-end" style={{ ["--delay" as string]: "150ms" }}>
                  <p className="max-w-[85%] rounded-panel bg-signal px-4 py-3 font-medium">
                    How many generators do we have?
                  </p>
                </div>
                <div className="rise max-w-[95%]" style={{ ["--delay" as string]: "700ms" }}>
                  <div className="rounded-panel border border-line bg-surface p-4">
                    <p>We currently have 43 units of Portable Generator 5kW in stock.</p>
                    <CopilotCard
                      onPick={noop}
                      card={{
                        kind: "stock",
                        product: { sku: "001254", name: "Portable Generator 5kW", unit: "unit", category: "Power Equipment" },
                        total: 43,
                        minStock: 10,
                        belowMinimum: false,
                        locations: [{ locationId: "B-4-2", qty: 43, lastMovedAt: "2026-10-25T09:12:00.000Z" }],
                      }}
                    />
                  </div>
                </div>
                <p className="rise text-sm text-soft" style={{ ["--delay" as string]: "1200ms" }}>
                  The number comes from the stock record, not from the model.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="trust" className="bg-ink text-canvas">
          <div className="mx-auto max-w-6xl px-4 py-16 md:px-8 md:py-24">
            <h2 className="display max-w-3xl !text-[clamp(2rem,4.6vw,3.5rem)]">
              Useful on the floor only if you can trust it.
            </h2>
            <dl className="mt-12 grid gap-x-12 gap-y-10 md:grid-cols-2">
              {guarantees.map((g) => (
                <div key={g.title} className="border-t border-canvas/25 pt-5">
                  <dt className="text-xl font-semibold">{g.title}</dt>
                  <dd className="mt-2 max-w-md text-canvas/80">{g.text}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section id="roles" className="mx-auto max-w-6xl px-4 py-16 md:px-8 md:py-24">
          <h2 className="display max-w-3xl !text-[clamp(2rem,4.6vw,3.5rem)]">One copilot, built for each job.</h2>
          <p className="mt-4 max-w-2xl text-lg text-soft">
            Everyone signs in and lands on a screen made for their work, with only the tools their role needs.
          </p>
          <ul className="mt-10 divide-y divide-line border-y border-line">
            {roles.map((r) => (
              <li key={r.title} className="grid items-center gap-4 py-6 md:grid-cols-[16rem_1fr_auto] md:gap-8">
                <h3 className="text-xl font-semibold">{r.title}</h3>
                <p className="max-w-xl text-soft">{r.text}</p>
                <Link
                  href={`/signin?as=${r.who}`}
                  className="inline-flex min-h-12 items-center justify-center rounded-control border border-line-strong bg-surface px-5 font-semibold hover:bg-sunk"
                  data-testid={`try-${r.who}`}
                >
                  Try this role
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="border-y border-line bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-16 md:px-8 md:py-24">
            <h2 className="display max-w-3xl !text-[clamp(2rem,4.6vw,3.5rem)]">Everything a shift needs.</h2>
            <ul className="mt-10 grid gap-x-12 gap-y-8 md:grid-cols-2">
              {capabilities.map((c) => (
                <li key={c.title} className="flex gap-4">
                  <span aria-hidden="true" className="mt-1 grid size-11 shrink-0 place-items-center rounded-control bg-signal text-ink">
                    <Icon name={c.icon} size={24} />
                  </span>
                  <div>
                    <h3 className="text-lg font-semibold">{c.title}</h3>
                    <p className="mt-1 text-soft">{c.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="offline" className="mx-auto max-w-6xl px-4 py-16 md:px-8 md:py-24">
          <div className="grid gap-12 lg:grid-cols-2">
            <div>
              <h2 className="display !text-[clamp(2rem,4.6vw,3.5rem)]">Prepare once. Then switch the network off.</h2>
              <ol className="mt-8 space-y-5 text-lg">
                <li className="flex gap-4">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-ink font-bold text-signal">1</span>
                  <span>Open Readiness and choose Prepare offline. The models download once and are stored here.</span>
                </li>
                <li className="flex gap-4">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-ink font-bold text-signal">2</span>
                  <span>Turn the network off.</span>
                </li>
                <li className="flex gap-4">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-ink font-bold text-signal">3</span>
                  <span>Keep working. Asking, voice, photos, counts and dispatch checks all still run.</span>
                </li>
              </ol>
            </div>
            <div className="rounded-panel border border-line bg-surface p-6 shadow-panel">
              <h3 className="text-lg font-semibold">Under the hood</h3>
              <p className="mt-2 text-soft">
                Built with the QVAC local AI SDK for the AI Yako hackathon, Offline AI apps track. Language, speech,
                document reading, vision and search models all run on the CPU of this machine.
              </p>
              <ul className="mt-4 space-y-2 text-sm">
                <li>QVAC SDK 0.22 runs inside the Next.js server, not in the cloud.</li>
                <li>Inventory lives in a local SQLite database on this device.</li>
                <li>Accounts and sessions are local too. There is no sign-in service.</li>
              </ul>
              <a
                href="https://github.com/Only1allan/warehouse_one"
                className="mt-5 inline-flex min-h-12 items-center rounded-control border border-line-strong px-5 font-semibold hover:bg-sunk"
              >
                Source code
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-soft md:px-8">
          <span>Warehouse Operations Copilot · built for AI Yako: Own Your AI (QVAC Hackathon)</span>
          <span>MIT licence</span>
        </div>
      </footer>
    </div>
  );
}
