"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { useDashboardTeam } from "@/components/DashboardTeamProvider";
import Icon from "@/components/ui/Icon";
import { EmptyState, FilterChips, PageHeader, SegmentedControl, Skeleton } from "@/components/ui/primitives";
import EventCard from "@/components/events/EventCard";
import { eventHref, fetchCalendarEvents, type CalendarEvent, type SignupStatus } from "@/lib/events/client";
import { formatDayLabel, formatMonthYear } from "@/lib/format";
import { EVENT_MANAGER_ROLES } from "@/lib/roleLabels";

type Filter = "all" | "MATCH" | "TRAINING" | "missing";
type View = "list" | "month";

const VIEW_STORAGE_KEY = "calendarViewMode";
const AHEAD_DAYS = 180;

function needsAnswer(event: CalendarEvent) {
  return (
    !event.canceledAt &&
    new Date(event.date).getTime() > Date.now() &&
    event.signupStatus !== "IN" &&
    event.signupStatus !== "OUT"
  );
}

function applyFilter(events: CalendarEvent[], filter: Filter) {
  if (filter === "missing") return events.filter(needsAnswer);
  if (filter === "MATCH") return events.filter((event) => event.kind === "MATCH");
  if (filter === "TRAINING") return events.filter((event) => event.kind !== "MATCH");
  return events;
}

function monthKey(date: string | Date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${d.getMonth()}`;
}

export default function KalenderPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { teamId, userId, actingMember, seasonQuery } = useDashboardTeam();
  const canManage = EVENT_MANAGER_ROLES.includes(actingMember?.role ?? "");

  const [view, setView] = useState<View>("list");
  const [filter, setFilter] = useState<Filter>(() =>
    searchParams.get("filter") === "missing" ? "missing" : "all"
  );
  const [events, setEvents] = useState<CalendarEvent[] | null>(null);
  const [pastDays, setPastDays] = useState(0);

  // Gamle deep-links (?focusEvent=…) fra notifikationer og bøder sendes videre til begivenhedssiden.
  useEffect(() => {
    const focus = searchParams.get("focusEvent");
    if (focus) router.replace(eventHref(focus));
  }, [searchParams, router]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(VIEW_STORAGE_KEY);
      if (stored === "calendar" || stored === "month") setView("month");
    } catch {
      /* ignore */
    }
  }, []);

  function changeView(next: View) {
    setView(next);
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, next === "month" ? "calendar" : "list");
    } catch {
      /* ignore */
    }
  }

  const load = useCallback(async () => {
    if (!teamId || !userId) return;
    const start = new Date(Date.now() - (pastDays > 0 ? pastDays * 86_400_000 : 3 * 60 * 60 * 1000));
    const end = new Date(Date.now() + AHEAD_DAYS * 86_400_000);
    try {
      setEvents(await fetchCalendarEvents({ teamId, userId, start, end, seasonQuery }));
    } catch {
      setEvents([]);
    }
  }, [teamId, userId, pastDays, seasonQuery]);

  useEffect(() => {
    load();
  }, [load]);

  function handleStatusChange(originalId: string, status: SignupStatus, realId: string) {
    setEvents((prev) =>
      (prev ?? []).map((event) => (event.id === originalId ? { ...event, id: realId, signupStatus: status } : event))
    );
  }

  const list = useMemo(() => applyFilter(events ?? [], filter), [events, filter]);
  const counts = useMemo(() => {
    const all = events ?? [];
    return {
      missing: all.filter(needsAnswer).length,
      MATCH: all.filter((event) => event.kind === "MATCH").length,
      TRAINING: all.filter((event) => event.kind !== "MATCH").length
    };
  }, [events]);

  const grouped = useMemo(() => {
    const groups: Array<{ key: string; label: string; items: CalendarEvent[] }> = [];
    for (const event of list) {
      const key = monthKey(event.date);
      const last = groups[groups.length - 1];
      if (last && last.key === key) last.items.push(event);
      else groups.push({ key, label: formatMonthYear(event.date), items: [event] });
    }
    return groups;
  }, [list]);

  return (
    <div className="space-y-4 pb-24">
      <PageHeader
        title="Kalender"
        subtitle="Kampe, træning og alt derimellem."
        action={
          canManage ? (
            <Link
              href="/dashboard/kalender/ny"
              className="hidden min-h-11 items-center gap-2 rounded-2xl bg-primary px-4 font-semibold text-on-primary transition active:scale-95 sm:inline-flex"
            >
              <Icon name="plus" strokeWidth={2.4} />
              Ny begivenhed
            </Link>
          ) : null
        }
      />

      <SegmentedControl<View>
        value={view}
        onChange={changeView}
        options={[
          { value: "list", label: <><Icon name="list" className="h-4 w-4" /> Liste</> },
          { value: "month", label: <><Icon name="grid" className="h-4 w-4" /> Måned</> }
        ]}
      />

      {view === "list" ? (
        <>
          <FilterChips<Filter>
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "Alle" },
              { value: "missing", label: "Mangler svar", count: counts.missing },
              { value: "MATCH", label: "Kampe" },
              { value: "TRAINING", label: "Træning" }
            ]}
          />

          {pastDays === 0 ? (
            <button
              type="button"
              onClick={() => setPastDays(90)}
              className="mx-auto flex items-center gap-1 text-sm font-semibold text-ink/55 hover:text-ink"
            >
              <Icon name="chevron-down" className="h-4 w-4 rotate-180" />
              Vis tidligere
            </button>
          ) : null}

          {events === null ? (
            <div className="space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-28 rounded-[1.375rem]" />
              ))}
            </div>
          ) : list.length === 0 ? (
            <EmptyState
              icon={filter === "missing" ? "check" : "calendar"}
              title={filter === "missing" ? "Du har svaret på alt" : "Ingen begivenheder"}
              description={
                filter === "missing" ? "Godt gået – du er helt opdateret." : "Der er ikke noget planlagt endnu."
              }
            />
          ) : (
            <div className="space-y-5">
              {grouped.map((group) => (
                <section key={group.key} className="space-y-2">
                  <h2 className="sticky top-[3.6rem] z-10 -mx-3 bg-bg/90 px-4 py-1.5 font-display text-lg font-bold uppercase tracking-wide text-ink/70 backdrop-blur sm:-mx-5 sm:px-6 lg:top-0">
                    {group.label}
                  </h2>
                  {group.items.map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      teamId={teamId}
                      userId={userId}
                      onStatusChange={handleStatusChange}
                    />
                  ))}
                </section>
              ))}
            </div>
          )}
        </>
      ) : (
        <MonthView teamId={teamId} userId={userId} seasonQuery={seasonQuery} onStatusChange={handleStatusChange} />
      )}

      {canManage ? (
        <Link
          href="/dashboard/kalender/ny"
          aria-label="Ny begivenhed"
          className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] right-4 z-40 inline-flex h-14 items-center gap-2 rounded-full bg-primary px-5 font-semibold text-on-primary shadow-[var(--shadow-lg)] transition active:scale-95 sm:hidden"
        >
          <Icon name="plus" strokeWidth={2.6} />
          Ny
        </Link>
      ) : null}
    </div>
  );
}

const WEEKDAYS = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"];

function MonthView({
  teamId,
  userId,
  seasonQuery,
  onStatusChange
}: {
  teamId: string;
  userId: string;
  seasonQuery: string;
  onStatusChange: (originalId: string, status: SignupStatus, realId: string) => void;
}) {
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selected, setSelected] = useState(() => new Date().toDateString());
  const [events, setEvents] = useState<CalendarEvent[] | null>(null);

  useEffect(() => {
    if (!teamId || !userId) return;
    let alive = true;
    setEvents(null);
    const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    fetchCalendarEvents({ teamId, userId, start, end, seasonQuery })
      .then((data) => alive && setEvents(data))
      .catch(() => alive && setEvents([]));
    return () => {
      alive = false;
    };
  }, [cursor, teamId, userId, seasonQuery]);

  const days = useMemo(() => {
    const first = new Date(cursor);
    const offset = (first.getDay() + 6) % 7; // mandag først
    const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const cells: Array<Date | null> = Array.from({ length: offset }, () => null);
    for (let day = 1; day <= daysInMonth; day += 1) cells.push(new Date(cursor.getFullYear(), cursor.getMonth(), day));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [cursor]);

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events ?? []) {
      const key = new Date(event.date).toDateString();
      map.set(key, [...(map.get(key) ?? []), event]);
    }
    return map;
  }, [events]);

  const selectedEvents = byDay.get(selected) ?? [];
  const today = new Date().toDateString();

  function shift(delta: number) {
    setCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[1.375rem] border border-line bg-surface p-3 shadow-[var(--shadow-sm)]">
        <div className="mb-2 flex items-center justify-between">
          <button
            type="button"
            onClick={() => shift(-1)}
            aria-label="Forrige måned"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-ink/[0.06] active:scale-95"
          >
            <Icon name="chevron-left" />
          </button>
          <button
            type="button"
            onClick={() => {
              const now = new Date();
              setCursor(new Date(now.getFullYear(), now.getMonth(), 1));
              setSelected(now.toDateString());
            }}
            className="font-display text-xl font-bold uppercase tracking-wide text-ink"
          >
            {formatMonthYear(cursor)}
          </button>
          <button
            type="button"
            onClick={() => shift(1)}
            aria-label="Næste måned"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-ink/[0.06] active:scale-95"
          >
            <Icon name="chevron-right" />
          </button>
        </div>
        <div className="grid grid-cols-7 text-center text-[0.6875rem] font-semibold uppercase tracking-wide text-ink/45">
          {WEEKDAYS.map((day) => (
            <span key={day} className="py-1">
              {day}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {days.map((date, index) => {
            if (!date) return <span key={`empty-${index}`} />;
            const key = date.toDateString();
            const dayEvents = byDay.get(key) ?? [];
            const isSelected = key === selected;
            const isToday = key === today;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelected(key)}
                aria-pressed={isSelected}
                aria-label={`${formatDayLabel(date)}${dayEvents.length ? `, ${dayEvents.length} begivenheder` : ""}`}
                className={cn(
                  "flex aspect-square flex-col items-center justify-center gap-1 rounded-xl text-[0.9375rem] font-semibold transition active:scale-95",
                  isSelected ? "bg-ink text-bg" : isToday ? "bg-primary/12 text-moss" : "text-ink hover:bg-ink/[0.05]"
                )}
              >
                <span className="tabular leading-none">{date.getDate()}</span>
                <span className="flex h-1.5 gap-0.5">
                  {dayEvents.slice(0, 3).map((event) => (
                    <span
                      key={event.id}
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        event.canceledAt
                          ? "bg-ink/25"
                          : event.kind === "MATCH"
                            ? isSelected
                              ? "bg-bg"
                              : "bg-kind-match"
                            : isSelected
                              ? "bg-bg/60"
                              : "bg-kind-training"
                      )}
                    />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex items-center justify-center gap-4 text-xs text-ink/55">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-kind-match" /> Kamp
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-kind-training" /> Træning
          </span>
        </div>
      </div>

      <section className="space-y-2">
        <h2 className="px-1 font-display text-lg font-bold uppercase tracking-wide text-ink/70">
          {formatDayLabel(new Date(selected))}
        </h2>
        {events === null ? (
          <Skeleton className="h-28 rounded-[1.375rem]" />
        ) : selectedEvents.length === 0 ? (
          <p className="px-1 text-sm text-ink/55">Intet planlagt denne dag.</p>
        ) : (
          selectedEvents.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              teamId={teamId}
              userId={userId}
              onStatusChange={(originalId, status, realId) => {
                setEvents((prev) =>
                  (prev ?? []).map((item) =>
                    item.id === originalId ? { ...item, id: realId, signupStatus: status } : item
                  )
                );
                onStatusChange(originalId, status, realId);
              }}
            />
          ))
        )}
      </section>
    </div>
  );
}
