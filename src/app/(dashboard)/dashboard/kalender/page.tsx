"use client";

import { useEffect, useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import "@fullcalendar/core/main.css";
import "@fullcalendar/daygrid/main.css";
import "@fullcalendar/timegrid/main.css";
import { getStoredTeamId, getStoredUserId } from "@/components/appState";

type CalendarEvent = {
  id: string;
  title: string;
  date: string;
  location: string;
  source: string;
  seriesId?: string | null;
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

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function addMonths(date: Date, delta: number) {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

function getCalendarDays(current: Date) {
  const start = startOfMonth(current);
  const end = endOfMonth(current);
  const startWeekday = (start.getDay() + 6) % 7; // Monday = 0
  const totalDays = end.getDate();
  const days = [] as { date: Date; isCurrentMonth: boolean }[];

  for (let i = 0; i < startWeekday; i += 1) {
    const d = new Date(start);
    d.setDate(start.getDate() - (startWeekday - i));
    days.push({ date: d, isCurrentMonth: false });
  }

  for (let day = 1; day <= totalDays; day += 1) {
    days.push({ date: new Date(current.getFullYear(), current.getMonth(), day), isCurrentMonth: true });
  }

  while (days.length % 7 !== 0) {
    const last = days[days.length - 1].date;
    const d = new Date(last);
    d.setDate(last.getDate() + 1);
    days.push({ date: d, isCurrentMonth: false });
  }

  return days;
}

const adminRoles = ["ADMIN", "TRAENER", "BOEDEKASSEFORMAND"];

export default function KalenderPage() {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [teamId, setTeamId] = useState("");
  const [userId, setUserId] = useState("");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [series, setSeries] = useState<SeriesItem[]>([]);
  const [members, setMembers] = useState<Member[]>([]);

  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [startDate, setStartDate] = useState("");
  const [recurrence, setRecurrence] = useState("WEEKLY");
  const [interval, setInterval] = useState(1);
  const [endDate, setEndDate] = useState("");
  const [deadlineHours, setDeadlineHours] = useState(24);
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

  useEffect(() => {
    setTeamId(getStoredTeamId());
    setUserId(getStoredUserId());
  }, []);

  const actingMember = members.find((member) => member.user.id === userId);
  const canManageEvents = actingMember ? adminRoles.includes(actingMember.role) : false;

  const days = useMemo(() => getCalendarDays(month), [month]);

  const monthLabel = month.toLocaleDateString("da-DK", {
    month: "long",
    year: "numeric"
  });

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
      if (!teamId || days.length === 0) return;
      const start = days[0].date.toISOString();
      const end = days[days.length - 1].date.toISOString();
      const response = await fetch(`/api/calendar?teamId=${teamId}&start=${start}&end=${end}`);
      const data = await response.json();
      const combined = [...(data.events ?? []), ...(data.occurrences ?? [])];
      setEvents(combined);
    }

    loadCalendar();
  }, [teamId, days]);

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
      extendedProps: {
        location: eventItem.location,
        source: eventItem.source,
        seriesId: eventItem.seriesId ?? null
      }
    }));
  }, [events]);

  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [signupStatus, setSignupStatus] = useState<"IN" | "OUT" | "UNKNOWN">("UNKNOWN");
  const [eventIdForSignup, setEventIdForSignup] = useState<string | null>(null);

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
    }
  }

  async function setSignup(status: "IN" | "OUT") {
    if (!eventIdForSignup || !userId) return;
    await fetch(`/api/events/${eventIdForSignup}/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, status })
    });
    setSignupStatus(status);
  }

  async function updateSeriesEndDate(seriesId: string, newEndDate: string) {
    await fetch(`/api/event-series/${seriesId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endDate: newEndDate || null })
    });
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
          <div className="flex items-center gap-2">
            <button className="btn-ghost" onClick={() => setMonth(addMonths(month, -1))}>
              Forrige
            </button>
            <button className="btn-ghost" onClick={() => setMonth(startOfMonth(new Date()))}>
              I dag
            </button>
            <button className="btn-ghost" onClick={() => setMonth(addMonths(month, 1))}>
              Næste
            </button>
            {canManageEvents ? (
              <button className="btn-primary" onClick={() => setShowModal(true)}>
                Opret begivenhed
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <div className="card">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold text-ink" style={{ textTransform: "capitalize" }}>
            {monthLabel}
          </h3>
        </div>
        <div className="mt-4 rounded-2xl border border-ink/10 bg-white/90 p-3">
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "dayGridMonth,timeGridWeek"
            }}
            height="auto"
            events={calendarEvents}
            eventClick={(info) => {
              const eventItem: CalendarEvent = {
                id: info.event.id,
                title: info.event.title,
                date: info.event.start?.toISOString() ?? new Date().toISOString(),
                location: String(info.event.extendedProps.location ?? ""),
                source: String(info.event.extendedProps.source ?? "MANUAL"),
                seriesId: info.event.extendedProps.seriesId ?? null
              };
              openEvent(eventItem);
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
                        {new Date(item.startDate).toLocaleDateString("da-DK")} · {item.recurrence} · {item.interval}x
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
                <h3 className="text-lg font-semibold text-ink">{selectedEvent.title}</h3>
                <p className="mt-2 text-sm text-ink/70">
                  {new Date(selectedEvent.date).toLocaleString("da-DK")} · {selectedEvent.location}
                </p>
              </div>
              <button className="btn-ghost" onClick={() => setSelectedEvent(null)}>
                Luk
              </button>
            </div>
            <div className="mt-4 space-y-3">
              <p className="text-sm text-ink/70">Tilmeldingsstatus: {signupStatus}</p>
              <div className="flex gap-2">
                <button className="btn-primary" onClick={() => setSignup("IN")}>Jeg kommer</button>
                <button className="btn-ghost" onClick={() => setSignup("OUT")}>Jeg kan ikke</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
