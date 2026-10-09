import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import Avatar from "@/components/ui/Avatar";
import { Chip } from "@/components/ui/primitives";
import Icon from "@/components/ui/Icon";
import { fineEventHref, fineStatusMeta } from "@/app/(dashboard)/dashboard/boder/boderUtils";

export function FineStatusChip({ status }: { status: string }) {
  const meta = fineStatusMeta(status);
  return <Chip tone={meta.tone}>{meta.label}</Chip>;
}

export function FineAmount({ amount, className }: { amount: number; className?: string }) {
  return (
    <span
      className={cn(
        "tabular whitespace-nowrap font-display text-2xl font-bold leading-none",
        amount < 0 ? "text-in" : "text-ink",
        className
      )}
    >
      {amount.toLocaleString("da-DK")} kr
    </span>
  );
}

/**
 * Én bøde: titel (må fylde flere linjer) og metadata til venstre,
 * beløb og status samlet til højre, så lange titler ikke skubber dem ned.
 */
export default function FineRow({
  title,
  description,
  meta,
  amount,
  status,
  person,
  event,
  actions,
  onClick,
  className
}: {
  title: string;
  description?: string | null;
  meta?: ReactNode;
  amount: number;
  status?: string;
  person?: { name: string | null; image?: string | null } | null;
  event?: { id: string; title: string; date: string } | null;
  actions?: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  const body = (
    <>
      {person ? <Avatar name={person.name} image={person.image} size="md" className="mt-0.5" /> : null}
      <div className="min-w-0 flex-1">
        {person ? <p className="truncate text-sm font-semibold text-ink/60">{person.name}</p> : null}
        <p className="font-semibold leading-snug text-ink [overflow-wrap:anywhere]">{title}</p>
        {description ? <p className="mt-0.5 text-sm text-ink/60">{description}</p> : null}
        {meta ? <div className="mt-1 text-sm text-ink/50">{meta}</div> : null}
        {event ? (
          <Link
            href={fineEventHref(event)}
            onClick={(e) => e.stopPropagation()}
            className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-moss hover:underline"
          >
            <Icon name="calendar" className="h-3.5 w-3.5" />
            {event.title} · {new Date(event.date).toLocaleDateString("da-DK", { day: "numeric", month: "short" })}
          </Link>
        ) : null}
        {actions ? <div className="mt-3 flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5 pl-2">
        <FineAmount amount={amount} />
        {status ? <FineStatusChip status={status} /> : null}
      </div>
    </>
  );
  const base = cn("flex items-start gap-3 px-4 py-3.5 text-left", className);
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cn(base, "w-full transition hover:bg-ink/[0.03] active:bg-ink/[0.05]")}>
        {body}
      </button>
    );
  }
  return <div className={base}>{body}</div>;
}
