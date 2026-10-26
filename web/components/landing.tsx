"use client";

import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import { motion, useMotionValueEvent, useScroll } from "motion/react";
import { useState } from "react";
import { photos } from "@/lib/photos";
import { Avatar } from "./app-shell";
import { CopilotCard } from "./copilot-cards";
import { Icon, type IconName } from "./icons";
import { HeaderCta } from "./landing-cta";
import { easeOut, Parallax, springSoft, Stagger, StaggerItem } from "./motion";

const noop = () => {};

export function LandingHeader() {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  useMotionValueEvent(scrollY, "change", (y) => setScrolled(y > 16));

  const navLink =
    "relative py-1 after:absolute after:-bottom-0.5 after:left-0 after:h-0.5 after:w-full after:origin-left after:scale-x-0 after:bg-ink after:transition-transform after:duration-300 after:ease-[var(--ease-out)] hover:after:scale-x-100";

  return (
    <header
      className={`sticky top-0 z-30 border-b transition-[background-color,border-color,box-shadow] duration-300 ${
        scrolled ? "glass border-line shadow-[0_8px_30px_-12px_rgb(27_26_23/0.25)]" : "border-transparent bg-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 md:px-8">
        <Link href="/" className="group flex items-center gap-3" aria-label="Warehouse Copilot">
          <span
            aria-hidden="true"
            className="grid size-10 place-items-center rounded-control bg-signal text-ink transition-transform duration-500 ease-[var(--ease-out)] group-hover:rotate-[-8deg]"
          >
            <Icon name="shelf" size={24} />
          </span>
          <span className="font-bold">Warehouse Copilot</span>
        </Link>
        <nav aria-label="Sections" className="hidden items-center gap-7 text-sm font-semibold md:flex">
          <a href="#trust" className={navLink}>
            Why trust it
          </a>
          <a href="#roles" className={navLink}>
            For each role
          </a>
          <a href="#offline" className={navLink}>
            Offline
          </a>
        </nav>
        <HeaderCta />
      </div>
    </header>
  );
}

export function HeroVisual() {
  return (
    <div className="relative">
      <motion.div
        className="relative aspect-[4/3] overflow-hidden rounded-hero bg-ink shadow-float sm:aspect-[16/11] lg:aspect-[4/5]"
        initial={{ clipPath: "inset(10% 10% 10% 10% round 28px)", opacity: 0 }}
        animate={{ clipPath: "inset(0% 0% 0% 0% round 28px)", opacity: 1 }}
        transition={{ duration: 1.3, ease: easeOut }}
      >
        <Parallax className="absolute inset-0" distance={36}>
          <Image
            src={photos.heroAisle}
            alt="Tall warehouse racking stacked with pallets of boxes"
            fill
            preload
            placeholder="blur"
            sizes="(min-width: 1024px) 600px, 100vw"
            className="object-cover"
          />
        </Parallax>
        <div aria-hidden="true" className="absolute inset-0 bg-linear-to-t from-ink/70 via-ink/10 to-ink/20" />
        <motion.div
          className="glass absolute left-4 top-4 inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: easeOut, delay: 0.9 }}
        >
          <span aria-hidden="true" className="relative grid size-2.5 place-items-center">
            <span className="ping-soft absolute size-2.5 rounded-full bg-bad" />
            <span className="relative size-2.5 rounded-full bg-bad" />
          </span>
          Network off
        </motion.div>
        <motion.div
          className="glass-dark absolute right-4 top-4 hidden items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold text-canvas sm:inline-flex"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: easeOut, delay: 1.05 }}
        >
          <Icon name="cpu" size={18} />
          AI on this device
        </motion.div>
      </motion.div>

      <motion.div
        className="relative z-10 mx-3 -mt-28 sm:mx-8 lg:absolute lg:-bottom-12 lg:-left-10 lg:mx-0 lg:mt-0 lg:w-[24rem]"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", visualDuration: 0.8, bounce: 0.2, delay: 0.6 }}
      >
        <div className="float">
          <div aria-label="Example of the Ask screen" role="img">
            <div className="rounded-panel border border-line bg-surface/95 p-4 shadow-float backdrop-blur md:p-5">
              <div className="flex items-center justify-between gap-3 border-b border-line pb-3 text-sm">
                <span className="flex items-center gap-2 font-semibold">
                  <Icon name="ask" size={18} /> Ask
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-sunk px-3 py-1 font-semibold">
                  <span aria-hidden="true" className="size-2 rounded-full bg-bad" />
                  Offline
                </span>
              </div>
              <div className="space-y-3 pt-4">
                <motion.div
                  className="flex justify-end"
                  initial={{ opacity: 0, y: 12, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ ...springSoft, delay: 1.1 }}
                >
                  <p className="max-w-[85%] rounded-panel rounded-br-sm bg-signal px-4 py-2.5 font-medium">
                    How many generators do we have?
                  </p>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, ease: easeOut, delay: 1.6 }}
                >
                  <div className="rounded-panel border border-line bg-surface p-3.5 text-[0.95rem]">
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
                </motion.div>
                <motion.p
                  className="flex items-center gap-2 text-sm text-soft"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.6, delay: 2.1 }}
                >
                  <Icon name="shield" size={16} className="text-ok" />
                  The number comes from the stock record, not from the model.
                </motion.p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

const strip: Array<{ src: StaticImageData; label: string }> = [
  { src: photos.receiveDock, label: "Receiving dock" },
  { src: photos.countBins, label: "Cycle counts" },
  { src: photos.forkliftTruck, label: "Dispatch" },
  { src: photos.safetyGear, label: "Safety" },
  { src: photos.controllerTablet2, label: "Stock checks" },
  { src: photos.containers, label: "Shipments" },
  { src: photos.voiceForklift, label: "Hands-free" },
  { src: photos.blueRacks, label: "Storage" },
  { src: photos.supervisorUniform, label: "Shift leads" },
];

export function PhotoStrip() {
  return (
    <div
      aria-hidden="true"
      className="marquee relative overflow-hidden py-4 [mask-image:linear-gradient(90deg,transparent,black_8%,black_92%,transparent)]"
    >
      <div className="marquee-track flex w-max gap-4">
        {[...strip, ...strip].map((item, i) => (
          <figure key={i} className="group relative h-44 w-64 shrink-0 overflow-hidden rounded-panel bg-ink md:h-52 md:w-80">
            <Image src={item.src} alt="" fill placeholder="blur" sizes="320px" className="zoom-photo object-cover" />
            <figcaption className="glass absolute bottom-3 left-3 rounded-full px-3 py-1 text-xs font-semibold">
              {item.label}
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}

export function RoleCard({
  title,
  who,
  person,
  text,
  photo,
  alt,
}: {
  title: string;
  who: string;
  person: string;
  text: string;
  photo: StaticImageData;
  alt: string;
}) {
  return (
    <motion.article
      whileHover={{ y: -6 }}
      transition={springSoft}
      className="group relative flex h-full flex-col overflow-hidden rounded-hero border border-line bg-surface shadow-panel transition-shadow duration-300 hover:shadow-lift"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-ink">
        <Image src={photo} alt={alt} fill placeholder="blur" sizes="(min-width: 768px) 600px, 100vw" className="zoom-photo object-cover" />
        <div aria-hidden="true" className="photo-fade-up absolute inset-0" />
        <div className="absolute bottom-4 left-4 flex items-center gap-3 text-canvas">
          <Avatar username={who} name={person} size={48} ring="ring-signal" />
          <div className="leading-tight">
            <div className="font-semibold">{person}</div>
            <div className="text-sm text-canvas/80">Demo login</div>
          </div>
        </div>
      </div>
      <div className="flex flex-1 flex-col p-6">
        <h3 className="text-xl font-semibold">{title}</h3>
        <p className="mt-2 flex-1 text-soft">{text}</p>
        <Link
          href={`/signin?as=${who}`}
          className="mt-5 inline-flex min-h-12 items-center gap-2 self-start rounded-control bg-ink px-5 font-semibold text-canvas after:absolute after:inset-0 hover:bg-ink/85"
          data-testid={`try-${who}`}
        >
          Try this role
          <Icon name="chevron" size={18} className="transition-transform duration-300 group-hover:translate-x-1" />
        </Link>
      </div>
    </motion.article>
  );
}

export function CapabilityTile({
  icon,
  title,
  text,
  photo,
  className = "",
}: {
  icon: IconName;
  title: string;
  text: string;
  photo?: StaticImageData;
  className?: string;
}) {
  if (photo) {
    return (
      <StaggerItem
        className={`group relative isolate flex min-h-64 flex-col justify-between overflow-hidden rounded-panel bg-ink p-6 text-canvas ${className}`}
      >
        <Image src={photo} alt="" fill placeholder="blur" sizes="(min-width: 768px) 50vw, 100vw" className="zoom-photo -z-10 object-cover" />
        <div aria-hidden="true" className="photo-fade-up absolute inset-0 -z-10" />
        <span aria-hidden="true" className="grid size-11 place-items-center rounded-control bg-signal text-ink">
          <Icon name={icon} size={24} />
        </span>
        <div>
          <h3 className="text-xl font-semibold">{title}</h3>
          <p className="mt-1 max-w-md text-canvas/80">{text}</p>
        </div>
      </StaggerItem>
    );
  }
  return (
    <StaggerItem className={`group flex min-h-56 flex-col justify-between rounded-panel border border-line bg-canvas p-6 ${className}`}>
      <span
        aria-hidden="true"
        className="grid size-11 place-items-center rounded-control bg-signal text-ink transition-transform duration-500 ease-[var(--ease-out)] group-hover:-rotate-6 group-hover:scale-110"
      >
        <Icon name={icon} size={24} />
      </span>
      <div>
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="mt-1 text-soft">{text}</p>
      </div>
    </StaggerItem>
  );
}

const steps = [
  "Open Readiness and choose Prepare offline. The models download once and are stored here.",
  "Turn the network off.",
  "Keep working. Asking, voice, photos, counts and dispatch checks all still run.",
];

export function OfflineSteps() {
  return (
    <div className="relative mt-10">
      <div aria-hidden="true" className="absolute bottom-5 left-[1.15rem] top-5 w-0.5 bg-line" />
      <motion.div
        aria-hidden="true"
        className="absolute bottom-5 left-[1.15rem] top-5 w-0.5 origin-top bg-ink"
        initial={{ scaleY: 0 }}
        whileInView={{ scaleY: 1 }}
        viewport={{ once: true, amount: 0.6 }}
        transition={{ duration: 1.4, ease: easeOut, delay: 0.2 }}
      />
      <Stagger as="ol" step={0.25} delay={0.15} className="relative space-y-7 text-lg">
        {steps.map((s, i) => (
          <StaggerItem as="li" key={i} className="flex gap-5">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-ink font-bold text-signal ring-4 ring-canvas">
              {i + 1}
            </span>
            <span className="pt-1.5">{s}</span>
          </StaggerItem>
        ))}
      </Stagger>
    </div>
  );
}

export function PhotoPanel({
  src,
  alt,
  className = "",
  children,
}: {
  src: StaticImageData;
  alt: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`relative isolate flex flex-col justify-end overflow-hidden rounded-hero bg-ink text-canvas shadow-float ${className}`}>
      <Parallax className="absolute inset-0 -z-10" distance={50}>
        <Image src={src} alt={alt} fill placeholder="blur" sizes="(min-width: 1024px) 600px, 100vw" className="object-cover" />
      </Parallax>
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-linear-to-t from-ink via-ink/80 to-ink/10" />
      {children}
    </div>
  );
}
