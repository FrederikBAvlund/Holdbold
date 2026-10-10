"use client";

import { cn } from "@/lib/utils";

/** Til/fra-kontakt. Brug label (skjult) hvis rækken ikke selv har tekst. */
export default function Switch({
  checked,
  onChange,
  disabled,
  busy,
  label
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  busy?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled || busy}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors duration-200 disabled:opacity-50",
        checked ? "bg-primary" : "bg-ink/20"
      )}
    >
      <span
        className={cn(
          "inline-flex h-6 w-6 items-center justify-center rounded-full bg-white shadow transition-transform duration-200",
          checked ? "translate-x-[1.75rem]" : "translate-x-1"
        )}
      >
        {busy ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-ink/30 border-t-ink" /> : null}
      </span>
    </button>
  );
}
