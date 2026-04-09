"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProvider";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import daLocale from "@fullcalendar/core/locales/da";
import "@fullcalendar/common/main.css";
import "@fullcalendar/daygrid/main.css";
import "@fullcalendar/timegrid/main.css";
import { useDashboardTeam, type DashboardTeamMember } from "@/components/DashboardTeamProvider";

type CalendarEvent = {
  id: string;
  title: string;
  date: string;
  location: string;
  meetingTime?: string | null;
  signupDeadline?: string | null;
  source: string;
  seriesId?: string | null;
  thingCarrierId?: string | null;
  beerCarrierId?: string | null;
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

type SignupLog = {
  id: string;
  status: string;
  reason?: string | null;
  deadlineAt?: string | null;
  createdAt: string;
  user: { id: string; name: string | null };
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

type CachedEventDetails = {
  signupStatus: "IN" | "OUT" | "UNKNOWN";
  reason: string;
  eventDeadlineAt: string | null;
  editableMeetingAt: string;
  editableDeadlineAt: string;
  editableThingCarrierId: string;
  editableBeerCarrierId: string;
  eventSignups: EventSignup[];
  logs: SignupLog[];
  eventLogs: EventLog[];
};

type FineTemplate = {
  id: string;
  title: string;
  amount: number;
  status?: string;
};

const adminRoles = ["ADMIN", "TRAENER", "BOEDEKASSEFORMAND"];

export default function KalenderPage() {
  const { pushToast } = useToast();
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const { teamId, userId, members, actingMember } = useDashboardTeam();
  const [range, setRange] = useState<{ start: string; end: string } | null>(null);
  const lastRangeRef = useRef<{ start: string; end: string } | null>(null);
  const loadedCalendarKeyRef = useRef<string | null>(null);
  const loadedSeriesKeyRef = useRef<string | null>(null);
  const loadedFineTemplatesKeyRef = useRef<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [series, setSeries] = useState<SeriesItem[]>([]);
  const [eventSignups, setEventSignups] = useState<EventSignup[]>([]);
  const [fineTemplates, setFineTemplates] = useState<FineTemplate[]>([]);
  const [selectedLateFineTemplateId, setSelectedLateFineTemplateId] = useState("");
  const [loadingCalendar, setLoadingCalendar] = useState(true);
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [openingEventId, setOpeningEventId] = useState<string | null>(null);
  const [eventDetailsLoading, setEventDetailsLoading] = useState(false);
  const [signupSubmitting, setSignupSubmitting] = useState<"IN" | "OUT" | null>(null);
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [reopenSubmitting, setReopenSubmitting] = useState(false);
  const [lateFineSubmitting, setLateFineSubmitting] = useState(false);
  const [updatingSeriesId, setUpdatingSeriesId] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [startDate, setStartDate] = useState("");
  const [recurrence, setRecurrence] = useState("WEEKLY");
  const [interval, setInterval] = useState(1);
  const [endDate, setEndDate] = useState("");
  const [deadlineHours, setDeadlineHours] = useState(24);
  const toIsoFromLocalDateTime = (value: string) => {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  };
  const toIsoEndOfLocalDay = (value: string) => {
    if (!value) return null;
    const parsed = new Date(`${value}T23:59:59`);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  };
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
    if (typeof window !== "undefined") {
      const storedMode = window.localStorage.getItem("calendarViewMode");
      if (storedMode === "list" || storedMode === "calendar") {
        setViewMode(storedMode);
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("calendarViewMode", viewMode);
    }
  }, [viewMode]);

  const canManageEvents = actingMember ? adminRoles.includes(actingMember.role) : false;
  const canAssignLateFine = actingMember
    ? actingMember.role === "ADMIN" || actingMember.role === "BOEDEKASSEFORMAND"
    : false;
  const canEditOtherSignups = canAssignLateFine;

  useEffect(() => {
    function update() {
      setIsMobile(window.innerWidth < 768);
    }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    if (viewMode !== "list" || range) return;
    const start = new Date();
    const end = new Date();
    end.setDate(end.getDate() + 180);
    const next = { start: start.toISOString(), end: end.toISOString() };
    lastRangeRef.current = next;
    setRange(next);
  }, [viewMode, range]);

  useEffect(() => {
    async function loadCalendar() {
      if (!teamId || !range || !userId) return;
      const key = `${teamId}:${userId}:${range.start}:${range.end}`;
      if (loadedCalendarKeyRef.current === key) return;
      loadedCalendarKeyRef.current = key;
      setLoadingCalendar(true);
      try {
        const response = await fetch(
          `/api/calendar?teamId=${teamId}&start=${range.start}&end=${range.end}&userId=${userId}`
        );
        const data = await response.json();
        const combined = [...(data.events ?? []), ...(data.occurrences ?? [])];
        setEvents(combined);
      } finally {
        setLoadingCalendar(false);
      }
    }

    loadCalendar();
  }, [teamId, range, userId]);

  useEffect(() => {
    async function loadSeries() {
      if (!teamId) return;
      if (loadedSeriesKeyRef.current === teamId) return;
      loadedSeriesKeyRef.current = teamId;
      const response = await fetch(`/api/event-series?teamId=${teamId}`);
      const data = await response.json();
      setSeries(data.series ?? []);
    }

    loadSeries();
  }, [teamId]);

  useEffect(() => {
    async function loadFineTemplates() {
      if (!teamId || !canAssignLateFine) return;
      const key = `${teamId}:${canAssignLateFine ? "1" : "0"}`;
      if (loadedFineTemplatesKeyRef.current === key) return;
      loadedFineTemplatesKeyRef.current = key;
      const response = await fetch(`/api/fine-templates?teamId=${teamId}`, { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      const approved = (data.templates ?? []).filter(
        (template: FineTemplate) => template.status === "APPROVED" || !template.status
      );
      setFineTemplates(approved);
      setSelectedLateFineTemplateId((prev) => {
        if (prev) return prev;
        const suggested = approved.find((template: FineTemplate) =>
          template.title.toLowerCase().includes("for sen")
        );
        return suggested?.id ?? "";
      });
    }

    loadFineTemplates();
  }, [teamId, canAssignLateFine]);

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
        meetingTime: eventItem.meetingTime ?? null,
        signupDeadline: eventItem.signupDeadline ?? null,
        source: eventItem.source,
        seriesId: eventItem.seriesId ?? null,
        thingCarrierId: eventItem.thingCarrierId ?? null,
        beerCarrierId: eventItem.beerCarrierId ?? null,
        signupStatus: eventItem.signupStatus ?? null,
        canceledAt: eventItem.canceledAt ?? null,
        canceledByName: eventItem.canceledByName ?? null
      }
    }));
  }, [events]);

  const upcomingEvents = useMemo(() => {
    const now = Date.now() - 5 * 60 * 1000;
    return [...events]
      .filter((eventItem) => new Date(eventItem.date).getTime() >= now)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [events]);

  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [signupStatus, setSignupStatus] = useState<"IN" | "OUT" | "UNKNOWN">("UNKNOWN");
  const [eventIdForSignup, setEventIdForSignup] = useState<string | null>(null);
  const [eventDeadlineAt, setEventDeadlineAt] = useState<string | null>(null);
  const [editableMeetingAt, setEditableMeetingAt] = useState("");
  const [editableDeadlineAt, setEditableDeadlineAt] = useState("");
  const [editableThingCarrierId, setEditableThingCarrierId] = useState("");
  const [editableBeerCarrierId, setEditableBeerCarrierId] = useState("");
  const [savingMatchMeta, setSavingMatchMeta] = useState(false);
  const [selectedLateFineUserIds, setSelectedLateFineUserIds] = useState<string[]>([]);
  const [editingSignupMember, setEditingSignupMember] = useState<DashboardTeamMember | null>(null);
  const [editingSignupStatus, setEditingSignupStatus] = useState<"IN" | "OUT" | "UNKNOWN">("UNKNOWN");
  const [editingSignupReason, setEditingSignupReason] = useState("");
  const [editingSignupSubmitting, setEditingSignupSubmitting] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<SignupLog[]>([]);
  const [eventLogs, setEventLogs] = useState<EventLog[]>([]);
  const handledFocusKeyRef = useRef<string | null>(null);
  const eventDetailsCacheRef = useRef<Map<string, CachedEventDetails>>(new Map());

  const toDateTimeLocalValue = (value: string | null | undefined) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const pad = (num: number) => String(num).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
      date.getHours()
    )}:${pad(date.getMinutes())}`;
  };

  const splitLocalDateTime = (value: string) => {
    if (!value || !value.includes("T")) {
      return { date: "—", time: "--.--" };
    }
    const [datePart, timePart] = value.split("T");
    const [year, month, day] = datePart.split("-");
    const safeDate =
      year && month && day ? `${day}.${month}.${year}` : "—";
    const safeTime = (timePart?.slice(0, 5) ?? "--:--").replace(":", ".");
    return { date: safeDate, time: safeTime };
  };

  async function handleCreateSeries(event: React.FormEvent) {
    event.preventDefault();
    if (!teamId || !userId) return;
    if (creatingEvent) return;
    const startIso = toIsoFromLocalDateTime(startDate);
    if (!startIso) {
      pushToast("Ugyldigt starttidspunkt", "error");
      return;
    }
    setCreatingEvent(true);
    try {
      const response =
        recurrence === "ONCE"
          ? await fetch("/api/events", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                teamId,
                title,
                location,
                date: new Date(startIso).toISOString(),
                signupDeadline: new Date(new Date(startIso).getTime() - deadlineHours * 60 * 60 * 1000).toISOString()
              })
            })
          : await fetch("/api/event-series", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                teamId,
                title,
                location,
                startDate: startIso,
                recurrence,
                interval,
                endDate: toIsoEndOfLocalDay(endDate) ?? undefined,
                signupDeadlineHoursBefore: deadlineHours
              })
            });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        pushToast(data.error ?? "Kunne ikke oprette begivenhed", "error");
        return;
      }

      pushToast(recurrence === "ONCE" ? "Begivenhed oprettet" : "Gentagelse oprettet", "success");
      setShowModal(false);
      setTitle("");
      setLocation("");
      setStartDate("");
      setEndDate("");
      setDeadlineHours(24);
      loadedSeriesKeyRef.current = null;
      loadedCalendarKeyRef.current = null;
    } finally {
      setCreatingEvent(false);
    }
  }

  async function openEvent(eventItem: CalendarEvent) {
    if (openingEventId) return;
    if (!teamId || !userId) return;
    setOpeningEventId(eventItem.id);
    setEventDetailsLoading(true);
    try {
      setSelectedEvent(eventItem);
      setSignupStatus(
        eventItem.signupStatus === "IN" || eventItem.signupStatus === "OUT" ? eventItem.signupStatus : "UNKNOWN"
      );
      setEventIdForSignup(null);
      setEventDeadlineAt(eventItem.signupDeadline ?? null);
      const fallbackMeetingIso = new Date(new Date(eventItem.date).getTime() - 60 * 60 * 1000).toISOString();
      setEditableMeetingAt(toDateTimeLocalValue(eventItem.meetingTime ?? fallbackMeetingIso));
      setEditableDeadlineAt(toDateTimeLocalValue(eventItem.signupDeadline ?? null));
      setEditableThingCarrierId(eventItem.thingCarrierId ?? "");
      setEditableBeerCarrierId(eventItem.beerCarrierId ?? "");
      setReason("");
      setError(null);
      setEventSignups([]);
      setLogs([]);
      setEventLogs([]);

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
      const cachedDetails = eventDetailsCacheRef.current.get(eventId);
      if (cachedDetails) {
        setSignupStatus(cachedDetails.signupStatus);
        setReason(cachedDetails.reason);
        setEventDeadlineAt(cachedDetails.eventDeadlineAt);
        setEditableMeetingAt(cachedDetails.editableMeetingAt);
        setEditableDeadlineAt(cachedDetails.editableDeadlineAt);
        setEditableThingCarrierId(cachedDetails.editableThingCarrierId);
        setEditableBeerCarrierId(cachedDetails.editableBeerCarrierId);
        setEventSignups(cachedDetails.eventSignups);
        setLogs(cachedDetails.logs);
        setEventLogs(canManageEvents ? cachedDetails.eventLogs : []);
        setSelectedEvent((prev) =>
          prev
            ? {
                ...prev,
                signupStatus:
                  cachedDetails.signupStatus === "UNKNOWN" ? null : cachedDetails.signupStatus
              }
            : prev
        );
        return;
      }

      const [statusResponse, signupsResponse, logResponse] = await Promise.all([
        fetch(`/api/events/${eventId}/signup?userId=${userId}`),
        fetch(`/api/events/${eventId}/signups`, { cache: "no-store" }),
        fetch(`/api/events/${eventId}/signup/logs`, { cache: "no-store" })
      ]);
      const [statusData, signupsData, logData] = await Promise.all([
        statusResponse.json(),
        signupsResponse.json(),
        logResponse.json()
      ]);
      if (statusData.event?.signupDeadline) {
        setEventDeadlineAt(statusData.event.signupDeadline);
      }
      const resolvedFallbackMeetingIso = statusData.event?.date
        ? new Date(new Date(statusData.event.date).getTime() - 60 * 60 * 1000).toISOString()
        : null;
      const meetingValue = statusData.event?.meetingTime ?? resolvedFallbackMeetingIso;
      setEditableDeadlineAt(toDateTimeLocalValue(statusData.event?.signupDeadline ?? null));
      setEditableMeetingAt(toDateTimeLocalValue(meetingValue));
      setEditableThingCarrierId(statusData.event?.thingCarrierId ?? "");
      setEditableBeerCarrierId(statusData.event?.beerCarrierId ?? "");
      if (statusData.event?.source) {
        setSelectedEvent((prev) =>
          prev
            ? {
                ...prev,
                source: statusData.event.source,
                thingCarrierId: statusData.event?.thingCarrierId ?? prev.thingCarrierId ?? null,
                beerCarrierId: statusData.event?.beerCarrierId ?? prev.beerCarrierId ?? null
              }
            : prev
        );
      }
      if (
        statusData.signup?.status === "IN" ||
        statusData.signup?.status === "OUT" ||
        statusData.signup?.status === "UNKNOWN"
      ) {
        setSignupStatus(statusData.signup.status);
        setReason(statusData.signup.reason ?? "");
        setSelectedEvent((prev) => (prev ? { ...prev, signupStatus: statusData.signup.status } : prev));
      }
      setEventSignups(signupsData.signups ?? []);
      setLogs(logData.logs ?? []);
      setEventLogs(canManageEvents ? (logData.eventLogs ?? []) : []);
      const resolvedSignupStatus =
        statusData.signup?.status === "IN" ||
        statusData.signup?.status === "OUT" ||
        statusData.signup?.status === "UNKNOWN"
          ? statusData.signup.status
          : "UNKNOWN";
      eventDetailsCacheRef.current.set(eventId, {
        signupStatus: resolvedSignupStatus,
        reason: statusData.signup?.reason ?? "",
        eventDeadlineAt: statusData.event?.signupDeadline ?? null,
        editableMeetingAt: toDateTimeLocalValue(meetingValue),
        editableDeadlineAt: toDateTimeLocalValue(statusData.event?.signupDeadline ?? null),
        editableThingCarrierId: statusData.event?.thingCarrierId ?? "",
        editableBeerCarrierId: statusData.event?.beerCarrierId ?? "",
        eventSignups: signupsData.signups ?? [],
        logs: logData.logs ?? [],
        eventLogs: logData.eventLogs ?? []
      });
    } finally {
      setEventDetailsLoading(false);
      setOpeningEventId(null);
    }
  }

  useEffect(() => {
    if (!teamId || !userId) return;
    if (typeof window === "undefined") return;

    const currentParams = new URLSearchParams(window.location.search);
    const focusEvent = currentParams.get("focusEvent");
    if (!focusEvent) return;
    const focusDate = currentParams.get("focusDate") ?? new Date().toISOString();
    const focusKey = `${focusEvent}:${focusDate}`;
    if (handledFocusKeyRef.current === focusKey) return;
    handledFocusKeyRef.current = focusKey;

    const focusItem: CalendarEvent = {
      id: focusEvent,
      title: currentParams.get("focusTitle") ?? "Begivenhed",
      date: focusDate,
      location: currentParams.get("focusLocation") ?? "",
      source: currentParams.get("focusSource") ?? "MANUAL",
      seriesId: currentParams.get("focusSeriesId"),
      thingCarrierId: null,
      beerCarrierId: null,
      meetingTime: null,
      signupDeadline: null,
      signupStatus: null,
      canceledAt: null,
      canceledByName: null
    };

    openEvent(focusItem);

    const cleaned = new URLSearchParams(currentParams.toString());
    cleaned.delete("focusEvent");
    cleaned.delete("focusDate");
    cleaned.delete("focusTitle");
    cleaned.delete("focusLocation");
    cleaned.delete("focusSource");
    cleaned.delete("focusSeriesId");
    const query = cleaned.toString();
    router.replace(query ? `/dashboard/kalender?${query}` : "/dashboard/kalender", {
      scroll: false
    });
  }, [router, teamId, userId]);

  const isMatchEvent = selectedEvent?.source === "ICAL";
  const canViewMatchMeta = Boolean(isMatchEvent);
  const canEditMatchMeta = Boolean(isMatchEvent && canAssignLateFine && eventIdForSignup);
  const canEditEventDuties = Boolean(eventIdForSignup);
  const isDeadlinePassed = Boolean(
    eventDeadlineAt && new Date(eventDeadlineAt).getTime() <= Date.now()
  );

  async function saveMatchMeta() {
    if (!eventIdForSignup) return;
    const meetingValue = editableMeetingAt.trim();
    const deadlineValue = editableDeadlineAt.trim();
    const meetingDate = meetingValue ? new Date(meetingValue) : null;
    const deadlineDate = deadlineValue ? new Date(deadlineValue) : null;

    if (meetingDate && Number.isNaN(meetingDate.getTime())) {
      pushToast("Ugyldig mødetid", "error");
      return;
    }
    if (deadlineDate && Number.isNaN(deadlineDate.getTime())) {
      pushToast("Ugyldig deadline", "error");
      return;
    }

    const payload: {
      meetingTime?: string | null;
      signupDeadline?: string;
      thingCarrierId?: string | null;
      beerCarrierId?: string | null;
    } = {
      thingCarrierId: editableThingCarrierId.trim() || null,
      beerCarrierId: editableBeerCarrierId.trim() || null
    };

    if (canEditMatchMeta) {
      payload.meetingTime = meetingDate ? meetingDate.toISOString() : null;
      if (!isDeadlinePassed && deadlineDate) {
        payload.signupDeadline = deadlineDate.toISOString();
      }
    }

    setSavingMatchMeta(true);
    try {
      const response = await fetch(`/api/events/${eventIdForSignup}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) {
        pushToast(data.error ?? "Kunne ikke gemme kampdetaljer", "error");
        return;
      }

      const nextMeeting = data.event?.meetingTime ?? null;
      const nextDeadline = data.event?.signupDeadline ?? eventDeadlineAt;
      const nextThingCarrierId = data.event?.thingCarrierId ?? "";
      const nextBeerCarrierId = data.event?.beerCarrierId ?? "";
      setEventDeadlineAt(nextDeadline);
      setEditableMeetingAt(toDateTimeLocalValue(nextMeeting));
      setEditableDeadlineAt(toDateTimeLocalValue(nextDeadline));
      setEditableThingCarrierId(nextThingCarrierId);
      setEditableBeerCarrierId(nextBeerCarrierId);
      setEvents((prev) =>
        prev.map((item) =>
          item.id === eventIdForSignup || item.id === selectedEvent?.id
            ? {
                ...item,
                meetingTime: nextMeeting,
                signupDeadline: nextDeadline,
                thingCarrierId: nextThingCarrierId || null,
                beerCarrierId: nextBeerCarrierId || null
              }
            : item
        )
      );
      setSelectedEvent((prev) =>
        prev
          ? {
              ...prev,
              meetingTime: nextMeeting,
              signupDeadline: nextDeadline,
              thingCarrierId: nextThingCarrierId || null,
              beerCarrierId: nextBeerCarrierId || null
            }
          : prev
      );
      eventDetailsCacheRef.current.delete(eventIdForSignup);
      pushToast("Begivenhed opdateret", "success");
    } finally {
      setSavingMatchMeta(false);
    }
  }

  async function setSignup(status: "IN" | "OUT") {
    if (selectedEvent?.canceledAt) return;
    if (!eventIdForSignup || !userId) return;
    if (signupSubmitting) return;
    if (signupStatus === status) return;
    if (status === "OUT" && reason.trim().length < 2) {
      setError("Skriv venligst hvorfor du ikke kan komme.");
      pushToast("Skriv venligst hvorfor du ikke kan komme.", "error");
      return;
    }
    setSignupSubmitting(status);
    try {
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
      if (eventIdForSignup) {
        const logResponse = await fetch(`/api/events/${eventIdForSignup}/signup/logs`, { cache: "no-store" });
        const logData = await logResponse.json();
        setLogs(logData.logs ?? []);
        setEventLogs(canManageEvents ? (logData.eventLogs ?? []) : []);
        eventDetailsCacheRef.current.set(eventIdForSignup, {
          signupStatus: status,
          reason: status === "OUT" ? reason : "",
          eventDeadlineAt,
          editableMeetingAt,
          editableDeadlineAt,
          editableThingCarrierId,
          editableBeerCarrierId,
          eventSignups: signupsData.signups ?? [],
          logs: logData.logs ?? [],
          eventLogs: logData.eventLogs ?? []
        });
      }
      pushToast(status === "IN" ? "Du er tilmeldt" : "Du er frameldt", "success");
    } finally {
      setSignupSubmitting(null);
    }
  }

  async function cancelEvent() {
    if (!eventIdForSignup || !canManageEvents) return;
    if (cancelSubmitting) return;
    setCancelSubmitting(true);
    try {
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
      eventDetailsCacheRef.current.delete(eventIdForSignup);
      pushToast("Begivenhed aflyst", "success");
    } finally {
      setCancelSubmitting(false);
    }
  }

  async function reopenEvent() {
    if (!eventIdForSignup || !canManageEvents) return;
    if (reopenSubmitting) return;
    setReopenSubmitting(true);
    try {
      const response = await fetch(`/api/events/${eventIdForSignup}/reopen`, { method: "POST" });
      if (!response.ok) {
        pushToast("Kunne ikke genåbne begivenhed", "error");
        return;
      }
      await response.json();
      setSelectedEvent((prev) =>
        prev ? { ...prev, canceledAt: null, canceledByName: null } : prev
      );
      setEvents((prev) =>
        prev.map((eventItem) =>
          eventItem.id === eventIdForSignup ? { ...eventItem, canceledAt: null, canceledByName: null } : eventItem
        )
      );
      eventDetailsCacheRef.current.delete(eventIdForSignup);
      pushToast("Begivenhed genåbnet", "success");
    } finally {
      setReopenSubmitting(false);
    }
  }

  async function updateSeriesEndDate(seriesId: string, newEndDate: string) {
    setUpdatingSeriesId(seriesId);
    try {
      const endIso = toIsoEndOfLocalDay(newEndDate);
      await fetch(`/api/event-series/${seriesId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endDate: endIso })
      });
    } finally {
      setUpdatingSeriesId((prev) => (prev === seriesId ? null : prev));
    }
  }

  const signupMap = useMemo(() => {
    return new Map(eventSignups.map((signup) => [signup.userId, signup.status]));
  }, [eventSignups]);

  const signupGroups = useMemo(() => {
    const grouped = {
      in: [] as DashboardTeamMember[],
      out: [] as DashboardTeamMember[],
      missing: [] as DashboardTeamMember[]
    };
    for (const member of members) {
      const status = signupMap.get(member.user.id);
      if (status === "IN") grouped.in.push(member);
      else if (status === "OUT") grouped.out.push(member);
      else grouped.missing.push(member);
    }
    return grouped;
  }, [members, signupMap]);

  const activeDeadlineAt = useMemo(() => {
    if (eventDeadlineAt) return eventDeadlineAt;
    const fromLogs = logs.find((entry) => entry.deadlineAt)?.deadlineAt;
    return fromLogs ?? null;
  }, [eventDeadlineAt, logs]);

  const lateGroups = useMemo(() => {
    const deadlineMs = activeDeadlineAt ? new Date(activeDeadlineAt).getTime() : null;
    if (!deadlineMs) {
      return { lateResponses: [] as DashboardTeamMember[], missingAfterDeadline: [] as DashboardTeamMember[] };
    }

    const latestLogByUser = new Map<string, SignupLog>();
    for (const log of logs) {
      if (!latestLogByUser.has(log.user.id)) {
        latestLogByUser.set(log.user.id, log);
      }
    }

    const lateResponses: DashboardTeamMember[] = [];
    const missingAfterDeadline: DashboardTeamMember[] = [];
    const now = Date.now();

    for (const member of members) {
      if (member.role === "SOME") continue;
      const status = signupMap.get(member.user.id);
      const latestLog = latestLogByUser.get(member.user.id);
      const latestAt = latestLog ? new Date(latestLog.createdAt).getTime() : null;

      if ((status === "IN" || status === "OUT") && latestAt && latestAt > deadlineMs) {
        lateResponses.push(member);
        continue;
      }

      if ((!status || status === "UNKNOWN") && now > deadlineMs) {
        missingAfterDeadline.push(member);
      }
    }

    return { lateResponses, missingAfterDeadline };
  }, [activeDeadlineAt, logs, members, signupMap]);

  const lateFineCandidates = useMemo(() => {
    return Array.from(
      new Set([...lateGroups.lateResponses, ...lateGroups.missingAfterDeadline].map((member) => member.user.id))
    );
  }, [lateGroups]);

  useEffect(() => {
    setSelectedLateFineUserIds((prev) => {
      if (lateFineCandidates.length === 0) return [];
      if (prev.length === 0) return lateFineCandidates;
      const allowed = new Set(lateFineCandidates);
      const kept = prev.filter((id) => allowed.has(id));
      return kept.length > 0 ? kept : lateFineCandidates;
    });
  }, [lateFineCandidates]);

  function toggleLateFineUser(userId: string) {
    setSelectedLateFineUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  }

  function openSignupEditor(member: DashboardTeamMember) {
    if (!canEditOtherSignups) return;
    const currentStatus = signupMap.get(member.user.id);
    const initialStatus: "IN" | "OUT" | "UNKNOWN" =
      currentStatus === "IN" || currentStatus === "OUT" ? currentStatus : "UNKNOWN";
    const latestReason = logs.find((entry) => entry.user.id === member.user.id)?.reason ?? "";
    setEditingSignupMember(member);
    setEditingSignupStatus(initialStatus);
    setEditingSignupReason(initialStatus === "OUT" ? latestReason : "");
  }

  async function saveEditedSignup() {
    if (!editingSignupMember || !eventIdForSignup || !userId) return;
    if (editingSignupSubmitting) return;
    if (editingSignupStatus === "OUT" && editingSignupReason.trim().length < 2) {
      pushToast("Skriv venligst en begrundelse.", "error");
      return;
    }

    setEditingSignupSubmitting(true);
    try {
      const response = await fetch(`/api/events/${eventIdForSignup}/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: editingSignupMember.user.id,
          status: editingSignupStatus,
          reason: editingSignupStatus === "OUT" ? editingSignupReason : undefined
        })
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        pushToast(data.error ?? "Kunne ikke opdatere tilmelding", "error");
        return;
      }

      const [signupsResponse, logResponse] = await Promise.all([
        fetch(`/api/events/${eventIdForSignup}/signups`, { cache: "no-store" }),
        fetch(`/api/events/${eventIdForSignup}/signup/logs`, { cache: "no-store" })
      ]);
      const [signupsData, logData] = await Promise.all([signupsResponse.json(), logResponse.json()]);
      setEventSignups(signupsData.signups ?? []);
      setLogs(logData.logs ?? []);
      setEventLogs(canManageEvents ? (logData.eventLogs ?? []) : []);
      eventDetailsCacheRef.current.set(eventIdForSignup, {
        signupStatus,
        reason,
        eventDeadlineAt,
        editableMeetingAt,
        editableDeadlineAt,
        editableThingCarrierId,
        editableBeerCarrierId,
        eventSignups: signupsData.signups ?? [],
        logs: logData.logs ?? [],
        eventLogs: logData.eventLogs ?? []
      });
      pushToast("Tilmelding opdateret", "success");
      setEditingSignupMember(null);
    } finally {
      setEditingSignupSubmitting(false);
    }
  }

  async function assignLateSignupFine() {
    if (!canAssignLateFine || !teamId || !userId || !eventIdForSignup) return;
    if (lateFineSubmitting) return;
    if (!selectedLateFineTemplateId) {
      pushToast("Vælg en bødeskabelon først", "error");
      return;
    }
    if (selectedLateFineUserIds.length === 0) {
      pushToast("Ingen spillere at give bøde til", "info");
      return;
    }

    setLateFineSubmitting(true);
    try {
      const responses = await Promise.all(
        selectedLateFineUserIds.map((targetUserId) =>
          fetch("/api/fines", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              teamId,
              userId: targetUserId,
              templateId: selectedLateFineTemplateId,
              eventId: eventIdForSignup
            })
          })
        )
      );

      const failed = responses.find((response) => !response.ok);
      if (failed) {
        const data = await failed.json().catch(() => ({}));
        pushToast(data.error ?? "Kunne ikke oprette bøder", "error");
        return;
      }

      pushToast(`Bøder oprettet for ${selectedLateFineUserIds.length} spiller(e)`, "success");
    } finally {
      setLateFineSubmitting(false);
    }
  }

  function showListView() {
    setViewMode("list");
    const start = new Date();
    const end = new Date();
    end.setDate(end.getDate() + 180);
    const next = { start: start.toISOString(), end: end.toISOString() };
    lastRangeRef.current = next;
    setRange(next);
  }

  function showCalendarView() {
    setViewMode("calendar");
  }

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
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-full border border-ink/15 bg-white/80 p-1">
              <button
                type="button"
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  viewMode === "calendar" ? "bg-ink text-fog" : "text-ink/75 hover:text-ink"
                }`}
                onClick={showCalendarView}
              >
                Kalender
              </button>
              <button
                type="button"
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  viewMode === "list" ? "bg-ink text-fog" : "text-ink/75 hover:text-ink"
                }`}
                onClick={showListView}
              >
                Liste
              </button>
            </div>
            {canManageEvents ? (
              <button className="btn-primary" onClick={() => setShowModal(true)} disabled={creatingEvent}>
                Opret begivenhed
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <div className="card">
        {viewMode === "calendar" ? (
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
                    meetingTime: info.event.extendedProps.meetingTime ?? null,
                    signupDeadline: info.event.extendedProps.signupDeadline ?? null,
                    source: String(info.event.extendedProps.source ?? "MANUAL"),
                    seriesId: info.event.extendedProps.seriesId ?? null,
                    thingCarrierId: info.event.extendedProps.thingCarrierId ?? null,
                    beerCarrierId: info.event.extendedProps.beerCarrierId ?? null,
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
        ) : (
          <div className="overflow-hidden rounded-2xl border border-ink/10 bg-white/95">
            {loadingCalendar ? (
              <p className="p-4 text-sm text-ink/60">Indlæser kommende begivenheder...</p>
            ) : upcomingEvents.length === 0 ? (
              <p className="p-4 text-sm text-ink/60">Ingen kommende begivenheder.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-ink/5 text-xs uppercase tracking-[0.14em] text-ink/60">
                    <tr>
                      <th className="px-4 py-3">Dato</th>
                      <th className="px-4 py-3">Tid</th>
                      <th className="px-4 py-3">Begivenhed</th>
                      <th className="px-4 py-3">Sted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {upcomingEvents.map((eventItem) => {
                      const date = new Date(eventItem.date);
                      const statusLabel = eventItem.canceledAt
                        ? "Aflyst"
                        : eventItem.signupStatus === "IN"
                        ? "Jeg kommer"
                        : eventItem.signupStatus === "OUT"
                        ? "Jeg kan ikke"
                        : "Mangler svar";
                      const rowToneClass = eventItem.canceledAt
                        ? "border-l-4 border-l-ink/35 bg-ink/5"
                        : eventItem.signupStatus === "IN"
                        ? "border-l-4 border-l-green-500 bg-green-50/60"
                        : eventItem.signupStatus === "OUT"
                        ? "border-l-4 border-l-red-500 bg-red-50/60"
                        : "border-l-4 border-l-amber-500 bg-amber-50/60";

                      return (
                        <tr
                          key={eventItem.id}
                          className={`cursor-pointer border-t border-ink/10 transition-colors hover:bg-ink/5 ${rowToneClass}`}
                          aria-label={`${eventItem.title} - ${statusLabel}`}
                          title={statusLabel}
                          onClick={() => {
                            if (openingEventId) return;
                            openEvent(eventItem);
                          }}
                        >
                          <td className="px-4 py-3 text-ink/80">{date.toLocaleDateString("da-DK")}</td>
                          <td className="px-4 py-3 text-ink/80">
                            {date.toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" })}
                          </td>
                          <td className={`px-4 py-3 font-semibold text-ink ${eventItem.canceledAt ? "line-through opacity-70" : ""}`}>
                            {eventItem.title}
                          </td>
                          <td className="px-4 py-3 text-ink/70">{eventItem.location || "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
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
                        disabled={updatingSeriesId === item.id}
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
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal-panel max-w-lg" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-ink">Opret gentagen begivenhed</h3>
                <p className="mt-2 text-sm text-ink/70">Vælg start, interval og evt. slutdato.</p>
              </div>
              <button className="btn-ghost" onClick={() => setShowModal(false)} disabled={creatingEvent}>
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
              <button className="btn-primary" disabled={creatingEvent}>
                {creatingEvent ? "Opretter..." : "Opret"}
              </button>
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
        <div className="modal-backdrop" onClick={() => setSelectedEvent(null)}>
          <div className="modal-panel max-w-lg" onClick={(event) => event.stopPropagation()}>
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
                  <button className="btn-ghost" onClick={reopenEvent} disabled={reopenSubmitting}>
                    {reopenSubmitting ? "Genåbner..." : "Genåbn begivenhed"}
                  </button>
                ) : (
                  <button className="btn-ghost" onClick={cancelEvent} disabled={cancelSubmitting}>
                    {cancelSubmitting ? "Aflyser..." : "Aflys begivenhed"}
                  </button>
                )
              ) : null}
              {canViewMatchMeta ? (
                <div className="rounded-2xl border border-ink/10 bg-white/90 p-4">
                  <p className="label">Kampdetaljer</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="min-w-0 space-y-2">
                      <label className="label" htmlFor="meeting-time">Mødetid</label>
                      {canEditMatchMeta ? (
                        <input
                          id="meeting-time"
                          type="datetime-local"
                          className="input min-w-0"
                          value={editableMeetingAt}
                          onChange={(event) => setEditableMeetingAt(event.target.value)}
                        />
                      ) : (
                        <div className="input flex items-center justify-between gap-3">
                          <span className="text-ink/75">{splitLocalDateTime(editableMeetingAt).date}</span>
                          <span className="rounded-full bg-ember/15 px-3 py-1 text-sm font-bold text-ember">
                            {splitLocalDateTime(editableMeetingAt).time}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 space-y-2">
                      <label className="label" htmlFor="deadline-time">Svarfrist</label>
                      {canEditMatchMeta ? (
                        <input
                          id="deadline-time"
                          type="datetime-local"
                          className="input min-w-0"
                          value={editableDeadlineAt}
                          onChange={(event) => setEditableDeadlineAt(event.target.value)}
                          readOnly={isDeadlinePassed}
                          disabled={isDeadlinePassed}
                        />
                      ) : (
                        <div className="input flex items-center justify-between gap-3">
                          <span className="text-ink/75">{splitLocalDateTime(editableDeadlineAt).date}</span>
                          <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-800">
                            {splitLocalDateTime(editableDeadlineAt).time}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  {!canEditMatchMeta ? (
                    <p className="mt-2 text-xs text-ink/60">
                      Kun admin og bødekasseformand kan ændre disse værdier.
                    </p>
                  ) : null}
                  {isDeadlinePassed ? (
                    <p className="mt-2 text-xs font-semibold text-amber-700">
                      Deadline er passeret og kan ikke længere ændres.
                    </p>
                  ) : null}
                  {canEditMatchMeta ? (
                    <div className="mt-3 flex items-center justify-end">
                      <button className="btn-primary" type="button" onClick={saveMatchMeta} disabled={savingMatchMeta}>
                        {savingMatchMeta ? "Gemmer..." : "Gem kampdetaljer"}
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
              {canEditEventDuties ? (
                <div className="rounded-2xl border border-ink/10 bg-white/90 p-4">
                  <p className="label">Praktisk</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="label" htmlFor="thing-carrier">Tingene</label>
                      <select
                        id="thing-carrier"
                        className="input"
                        value={editableThingCarrierId}
                        onChange={(event) => setEditableThingCarrierId(event.target.value)}
                      >
                        <option value="">Ingen valgt</option>
                        {members.map((member) => (
                          <option key={`thing-${member.user.id}`} value={member.user.id}>
                            {member.user.name ?? "Ukendt"}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="label" htmlFor="beer-carrier">Øl</label>
                      <select
                        id="beer-carrier"
                        className="input"
                        value={editableBeerCarrierId}
                        onChange={(event) => setEditableBeerCarrierId(event.target.value)}
                      >
                        <option value="">Ingen valgt</option>
                        {members.map((member) => (
                          <option key={`beer-${member.user.id}`} value={member.user.id}>
                            {member.user.name ?? "Ukendt"}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-end">
                    <button className="btn-primary" type="button" onClick={saveMatchMeta} disabled={savingMatchMeta}>
                      {savingMatchMeta ? "Gemmer..." : "Gem opgaver"}
                    </button>
                  </div>
                </div>
              ) : null}
              <div className="flex gap-2">
                <button
                  className={`rounded-full px-5 py-3 text-sm font-semibold uppercase tracking-[0.2em] ${
                    signupStatus === "IN" ? "bg-green-600 text-white" : "bg-green-100 text-green-700"
                  } ${
                    selectedEvent?.canceledAt || signupStatus === "IN" ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                  onClick={() => setSignup("IN")}
                  disabled={
                    Boolean(selectedEvent?.canceledAt) ||
                    signupSubmitting !== null ||
                    signupStatus === "IN" ||
                    eventDetailsLoading
                  }
                >
                  {signupSubmitting === "IN" ? "Gemmer..." : eventDetailsLoading ? "Henter..." : "Jeg kommer"}
                </button>
                <button
                  className={`rounded-full px-5 py-3 text-sm font-semibold uppercase tracking-[0.2em] ${
                    signupStatus === "OUT" ? "bg-red-600 text-white" : "bg-red-100 text-red-700"
                  } ${
                    selectedEvent?.canceledAt || signupStatus === "OUT" ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                  onClick={() => setSignup("OUT")}
                  disabled={
                    Boolean(selectedEvent?.canceledAt) ||
                    signupSubmitting !== null ||
                    signupStatus === "OUT" ||
                    eventDetailsLoading
                  }
                >
                  {signupSubmitting === "OUT" ? "Gemmer..." : eventDetailsLoading ? "Henter..." : "Jeg kan ikke"}
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
                {eventDetailsLoading ? (
                  <p className="mt-3 text-sm text-ink/60">Henter tilmeldinger...</p>
                ) : (
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
                        <button
                          key={member.user.id}
                          type="button"
                          onClick={() => openSignupEditor(member)}
                          className={`block text-left ${canEditOtherSignups ? "hover:underline" : ""}`}
                          disabled={!canEditOtherSignups}
                        >
                          {member.user.name ?? "Ukendt"}
                        </button>
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
                        <button
                          key={member.user.id}
                          type="button"
                          onClick={() => openSignupEditor(member)}
                          className={`block text-left ${canEditOtherSignups ? "hover:underline" : ""}`}
                          disabled={!canEditOtherSignups}
                        >
                          {member.user.name ?? "Ukendt"}
                        </button>
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
                        <button
                          key={member.user.id}
                          type="button"
                          onClick={() => openSignupEditor(member)}
                          className={`block text-left ${canEditOtherSignups ? "hover:underline" : ""}`}
                          disabled={!canEditOtherSignups}
                        >
                          {member.user.name ?? "Ukendt"}
                        </button>
                      ))}
                    </div>
                  </div>
                  </div>
                )}
              </div>
              {editingSignupMember ? (
                <div className="mt-4 rounded-2xl border border-ink/10 bg-white/90 p-4">
                  <p className="label">Rediger tilmelding</p>
                  <p className="mt-1 text-sm text-ink/70">{editingSignupMember.user.name ?? "Ukendt"}</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <button
                      type="button"
                      className={`rounded-full px-4 py-2 text-sm font-semibold ${
                        editingSignupStatus === "IN" ? "bg-green-600 text-white" : "bg-green-100 text-green-700"
                      }`}
                      onClick={() => setEditingSignupStatus("IN")}
                    >
                      Jeg kommer
                    </button>
                    <button
                      type="button"
                      className={`rounded-full px-4 py-2 text-sm font-semibold ${
                        editingSignupStatus === "OUT" ? "bg-red-600 text-white" : "bg-red-100 text-red-700"
                      }`}
                      onClick={() => setEditingSignupStatus("OUT")}
                    >
                      Jeg kan ikke
                    </button>
                    <button
                      type="button"
                      className={`rounded-full px-4 py-2 text-sm font-semibold ${
                        editingSignupStatus === "UNKNOWN" ? "bg-amber-500 text-white" : "bg-amber-100 text-amber-800"
                      }`}
                      onClick={() => setEditingSignupStatus("UNKNOWN")}
                    >
                      Mangler svar
                    </button>
                  </div>
                  <div className="mt-3 space-y-2">
                    <label className="label">Begrundelse</label>
                    <textarea
                      className="input min-h-[80px]"
                      placeholder="Valgfri begrundelse (påkrævet ved 'Jeg kan ikke')"
                      value={editingSignupReason}
                      onChange={(event) => setEditingSignupReason(event.target.value)}
                    />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={saveEditedSignup}
                      disabled={editingSignupSubmitting}
                    >
                      {editingSignupSubmitting ? "Gemmer..." : "Gem ændring"}
                    </button>
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => setEditingSignupMember(null)}
                      disabled={editingSignupSubmitting}
                    >
                      Annuller
                    </button>
                  </div>
                </div>
              ) : null}
              {(lateGroups.lateResponses.length > 0 || lateGroups.missingAfterDeadline.length > 0) &&
              activeDeadlineAt ? (
                <div className="mt-4 rounded-2xl border border-red-200 bg-red-50/70 p-4">
                  <div>
                    <p className="label text-red-700">Efter deadline</p>
                    <p className="mt-1 text-xs text-red-700/80">
                      Deadline: {formatTimestamp(activeDeadlineAt)}
                    </p>
                  </div>
                  {!canAssignLateFine ? (
                    <p className="mt-2 text-xs text-ink/60">
                      Kun bødeformand/admin kan tildele bøder herfra.
                    </p>
                  ) : (
                    <>
                      <select
                        className="input mt-3 w-full min-w-0 max-w-xl"
                        value={selectedLateFineTemplateId}
                        onChange={(event) => setSelectedLateFineTemplateId(event.target.value)}
                      >
                        <option value="">Vælg bødeskabelon</option>
                        {fineTemplates.map((template) => (
                          <option key={template.id} value={template.id}>
                            {template.title} ({template.amount} kr)
                          </option>
                        ))}
                      </select>
                      {fineTemplates.length === 0 ? (
                        <p className="mt-2 text-xs text-ink/60">
                          Ingen godkendte bødeskabeloner fundet endnu.
                        </p>
                      ) : (
                        <div className="my-3 flex flex-col gap-2">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              className="btn-ghost min-h-[2.75rem] flex-1 text-xs"
                              onClick={() => setSelectedLateFineUserIds(lateFineCandidates)}
                            >
                              Vælg alle
                            </button>
                            <button
                              type="button"
                              className="btn-ghost min-h-[2.75rem] flex-1 text-xs"
                              onClick={() => setSelectedLateFineUserIds([])}
                            >
                              Fravælg alle
                            </button>
                          </div>
                          <button
                            className="btn-primary w-full mt-1"
                            type="button"
                            onClick={assignLateSignupFine}
                            disabled={
                              !selectedLateFineTemplateId ||
                              selectedLateFineUserIds.length === 0 ||
                              lateFineSubmitting
                            }
                          >
                            {lateFineSubmitting
                              ? "Opretter..."
                              : `Giv bøde til ${selectedLateFineUserIds.length}`}
                          </button>
                        </div>
                      )}
                    </>
                  )}
                  <div className="mt-3 grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm font-semibold text-ink">
                        <span className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full bg-red-600" />
                          Svar efter deadline
                        </span>
                        <span className="text-ink/60">{lateGroups.lateResponses.length}</span>
                      </div>
                      <div className="space-y-1 text-sm text-ink/75">
                        {lateGroups.lateResponses.length === 0 ? <div>Ingen</div> : null}
                        {lateGroups.lateResponses.map((member) => (
                          <label key={`late-${member.user.id}`} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={selectedLateFineUserIds.includes(member.user.id)}
                              onChange={() => toggleLateFineUser(member.user.id)}
                            />
                            <span>{member.user.name ?? "Ukendt"}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm font-semibold text-ink">
                        <span className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                          Mangler svar efter deadline
                        </span>
                        <span className="text-ink/60">{lateGroups.missingAfterDeadline.length}</span>
                      </div>
                      <div className="space-y-1 text-sm text-ink/75">
                        {lateGroups.missingAfterDeadline.length === 0 ? <div>Ingen</div> : null}
                        {lateGroups.missingAfterDeadline.map((member) => (
                          <label key={`missing-${member.user.id}`} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={selectedLateFineUserIds.includes(member.user.id)}
                              onChange={() => toggleLateFineUser(member.user.id)}
                            />
                            <span>{member.user.name ?? "Ukendt"}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
              {canManageEvents && !eventDetailsLoading && (logs.length > 0 || eventLogs.length > 0) ? (
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
                      ...eventLogs
                        .filter((entry) => entry.type !== "SIGNUP")
                        .map((entry) => ({
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
                              "status" in entry
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
