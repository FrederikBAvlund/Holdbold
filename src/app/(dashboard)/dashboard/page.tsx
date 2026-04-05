"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { getStoredTeamId, setStoredTeamId } from "@/components/appState";

type CalendarEvent = {
  id: string;
  title: string;
  date: string;
  location: string;
  source?: string;
  seriesId?: string | null;
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
};

type Member = {
  user: { id: string; name: string | null };
};

type FineItem = { amount: number };

export default function DashboardHome() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const [teamId, setTeamId] = useState("");
  const [userId, setUserId] = useState("");
  const [nextEvents, setNextEvents] = useState<CalendarEvent[]>([]);
  const [eventCounts, setEventCounts] = useState<Record<string, { in: number; out: number; missing: number }>>({});
  const [memberCount, setMemberCount] = useState(0);
  const [totalFines, setTotalFines] = useState(0);
  const defaultTeamLoadedForUserRef = useRef<string | null>(null);
  const loadedMembersKeyRef = useRef<string | null>(null);
  const loadedNextEventsKeyRef = useRef<string | null>(null);
  const loadedFinesKeyRef = useRef<string | null>(null);

  useEffect(() => {
    setTeamId(getStoredTeamId());
  }, []);

  useEffect(() => {
    if (session?.user?.id) setUserId(session.user.id);
  }, [session?.user?.id]);

  useEffect(() => {
    async function loadDefaultTeam() {
      const sessionUserId = session?.user?.id;
      if (!sessionUserId) {
        defaultTeamLoadedForUserRef.current = null;
        return;
      }
      if (defaultTeamLoadedForUserRef.current === sessionUserId) return;
      defaultTeamLoadedForUserRef.current = sessionUserId;

      const response = await fetch("/api/me");
      if (!response.ok) return;
      const data = await response.json();
      const memberships = data.memberships ?? [];
      const firstTeam = memberships[0]?.team?.id;
      if (!firstTeam) return;
      const currentTeamId = teamId || getStoredTeamId();
      const isCurrentValid = memberships.some(
        (membership: { team?: { id?: string } }) => membership.team?.id === currentTeamId
      );
      if (!currentTeamId || !isCurrentValid) {
        setTeamId(firstTeam);
        setStoredTeamId(firstTeam);
      }
    }

    loadDefaultTeam();
  }, [session?.user?.id, teamId]);

  useEffect(() => {
    async function loadMembers() {
      if (!teamId) return;
      if (loadedMembersKeyRef.current === teamId) return;
      loadedMembersKeyRef.current = teamId;
      const response = await fetch(`/api/team-members?teamId=${teamId}`);
      const data = await response.json();
      setMemberCount((data.members ?? []).length);
    }

    loadMembers();
  }, [teamId]);

  useEffect(() => {
    async function loadNextEvents() {
      if (!teamId || !userId) return;
      const key = `${teamId}:${userId}`;
      if (loadedNextEventsKeyRef.current === key) return;
      loadedNextEventsKeyRef.current = key;

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
        ...events.map((item) => ({ ...item, kind: "event" })),
        ...occurrences.map((item) => ({
          id: item.id,
          title: item.title,
          date: item.date,
          location: item.location,
          source: "SERIES",
          seriesId: item.seriesId,
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

      const nextCounts: Record<string, { in: number; out: number; missing: number }> = {};
      await Promise.all(
        firstTwo.map(async (eventItem) => {
          if (eventItem.id.startsWith("series:")) {
            nextCounts[eventItem.id] = { in: 0, out: 0, missing: memberCount };
            return;
          }
          const signupsResponse = await fetch(`/api/events/${eventItem.id}/signups`, { cache: "no-store" });
          if (!signupsResponse.ok) {
            nextCounts[eventItem.id] = { in: 0, out: 0, missing: memberCount };
            return;
          }
          const signupsData = await signupsResponse.json();
          const signups = signupsData.signups ?? [];
          const inCount = signups.filter((signup: { status: string }) => signup.status === "IN").length;
          const outCount = signups.filter((signup: { status: string }) => signup.status === "OUT").length;
          const missingCount = Math.max(memberCount - inCount - outCount, 0);
          nextCounts[eventItem.id] = { in: inCount, out: outCount, missing: missingCount };
        })
      );
      setEventCounts(nextCounts);
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
      if (loadedFinesKeyRef.current === key) return;
      loadedFinesKeyRef.current = key;
      const response = await fetch(`/api/fines?teamId=${teamId}&userId=${userId}`);
      const data = await response.json();
      const list: FineItem[] = data.fines ?? [];
      setTotalFines(list.reduce((sum, fine) => sum + fine.amount, 0));
    }

    loadFines();
  }, [teamId, userId]);

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

  if (sessionStatus === "loading") {
    return (
      <section className="space-y-6">
        <header className="card">
          <h2 className="text-2xl font-semibold text-ink">Velkommen tilbage</h2>
          <p className="mt-2 text-ink/70">Indlæser...</p>
        </header>
      </section>
    );
  }

  if (!session?.user?.id) {
    return (
      <section className="space-y-6">
        <header className="card">
          <h2 className="text-2xl font-semibold text-ink">Velkommen tilbage</h2>
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
      <header className="card">
        <h2 className="text-2xl font-semibold text-ink">Velkommen tilbage</h2>
        <p className="mt-2 text-ink/70">
          Her får du et hurtigt overblik. Brug menuen for kalender, bøder, notifikationer og indstillinger.
        </p>
      </header>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card-soft">
          <h3 className="text-lg font-semibold text-ink">Næste begivenheder</h3>
          {nextEvents.length > 0 ? (
            <div className="mt-3 space-y-12">
              {nextEvents.map((eventItem) => {
                const times = formatEventTimes(eventItem);
                const counts = eventCounts[eventItem.id] ?? { in: 0, out: 0, missing: memberCount };
                return (
                  <button
                    key={eventItem.id}
                    type="button"
                    onClick={() => openNextEvent(eventItem)}
                    className="w-full space-y-2 rounded-2xl border border-transparent text-left text-sm text-ink/70 transition hover:border-ink/15 hover:bg-white/60"
                  >
                    <div className="text-base font-semibold text-ink">{eventItem.title}</div>
                    <div className="grid gap-2 rounded-2xl border border-ink/10 bg-white/85 p-3">
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/55">Start</span>
                        <span className="font-semibold text-ink">{times.start}</span>
                      </div>
                      {times.meeting ? (
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/55">Mødetid</span>
                          <span className="font-semibold text-ink">{times.meeting}</span>
                        </div>
                      ) : null}
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/55">Svarfrist</span>
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
                      <div className="pt-2 text-xs font-semibold uppercase tracking-[0.2em] text-ink/60" style={{ color: eventItem.signupStatus === "IN" ? "green" : "red" }}>
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
            <p className="mt-2 text-sm text-ink/70">Ingen begivenheder endnu.</p>
          )}
        </div>
        <div className="card-soft">
          <h3 className="text-lg font-semibold text-ink">Mine bøder</h3>
          <p className="mt-2 text-sm text-ink/70">Total skyldsbeløb</p>
          <div className="mt-4 text-3xl font-semibold text-ink">{totalFines} kr</div>
        </div>
      </div>
    </section>
  );
}
