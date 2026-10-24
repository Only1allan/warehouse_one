import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "./icons";

type ButtonVariant = "primary" | "secondary" | "quiet" | "danger";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-signal text-ink border border-ink/15 hover:bg-signal-press shadow-[0_1px_0_rgb(27_26_23/0.2)]",
  secondary: "bg-surface text-ink border border-line-strong hover:bg-sunk",
  quiet: "bg-transparent text-ink border border-transparent hover:bg-sunk",
  danger: "bg-bad text-white border border-bad hover:brightness-110",
};

export function Button({
  variant = "secondary",
  icon,
  children,
  className = "",
  ...props
}: {
  variant?: ButtonVariant;
  icon?: IconName;
  children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex min-h-14 items-center justify-center gap-2.5 rounded-control px-5 text-base font-semibold disabled:cursor-not-allowed disabled:opacity-45 ${variants[variant]} ${className}`}
    >
      {icon ? <Icon name={icon} size={22} /> : null}
      {children}
    </button>
  );
}

export type Status = "ok" | "warning" | "discrepancy" | "info";

const statusStyle: Record<Status, { className: string; icon: IconName; label: string }> = {
  ok: { className: "bg-ok-fill text-ok", icon: "check", label: "OK" },
  warning: { className: "bg-warn-fill text-warn", icon: "alert", label: "Check" },
  discrepancy: { className: "bg-bad-fill text-bad", icon: "alert", label: "Discrepancy" },
  info: { className: "bg-info-fill text-info", icon: "info", label: "Info" },
};

export function StatusPill({ status, label }: { status: Status; label?: string }) {
  const s = statusStyle[status];
  return (
    <span
      data-status={status}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${s.className}`}
    >
      <Icon name={s.icon} size={16} />
      {label ?? s.label}
    </span>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 pb-6">
      <div className="max-w-2xl">
        <h1 className="text-2xl font-semibold">{title}</h1>
        {description ? <p className="mt-1.5 text-soft">{description}</p> : null}
      </div>
      {actions}
    </div>
  );
}

export function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-panel border border-line bg-surface p-5 shadow-panel ${className}`}
    >
      {children}
    </section>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`skeleton ${className}`} />;
}
