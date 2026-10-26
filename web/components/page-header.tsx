"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import type { ReactNode } from "react";
import { screenPhoto } from "@/lib/photos";
import { easeOut, SettleIn, TextReveal } from "./motion";

export function ScreenHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  const pathname = usePathname();
  const photo = screenPhoto[pathname];

  return (
    <header className="relative mb-6 overflow-hidden rounded-hero border border-line bg-surface shadow-panel">
      {photo ? (
        <div aria-hidden="true" className="absolute inset-y-0 right-0 w-3/5 sm:w-1/2">
          <SettleIn className="absolute inset-0">
            <Image src={photo} alt="" fill placeholder="blur" sizes="(min-width: 1024px) 480px, 60vw" className="object-cover" />
          </SettleIn>
          <div className="absolute inset-0 bg-linear-to-r from-surface via-surface/55 to-surface/0" />
        </div>
      ) : null}
      <div className="relative flex min-h-36 flex-wrap items-end justify-between gap-4 px-5 py-6 md:px-8 md:py-8">
        <div className="max-w-xl">
          <TextReveal as="h1" text={title} className="text-2xl font-semibold md:text-[2rem]" />
          {description ? (
            <motion.p
              className="mt-2 max-w-md text-soft"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: easeOut, delay: 0.25 }}
            >
              {description}
            </motion.p>
          ) : null}
        </div>
        {actions}
      </div>
    </header>
  );
}
