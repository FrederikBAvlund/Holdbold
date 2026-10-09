"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { useDashboardTeam } from "@/components/DashboardTeamProvider";
import Icon, { type IconName } from "@/components/ui/Icon";
import Avatar, { AvatarStack } from "@/components/ui/Avatar";
import { Card, EmptyState, KindTag, Section, SectionLink, Skeleton } from "@/components/ui/primitives";
import EventCard from "@/components/events/EventCard";
import RsvpControl from "@/components/events/RsvpControl";
import {
  eventHref,
  fetchCalendarEvents,
  fetchEventSignups,
  isSeriesOccurrence,
  type CalendarEvent,
  type EventSignup,
  type SignupStatus
} from "@/lib/events/client";
import { firstName, formatCountdown, formatDayLabel, formatKr, formatTime } from "@/lib/format";
import { FINE_MANAGER_ROLES } from "@/lib/roleLabels";
import { LEADERBOARD_CATEGORIES, type LeaderboardCategory, type LeaderboardTop } from "@/lib/leaderboardsShared";
import { LEADERBOARD_SHORT } from "@/lib/leaderboardDisplay";

type Fine = { amount: number; status: string };

const LOOKAHEAD_DAYS = 60;

function greeting(now = new Date()) {
  const hour = now.getHours();
  if (hour < 5) return "God nat";
  if (hour < 10) return "Godmorgen";
  if (hour < 18) return "Hej";
  return "God aften";
}

export default function HomePage() {
  const { data: session } = useSession();
  const { teamId, userId, members, memberships, actingMember } = useDashboardTeam();
  const [events, setEvents] = useState<CalendarEvent[] | null>(null);
  const [nextSignups, setNextSignups] = useState<EventSignup[] | null>(null);
  const [fines, setFines] = useState<Fine[] | null>(null);
  const [leaderboards, setLeaderboards] = useState<Record<LeaderboardCategory, LeaderboardTop[]> | null>(null);
  const [pendingPayments, setPendingPayments] = useState(0);
  const [proposedFines, setProposedFines] = useState(0);

  const teamName = memberships.find((membership) => membership.team?.id === teamId)?.team?.name ?? "";
  const canManageFines = FINE_MANAGER_ROLES.includes(actingMember?.role ?? "");
  const isAdmin = actingMember?.role === "ADMIN";

  const loadEvents = useCallback(async () => {
    if (!teamId || !userId) return;
    const start = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const end = new Date(Date.now() + LOOKAHEAD_DAYS * 86_400_000);
    try {
      setEvents(await fetchCalendarEvents({ teamId, userId, start, end }));
    } catch {
      setEvents([]);
    }
  }, [teamId, userId]);

  useEffect(() => {
    setEvents(null);
    setFines(null);
    setLeaderboards(null);
    loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    if (!teamId || !userId) return;
    let alive = true;
    fetch(`/api/fines?teamId=${teamId}&userId=${userId}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => alive && setFines(data.fines ?? []))
      .catch(() => alive && setFines([]));
    fetch(`/api/teams/${teamId}/leaderboards`)
      .then((response) => (response.ok ? response.json() : { summary: null }))
      .then((data) => alive && setLeaderboards(data.summary ?? null))
      .catch(() => alive && setLeaderboards(null));
    return () => {
      alive = false;
    };
  }, [teamId, userId]);

  useEffect(() => {
    if (!teamId || !canManageFines) return;
    let alive = true;
    fetch(`/api/fines?teamId=${teamId}&status=FORESLAET`, { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => alive && setProposedFines((data.fines ?? []).length))
      .catch(() => undefined);
    if (isAdmin) {
      fetch(`/api/fines/payments/pending?teamId=${teamId}`, { cache: "no-store" })
        .then((response) => response.json())
        .then((data) => alive && setPendingPayments((data.payments ?? []).length))
        .catch(() => undefined);
    }
    return () => {
      alive = false;
    };
  }, [teamId, canManageFines, isAdmin]);

  // Aflyste begivenheder springes over som "næste".
  const upcoming = useMemo(
    () => (events ?? []).filter((event) => new Date(event.date).getTime() > Date.now() - 2 * 60 * 60 * 1000),
    [events]
  );
  const nextEvent = upcoming.find((event) => !event.canceledAt) ?? null;
  const laterEvents = upcoming.filter((event) => event.id !== nextEvent?.id).slice(0, 4);
  const unanswered = upcoming.filter(
    (event) =>
      !event.canceledAt &&
      event.id !== nextEvent?.id &&
      event.signupStatus !== "IN" &&
      event.signupStatus !== "OUT" &&
      new Date(event.date).getTime() < Date.now() + 14 * 86_400_000
  );

  useEffect(() => {
    if (!nextEvent || isSeriesOccurrence(nextEvent.id)) {
      setNextSignups(nextEvent ? [] : null);
      return;
    }
    let alive = true;
    fetchEventSignups(nextEvent.id)
      .then((signups) => alive && setNextSignups(signups))
      .catch(() => alive && setNextSignups([]));
    return () => {
      alive = false;
    };
  }, [nextEvent?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const debt = (fines ?? [])
    .filter((fine) => fine.status === "UNPAID" || fine.status === "PAID_PENDING")
    .reduce((sum, fine) => sum + fine.amount, 0);
  const unpaid = (fines ?? []).filter((fine) => fine.status === "UNPAID").reduce((sum, fine) => sum + fine.amount, 0);

  function handleStatusChange(originalId: string, status: SignupStatus, realId: string) {
    setEvents((prev) =>
      (prev ?? []).map((event) => (event.id === originalId ? { ...event, id: realId, signupStatus: status } : event))
    );
    if (originalId === nextEvent?.id) {
      fetchEventSignups(realId).then(setNextSignups).catch(() => undefined);
    }
  }

  const actionItems: Array<{ icon: IconName; title: string; subtitle: string; href: string; tone: string }> = [];
  if (unanswered.length > 0) {
    actionItems.push({
      icon: "hourglass",
      title: unanswered.length === 1 ? "1 begivenhed mangler dit svar" : `${unanswered.length} begivenheder mangler dit svar`,
      subtitle: `Næste: ${unanswered[0].title} · ${formatDayLabel(unanswered[0].date)}`,
      href: "/dashboard/kalender?filter=missing",
      tone: "bg-pending/15 text-pending"
    });
  }
  if (unpaid > 0) {
    actionItems.push({
      icon: "wallet",
      title: `Du skylder ${formatKr(unpaid)}`,
      subtitle: "Betal nemt med MobilePay",
      href: "/dashboard/boder",
      tone: "bg-out/12 text-out"
    });
  }
  if (canManageFines && proposedFines > 0) {
    actionItems.push({
      icon: "receipt",
      title: `${proposedFines} bødeforslag venter`,
      subtitle: "Godkend eller afvis",
      href: "/dashboard/boder",
      tone: "bg-primary/12 text-moss"
    });
  }
  if (isAdmin && pendingPayments > 0) {
    actionItems.push({
      icon: "check",
      title: `${pendingPayments} betalinger til godkendelse`,
      subtitle: "Spillere har markeret som betalt",
      href: "/dashboard/boder",
      tone: "bg-in/15 text-in"
    });
  }

  const name = firstName(session?.user?.name);

  return (
    <div className="space-y-7 pb-4">
      <header className="px-1 pt-2">
        <p className="text-sm font-semibold text-ink/55">{teamName || "Holdbold"}</p>
        <h1 className="font-display text-[2.5rem] font-extrabold uppercase leading-[0.95] tracking-tight text-ink">
          {greeting()}
          {name ? `, ${name}` : ""}
        </h1>
      </header>

      {/* Næste op */}
      <section aria-label="Næste begivenhed">
        {events === null ? (
          <Skeleton className="h-[19rem] rounded-[1.75rem]" />
        ) : nextEvent ? (
          <NextUpHero
            event={nextEvent}
            signups={nextSignups}
            members={members}
            teamId={teamId}
            userId={userId}
            onStatusChange={handleStatusChange}
          />
        ) : (
          <EmptyState
            icon="calendar"
            title="Intet i kalenderen"
            description="Der er ingen kampe eller træninger de næste 60 dage."
            action={
              <Link href="/dashboard/kalender" className="text-sm font-semibold text-moss">
                Gå til kalenderen
              </Link>
            }
          />
        )}
      </section>

      {actionItems.length > 0 ? (
        <Section title="Kræver handling">
          <div className="space-y-2">
            {actionItems.map((item) => (
              <Link
                key={item.title}
                href={item.href}
                className="flex min-h-[4rem] items-center gap-3 rounded-[1.375rem] border border-line bg-surface px-4 py-3 transition hover:border-ink/20 active:scale-[0.99]"
              >
                <span className={cn("inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", item.tone)}>
                  <Icon name={item.icon} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-ink">{item.title}</span>
                  <span className="block truncate text-sm text-ink/55">{item.subtitle}</span>
                </span>
                <Icon name="chevron-right" className="h-4 w-4 text-ink/35" />
              </Link>
            ))}
          </div>
        </Section>
      ) : null}

      <Section title="Kommende" action={<SectionLink href="/dashboard/kalender">Se alle</SectionLink>}>
        {events === null ? (
          <div className="space-y-2">
            <Skeleton className="h-24 rounded-[1.375rem]" />
            <Skeleton className="h-24 rounded-[1.375rem]" />
          </div>
        ) : laterEvents.length === 0 ? (
          <p className="px-1 text-sm text-ink/55">Ikke mere planlagt lige nu.</p>
        ) : (
          <div className="space-y-2">
            {laterEvents.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                teamId={teamId}
                userId={userId}
                onStatusChange={handleStatusChange}
              />
            ))}
          </div>
        )}
      </Section>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/dashboard/boder" className="group">
          <Card className="flex h-full items-center gap-4 transition group-hover:border-ink/20">
            <span
              className={cn(
                "inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl",
                debt > 0 ? "bg-out/12 text-out" : "bg-in/15 text-in"
              )}
            >
              <Icon name="receipt" className="h-6 w-6" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-ink/55">Din bødesaldo</span>
              {fines === null ? (
                <Skeleton className="mt-1 h-8 w-24" />
              ) : (
                <span className="tabular block font-display text-[2rem] font-bold leading-none text-ink">
                  {formatKr(debt)}
                </span>
              )}
            </span>
            <Icon name="chevron-right" className="h-4 w-4 text-ink/35" />
          </Card>
        </Link>
      </div>

      <Section title="Holdets rekorder" action={<SectionLink href="/dashboard/hold">Alle</SectionLink>}>
        <LeaderboardStrip summary={leaderboards} loading={leaderboards === null && fines === null} userId={userId} />
      </Section>
    </div>
  );
}

function NextUpHero({
  event,
  signups,
  members,
  teamId,
  userId,
  onStatusChange
}: {
  event: CalendarEvent;
  signups: EventSignup[] | null;
  members: ReturnType<typeof useDashboardTeam>["members"];
  teamId: string;
  userId: string;
  onStatusChange: (originalId: string, status: SignupStatus, realId: string) => void;
}) {
  const coming = (signups ?? []).filter((signup) => signup.status === "IN");
  const memberById = new Map(members.map((member) => [member.user.id, member.user]));
  const people = coming.map((signup) => ({
    id: signup.userId,
    name: signup.user?.name ?? memberById.get(signup.userId)?.name ?? null,
    image: signup.user?.image ?? memberById.get(signup.userId)?.image ?? null
  }));
  const duties: string[] = [];
  if (event.beerCarrierId === userId) duties.push("Du har øl med 🍺");
  if (event.thingCarrierId === userId) duties.push("Du har tingene med 🎒");
  const isMatch = event.kind === "MATCH";

  return (
    <div className="hero-surface rounded-[1.75rem] p-5 shadow-[0_24px_48px_-24px_var(--primary)]">
      <div className="flex items-center justify-between gap-2">
        <span className="font-display text-sm font-bold uppercase tracking-[0.14em] text-on-primary/75">Næste op</span>
        <KindTag kind={event.kind} onHero />
      </div>

      <Link href={eventHref(event.id)} className="mt-3 block">
        <h2 className="font-display text-[2.375rem] font-extrabold uppercase leading-[0.95] tracking-tight">
          {event.title}
        </h2>
        <div className="mt-3 flex flex-wrap items-end gap-x-5 gap-y-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-on-primary/70">{formatDayLabel(event.date)}</p>
            <p className="tabular font-display text-[2.75rem] font-bold leading-none">{formatTime(event.date)}</p>
          </div>
          <div className="pb-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-on-primary/70">Starter</p>
            <p className="font-display text-2xl font-bold leading-none">{formatCountdown(event.date)}</p>
          </div>
        </div>
        <div className="mt-3 space-y-1 text-sm text-on-primary/85">
          {event.location ? (
            <p className="flex items-center gap-1.5">
              <Icon name="map-pin" className="h-4 w-4" />
              <span className="truncate">{event.location}</span>
            </p>
          ) : null}
          {isMatch && event.meetingTime ? (
            <p className="flex items-center gap-1.5">
              <Icon name="clock" className="h-4 w-4" />
              Mødetid {formatTime(event.meetingTime)}
            </p>
          ) : null}
          {event.signupDeadline ? (
            <p className="flex items-center gap-1.5">
              <Icon name="hourglass" className="h-4 w-4" />
              Svar senest {formatDayLabel(event.signupDeadline).toLowerCase()} kl. {formatTime(event.signupDeadline)}
            </p>
          ) : null}
        </div>
      </Link>

      {duties.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {duties.map((duty) => (
            <span key={duty} className="rounded-full bg-on-primary/15 px-3 py-1 text-sm font-semibold">
              {duty}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-on-primary/15 pt-4">
        {signups === null ? (
          <span className="h-8 w-28 animate-pulse rounded-full bg-on-primary/15" />
        ) : people.length > 0 ? (
          <span className="flex items-center gap-2.5">
            <AvatarStack people={people} max={5} size="sm" ringClass="ring-[color:var(--primary)]" />
            <span className="text-sm font-semibold">{people.length} kommer</span>
          </span>
        ) : (
          <span className="text-sm font-semibold text-on-primary/80">Vær den første til at melde til</span>
        )}
        <Link
          href={eventHref(event.id)}
          className="inline-flex items-center gap-1 text-sm font-semibold text-on-primary/90 hover:text-on-primary"
        >
          Detaljer
          <Icon name="chevron-right" className="h-4 w-4" />
        </Link>
      </div>

      <RsvpControl
        className="mt-4"
        variant="hero"
        teamId={teamId}
        userId={userId}
        event={event}
        status={event.signupStatus}
        onSaved={({ status, eventId }) => onStatusChange(event.id, status, eventId)}
      />
    </div>
  );
}

function LeaderboardStrip({
  summary,
  loading,
  userId
}: {
  summary: Record<LeaderboardCategory, LeaderboardTop[]> | null;
  loading: boolean;
  userId: string;
}) {
  if (loading) {
    return (
      <div className="flex gap-3 overflow-hidden">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-36 w-40 shrink-0 rounded-[1.375rem]" />
        ))}
      </div>
    );
  }
  const cards = LEADERBOARD_CATEGORIES.map((category) => ({ category, top: summary?.[category] ?? [] })).filter(
    (item) => item.top.length > 0 && item.top[0].value > 0
  );
  if (cards.length === 0) {
    return <p className="px-1 text-sm text-ink/55">Rekorderne dukker op, når sæsonen er i gang.</p>;
  }
  return (
    <div className="no-scrollbar -mx-3 flex snap-x gap-3 overflow-x-auto px-3 pb-1 sm:mx-0 sm:px-0">
      {cards.map(({ category, top }) => {
        const meta = LEADERBOARD_SHORT[category];
        const leader = top[0];
        const isMe = top.some((row) => row.userId === userId);
        return (
          <Link
            key={category}
            href="/dashboard/hold#rekorder"
            className={cn(
              "flex w-40 shrink-0 snap-start flex-col rounded-[1.375rem] border bg-surface p-3.5 transition active:scale-[0.98]",
              isMe ? "border-moss ring-1 ring-moss" : "border-line"
            )}
          >
            <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink/55">
              <Icon name={meta.icon} className="h-3.5 w-3.5" />
              {meta.label}
            </span>
            <span className="mt-3 flex items-center gap-2">
              <Avatar name={leader.name} image={leader.image} size="sm" />
              <span className="min-w-0 truncate text-sm font-semibold text-ink">
                {top.length > 1 ? `${firstName(leader.name)} +${top.length - 1}` : leader.name}
              </span>
            </span>
            <span className="mt-auto pt-3">
              <span className="tabular font-display text-[2rem] font-bold leading-none text-ink">{leader.value}</span>
              <span className="ml-1 text-sm font-semibold text-ink/50">{meta.unit}</span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}
