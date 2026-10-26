"use client";

import Link from "next/link";
import {
  animate,
  motion,
  MotionConfig,
  stagger,
  useInView,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type Variants,
} from "motion/react";
import { Fragment, useEffect, useRef, type ReactNode } from "react";

export const easeOut = [0.22, 1, 0.36, 1] as const;
export const springSoft = { type: "spring", visualDuration: 0.45, bounce: 0.15 } as const;

export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

export const MotionLink = motion.create(Link);

const blockTags = {
  div: motion.div,
  section: motion.section,
  article: motion.article,
  li: motion.li,
  ul: motion.ul,
  ol: motion.ol,
  dl: motion.dl,
};
type BlockTag = keyof typeof blockTags;

const inViewport = { once: true, margin: "0px 0px -8% 0px" } as const;

export function Reveal({
  children,
  className,
  delay = 0,
  y = 28,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  as?: BlockTag;
}) {
  const Tag = blockTags[as] as typeof motion.div;
  return (
    <Tag
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={inViewport}
      transition={{ duration: 0.8, ease: easeOut, delay }}
    >
      {children}
    </Tag>
  );
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: easeOut } },
};

/** Children wrapped in StaggerItem enter one after another. `onMount` animates without waiting for scroll. */
export function Stagger({
  children,
  className,
  as = "div",
  delay = 0,
  step = 0.07,
  onMount = false,
  ...rest
}: {
  children: ReactNode;
  className?: string;
  as?: BlockTag;
  delay?: number;
  step?: number;
  onMount?: boolean;
  "data-testid"?: string;
}) {
  const Tag = blockTags[as] as typeof motion.div;
  const variants: Variants = { hidden: {}, show: { transition: { delayChildren: stagger(step, { startDelay: delay }) } } };
  const trigger = onMount ? { animate: "show" } : { whileInView: "show", viewport: inViewport };
  return (
    <Tag className={className} variants={variants} initial="hidden" {...trigger} {...rest}>
      {children}
    </Tag>
  );
}

export function StaggerItem({
  children,
  className,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: BlockTag;
}) {
  const Tag = blockTags[as] as typeof motion.div;
  return (
    <Tag className={className} variants={itemVariants}>
      {children}
    </Tag>
  );
}

const textTags = { h1: motion.h1, h2: motion.h2, h3: motion.h3, p: motion.p, span: motion.span };

const wordVariants: Variants = {
  hidden: { y: "110%", opacity: 0 },
  show: { y: "0%", opacity: 1, transition: { duration: 0.9, ease: easeOut } },
};

const markVariants: Variants = {
  hidden: { scaleX: 0 },
  show: { scaleX: 1, transition: { duration: 0.7, ease: easeOut, delay: 0.35 } },
};

/**
 * Word-by-word masked reveal. Every word stays in the DOM as real text, so headings keep their
 * accessible name and copy-paste works. `highlight` marks a phrase with a safety-yellow bar.
 */
export function TextReveal({
  text,
  as = "span",
  className,
  delay = 0,
  step = 0.055,
  inView = false,
  highlight,
  id,
}: {
  text: string;
  as?: keyof typeof textTags;
  className?: string;
  delay?: number;
  step?: number;
  inView?: boolean;
  highlight?: string;
  id?: string;
}) {
  const Tag = textTags[as] as typeof motion.span;
  const words = text.split(" ");
  const marked = new Set<number>();
  if (highlight) {
    const target = highlight.split(" ");
    const start = words.findIndex((_, i) => target.every((t, j) => words[i + j] === t));
    if (start >= 0) target.forEach((_, j) => marked.add(start + j));
  }
  const variants: Variants = { hidden: {}, show: { transition: { delayChildren: stagger(step, { startDelay: delay }) } } };
  const trigger = inView ? { whileInView: "show", viewport: { once: true, amount: 0.4 } } : { animate: "show" };
  return (
    <Tag
      id={id}
      className={`${highlight ? "isolate" : ""} ${className ?? ""}`}
      variants={variants}
      initial="hidden"
      {...trigger}
    >
      {words.map((word, i) => {
        const mask = (
          <span className="reveal-mask">
            <motion.span className="inline-block" variants={wordVariants}>
              {word}
            </motion.span>
          </span>
        );
        return (
          <Fragment key={i}>
            {marked.has(i) ? (
              <span className="relative inline-block">
                {mask}
                <motion.span
                  aria-hidden="true"
                  variants={markVariants}
                  className={`absolute bottom-[0.16em] left-[-0.06em] -z-10 h-[0.34em] origin-left bg-signal ${
                    marked.has(i + 1) ? "right-[-0.34em]" : "right-[-0.06em]"
                  }`}
                />
              </span>
            ) : (
              mask
            )}
            {i < words.length - 1 ? " " : null}
          </Fragment>
        );
      })}
    </Tag>
  );
}

/** Counts up to a number (optionally ending in %), keeping its decimal places. Anything else renders as plain text. */
export function CountUp({
  value,
  className,
  onView = false,
  ...rest
}: {
  value: string | number;
  className?: string;
  onView?: boolean;
  "data-testid"?: string;
}) {
  const text = String(value);
  const match = /^(\d+)(?:\.(\d+))?(%?)$/.exec(text);
  if (!match) {
    return (
      <span className={className} {...rest}>
        {text}
      </span>
    );
  }
  const decimals = match[2]?.length ?? 0;
  return (
    <AnimatedNumber
      to={Number(text.replace("%", ""))}
      decimals={decimals}
      suffix={match[3]}
      className={className}
      onView={onView}
      {...rest}
    />
  );
}

function AnimatedNumber({
  to,
  decimals,
  suffix,
  className,
  onView,
  ...rest
}: {
  to: number;
  decimals: number;
  suffix: string;
  className?: string;
  onView: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const seen = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const count = useMotionValue(0);
  const display = useTransform(() => `${count.get().toFixed(decimals)}${suffix}`);
  const go = !onView || seen;

  useEffect(() => {
    if (!go) return;
    if (reduce) {
      count.set(to);
      return;
    }
    const controls = animate(count, to, { duration: 1.2, ease: easeOut });
    return () => controls.stop();
  }, [go, to, reduce, count]);

  return (
    <motion.span ref={ref} className={className} {...rest}>
      {display}
    </motion.span>
  );
}

/** Moves its child against the scroll for depth. Give it a size or position (e.g. "absolute inset-0"). */
export function Parallax({
  children,
  className = "relative",
  distance = 60,
}: {
  children: ReactNode;
  className?: string;
  distance?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const travel = reduce ? 0 : distance;
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [-travel, travel]);
  return (
    <div ref={ref} className={`overflow-hidden ${className}`}>
      <motion.div className="absolute inset-x-0" style={{ y, top: -travel, bottom: -travel }}>
        {children}
      </motion.div>
    </div>
  );
}

export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 220, damping: 34, restDelta: 0.001 });
  return (
    <motion.div
      aria-hidden="true"
      className="fixed inset-x-0 top-0 z-50 h-[3px] origin-left bg-signal"
      style={{ scaleX }}
    />
  );
}

/** Slow settle from a slight zoom: used for banner photos when a screen opens. */
export function SettleIn({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ scale: 1.08, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 1.4, ease: easeOut }}
    >
      {children}
    </motion.div>
  );
}

export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: easeOut }}
    >
      {children}
    </motion.div>
  );
}
