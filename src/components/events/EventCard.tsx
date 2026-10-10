"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import Icon from "@/components/ui/Icon";
import { Chip, KindTag } from "@/components/ui/primitives";
import RsvpControl from "@/components/events/RsvpControl";
import { formatDayLabel, formatMonthShort, formatTime, formatWeekdayShort } from "@/lib/format";
import { eventHref, isPast, type CalendarEvent, type SignupStatus } from "@/lib/events/client";

export function StatusChip({ status }: { status: SignupStatus | null | undefined }) {
  if (status === "IN") return <Chip tone="in" icon="check">Du kommer</Chip>;
  if (status === "OUT") return <Chip tone="out" icon="x">Afbud</Chip>;
  return <Chip tone="pending" icon="hourglass">Mangler svar</Chip>;
}

export function DateBlock({ date, highlight }: { date: string; highlight?: boolean }) {
  return (
    <div
      className={cn(
        "flex w-[3.25rem] shrink-0 flex-col items-center justify-center rounded-2xl py-1.5 leading-none",
        highlight ? "bg-primary text-on-primary" : "bg-ink/[0.06] text-ink"
      )}
    >
      <span className={cn("text-[0.6875rem] font-semibold uppercase", highlight ? "text-on-primary/80" : "text-ink/55")}>
        {formatWeekdayShort(date)}
      </span>
      <span className="tabular font-display text-[1.75rem] font-bold leading-[1.05]">{new Date(date).getDate()}</span>
      <span className={cn("text-[0.6875rem] font-semibold uppercase", highlight ? "text-on-primary/80" : "text-ink/55")}>
        {formatMonthShort(date)}
      </span>
    </div>
  );
}

export default function EventCard({
  event,
  teamId,
  userId,
  onStatusChange,
  showDayLabel
}: {
  event: CalendarEvent;
  teamId: string;
  userId: string;
  onStatusChange?: (eventId: string, status: SignupStatus, realId: string) => void;
  showDayLabel?: boolean;
}) {
  const canceled = Boolean(event.canceledAt);
  const past = isPast(event);
  const status = event.signupStatus ?? null;
  const needsAnswer = !canceled && !past && status !== "IN" && status !== "OUT";
  // Hurtig-svar kun for de nærmeste to uger – resten viser blot "Mangler svar", så listen ikke drukner i knapper.
  const showQuickAnswer = needsAnswer && new Date(event.date).getTime() - Date.now() < 14 * 86_400_000;
  const isToday = new Date(event.date).toDateString() === new Date().toDateString();
  const hasScore = event.kind === "MATCH" && typeof event.matchHomeGoals === "number" && typeof event.matchAwayGoals === "number";

  return (
    <article
      data-guide="event-card"
      className={cn(
        "relative rounded-[1.375rem] border border-line bg-surface p-3.5 shadow-[var(--shadow-sm)] transition hover:border-ink/20",
        canceled && "opacity-70"
      )}
    >
      <Link href={eventHref(event.id)} className="absolute inset-0 rounded-[1.375rem]" aria-label={`Åbn ${event.title}`} />
      <div className="pointer-events-none relative flex gap-3">
        <DateBlock date={event.date} highlight={isToday && !canceled} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <KindTag kind={event.kind} />
            <span className="tabular text-sm font-semibold text-ink/70">
              {showDayLabel ? `${formatDayLabel(event.date)} · ` : ""}
              {formatTime(event.date)}
            </span>
            {canceled ? <Chip tone="out">Aflyst</Chip> : null}
          </div>
          <h3
            className={cn(
              "mt-1 truncate font-display text-xl font-bold uppercase leading-tight text-ink",
              canceled && "line-through decoration-2"
            )}
          >
            {event.title}
          </h3>
          {event.location ? (
            <p className="mt-0.5 flex items-center gap-1 truncate text-sm text-ink/55">
              <Icon name="map-pin" className="h-3.5 w-3.5" />
              <span className="truncate">{event.location}</span>
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-end justify-between gap-2">
          {hasScore ? (
            <span className="tabular font-display text-2xl font-bold text-ink">
              {event.matchHomeGoals}–{event.matchAwayGoals}
            </span>
          ) : !canceled && !past && !showQuickAnswer ? (
            <StatusChip status={status} />
          ) : null}
          <Icon name="chevron-right" className="h-4 w-4 text-ink/30" />
        </div>
      </div>
      {showQuickAnswer ? (
        <div className="relative z-10 mt-3 border-t border-line pt-3">
          <RsvpControl
            variant="compact"
            teamId={teamId}
            userId={userId}
            event={event}
            status={status}
            onSaved={({ status: next, eventId }) => onStatusChange?.(event.id, next, eventId)}
          />
        </div>
      ) : null}
    </article>
  );
}
