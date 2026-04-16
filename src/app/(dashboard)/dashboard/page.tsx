"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CollapsibleCard } from "@/components/CollapsibleCard";
import { useDashboardTeam } from "@/components/DashboardTeamProvider";
import {
  LEADERBOARD_CATEGORIES,
  LEADERBOARD_CATEGORY_LABELS_DA,
  type LeaderboardCategory,
  type LeaderboardRow,
  type LeaderboardTop
} from "@/lib/leaderboardsShared";

type CalendarEvent = {
  id: string;
  title: string;
  date: string;
  location: string;
  source?: string;
  seriesId?: string | null;
  kind?: string | null;
  meetingTime?: string | null;
  signupDeadline?: string | null;
  signupStatus?: string | null;
};

type Occurrence = {
  id: string;
  title: string;
  date: string;
  location: string;
  seriesId: string;
  kind?: string | null;
};

type FineItem = { amount: number };

type DashboardSnapshot = {
  nextEvents: CalendarEvent[];
  eventCounts: Record<string, { in: number; out: number; missing: number }>;
  memberCount: number;
  totalFines: number;
  leaderboardSummary: Record<LeaderboardCategory, LeaderboardTop | null> | null;
  updatedAt: number;
};

const dashboardCache = new Map<string, DashboardSnapshot>();
const DASHBOARD_CACHE_TTL_MS = 60_000;

const DASHBOARD_CARDS_STORAGE_KEY = "holdbold:dashboard";

function formatLeaderboardMetric(category: LeaderboardCategory, value: number): string {
  if (category === "fines") return `${value} kr`;
  return String(value);
}

export default function DashboardHome() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const { teamId, userId, members } = useDashboardTeam();
  const memberCount = members.length;
  const [nextEvents, setNextEvents] = useState<CalendarEvent[]>([]);
  const [eventCounts, setEventCounts] = useState<Record<string, { in: number; out: number; missing: number }>>({});
  const [totalFines, setTotalFines] = useState(0);
  const [leaderboardSummary, setLeaderboardSummary] = useState<Record<
    LeaderboardCategory,
    LeaderboardTop | null
  > | null>(null);
  const [loadingNextEvents, setLoadingNextEvents] = useState(true);
  const [loadingFines, setLoadingFines] = useState(true);
  const [loadingLeaderboards, setLoadingLeaderboards] = useState(true);
  const [collapseVersion, setCollapseVersion] = useState(0);
  const [detailCategory, setDetailCategory] = useState<LeaderboardCategory | null>(null);
  const [detailRows, setDetailRows] = useState<LeaderboardRow[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const hasHydratedCacheRef = useRef<string | null>(null);
  const skipNextCacheWriteRef = useRef(false);
  const storagePrefix = `${DASHBOARD_CARDS_STORAGE_KEY}:${teamId}:${userId ?? "anon"}`;
  const collapseAllCards = () => {
    if (typeof window === "undefined") return;
    const keys = ["welcome", "nextEvents", "fines", "leaderboards"];
    keys.forEach((key) => window.localStorage.setItem(`${storagePrefix}:${key}`, "0"));
    setCollapseVersion((prev) => prev + 1);
  };
  const expandAllCards = () => {
    if (typeof window === "undefined") return;
    const keys = ["welcome", "nextEvents", "fines", "leaderboards"];
    keys.forEach((key) => window.localStorage.setItem(`${storagePrefix}:${key}`, "1"));
    setCollapseVersion((prev) => prev + 1);
  };

  useEffect(() => {
    if (!teamId || !userId) return;
    const key = `${teamId}:${userId}`;
    if (hasHydratedCacheRef.current === key) return;
    hasHydratedCacheRef.current = key;

    const cached = dashboardCache.get(key);
    if (!cached) return;
    if (!("leaderboardSummary" in cached)) {
      dashboardCache.delete(key);
      return;
    }

    skipNextCacheWriteRef.current = true;
    setNextEvents(cached.nextEvents);
    setEventCounts(cached.eventCounts);
    setTotalFines(cached.totalFines);
    setLeaderboardSummary(cached.leaderboardSummary ?? null);
    setLoadingNextEvents(false);
    setLoadingFines(false);
    setLoadingLeaderboards(false);
  }, [teamId, userId]);

  useEffect(() => {
    async function loadNextEvents() {
      if (!teamId || !userId) return;
      const key = `${teamId}:${userId}`;
      const cached = dashboardCache.get(key);
      const isFresh = cached && Date.now() - cached.updatedAt < DASHBOARD_CACHE_TTL_MS;
      if (isFresh) return;
      setLoadingNextEvents(!cached);

      try {
        const now = new Date();
        const end = new Date(now);
        end.setDate(end.getDate() + 90);

        const response = await fetch(
          `/api/calendar?teamId=${teamId}&start=${now.toISOString()}&end=${end.toISOString()}&userId=${userId}`
        );
        if (!response.ok) return;
        const data = await response.json();
        const events: CalendarEvent[] = (data.events ?? []).map((event: CalendarEvent) => ({
          ...event,
          date: typeof event.date === "string" ? event.date : new Date(event.date).toISOString()
        }));
        const occurrences: Occurrence[] = (data.occurrences ?? []).map((occ: Occurrence) => ({
          ...occ,
          date: typeof occ.date === "string" ? occ.date : new Date(occ.date).toISOString()
        }));
        const upcoming = [
          ...events.map((item) => ({ ...item })),
          ...occurrences.map((item) => ({
            id: item.id,
            title: item.title,
            date: item.date,
            location: item.location,
            source: "SERIES",
            seriesId: item.seriesId,
            kind: item.kind ?? "TRAINING",
            meetingTime: null,
            signupDeadline: null,
            signupStatus: null
          }))
        ]
          .filter((item) => new Date(item.date) >= now)
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        const firstTwo = upcoming.slice(0, 2);
        setNextEvents(firstTwo);

        if (firstTwo.length === 0) {
          setEventCounts({});
          return;
        }

        const membersResponse = await fetch(`/api/team-members?teamId=${teamId}`);
        const membersData = membersResponse.ok ? await membersResponse.json() : { members: [] };
        const membersLen = (membersData.members ?? []).length;

        const nextCounts: Record<string, { in: number; out: number; missing: number }> = {};
        await Promise.all(
          firstTwo.map(async (eventItem) => {
            if (eventItem.id.startsWith("series:")) {
              nextCounts[eventItem.id] = { in: 0, out: 0, missing: membersLen };
              return;
            }
            const signupsResponse = await fetch(`/api/events/${eventItem.id}/signups`, { cache: "no-store" });
            if (!signupsResponse.ok) {
              nextCounts[eventItem.id] = { in: 0, out: 0, missing: membersLen };
              return;
            }
            const signupsData = await signupsResponse.json();
            const signups = signupsData.signups ?? [];
            const inCount = signups.filter((signup: { status: string }) => signup.status === "IN").length;
            const outCount = signups.filter((signup: { status: string }) => signup.status === "OUT").length;
            const missingCount = Math.max(membersLen - inCount - outCount, 0);
            nextCounts[eventItem.id] = { in: inCount, out: outCount, missing: missingCount };
          })
        );
        setEventCounts(nextCounts);
      } finally {
        setLoadingNextEvents(false);
      }
    }

    loadNextEvents();
  }, [teamId, userId]);

  useEffect(() => {
    if (memberCount <= 0) return;
    setEventCounts((prev) => {
      let changed = false;
      const next: Record<string, { in: number; out: number; missing: number }> = {};
      for (const [eventId, counts] of Object.entries(prev)) {
        const missing = Math.max(memberCount - counts.in - counts.out, 0);
        if (missing !== counts.missing) changed = true;
        next[eventId] = { ...counts, missing };
      }
      return changed ? next : prev;
    });
  }, [memberCount]);

  useEffect(() => {
    async function loadFines() {
      if (!teamId || !userId) return;
      const key = `${teamId}:${userId}`;
      const cached = dashboardCache.get(key);
      const isFresh = cached && Date.now() - cached.updatedAt < DASHBOARD_CACHE_TTL_MS;
      if (isFresh) return;
      setLoadingFines(!cached);
      try {
        const response = await fetch(`/api/fines?teamId=${teamId}&userId=${userId}`);
        const data = await response.json();
        const list: FineItem[] = data.fines ?? [];
        setTotalFines(list.reduce((sum, fine) => sum + fine.amount, 0));
      } finally {
        setLoadingFines(false);
      }
    }

    loadFines();
  }, [teamId, userId]);

  useEffect(() => {
    async function loadLeaderboards() {
      if (!teamId) return;
      const key = `${teamId}:${userId ?? ""}`;
      const cached = dashboardCache.get(key);
      const isFresh = cached && Date.now() - cached.updatedAt < DASHBOARD_CACHE_TTL_MS;
      if (isFresh) return;
      setLoadingLeaderboards(!cached);
      try {
        const response = await fetch(`/api/teams/${teamId}/leaderboards`);
        if (!response.ok) {
          setLeaderboardSummary(null);
          return;
        }
        const data = await response.json();
        setLeaderboardSummary(data.summary ?? null);
      } finally {
        setLoadingLeaderboards(false);
      }
    }

    loadLeaderboards();
  }, [teamId, userId]);

  useEffect(() => {
    if (!teamId || !userId) return;
    if (loadingNextEvents || loadingFines || loadingLeaderboards) return;
    if (skipNextCacheWriteRef.current) {
      skipNextCacheWriteRef.current = false;
      return;
    }
    const key = `${teamId}:${userId}`;
    dashboardCache.set(key, {
      nextEvents,
      eventCounts,
      memberCount,
      totalFines,
      leaderboardSummary,
      updatedAt: Date.now()
    });
  }, [
    teamId,
    userId,
    nextEvents,
    eventCounts,
    memberCount,
    totalFines,
    leaderboardSummary,
    loadingNextEvents,
    loadingFines,
    loadingLeaderboards
  ]);

  const formatEventTimes = (eventItem: CalendarEvent) => {
    const startDate = new Date(eventItem.date);
    const meetingDate = eventItem.meetingTime
      ? new Date(eventItem.meetingTime)
      : null;
    const deadlineDate = eventItem.signupDeadline ? new Date(eventItem.signupDeadline) : null;
    const pad = (num: number) => String(num).padStart(2, "0");
    const fmt = (date: Date) =>
      `${pad(date.getHours())}:${pad(date.getMinutes())} ${pad(date.getDate())}.${pad(
        date.getMonth() + 1
      )}.${date.getFullYear()}`;

    return {
      start: fmt(startDate),
      meeting: meetingDate ? fmt(meetingDate) : null,
      deadline: deadlineDate ? fmt(deadlineDate) : "Ikke sat"
    };
  };

  const greetingName =
    session?.user?.name?.trim()?.split(" ")[0] ||
    (session?.user?.email ? session.user.email.split("@")[0] : "") ||
    "Dig";

  const openNextEvent = (eventItem: CalendarEvent) => {
    const params = new URLSearchParams();
    params.set("focusEvent", eventItem.id);
    params.set("focusTitle", eventItem.title);
    params.set("focusDate", eventItem.date);
    params.set("focusLocation", eventItem.location);
    if (eventItem.source) params.set("focusSource", eventItem.source);
    if (eventItem.seriesId) params.set("focusSeriesId", eventItem.seriesId);
    router.push(`/dashboard/kalender?${params.toString()}`);
  };

  async function openLeaderboardDetail(category: LeaderboardCategory) {
    if (!teamId) return;
    setDetailCategory(category);
    setDetailRows([]);
    setDetailLoading(true);
    try {
      const response = await fetch(`/api/teams/${teamId}/leaderboards?category=${encodeURIComponent(category)}`);
      const data = response.ok ? await response.json() : { rows: [] };
      setDetailRows(data.rows ?? []);
    } finally {
      setDetailLoading(false);
    }
  }

  function closeLeaderboardDetail() {
    setDetailCategory(null);
    setDetailRows([]);
  }

  if (sessionStatus === "loading") {
    return (
      <section className="space-y-6">
        <header className="card">
          <h2 className="font-display text-[1.65rem] font-semibold leading-tight text-ink sm:text-3xl">Indlæser…</h2>
        </header>
      </section>
    );
  }

  if (!session?.user?.id) {
    return (
      <section className="space-y-6">
        <header className="card">
          <h2 className="font-display text-[1.65rem] font-semibold leading-tight text-ink sm:text-3xl">Overblik</h2>
          <p className="mt-2 text-ink/70">Du skal være logget ind for at se overblikket.</p>
        </header>
      </section>
    );
  }

  if (!teamId) {
    return (
      <section className="space-y-6">
        <header className="card">
          <h2 className="text-2xl font-semibold text-ink">Velkommen tilbage</h2>
          <p className="mt-2 text-ink/70">Vælg aktivt hold i Indstillinger for at fortsætte.</p>
        </header>
      </section>
    );
  }

  return (
    <section className="space-y-6">

      <CollapsibleCard
        key={`welcome-${collapseVersion}`}
        title={`Velkommen tilbage, ${greetingName}!`}
        storageKey={`${storagePrefix}:welcome`}
      >
        <p className="text-ink/70">
          Her får du et hurtigt overblik. Brug menuen for kalender, bøder, notifikationer og indstillinger.
        </p>
      </CollapsibleCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <CollapsibleCard
          key={`nextEvents-${collapseVersion}`}
          title="Næste begivenheder"
          storageKey={`${storagePrefix}:nextEvents`}
        >
          {loadingNextEvents ? (
            <p className="text-sm text-ink/70">Indlæser begivenheder...</p>
          ) : nextEvents.length > 0 ? (
            <div className="space-y-3">
              {nextEvents.map((eventItem) => {
                const times = formatEventTimes(eventItem);
                const counts = eventCounts[eventItem.id] ?? { in: 0, out: 0, missing: memberCount };
                return (
                  <button
                    key={eventItem.id}
                    type="button"
                    onClick={() => openNextEvent(eventItem)}
                    className="w-full space-y-2 rounded-control border border-ink/10 bg-white p-4 text-left text-sm text-ink/70 shadow-sm transition hover:border-ink/14 hover:bg-white/88"
                  >
                    <div className="text-base font-semibold text-ink">{eventItem.title}</div>
                    <div className="grid gap-2 rounded-control border border-ink/10 bg-white/80 p-3">
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-ink/55">Start</span>
                        <span className="font-semibold text-ink">{times.start}</span>
                      </div>
                      {times.meeting ? (
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-ink/55">Mødetid</span>
                          <span className="font-semibold text-ink">{times.meeting}</span>
                        </div>
                      ) : null}
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-ink/55">Svarfrist</span>
                        <span className="font-semibold text-ink">{times.deadline}</span>
                      </div>
                    </div>
                    <div>{eventItem.location}</div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-ink/60">
                      <span className="rounded-full bg-green-100 px-3 py-1 text-green-700">Kommer: {counts.in}</span>
                      <span className="rounded-full bg-red-100 px-3 py-1 text-red-700">Kan ikke: {counts.out}</span>
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-700">
                        Mangler svar: {counts.missing}
                      </span>
                    </div>
                    {eventItem.signupStatus ? (
                      <div
                        className="pt-2 text-xs font-semibold uppercase tracking-[0.2em] text-ink/60"
                        style={{ color: eventItem.signupStatus === "IN" ? "green" : "red" }}
                      >
                        {eventItem.signupStatus === "IN" ? "Du kommer" : "Du kan ikke"}
                      </div>
                    ) : (
                      <div className="pt-2 text-xs font-bold uppercase tracking-[0.2em] text-amber-500">
                        Du mangler at svare
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-ink/70">Ingen begivenheder endnu.</p>
          )}
        </CollapsibleCard>

        <CollapsibleCard
          key={`fines-${collapseVersion}`}
          title="Mine bøder"
          description="Skylder i alt"
          titleClassName="text-base font-semibold leading-tight text-ink sm:text-lg"
          descriptionClassName="mt-0.5 text-xs text-ink/55"
          surface="card-soft"
          storageKey={`${storagePrefix}:fines`}
          headerEnd={
            <div className="shrink-0 rounded-2xl border border-ink/10 bg-white/90 px-5 py-3 font-semibold text-ink shadow-sm">
              {loadingFines ? "…" : `${totalFines} kr`}
            </div>
          }
        >
          <div>
            <Link href="/dashboard/boder" className="inline-flex items-center gap-2 text-teal-700 hover:underline">
              Se bøder <span aria-hidden>→</span>
            </Link>
          </div>
        </CollapsibleCard>
      </div>

      <CollapsibleCard
        key={`leaderboards-${collapseVersion}`}
        title="Leaderboards"
        storageKey={`${storagePrefix}:leaderboards`}
      >
        {loadingLeaderboards ? (
          <p className="text-sm text-ink/70">Indlæser leaderboard...</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {LEADERBOARD_CATEGORIES.map((category) => {
              const top = leaderboardSummary?.[category] ?? null;
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => openLeaderboardDetail(category)}
                  className="rounded-control border border-ink/10 bg-white p-3 text-left transition hover:border-ink/20"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink/55">
                    {LEADERBOARD_CATEGORY_LABELS_DA[category]}
                  </p>
                  {top ? (
                    <div className="mt-2">
                      <p className="font-semibold text-ink">{top.name}</p>
                      <p className="text-sm text-ink/70">
                        {formatLeaderboardMetric(category, top.value)}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-ink/70">Ingen data endnu</p>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </CollapsibleCard>

      {detailCategory ? (
        <div className="modal-backdrop" onClick={closeLeaderboardDetail}>
          <div className="modal-panel max-w-xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-lg font-semibold text-ink">
                {LEADERBOARD_CATEGORY_LABELS_DA[detailCategory]}
              </h3>
              <button type="button" className="btn-ghost" onClick={closeLeaderboardDetail}>
                Luk
              </button>
            </div>
            {detailLoading ? (
              <p className="mt-4 text-sm text-ink/70">Indlæser...</p>
            ) : detailRows.length > 0 ? (
              <div className="mt-4 space-y-2">
                {detailRows.map((row) => (
                  <div
                    key={`${row.userId}-${row.rank}`}
                    className="flex items-center justify-between rounded-control border border-ink/10 bg-white px-3 py-2"
                  >
                    <p className="font-medium text-ink">
                      {row.rank}. {row.name}
                    </p>
                    <p className="text-sm font-semibold text-ink/75">
                      {detailCategory ? formatLeaderboardMetric(detailCategory, row.value) : row.value}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-ink/70">Ingen data i denne kategori endnu.</p>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
