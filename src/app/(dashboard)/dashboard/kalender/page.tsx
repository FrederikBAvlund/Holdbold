"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useToast } from "@/components/ToastProvider";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import daLocale from "@fullcalendar/core/locales/da";
import "@fullcalendar/common/main.css";
import "@fullcalendar/daygrid/main.css";
import "@fullcalendar/timegrid/main.css";
import { getStoredTeamId, setStoredTeamId } from "@/components/appState";

type CalendarEvent = {
  id: string;
  title: string;
  date: string;
  location: string;
  source: string;
  seriesId?: string | null;
  signupStatus?: string | null;
  canceledAt?: string | null;
  canceledByName?: string | null;
};

type SeriesItem = {
  id: string;
  title: string;
  location: string;
  startDate: string;
  recurrence: string;
  interval: number;
  endDate?: string | null;
};

type Member = {
  role: string;
  user: { id: string; name: string };
};

type SignupLog = {
  id: string;
  status: string;
  reason?: string | null;
  deadlineAt?: string | null;
  createdAt: string;
  user: { name: string | null };
};

type EventLog = {
  id: string;
  type: string;
  message: string;
  createdAt: string;
  actor?: { name: string | null } | null;
};

type EventSignup = {
  userId: string;
  status: string;
  user: { id: string; name: string | null };
};

const adminRoles = ["ADMIN", "TRAENER", "BOEDEKASSEFORMAND"];

export default function KalenderPage() {
  const { pushToast } = useToast();
  const { data: session, status: sessionStatus } = useSession();
  const [range, setRange] = useState<{ start: string; end: string } | null>(null);
  const lastRangeRef = useRef<{ start: string; end: string } | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [teamId, setTeamId] = useState("");
  const [userId, setUserId] = useState("");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [series, setSeries] = useState<SeriesItem[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [eventSignups, setEventSignups] = useState<EventSignup[]>([]);

  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [startDate, setStartDate] = useState("");
  const [recurrence, setRecurrence] = useState("WEEKLY");
  const [interval, setInterval] = useState(1);
  const [endDate, setEndDate] = useState("");
  const [deadlineHours, setDeadlineHours] = useState(24);
  const formatTimestamp = (value: string | Date) => {
    const date = typeof value === "string" ? new Date(value) : value;
    const pad = (num: number) => String(num).padStart(2, "0");
    return `${pad(date.getHours())}:${pad(date.getMinutes())} · ${pad(date.getDate())}.${pad(
      date.getMonth() + 1
    )}.${date.getFullYear()}`;
  };
  const summaryLines = useMemo(() => {
    if (!startDate) return [];
    const start = new Date(startDate);
    const weekday = start.toLocaleDateString("da-DK", { weekday: "long" });
    const time = start.toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" });
    const intervalText = interval === 1 ? "" : `hver ${interval}. `;
    const recurrenceText =
      recurrence === "ONCE"
        ? "Engang"
        : recurrence === "DAILY"
        ? `${intervalText}dag`
        : recurrence === "WEEKLY"
        ? `${intervalText}${weekday}`
        : recurrence === "MONTHLY"
        ? `${intervalText}måned`
        : `${intervalText}år`;
    const lines = [recurrenceText, location, `Kl. ${time}`];
    return lines.filter(Boolean);
  }, [startDate, interval, recurrence, location]);

  const recurrenceLabel = (value: string) => {
    switch (value) {
      case "DAILY":
        return "Dagligt";
      case "WEEKLY":
        return "Ugentligt";
      case "MONTHLY":
        return "Månedligt";
      case "YEARLY":
        return "Årligt";
      default:
        return value;
    }
  };

  useEffect(() => {
    setTeamId(getStoredTeamId());
  }, []);

  useEffect(() => {
    if (session?.user?.id) {
      setUserId(session.user.id);
    }
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
  const actingMember = members.find((member) => member.user.id === userId);
  const canManageEvents = actingMember ? adminRoles.includes(actingMember.role) : false;

  useEffect(() => {
    function update() {
      setIsMobile(window.innerWidth < 768);
    }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    async function loadMembers() {
      if (!teamId) return;
      const response = await fetch(`/api/team-members?teamId=${teamId}`);
      const data = await response.json();
      setMembers(data.members ?? []);
    }

    loadMembers();
  }, [teamId]);

  useEffect(() => {
    async function loadCalendar() {
      if (!teamId || !range) return;
      const response = await fetch(
        `/api/calendar?teamId=${teamId}&start=${range.start}&end=${range.end}&userId=${userId}`
      );
      const data = await response.json();
      const combined = [...(data.events ?? []), ...(data.occurrences ?? [])];
      setEvents(combined);
    }

    loadCalendar();
  }, [teamId, range, userId]);

  useEffect(() => {
    async function loadSeries() {
      if (!teamId) return;
      const response = await fetch(`/api/event-series?teamId=${teamId}`);
      const data = await response.json();
      setSeries(data.series ?? []);
    }

    loadSeries();
  }, [teamId]);

  const calendarEvents = useMemo(() => {
    return events.map((eventItem) => ({
      id: eventItem.id,
      title: eventItem.title,
      start: eventItem.date,
      backgroundColor:
        eventItem.signupStatus === "IN"
          ? "#16a34a"
          : eventItem.signupStatus === "OUT"
          ? "#dc2626"
          : eventItem.signupStatus === null
          ? "#f59e0b"
          : "#f59e0b",
      borderColor:
        eventItem.signupStatus === "IN"
          ? "#16a34a"
          : eventItem.signupStatus === "OUT"
          ? "#dc2626"
          : eventItem.signupStatus === null
          ? "#f59e0b"
          : "#f59e0b",
      extendedProps: {
        location: eventItem.location,
        source: eventItem.source,
        seriesId: eventItem.seriesId ?? null,
        signupStatus: eventItem.signupStatus ?? null,
        canceledAt: eventItem.canceledAt ?? null,
        canceledByName: eventItem.canceledByName ?? null
      }
    }));
  }, [events]);

  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [signupStatus, setSignupStatus] = useState<"IN" | "OUT" | "UNKNOWN">("UNKNOWN");
  const [eventIdForSignup, setEventIdForSignup] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<SignupLog[]>([]);
  const [eventLogs, setEventLogs] = useState<EventLog[]>([]);

  async function handleCreateSeries(event: React.FormEvent) {
    event.preventDefault();
    if (!teamId || !userId) return;

    if (recurrence === "ONCE") {
      const start = new Date(startDate);
      const deadline = new Date(start.getTime() - deadlineHours * 60 * 60 * 1000);
      await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId,
          title,
          location,
          date: start.toISOString(),
          signupDeadline: deadline.toISOString(),
          createdById: userId
        })
      });
    } else {
      await fetch("/api/event-series", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId,
          title,
          location,
          startDate,
          recurrence,
          interval,
          endDate: endDate || undefined,
          signupDeadlineHoursBefore: deadlineHours,
          createdById: userId
        })
      });
    }

    setShowModal(false);
    setTitle("");
    setLocation("");
    setStartDate("");
    setEndDate("");
    setDeadlineHours(24);
  }

  async function openEvent(eventItem: CalendarEvent) {
    setSelectedEvent(eventItem);
    setSignupStatus("UNKNOWN");
    setEventIdForSignup(null);
    setReason("");
    setError(null);
    setEventSignups([]);

    if (!teamId || !userId) return;

    let eventId = eventItem.id;
    if (eventItem.id.startsWith("series:")) {
      const response = await fetch("/api/events/materialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId,
          seriesId: eventItem.seriesId,
          date: eventItem.date
        })
      });
      const data = await response.json();
      if (response.ok) {
        eventId = data.event.id;
      }
    }

    setEventIdForSignup(eventId);
    const statusResponse = await fetch(`/api/events/${eventId}/signup?userId=${userId}`);
    const statusData = await statusResponse.json();
    if (statusData.signup?.status) {
      setSignupStatus(statusData.signup.status);
      setReason(statusData.signup.reason ?? "");
      setSelectedEvent((prev) => (prev ? { ...prev, signupStatus: statusData.signup.status } : prev));
    }

    const signupsResponse = await fetch(`/api/events/${eventId}/signups`, { cache: "no-store" });
    const signupsData = await signupsResponse.json();
    setEventSignups(signupsData.signups ?? []);

    if (canManageEvents) {
      const logResponse = await fetch(`/api/events/${eventId}/signup/logs`, { cache: "no-store" });
      const logData = await logResponse.json();
      setLogs(logData.logs ?? []);
      setEventLogs(logData.eventLogs ?? []);
    } else {
      setLogs([]);
      setEventLogs([]);
    }
  }

  async function setSignup(status: "IN" | "OUT") {
    if (selectedEvent?.canceledAt) return;
    if (!eventIdForSignup || !userId) return;
    if (status === "OUT" && reason.trim().length < 2) {
      setError("Skriv venligst hvorfor du ikke kan komme.");
      pushToast("Skriv venligst hvorfor du ikke kan komme.", "error");
      return;
    }
    const response = await fetch(`/api/events/${eventIdForSignup}/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, status, reason: status === "OUT" ? reason : undefined })
    });
    if (!response.ok) {
      pushToast("Kunne ikke gemme tilmelding", "error");
      return;
    }
    setSignupStatus(status);
    setError(null);
    setSelectedEvent((prev) => (prev ? { ...prev, signupStatus: status } : prev));
    setEvents((prev) =>
      prev.map((eventItem) => {
        if (eventItem.id === eventIdForSignup || eventItem.id === selectedEvent?.id) {
          return { ...eventItem, signupStatus: status };
        }
        return eventItem;
      })
    );
    const signupsResponse = await fetch(`/api/events/${eventIdForSignup}/signups`, { cache: "no-store" });
    const signupsData = await signupsResponse.json();
    setEventSignups(signupsData.signups ?? []);
    if (canManageEvents && eventIdForSignup) {
      const logResponse = await fetch(`/api/events/${eventIdForSignup}/signup/logs`, { cache: "no-store" });
      const logData = await logResponse.json();
      setLogs(logData.logs ?? []);
      setEventLogs(logData.eventLogs ?? []);
    }
    pushToast(status === "IN" ? "Du er tilmeldt" : "Du er frameldt", "success");
  }

  async function cancelEvent() {
    if (!eventIdForSignup || !canManageEvents) return;
    const response = await fetch(`/api/events/${eventIdForSignup}/cancel`, { method: "POST" });
    if (!response.ok) {
      pushToast("Kunne ikke aflyse begivenhed", "error");
      return;
    }
    const data = await response.json();
    const canceledAt = data.event?.canceledAt ?? new Date().toISOString();
    const canceledByName = session?.user?.name ?? "Administrator";
    setSelectedEvent((prev) =>
      prev ? { ...prev, canceledAt, canceledByName } : prev
    );
    setEvents((prev) =>
      prev.map((eventItem) =>
        eventItem.id === eventIdForSignup ? { ...eventItem, canceledAt, canceledByName } : eventItem
      )
    );
    pushToast("Begivenhed aflyst", "success");
  }

  async function reopenEvent() {
    if (!eventIdForSignup || !canManageEvents) return;
    const response = await fetch(`/api/events/${eventIdForSignup}/reopen`, { method: "POST" });
    if (!response.ok) {
      pushToast("Kunne ikke genåbne begivenhed", "error");
      return;
    }
    const data = await response.json();
    setSelectedEvent((prev) =>
      prev ? { ...prev, canceledAt: null, canceledByName: null } : prev
    );
    setEvents((prev) =>
      prev.map((eventItem) =>
        eventItem.id === eventIdForSignup ? { ...eventItem, canceledAt: null, canceledByName: null } : eventItem
      )
    );
    pushToast("Begivenhed genåbnet", "success");
  }

  async function updateSeriesEndDate(seriesId: string, newEndDate: string) {
    await fetch(`/api/event-series/${seriesId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endDate: newEndDate || null })
    });
  }

  const signupMap = useMemo(() => {
    return new Map(eventSignups.map((signup) => [signup.userId, signup.status]));
  }, [eventSignups]);

  const signupGroups = useMemo(() => {
    const grouped = {
      in: [] as Member[],
      out: [] as Member[],
      missing: [] as Member[]
    };
    for (const member of members) {
      const status = signupMap.get(member.user.id);
      if (status === "IN") grouped.in.push(member);
      else if (status === "OUT") grouped.out.push(member);
      else grouped.missing.push(member);
    }
    return grouped;
  }, [members, signupMap]);

  if (sessionStatus === "loading") {
    return (
      <section className="card">
        <h2 className="text-2xl font-semibold text-ink">Kalender</h2>
        <p className="mt-2 text-ink/70">Indlæser...</p>
      </section>
    );
  }

  if (!session?.user?.id) {
    return (
      <section className="card">
        <h2 className="text-2xl font-semibold text-ink">Kalender</h2>
        <p className="mt-2 text-ink/70">Du skal være logget ind for at se kalenderen.</p>
      </section>
    );
  }

  if (!teamId) {
    return (
      <section className="card">
        <h2 className="text-2xl font-semibold text-ink">Kalender</h2>
        <p className="mt-2 text-ink/70">Vælg aktivt team i Indstillinger for at fortsætte.</p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <header className="card">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-ink">Kalender</h2>
            <p className="mt-2 text-ink/70">Overblik over kampe og træning.</p>
          </div>
          {canManageEvents ? (
            <button className="btn-primary" onClick={() => setShowModal(true)}>
              Opret begivenhed
            </button>
          ) : null}
        </div>
      </header>

      <div className="card">
        <div className="rounded-2xl border border-ink/10 bg-white/90 p-3">
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView={isMobile ? "dayGridWeek" : "dayGridMonth"}
            locales={[daLocale]}
            locale="da"
            headerToolbar={
              isMobile
                ? { left: "prev,next", center: "title", right: "dayGridWeek,dayGridMonth" }
                : { left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek,dayGridDay" }
            }
            buttonText={{
              today: "I dag",
              month: "Måned",
              week: "Uge",
              day: "Dag"
            }}
            height="auto"
            aspectRatio={isMobile ? 0.9 : 1.35}
            datesSet={(arg) => {
              const next = { start: arg.start.toISOString(), end: arg.end.toISOString() };
              const last = lastRangeRef.current;
              if (last && last.start === next.start && last.end === next.end) return;
              lastRangeRef.current = next;
              setRange(next);
            }}
            events={calendarEvents}
            eventClick={(info) => {
                const eventItem: CalendarEvent = {
                  id: info.event.id,
                  title: info.event.title,
                  date: info.event.start?.toISOString() ?? new Date().toISOString(),
                  location: String(info.event.extendedProps.location ?? ""),
                  source: String(info.event.extendedProps.source ?? "MANUAL"),
                  seriesId: info.event.extendedProps.seriesId ?? null,
                  signupStatus: info.event.extendedProps.signupStatus ?? null,
                  canceledAt: info.event.extendedProps.canceledAt ?? null,
                  canceledByName: info.event.extendedProps.canceledByName ?? null
                };
                openEvent(eventItem);
              }}
            eventContent={(arg) => {
              const canceled = arg.event.extendedProps.canceledAt;
              const color = arg.event.backgroundColor || "#94a3b8";
              return (
                <div className={`flex items-center gap-2 ${canceled ? "line-through opacity-60" : ""}`}>
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  {arg.timeText ? `${arg.timeText} ` : ""}
                  {arg.event.title}
                </div>
              );
            }}
          />
        </div>
      </div>

      {canManageEvents ? (
        <div className="card">
          <h3 className="text-lg font-semibold text-ink">Gentagne begivenheder</h3>
          <p className="mt-2 text-sm text-ink/70">Opdater slutdato for eksisterende gentagelser.</p>
          <div className="mt-4 grid gap-3">
            {series.length === 0 ? (
              <p className="text-sm text-ink/60">Ingen gentagelser endnu.</p>
            ) : (
              series.map((item) => (
                <div key={item.id} className="rounded-2xl border border-ink/10 bg-white/90 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-ink">{item.title}</p>
                      <p className="text-xs text-ink/60">
                        {new Date(item.startDate).toLocaleDateString("da-DK")} · {recurrenceLabel(item.recurrence)} ·{" "}
                        {item.interval}x
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        defaultValue={item.endDate ? item.endDate.slice(0, 10) : ""}
                        className="input"
                        onBlur={(event) => updateSeriesEndDate(item.id, event.target.value)}
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}

      {showModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 px-4">
          <div className="card max-w-lg w-full">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-ink">Opret gentagen begivenhed</h3>
                <p className="mt-2 text-sm text-ink/70">Vælg start, interval og evt. slutdato.</p>
              </div>
              <button className="btn-ghost" onClick={() => setShowModal(false)}>
                Luk
              </button>
            </div>
            <form onSubmit={handleCreateSeries} className="mt-4 grid gap-3">
              <div className="space-y-2">
                <label className="label" htmlFor="event-title">Titel</label>
                <input
                  id="event-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Titel"
                  className="input"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="label" htmlFor="event-location">Lokation</label>
                <input
                  id="event-location"
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                  placeholder="Lokation"
                  className="input"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="label" htmlFor="event-start">Start</label>
                <input
                  id="event-start"
                  type="datetime-local"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  className="input"
                  required
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="label" htmlFor="event-recurrence">Gentagelse</label>
                  <select
                    id="event-recurrence"
                    value={recurrence}
                    onChange={(event) => setRecurrence(event.target.value)}
                    className="input"
                  >
                    <option value="ONCE">Engang</option>
                    <option value="DAILY">Hver dag</option>
                    <option value="WEEKLY">Hver uge</option>
                    <option value="MONTHLY">Hver måned</option>
                    <option value="YEARLY">Hvert år</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="label" htmlFor="event-interval">Interval</label>
                  <input
                    id="event-interval"
                    type="number"
                    value={interval}
                    min={1}
                    onChange={(event) => setInterval(Number(event.target.value))}
                    placeholder="Interval"
                    className="input"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="label" htmlFor="event-deadline">Deadline (timer før)</label>
                <input
                  id="event-deadline"
                  type="number"
                  value={deadlineHours}
                  min={1}
                  onChange={(event) => setDeadlineHours(Number(event.target.value))}
                  placeholder="Deadline (timer før)"
                  className="input"
                />
              </div>
              <div className="space-y-2">
                <label className="label" htmlFor="event-end">Slutdato</label>
                <input
                  id="event-end"
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  className="input"
                  placeholder="Slutdato (valgfri)"
                />
              </div>
              <button className="btn-primary">Opret</button>
            </form>
            {summaryLines.length > 0 ? (
              <div className="mt-4 rounded-2xl border border-ink/10 bg-ink/5 p-3 text-sm text-ink/70">
                <p className="text-xs uppercase tracking-[0.2em] text-ink/50">Opsummering</p>
                <div className="mt-2 space-y-1">
                  {summaryLines.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {selectedEvent ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 px-4">
          <div className="card max-w-lg w-full">
            <div className="flex items-start justify-between">
              <div>
                <h3 className={`text-lg font-semibold text-ink ${selectedEvent.canceledAt ? "line-through" : ""}`}>
                  {selectedEvent.title}
                </h3>
                <p className="mt-2 text-sm text-ink/70">
                  {formatTimestamp(selectedEvent.date)} · {selectedEvent.location}
                </p>
                {selectedEvent.canceledAt ? (
                  <p className="mt-2 text-sm font-semibold text-red-600">
                    Aflyst af {selectedEvent.canceledByName ?? "Administrator"}
                  </p>
                ) : null}
              </div>
              <button className="btn-ghost" onClick={() => setSelectedEvent(null)}>
                Luk
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {canManageEvents ? (
                selectedEvent.canceledAt ? (
                  <button className="btn-ghost" onClick={reopenEvent}>
                    Genåbn begivenhed
                  </button>
                ) : (
                  <button className="btn-ghost" onClick={cancelEvent}>
                    Aflys begivenhed
                  </button>
                )
              ) : null}
              <div className="flex gap-2">
                <button
                  className={`rounded-full px-5 py-3 text-sm font-semibold uppercase tracking-[0.2em] ${
                    signupStatus === "IN" ? "bg-green-600 text-white" : "bg-green-100 text-green-700"
                  } ${selectedEvent?.canceledAt ? "opacity-50 cursor-not-allowed" : ""}`}
                  onClick={() => setSignup("IN")}
                  disabled={Boolean(selectedEvent?.canceledAt)}
                >
                  Jeg kommer
                </button>
                <button
                  className={`rounded-full px-5 py-3 text-sm font-semibold uppercase tracking-[0.2em] ${
                    signupStatus === "OUT" ? "bg-red-600 text-white" : "bg-red-100 text-red-700"
                  } ${selectedEvent?.canceledAt ? "opacity-50 cursor-not-allowed" : ""}`}
                  onClick={() => setSignup("OUT")}
                  disabled={Boolean(selectedEvent?.canceledAt)}
                >
                  Jeg kan ikke
                </button>
              </div>
              <div className="space-y-2">
                <label className="label" htmlFor="reason">Hvis du ikke kan komme, skriv hvorfor</label>
                <textarea
                  id="reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Skriv kort hvorfor..."
                  className="input min-h-[90px]"
                  disabled={Boolean(selectedEvent?.canceledAt)}
                />
                {error ? <p className="text-sm text-red-600">{error}</p> : null}
              </div>
              <div className="mt-4 rounded-2xl border border-ink/10 bg-white/90 p-4">
                <p className="label">Tilmeldinger</p>
                <div className="mt-3 grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm font-semibold text-ink">
                      <span className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-green-600" />
                        Tilmeldte
                      </span>
                      <span className="text-ink/60">{signupGroups.in.length}</span>
                    </div>
                    <div className="space-y-1 text-sm text-ink/70">
                      {signupGroups.in.length === 0 ? <div>Ingen</div> : null}
                      {signupGroups.in.map((member) => (
                        <div key={member.user.id}>{member.user.name ?? "Ukendt"}</div>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm font-semibold text-ink">
                      <span className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-red-600" />
                        Frameldte
                      </span>
                      <span className="text-ink/60">{signupGroups.out.length}</span>
                    </div>
                    <div className="space-y-1 text-sm text-ink/70">
                      {signupGroups.out.length === 0 ? <div>Ingen</div> : null}
                      {signupGroups.out.map((member) => (
                        <div key={member.user.id}>{member.user.name ?? "Ukendt"}</div>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm font-semibold text-ink">
                      <span className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                        Mangler at svare
                      </span>
                      <span className="text-ink/60">{signupGroups.missing.length}</span>
                    </div>
                    <div className="space-y-1 text-sm text-ink/70">
                      {signupGroups.missing.length === 0 ? <div>Ingen</div> : null}
                      {signupGroups.missing.map((member) => (
                        <div key={member.user.id}>{member.user.name ?? "Ukendt"}</div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              {canManageEvents && (logs.length > 0 || eventLogs.length > 0) ? (
                <div className="mt-4 rounded-2xl border border-ink/10 bg-white/90 p-4">
                  <p className="label">Historik</p>
                  <div className="mt-2 space-y-2">
                    {[
                      ...logs.map((log) => ({
                        id: `signup-${log.id}`,
                        createdAt: log.createdAt,
                        type: "SIGNUP",
                        status: log.status,
                        name: log.user?.name ?? "Ukendt",
                        reason: log.reason,
                        deadlineAt: log.deadlineAt
                      })),
                      ...eventLogs.map((entry) => ({
                        id: `event-${entry.id}`,
                        createdAt: entry.createdAt,
                        type: entry.type,
                        message: entry.message,
                        name: entry.actor?.name ?? "System"
                      }))
                    ]
                      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                      .map((entry) => (
                        <div key={entry.id} className="flex items-start gap-2 text-sm text-ink/70">
                          <span
                            className={`mt-1 inline-block h-2.5 w-2.5 rounded-full ${
                              entry.type === "SIGNUP"
                                ? entry.status === "IN"
                                  ? "bg-green-600"
                                  : entry.status === "OUT"
                                  ? "bg-red-600"
                                  : "bg-ink/40"
                                : entry.type === "CANCEL"
                                ? "bg-red-600"
                                : entry.type === "REOPEN"
                                ? "bg-green-600"
                                : "bg-ink/40"
                            }`}
                          />
                          <div>
                            <div>
                              <span className="font-semibold text-ink">{entry.name}</span> ·{" "}
                              {formatTimestamp(entry.createdAt)}
                            </div>
                            {"deadlineAt" in entry && entry.deadlineAt && new Date(entry.createdAt) > new Date(entry.deadlineAt) ? (
                              <div className="text-xs font-semibold text-red-600">For sent efter deadline</div>
                            ) : null}
                            {"reason" in entry && entry.reason ? (
                              <div className="text-xs text-ink/60">{entry.reason}</div>
                            ) : null}
                            {"message" in entry && entry.message ? (
                              <div className="text-xs text-ink/60">{entry.message}</div>
                            ) : null}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
