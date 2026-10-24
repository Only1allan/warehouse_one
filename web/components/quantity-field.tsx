"use client";

import { Icon } from "./icons";

export function QuantityField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}) {
  const current = value === "" ? null : Number(value);
  const step = (delta: number) => {
    const base = current ?? 0;
    onChange(String(Math.max(0, base + delta)));
  };
  const button =
    "grid size-14 shrink-0 place-items-center rounded-control border border-line-strong bg-surface text-xl font-semibold hover:bg-sunk disabled:opacity-45";
  return (
    <div className="flex items-center gap-2" role="group" aria-label={label}>
      <button
        type="button"
        className={button}
        onClick={() => step(-1)}
        disabled={disabled}
        aria-label={`Decrease ${label}`}
      >
        <span aria-hidden="true">−</span>
      </button>
      <input
        aria-label={label}
        inputMode="numeric"
        pattern="[0-9]*"
        value={value}
        disabled={disabled}
        placeholder="0"
        onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, ""))}
        className="h-14 w-24 rounded-control border border-line-strong bg-surface text-center text-lg font-semibold disabled:opacity-60"
      />
      <button
        type="button"
        className={button}
        onClick={() => step(1)}
        disabled={disabled}
        aria-label={`Increase ${label}`}
      >
        <Icon name="plus" size={22} />
      </button>
    </div>
  );
}
