"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { getStoredTeamId, setStoredTeamId } from "@/components/appState";

type CalendarEvent = {
  id: string;
  title: string;
  date: string;
  location: string;
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
  const { data: session, status: sessionStatus } = useSession();
  const [teamId, setTeamId] = useState("");
  const [userId, setUserId] = useState("");
  const [nextEvent, setNextEvent] = useState<CalendarEvent | null>(null);
  const [counts, setCounts] = useState({ in: 0, out: 0, missing: 0 });
  const [memberCount, setMemberCount] = useState(0);
  const [totalFines, setTotalFines] = useState(0);

  useEffect(() => {
    setTeamId(getStoredTeamId());
  }, []);

  useEffect(() => {
    if (session?.user?.id) setUserId(session.user.id);
  }, [session?.user?.id]);

  useEffect(() => {
    async function loadDefaultTeam() {
      if (teamId || !session?.user?.id) return;
      const response = await fetch("/api/me");
      if (!response.ok) return;
      const data = await response.json();
      const firstTeam = data.memberships?.[0]?.team?.id;
      if (firstTeam) {
        setTeamId(firstTeam);
        setStoredTeamId(firstTeam);
      }
    }

    loadDefaultTeam();
  }, [teamId, session?.user?.id]);

  useEffect(() => {
    async function loadMembers() {
      if (!teamId) return;
      const response = await fetch(`/api/team-members?teamId=${teamId}`);
      const data = await response.json();
      setMemberCount((data.members ?? []).length);
    }

    loadMembers();
  }, [teamId]);

  useEffect(() => {
    async function loadNextEvent() {
      if (!teamId || !userId) return;
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
          signupStatus: null
        }))
      ]
        .filter((item) => new Date(item.date) >= now)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      const first = upcoming[0] ?? null;
      setNextEvent(first);

      if (!first) {
        setCounts({ in: 0, out: 0, missing: memberCount });
        return;
      }

      if (first.id.startsWith("series:")) {
        setCounts({ in: 0, out: 0, missing: memberCount });
        return;
      }

      const signupsResponse = await fetch(`/api/events/${first.id}/signups`, { cache: "no-store" });
      if (!signupsResponse.ok) return;
      const signupsData = await signupsResponse.json();
      const signups = signupsData.signups ?? [];
      const inCount = signups.filter((signup: { status: string }) => signup.status === "IN").length;
      const outCount = signups.filter((signup: { status: string }) => signup.status === "OUT").length;
      const missingCount = Math.max(memberCount - inCount - outCount, 0);
      setCounts({ in: inCount, out: outCount, missing: missingCount });
    }

    loadNextEvent();
  }, [teamId, userId, memberCount]);

  useEffect(() => {
    async function loadFines() {
      if (!teamId || !userId) return;
      const response = await fetch(`/api/fines?teamId=${teamId}&userId=${userId}`);
      const data = await response.json();
      const list: FineItem[] = data.fines ?? [];
      setTotalFines(list.reduce((sum, fine) => sum + fine.amount, 0));
    }

    loadFines();
  }, [teamId, userId]);

  const nextEventLabel = useMemo(() => {
    if (!nextEvent) return "Ingen begivenheder endnu.";
    const date = new Date(nextEvent.date);
    const pad = (num: number) => String(num).padStart(2, "0");
    return `${pad(date.getHours())}:${pad(date.getMinutes())} ${pad(date.getDate())}.${pad(
      date.getMonth() + 1
    )}.${date.getFullYear()}`;
  }, [nextEvent]);

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
          <h3 className="text-lg font-semibold text-ink">Næste begivenhed</h3>
          {nextEvent ? (
            <div className="mt-3 space-y-2 text-sm text-ink/70">
              <div className="text-base font-semibold text-ink">{nextEvent.title}</div>
              <div>{nextEventLabel}</div>
              <div>{nextEvent.location}</div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-ink/60">
                <span className="rounded-full bg-green-100 px-3 py-1 text-green-700">Kommer: {counts.in}</span>
                <span className="rounded-full bg-red-100 px-3 py-1 text-red-700">Kan ikke: {counts.out}</span>
                <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-700">
                  Mangler svar: {counts.missing}
                </span>
              </div>
              {nextEvent.signupStatus ? (
                <div className="pt-2 text-xs font-semibold uppercase tracking-[0.2em] text-ink/60">
                  {nextEvent.signupStatus === "IN" ? "Du kommer" : "Du kan ikke"}
                </div>
              ) : (
                <div className="pt-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">
                  Du mangler at svare
                </div>
              )}
            </div>
          ) : (
            <p className="mt-2 text-sm text-ink/70">{nextEventLabel}</p>
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
