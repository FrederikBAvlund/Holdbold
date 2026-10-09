import Link from "next/link";
import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import Icon, { type IconName } from "@/components/ui/Icon";

/* ---------- Card ---------- */

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-[1.375rem] border border-line bg-surface p-4 shadow-[var(--shadow-sm)] sm:p-5", className)}
      {...props}
    />
  );
}

/* ---------- Section ---------- */

export function Section({
  title,
  action,
  children,
  className
}: {
  title: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex items-end justify-between gap-3 px-1">
        <h2 className="font-display text-[1.375rem] font-bold uppercase leading-none tracking-wide text-ink">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function SectionLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-0.5 text-sm font-semibold text-moss hover:underline">
      {children}
      <Icon name="chevron-right" className="h-4 w-4" />
    </Link>
  );
}

/* ---------- PageHeader ---------- */

export function PageHeader({
  title,
  subtitle,
  action,
  className
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex items-end justify-between gap-3 px-1 pt-1", className)}>
      <div className="min-w-0">
        <h1 className="font-display text-[2.25rem] font-extrabold uppercase leading-[0.95] tracking-tight text-ink sm:text-5xl">
          {title}
        </h1>
        {subtitle ? <p className="mt-1.5 text-[0.9375rem] text-ink/60">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}

/* ---------- Chip ---------- */

type ChipTone = "neutral" | "in" | "out" | "pending" | "match" | "training" | "primary" | "onHero";

const chipTones: Record<ChipTone, string> = {
  neutral: "bg-ink/[0.07] text-ink/75",
  in: "bg-in/15 text-in",
  out: "bg-out/15 text-out",
  pending: "bg-pending/15 text-pending",
  match: "bg-kind-match text-on-primary",
  training: "bg-kind-training/15 text-kind-training",
  primary: "bg-primary/12 text-moss",
  onHero: "bg-on-primary/15 text-on-primary"
};

export function Chip({
  tone = "neutral",
  icon,
  children,
  className
}: {
  tone?: ChipTone;
  icon?: IconName;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold leading-none",
        chipTones[tone],
        className
      )}
    >
      {icon ? <Icon name={icon} className="h-3.5 w-3.5" strokeWidth={2.2} /> : null}
      {children}
    </span>
  );
}

/** Store versaler – bruges til type-mærkning (KAMP / TRÆNING). */
export function KindTag({ kind, onHero }: { kind: string | null | undefined; onHero?: boolean }) {
  const isMatch = kind === "MATCH";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-display text-[0.8125rem] font-bold uppercase leading-5 tracking-[0.08em]",
        onHero
          ? "bg-on-primary/15 text-on-primary"
          : isMatch
            ? "bg-kind-match text-on-primary"
            : "bg-kind-training/15 text-kind-training"
      )}
    >
      <Icon name={isMatch ? "ball" : "whistle"} className="h-3.5 w-3.5" strokeWidth={2.2} />
      {isMatch ? "Kamp" : "Træning"}
    </span>
  );
}

/* ---------- Skeleton ---------- */

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded-xl bg-ink/[0.07]", className)}>
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.4s_infinite] bg-gradient-to-r from-transparent via-surface/60 to-transparent" />
    </div>
  );
}

/* ---------- EmptyState ---------- */

export function EmptyState({
  icon = "calendar",
  title,
  description,
  action,
  className
}: {
  icon?: IconName;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center rounded-[1.375rem] border border-dashed border-ink/15 px-6 py-8 text-center", className)}>
      <span className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/12 text-moss">
        <Icon name={icon} className="h-6 w-6" />
      </span>
      <p className="font-display text-xl font-bold uppercase text-ink">{title}</p>
      {description ? <p className="mt-1 max-w-xs text-sm text-ink/60">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

/* ---------- ListRow ---------- */

export function ListRow({
  leading,
  title,
  subtitle,
  trailing,
  href,
  onClick,
  chevron,
  className
}: {
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  href?: string;
  onClick?: () => void;
  chevron?: boolean;
  className?: string;
}) {
  const body = (
    <>
      {leading ? <span className="shrink-0">{leading}</span> : null}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-ink">{title}</span>
        {subtitle ? <span className="mt-0.5 block truncate text-sm text-ink/55">{subtitle}</span> : null}
      </span>
      {trailing ? <span className="shrink-0">{trailing}</span> : null}
      {chevron ? <Icon name="chevron-right" className="h-4 w-4 text-ink/35" /> : null}
    </>
  );
  const base = cn(
    "flex min-h-[3.5rem] w-full items-center gap-3 px-4 py-2.5 text-left",
    (href || onClick) && "transition hover:bg-ink/[0.03] active:bg-ink/[0.06]",
    className
  );
  if (href) {
    return (
      <Link href={href} className={base}>
        {body}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={base}>
        {body}
      </button>
    );
  }
  return <div className={base}>{body}</div>;
}

export function ListGroup({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("divide-y divide-line overflow-hidden rounded-[1.375rem] border border-line bg-surface", className)}>
      {children}
    </div>
  );
}

/* ---------- SegmentedControl ---------- */

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  className,
  size = "md"
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: ReactNode; count?: number }>;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div role="tablist" className={cn("flex rounded-2xl bg-ink/[0.06] p-1", className)}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 font-semibold transition",
              size === "sm" ? "min-h-9 text-sm" : "min-h-10 text-[0.9375rem]",
              active ? "bg-surface text-ink shadow-[var(--shadow-sm)]" : "text-ink/60 hover:text-ink"
            )}
          >
            {option.label}
            {typeof option.count === "number" ? (
              <span className={cn("tabular text-xs", active ? "text-ink/60" : "text-ink/40")}>{option.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- FilterChips ---------- */

export function FilterChips<T extends string>({
  value,
  onChange,
  options
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string; count?: number; icon?: IconName; countTone?: "pending" | "neutral" }>;
}) {
  return (
    <div className="no-scrollbar -mx-3 flex gap-2 overflow-x-auto px-3 py-1 sm:-mx-1 sm:px-1">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-2xl px-3.5 text-[0.9375rem] font-semibold transition duration-200 active:scale-95",
              active
                ? "bg-primary/12 text-moss shadow-[inset_0_0_0_1.5px_var(--moss)]"
                : "bg-surface text-ink/70 shadow-[var(--shadow-sm)] hover:text-ink"
            )}
          >
            {option.icon ? <Icon name={option.icon} className="h-4 w-4" strokeWidth={2.1} /> : null}
            {option.label}
            {typeof option.count === "number" && option.count > 0 ? (
              <span
                className={cn(
                  "tabular inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold",
                  option.countTone === "pending" ? "bg-pending text-on-solid" : active ? "bg-moss/15" : "bg-ink/[0.07]"
                )}
              >
                {option.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Field ---------- */

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor
}: {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-semibold text-ink/80">
        {label}
      </label>
      {children}
      {error ? <p className="text-sm font-medium text-danger">{error}</p> : hint ? <p className="text-xs text-ink/55">{hint}</p> : null}
    </div>
  );
}

export const inputClass =
  "w-full min-h-12 rounded-2xl border border-line bg-surface-2 px-4 text-base text-ink placeholder:text-ink/40 transition focus:border-moss focus:bg-surface focus:outline-none focus:ring-4 focus:ring-moss/15";

/* ---------- Stepper ---------- */

export function Stepper({
  value,
  onChange,
  min = 0,
  max = 99,
  label,
  size = "md",
  disabled,
  canIncrement = true
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  label?: string;
  size?: "sm" | "md";
  disabled?: boolean;
  canIncrement?: boolean;
}) {
  const btn = cn(
    "inline-flex items-center justify-center rounded-full bg-ink/[0.07] font-bold text-ink transition active:scale-90 disabled:opacity-30",
    size === "sm" ? "h-9 w-9" : "h-11 w-11"
  );
  return (
    <div className="inline-flex items-center gap-1.5" role="group" aria-label={label}>
      <button
        type="button"
        className={btn}
        aria-label={label ? `${label}: én mindre` : "Én mindre"}
        disabled={disabled || value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        <span aria-hidden className="text-lg leading-none">−</span>
      </button>
      <span
        className={cn(
          "tabular text-center font-display font-bold text-ink",
          size === "sm" ? "w-6 text-xl" : "w-9 text-3xl"
        )}
        aria-live="polite"
      >
        {value}
      </span>
      <button
        type="button"
        className={btn}
        aria-label={label ? `${label}: én mere` : "Én mere"}
        disabled={disabled || value >= max || !canIncrement}
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        <Icon name="plus" className="h-4 w-4" strokeWidth={2.6} />
      </button>
    </div>
  );
}
