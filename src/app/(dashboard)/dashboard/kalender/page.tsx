"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProvider";
import { MotmRevealOverlay, type MotmRevealRow } from "@/components/MotmRevealOverlay";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import daLocale from "@fullcalendar/core/locales/da";
import "@fullcalendar/common/main.css";
import "@fullcalendar/daygrid/main.css";
import { useDashboardTeam, type DashboardTeamMember } from "@/components/DashboardTeamProvider";
import { CollapsibleCard } from "@/components/CollapsibleCard";
import {
  DutyWheelModal,
  type DutyWheelAppliedPayload,
  type DutyWheelNextEvent
} from "@/components/DutyWheelModal";
import { DutyWheelOpenIcon } from "@/components/DutyWheelOpenIcon";

type CalendarEvent = {
  id: string;
  title: string;
  date: string;
  location: string;
  meetingTime?: string | null;
  signupDeadline?: string | null;
  source: string;
  seriesId?: string | null;
  kind?: string | null;
  matchHomeGoals?: number | null;
  matchAwayGoals?: number | null;
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
  kind?: string | null;
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

type MatchStatRowFields = {
  goals: string;
  assists: string;
  yellowCards: string;
  redCards: string;
};

type CachedEventDetails = {
  signupStatus: "IN" | "OUT" | "UNKNOWN";
  reason: string;
  eventDeadlineAt: string | null;
  editableMeetingAt: string;
  editableDeadlineAt: string;
  editableThingCarrierId: string;
  editableBeerCarrierId: string;
  eventKind?: string | null;
  editableMatchHome?: string;
  editableMatchAway?: string;
  matchStatRows?: Record<string, MatchStatRowFields>;
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

type MotmPollVote = {
  userId: string;
  weight: number;
};

type MotmPollVoter = {
  userId: string;
  name: string;
  createdAt: string;
};

type MotmPollScoreRow = MotmRevealRow & {
  image?: string | null;
};

type MotmPoll = {
  id: string;
  status: "OPEN" | "CLOSED";
  createdById: string;
  votesPerVoter: number;
  revealCount: number;
  closedAt: string | null;
  totalBallots: number;
  canManage: boolean;
  isCreator: boolean;
  myVotes: MotmPollVote[];
  voters: MotmPollVoter[] | null;
  scoreboard: MotmPollScoreRow[];
  revealRows: MotmPollScoreRow[];
  winner: MotmPollScoreRow | null;
};

type RevealState = {
  eventTitle: string;
  revealRows: MotmRevealRow[];
  scoreboard: MotmRevealRow[];
  winner: MotmRevealRow | null;
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
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
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
  const canManageMotmPoll = canAssignLateFine;
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
        kind: eventItem.kind ?? null,
        matchHomeGoals: eventItem.matchHomeGoals ?? null,
        matchAwayGoals: eventItem.matchAwayGoals ?? null,
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
  const [dutyWheelKind, setDutyWheelKind] = useState<"thing" | "beer" | null>(null);
  const [dutyWheelMeta, setDutyWheelMeta] = useState<{
    beerPreviouslyUserIds: string[];
    nextEvent: DutyWheelNextEvent | null;
  } | null>(null);
  const [dutyWheelOpening, setDutyWheelOpening] = useState(false);
  const [savingMatchMeta, setSavingMatchMeta] = useState(false);
  const [editableMatchHome, setEditableMatchHome] = useState("");
  const [editableMatchAway, setEditableMatchAway] = useState("");
  const [matchStatRows, setMatchStatRows] = useState<Record<string, MatchStatRowFields>>({});
  const [savingMatchStats, setSavingMatchStats] = useState(false);
  const [matchStatSearch, setMatchStatSearch] = useState("");
  const [showMatchStatsEditor, setShowMatchStatsEditor] = useState(false);
  const [copyingLocation, setCopyingLocation] = useState(false);
  const [newEventKind, setNewEventKind] = useState<"TRAINING" | "MATCH">("TRAINING");
  const [savingEventKind, setSavingEventKind] = useState(false);
  const [draftEventKind, setDraftEventKind] = useState<"TRAINING" | "MATCH">("TRAINING");
  const [selectedLateFineUserIds, setSelectedLateFineUserIds] = useState<string[]>([]);
  const [editingSignupMember, setEditingSignupMember] = useState<DashboardTeamMember | null>(null);
  const [editingSignupStatus, setEditingSignupStatus] = useState<"IN" | "OUT" | "UNKNOWN">("UNKNOWN");
  const [editingSignupReason, setEditingSignupReason] = useState("");
  const [editingSignupSubmitting, setEditingSignupSubmitting] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<SignupLog[]>([]);
  const [eventLogs, setEventLogs] = useState<EventLog[]>([]);
  const [motmPoll, setMotmPoll] = useState<MotmPoll | null>(null);
  const [motmWinner, setMotmWinner] = useState<{ id: string; name: string; image?: string | null } | null>(null);
  const [motmLoading, setMotmLoading] = useState(false);
  const [motmSubmitting, setMotmSubmitting] = useState(false);
  const [motmVotesPerVoterDraft, setMotmVotesPerVoterDraft] = useState("3");
  const [motmRevealCountDraft, setMotmRevealCountDraft] = useState("5");
  const [motmVoteDraft, setMotmVoteDraft] = useState<Record<string, string>>({});
  const [revealState, setRevealState] = useState<RevealState | null>(null);
  const handledFocusKeyRef = useRef<string | null>(null);
  const eventDetailsCacheRef = useRef<Map<string, CachedEventDetails>>(new Map());
  const motmBroadcastRef = useRef<BroadcastChannel | null>(null);
  const lastMotmPollStatusRef = useRef<"OPEN" | "CLOSED" | null>(null);

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

  function buildMatchStatRows(
    stats:
      | Array<{
          userId: string;
          goals: number;
          assists: number;
          yellowCards?: number;
          redCards?: number;
        }>
      | undefined
  ) {
    const rows: Record<string, MatchStatRowFields> = {};
    for (const m of members) {
      const stat = stats?.find((s) => s.userId === m.user.id);
      rows[m.user.id] = {
        goals: String(stat?.goals ?? 0),
        assists: String(stat?.assists ?? 0),
        yellowCards: String(stat?.yellowCards ?? 0),
        redCards: String(stat?.redCards ?? 0)
      };
    }
    return rows;
  }

  function applyEventDetailPayload(apiEvent: {
    kind?: string | null;
    matchHomeGoals?: number | null;
    matchAwayGoals?: number | null;
    matchPlayerStats?: Array<{
      userId: string;
      goals: number;
      assists: number;
      yellowCards?: number;
      redCards?: number;
    }>;
  }) {
    setDraftEventKind(apiEvent.kind === "MATCH" ? "MATCH" : "TRAINING");
    setEditableMatchHome(apiEvent.matchHomeGoals != null ? String(apiEvent.matchHomeGoals) : "");
    setEditableMatchAway(apiEvent.matchAwayGoals != null ? String(apiEvent.matchAwayGoals) : "");
    setMatchStatRows(buildMatchStatRows(apiEvent.matchPlayerStats));
  }

  function openMotmReveal(nextState: RevealState) {
    setRevealState(nextState);
    try {
      motmBroadcastRef.current?.postMessage(nextState);
    } catch {
      // BroadcastChannel may be unavailable in some browsers.
    }
  }

  function closeEventModal() {
    setShowCancelConfirm(false);
    setShowMatchStatsEditor(false);
    setDutyWheelKind(null);
    setDutyWheelMeta(null);
    setDutyWheelOpening(false);
    setSelectedEvent(null);
    setEventIdForSignup(null);
    setMotmPoll(null);
    setMotmWinner(null);
    setMotmVoteDraft({});
    setMotmLoading(false);
    lastMotmPollStatusRef.current = null;
  }

  async function openDutyWheelForEvent(kind: "thing" | "beer") {
    if (!eventIdForSignup) return;
    setDutyWheelOpening(true);
    try {
      const response = await fetch(`/api/events/${eventIdForSignup}/duty-wheel`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        pushToast(typeof data.error === "string" ? data.error : "Kunne ikke åbne hjulet", "error");
        return;
      }
      const nextRaw = data.nextEvent;
      const nextEvent: DutyWheelNextEvent | null =
        nextRaw &&
        typeof nextRaw.id === "string" &&
        typeof nextRaw.title === "string" &&
        typeof nextRaw.date === "string" &&
        typeof nextRaw.kind === "string"
          ? {
              id: nextRaw.id,
              title: nextRaw.title,
              date: nextRaw.date,
              kind: nextRaw.kind
            }
          : null;
      setDutyWheelMeta({
        beerPreviouslyUserIds: Array.isArray(data.beerPreviouslyUserIds) ? data.beerPreviouslyUserIds : [],
        nextEvent
      });
      setDutyWheelKind(kind);
    } finally {
      setDutyWheelOpening(false);
    }
  }

  function handleDutyWheelApplied(payload: DutyWheelAppliedPayload) {
    eventDetailsCacheRef.current.delete(payload.targetEventId);
    setEvents((prev) =>
      prev.map((item) =>
        item.id === payload.targetEventId
          ? {
              ...item,
              ...(payload.field === "thingCarrierId"
                ? { thingCarrierId: payload.userId }
                : { beerCarrierId: payload.userId })
            }
          : item
      )
    );
    setSelectedEvent((prev) =>
      prev && prev.id === payload.targetEventId
        ? {
            ...prev,
            ...(payload.field === "thingCarrierId"
              ? { thingCarrierId: payload.userId }
              : { beerCarrierId: payload.userId })
          }
        : prev
    );
    if (payload.targetEventId === eventIdForSignup) {
      if (payload.field === "thingCarrierId") {
        setEditableThingCarrierId(payload.userId);
      } else {
        setEditableBeerCarrierId(payload.userId);
      }
    }
  }

  function motmOpenPollFingerprint(poll: MotmPoll) {
    return JSON.stringify({
      id: poll.id,
      status: poll.status,
      totalBallots: poll.totalBallots,
      votesPerVoter: poll.votesPerVoter,
      revealCount: poll.revealCount,
      isCreator: poll.isCreator,
      canManage: poll.canManage,
      myVotes: poll.myVotes,
      voters: poll.voters
    });
  }

  function applyMotmResponse(
    data: { poll?: MotmPoll | null; matchMotmUser?: { id: string; name: string; image?: string | null } | null },
    eventTitle: string,
    options?: { syncDraft?: boolean }
  ) {
    const nextPoll = data.poll ?? null;
    setMotmPoll((prev) => {
      if (!nextPoll) return nextPoll;
      if (
        prev &&
        prev.status === "OPEN" &&
        nextPoll.status === "OPEN" &&
        prev.id === nextPoll.id &&
        motmOpenPollFingerprint(prev) === motmOpenPollFingerprint(nextPoll)
      ) {
        return prev;
      }
      return nextPoll;
    });
    setMotmWinner((prev) => {
      const next = data.matchMotmUser
        ? { id: data.matchMotmUser.id, name: data.matchMotmUser.name, image: data.matchMotmUser.image ?? null }
        : null;
      if (
        prev?.id === next?.id &&
        prev?.name === next?.name &&
        prev?.image === next?.image
      ) {
        return prev;
      }
      return next;
    });
    if (nextPoll) {
      if (options?.syncDraft) {
        setMotmVoteDraft(() => {
          const next: Record<string, string> = {};
          for (const m of members) {
            const found = nextPoll.myVotes.find((vote) => vote.userId === m.user.id);
            next[m.user.id] = found ? String(found.weight) : "0";
          }
          return next;
        });
      }
      if (lastMotmPollStatusRef.current === "OPEN" && nextPoll.status === "CLOSED" && nextPoll.isCreator) {
        openMotmReveal({
          eventTitle,
          revealRows: nextPoll.revealRows.map((row) => ({
            rank: row.rank,
            userId: row.userId,
            name: row.name,
            votes: row.votes
          })),
          scoreboard: nextPoll.scoreboard.map((row) => ({
            rank: row.rank,
            userId: row.userId,
            name: row.name,
            votes: row.votes
          })),
          winner: nextPoll.winner
            ? {
                rank: nextPoll.winner.rank,
                userId: nextPoll.winner.userId,
                name: nextPoll.winner.name,
                votes: nextPoll.winner.votes
              }
            : null
        });
      }
      lastMotmPollStatusRef.current = nextPoll.status;
      return;
    }
    lastMotmPollStatusRef.current = null;
  }

  async function loadMotmPoll(
    eventId: string,
    eventTitle: string,
    loadOpts?: { showSpinner?: boolean; syncDraftFromServer?: boolean }
  ) {
    if (loadOpts?.showSpinner) setMotmLoading(true);
    try {
      const response = await fetch(`/api/events/${eventId}/motm-poll`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) return;
      applyMotmResponse(data, eventTitle, {
        syncDraft: loadOpts?.syncDraftFromServer ?? false
      });
    } finally {
      if (loadOpts?.showSpinner) setMotmLoading(false);
    }
  }

  async function openMotmPoll() {
    if (!eventIdForSignup || !canManageMotmPoll) return;
    const votesParsed = Math.max(1, Math.min(10, parseInt(motmVotesPerVoterDraft, 10) || 1));
    const revealParsed = Math.max(1, Math.min(10, parseInt(motmRevealCountDraft, 10) || 1));
    setMotmSubmitting(true);
    try {
      const response = await fetch(`/api/events/${eventIdForSignup}/motm-poll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ votesPerVoter: votesParsed, revealCount: revealParsed })
      });
      const data = await response.json();
      if (!response.ok) {
        pushToast(data.error ?? "Kunne ikke åbne afstemning", "error");
        return;
      }
      applyMotmResponse(data, selectedEvent?.title ?? "Kampens spiller", { syncDraft: true });
      pushToast("MOTM-afstemning åbnet", "success");
    } finally {
      setMotmSubmitting(false);
    }
  }

  async function persistMotmVote(): Promise<{ ok: boolean; totalBallots?: number }> {
    if (!eventIdForSignup || !motmPoll || motmPoll.status !== "OPEN") {
      return { ok: true };
    }
    const selections = members
      .map((member) => ({
        userId: member.user.id,
        weight: Math.max(0, parseInt(motmVoteDraft[member.user.id] ?? "0", 10) || 0)
      }))
      .filter((entry) => entry.weight > 0);
    const total = members.reduce(
      (sum, member) => sum + Math.max(0, parseInt(motmVoteDraft[member.user.id] ?? "0", 10) || 0),
      0
    );
    if (total !== motmPoll.votesPerVoter) {
      return { ok: false };
    }
    const response = await fetch(`/api/events/${eventIdForSignup}/motm-poll/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ selections })
    });
    const data = await response.json();
    if (!response.ok) {
      pushToast(data.error ?? "Kunne ikke gemme stemme", "error");
      return { ok: false };
    }
    applyMotmResponse(data, selectedEvent?.title ?? "Kampens spiller", { syncDraft: true });
    const totalBallots = typeof data.poll?.totalBallots === "number" ? data.poll.totalBallots : undefined;
    return { ok: true, totalBallots };
  }

  async function closeMotmPoll() {
    if (!eventIdForSignup || !motmPoll || !motmPoll.isCreator) return;
    if (motmVoteTotal > 0 && motmVoteTotal !== motmPoll.votesPerVoter) {
      pushToast(
        "Fordel alle dine stemmer, eller sæt alle tilbage til 0, før du lukker afstemningen.",
        "error"
      );
      return;
    }
    const revealTitle = selectedEvent?.title ?? "Kampens spiller";
    setMotmSubmitting(true);
    try {
      let totalBallotsHint = motmPoll.totalBallots;
      if (motmVoteTotal === motmPoll.votesPerVoter) {
        const saved = await persistMotmVote();
        if (!saved.ok) return;
        totalBallotsHint = saved.totalBallots ?? totalBallotsHint;
      }
      if (
        totalBallotsHint === 0 &&
        !window.confirm(
          "Ingen har gemt en stemme endnu. Hvis du lukker nu, bliver der ikke registreret nogen stemmer. Vil du lukke alligevel?"
        )
      ) {
        return;
      }
      const response = await fetch(`/api/events/${eventIdForSignup}/motm-poll/close`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) {
        pushToast(data.error ?? "Kunne ikke lukke afstemning", "error");
        return;
      }
      applyMotmResponse(data, revealTitle, { syncDraft: true });
      closeEventModal();
      pushToast("Afstemning lukket", "success");
    } finally {
      setMotmSubmitting(false);
    }
  }

  async function resetMotmPoll() {
    if (!eventIdForSignup || !canManageMotmPoll || !motmPoll) return;
    if (
      !window.confirm(
        motmPoll.status === "CLOSED"
          ? "Nulstil MOTM-afstemningen? Det sletter den gemte vinder og alle tilhørende stemmer."
          : "Nulstil MOTM-afstemningen? Det sletter alle afgivne stemmer."
      )
    ) {
      return;
    }
    setMotmSubmitting(true);
    try {
      const response = await fetch(`/api/events/${eventIdForSignup}/motm-poll`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) {
        pushToast(data.error ?? "Kunne ikke nulstille afstemning", "error");
        return;
      }
      applyMotmResponse(data, selectedEvent?.title ?? "Kampens spiller", { syncDraft: true });
      setMotmVoteDraft({});
      pushToast("MOTM-afstemning nulstillet", "success");
    } finally {
      setMotmSubmitting(false);
    }
  }

  async function submitMotmVote() {
    if (!eventIdForSignup || !motmPoll || motmPoll.status !== "OPEN") return;
    if (motmVoteTotal !== motmPoll.votesPerVoter) {
      pushToast(`Fordel præcis ${motmPoll.votesPerVoter} stemmer før du gemmer.`, "error");
      return;
    }
    setMotmSubmitting(true);
    try {
      const result = await persistMotmVote();
      if (result.ok) {
        pushToast("Stemme gemt", "success");
      }
    } finally {
      setMotmSubmitting(false);
    }
  }

  const motmVoteTotal = members.reduce(
    (sum, member) => sum + Math.max(0, parseInt(motmVoteDraft[member.user.id] ?? "0", 10) || 0),
    0
  );

  function adjustMotmVote(userId: string, delta: 1 | -1) {
    if (!motmPoll || motmPoll.status !== "OPEN") return;
    setMotmVoteDraft((prev) => {
      const current = Math.max(0, parseInt(prev[userId] ?? "0", 10) || 0);
      const currentTotal = members.reduce(
        (sum, member) => sum + Math.max(0, parseInt(prev[member.user.id] ?? "0", 10) || 0),
        0
      );
      if (delta > 0 && currentTotal >= motmPoll.votesPerVoter) {
        return prev;
      }
      const nextValue = Math.max(0, current + delta);
      return {
        ...prev,
        [userId]: String(nextValue)
      };
    });
  }

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
                signupDeadline: new Date(new Date(startIso).getTime() - deadlineHours * 60 * 60 * 1000).toISOString(),
                kind: newEventKind
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
                signupDeadlineHoursBefore: deadlineHours,
                kind: newEventKind
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
      setNewEventKind("TRAINING");
      loadedSeriesKeyRef.current = null;
      loadedCalendarKeyRef.current = null;
    } finally {
      setCreatingEvent(false);
    }
  }

  async function openEvent(eventItem: CalendarEvent) {
    if (openingEventId) return;
    if (!teamId || !userId) return;
    let pollLoadId = "";
    const pollLoadTitle = eventItem.title;
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
      setMotmPoll(null);
      setMotmWinner(null);
      setMotmVoteDraft({});
      lastMotmPollStatusRef.current = null;

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
        if (response.ok && data.event) {
          eventId = data.event.id;
          setSelectedEvent((prev) =>
            prev
              ? {
                  ...prev,
                  id: data.event.id,
                  kind: data.event.kind ?? prev.kind,
                  seriesId: data.event.seriesId ?? prev.seriesId
                }
              : prev
          );
        }
      }

      setEventIdForSignup(eventId);
      pollLoadId = eventId;
      const cachedDetails = eventDetailsCacheRef.current.get(eventId);
      if (cachedDetails) {
        setSignupStatus(cachedDetails.signupStatus);
        setReason(cachedDetails.reason);
        setEventDeadlineAt(cachedDetails.eventDeadlineAt);
        setEditableMeetingAt(cachedDetails.editableMeetingAt);
        setEditableDeadlineAt(cachedDetails.editableDeadlineAt);
        setEditableThingCarrierId(cachedDetails.editableThingCarrierId);
        setEditableBeerCarrierId(cachedDetails.editableBeerCarrierId);
        setDraftEventKind(cachedDetails.eventKind === "MATCH" ? "MATCH" : "TRAINING");
        setEditableMatchHome(cachedDetails.editableMatchHome ?? "");
        setEditableMatchAway(cachedDetails.editableMatchAway ?? "");
        {
          const rawRows = cachedDetails.matchStatRows ?? {};
          setMatchStatRows(
            Object.fromEntries(
              members.map((m) => {
                const r = rawRows[m.user.id];
                return [
                  m.user.id,
                  {
                    goals: r?.goals ?? "0",
                    assists: r?.assists ?? "0",
                    yellowCards: r?.yellowCards ?? "0",
                    redCards: r?.redCards ?? "0"
                  }
                ];
              })
            )
          );
        }
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
      if (statusData.event) {
        applyEventDetailPayload(statusData.event);
        setSelectedEvent((prev) =>
          prev
            ? {
                ...prev,
                source: statusData.event.source,
                kind: statusData.event.kind ?? prev.kind,
                matchHomeGoals: statusData.event.matchHomeGoals ?? prev.matchHomeGoals ?? null,
                matchAwayGoals: statusData.event.matchAwayGoals ?? prev.matchAwayGoals ?? null,
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
        eventKind: statusData.event?.kind ?? null,
        editableMatchHome:
          statusData.event?.matchHomeGoals != null ? String(statusData.event.matchHomeGoals) : "",
        editableMatchAway:
          statusData.event?.matchAwayGoals != null ? String(statusData.event.matchAwayGoals) : "",
        matchStatRows: buildMatchStatRows(
          statusData.event?.matchPlayerStats as
            | Array<{
                userId: string;
                goals: number;
                assists: number;
                yellowCards?: number;
                redCards?: number;
              }>
            | undefined
        ),
        eventSignups: signupsData.signups ?? [],
        logs: logData.logs ?? [],
        eventLogs: logData.eventLogs ?? []
      });
    } finally {
      setEventDetailsLoading(false);
      setOpeningEventId(null);
      if (pollLoadId) {
        void loadMotmPoll(pollLoadId, pollLoadTitle, { showSpinner: true, syncDraftFromServer: true });
      }
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

  const resolvedEventKind =
    selectedEvent?.kind ?? (selectedEvent?.source === "ICAL" ? "MATCH" : "TRAINING");
  const isMatchEvent = resolvedEventKind === "MATCH";

  useEffect(() => {
    if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel("holdbold-motm");
    motmBroadcastRef.current = channel;
    channel.onmessage = (message) => {
      const payload = message.data as RevealState | null;
      if (!payload) return;
      openMotmReveal(payload);
    };
    return () => {
      channel.close();
      motmBroadcastRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!selectedEvent || !eventIdForSignup || motmPoll?.status !== "OPEN") return;
    const timer = window.setInterval(() => {
      void loadMotmPoll(eventIdForSignup, selectedEvent.title);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [eventIdForSignup, motmPoll?.status, selectedEvent]);
  const canViewMatchMeta = Boolean(isMatchEvent);
  const canEditMatchMeta = Boolean(isMatchEvent && canAssignLateFine && eventIdForSignup);
  const canEditEventDuties = Boolean(eventIdForSignup);
  const isDeadlinePassed = Boolean(
    eventDeadlineAt && new Date(eventDeadlineAt).getTime() <= Date.now()
  );
  const signupLockedPastStart = Boolean(
    selectedEvent?.date && new Date(selectedEvent.date).getTime() <= Date.now()
  );
  const locationMapUrl = selectedEvent?.location?.trim()
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedEvent.location.trim())}`
    : null;

  async function copyLocationToClipboard() {
    if (!selectedEvent?.location?.trim() || copyingLocation) return;
    setCopyingLocation(true);
    try {
      await navigator.clipboard.writeText(selectedEvent.location.trim());
      pushToast("Adresse kopieret", "success");
    } catch {
      pushToast("Kunne ikke kopiere adresse", "error");
    } finally {
      setCopyingLocation(false);
    }
  }

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
              beerCarrierId: nextBeerCarrierId || null,
              ...(data.event?.kind ? { kind: data.event.kind } : {}),
              ...(data.event?.matchHomeGoals !== undefined
                ? { matchHomeGoals: data.event.matchHomeGoals }
                : {}),
              ...(data.event?.matchAwayGoals !== undefined
                ? { matchAwayGoals: data.event.matchAwayGoals }
                : {})
            }
          : prev
      );
      if (data.event) {
        applyEventDetailPayload(data.event);
      }
      eventDetailsCacheRef.current.delete(eventIdForSignup);
      pushToast("Begivenhed opdateret", "success");
    } finally {
      setSavingMatchMeta(false);
    }
  }

  async function saveEventKind() {
    if (!eventIdForSignup || !canManageEvents) return;
    setSavingEventKind(true);
    try {
      const response = await fetch(`/api/events/${eventIdForSignup}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: draftEventKind })
      });
      const data = await response.json();
      if (!response.ok) {
        pushToast(data.error ?? "Kunne ikke gemme type", "error");
        return;
      }
      if (data.event) {
        applyEventDetailPayload(data.event);
        setSelectedEvent((prev) =>
          prev
            ? {
                ...prev,
                kind: data.event.kind,
                matchHomeGoals: data.event.matchHomeGoals ?? null,
                matchAwayGoals: data.event.matchAwayGoals ?? null
              }
            : prev
        );
      }
      setEvents((prev) =>
        prev.map((item) =>
          item.id === eventIdForSignup ? { ...item, kind: draftEventKind } : item
        )
      );
      eventDetailsCacheRef.current.delete(eventIdForSignup);
      pushToast("Type opdateret", "success");
    } finally {
      setSavingEventKind(false);
    }
  }

  async function saveMatchStats() {
    if (!eventIdForSignup || !canManageEvents) return;
    const homeTrim = editableMatchHome.trim();
    const awayTrim = editableMatchAway.trim();
    const matchPlayerStats = members.map((m) => ({
      userId: m.user.id,
      goals: Math.max(0, parseInt(matchStatRows[m.user.id]?.goals ?? "0", 10) || 0),
      assists: Math.max(0, parseInt(matchStatRows[m.user.id]?.assists ?? "0", 10) || 0),
      yellowCards: Math.max(0, parseInt(matchStatRows[m.user.id]?.yellowCards ?? "0", 10) || 0),
      redCards: Math.max(0, parseInt(matchStatRows[m.user.id]?.redCards ?? "0", 10) || 0)
    }));
    setSavingMatchStats(true);
    try {
      const response = await fetch(`/api/events/${eventIdForSignup}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchHomeGoals: homeTrim === "" ? null : Math.max(0, parseInt(homeTrim, 10) || 0),
          matchAwayGoals: awayTrim === "" ? null : Math.max(0, parseInt(awayTrim, 10) || 0),
          matchPlayerStats
        })
      });
      const data = await response.json();
      if (!response.ok) {
        pushToast(data.error ?? "Kunne ikke gemme kampstatistik", "error");
        return;
      }
      if (data.event) {
        applyEventDetailPayload(data.event);
        setSelectedEvent((prev) =>
          prev
            ? {
                ...prev,
                matchHomeGoals: data.event.matchHomeGoals ?? null,
                matchAwayGoals: data.event.matchAwayGoals ?? null
              }
            : prev
        );
      }
      eventDetailsCacheRef.current.delete(eventIdForSignup);
      setShowMatchStatsEditor(false);
      setMatchStatSearch("");
      pushToast("Kampstatistik gemt", "success");
    } finally {
      setSavingMatchStats(false);
    }
  }

  async function setSignup(status: "IN" | "OUT") {
    if (selectedEvent?.canceledAt) return;
    if (signupLockedPastStart) {
      pushToast("Begivenheden er afviklet – du kan ikke ændre dit svar.", "error");
      return;
    }
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
          eventKind: draftEventKind,
          editableMatchHome,
          editableMatchAway,
          matchStatRows,
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
      setShowCancelConfirm(false);
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
      setShowCancelConfirm(false);
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

  const filteredMatchMembers = useMemo(() => {
    const needle = matchStatSearch.trim().toLowerCase();
    if (!needle) return members;
    return members.filter((member) => (member.user.name ?? "").toLowerCase().includes(needle));
  }, [members, matchStatSearch]);

  const matchStatSummaryEntries = useMemo(() => {
    return members
      .map((member) => {
        const goals = Math.max(0, parseInt(matchStatRows[member.user.id]?.goals ?? "0", 10) || 0);
        const assists = Math.max(0, parseInt(matchStatRows[member.user.id]?.assists ?? "0", 10) || 0);
        const yellowCards = Math.max(0, parseInt(matchStatRows[member.user.id]?.yellowCards ?? "0", 10) || 0);
        const redCards = Math.max(0, parseInt(matchStatRows[member.user.id]?.redCards ?? "0", 10) || 0);
        if (goals === 0 && assists === 0 && yellowCards === 0 && redCards === 0) return null;
        const parts: string[] = [];
        if (goals > 0) parts.push(`${goals}x mål`);
        if (assists > 0) parts.push(`${assists}x assist${assists === 1 ? "" : "s"}`);
        if (yellowCards > 0) parts.push(`${yellowCards}x gult kort`);
        if (redCards > 0) parts.push(`${redCards}x rødt kort`);
        return { userId: member.user.id, name: member.user.name ?? "Ukendt", summary: parts.join(" · ") };
      })
      .filter((entry): entry is { userId: string; name: string; summary: string } => Boolean(entry));
  }, [members, matchStatRows]);

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
        eventKind: draftEventKind,
        editableMatchHome,
        editableMatchAway,
        matchStatRows,
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
      <header className="card !p-4 sm:!p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <div className="min-w-0">
            <h2 className="font-display text-xl font-semibold leading-tight text-ink sm:text-2xl">Kalender</h2>
            <p className="mt-1 text-sm leading-snug text-ink/70">Overblik over kampe og træning.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            <div className="inline-flex w-full rounded-full border border-ink/15 bg-white/80 p-1 sm:w-auto">
              <button
                type="button"
                className={`min-h-[2.75rem] flex-1 rounded-full px-4 py-2 text-sm font-semibold transition sm:min-h-0 sm:flex-none ${
                  viewMode === "calendar" ? "bg-ink text-fog" : "text-ink/75 hover:text-ink"
                }`}
                onClick={showCalendarView}
              >
                Kalender
              </button>
              <button
                type="button"
                className={`min-h-[2.75rem] flex-1 rounded-full px-4 py-2 text-sm font-semibold transition sm:min-h-0 sm:flex-none ${
                  viewMode === "list" ? "bg-ink text-fog" : "text-ink/75 hover:text-ink"
                }`}
                onClick={showListView}
              >
                Liste
              </button>
            </div>
            {canManageEvents ? (
              <button
                className="btn-primary w-full whitespace-nowrap sm:w-auto"
                onClick={() => setShowModal(true)}
                disabled={creatingEvent}
              >
                Opret begivenhed
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <div className="card !p-3 sm:!p-5">
        {viewMode === "calendar" ? (
          <div className="overflow-hidden rounded-app-soft bg-white/40">
            <FullCalendar
              plugins={[dayGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              locales={[daLocale]}
              locale="da"
              headerToolbar={{ left: "prev,next today", center: "title", right: "" }}
              buttonText={{
                today: "I dag"
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
                    kind: info.event.extendedProps.kind ?? null,
                    matchHomeGoals: info.event.extendedProps.matchHomeGoals ?? null,
                    matchAwayGoals: info.event.extendedProps.matchAwayGoals ?? null,
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
                const timePart = arg.timeText?.trim() ?? "";
                return (
                  <div
                    className={`w-full min-w-0 text-left ${canceled ? "line-through opacity-60" : ""}`}
                  >
                    <div className="flex gap-1.5 sm:items-center sm:gap-2">
                      <span
                        className="mt-0.5 h-2 w-2 shrink-0 rounded-full sm:mt-0"
                        style={{ backgroundColor: color }}
                        aria-hidden
                      />
                      <span className="min-w-0 break-words leading-snug">
                        {timePart ? (
                          <span className="whitespace-nowrap font-semibold tabular-nums text-ink/80">
                            {timePart}
                            <span className="mx-0.5 font-normal text-ink/35" aria-hidden>
                              ·
                            </span>
                          </span>
                        ) : null}
                        <span className="font-semibold text-ink">{arg.event.title}</span>
                      </span>
                    </div>
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
                <label className="label" htmlFor="event-kind">Type</label>
                <select
                  id="event-kind"
                  className="input"
                  value={newEventKind}
                  onChange={(event) => setNewEventKind(event.target.value as "TRAINING" | "MATCH")}
                >
                  <option value="TRAINING">Træning</option>
                  <option value="MATCH">Kamp</option>
                </select>
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
        <>
        <div
          className="modal-backdrop"
          onClick={() => {
            closeEventModal();
          }}
        >
          <div className="modal-panel max-w-xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className={`text-lg font-semibold text-ink ${selectedEvent.canceledAt ? "line-through" : ""}`}>
                  {selectedEvent.title}
                </h3>
                <p className="mt-2 text-sm text-ink/70">{formatTimestamp(selectedEvent.date)}</p>
                {selectedEvent.location ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {locationMapUrl ? (
                      <a
                        href={locationMapUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-medium text-moss underline decoration-moss/35 underline-offset-2"
                        title="Åbn adresse i kort"
                      >
                        {selectedEvent.location}
                      </a>
                    ) : (
                      <p className="text-sm text-ink/70">{selectedEvent.location}</p>
                    )}
                    <button
                      type="button"
                      className="btn-ghost px-3 py-1.5 text-xs"
                      onClick={copyLocationToClipboard}
                      disabled={copyingLocation}
                    >
                      {copyingLocation ? "Kopierer..." : "Kopiér"}
                    </button>
                  </div>
                ) : null}
                {selectedEvent.canceledAt ? (
                  <p className="mt-2 text-sm font-semibold text-red-600">
                    Aflyst af {selectedEvent.canceledByName ?? "Administrator"}
                  </p>
                ) : null}
              </div>
              <button className="btn-ghost" onClick={closeEventModal}>
                Luk
              </button>
            </div>
            <div className="mt-4 flex flex-col gap-3">
              {canManageEvents ? (
                <CollapsibleCard
                  title="Begivenhed"
                  storageKey="event-modal-begivenhed"
                  defaultOpen={!isMobile}
                  className="order-11"
                  surface="card"
                  titleClassName="text-xs font-semibold text-ink/70"
                >
                  {selectedEvent.canceledAt ? (
                    <button className="btn-ghost w-full sm:w-auto sm:min-w-[13rem]" onClick={reopenEvent} disabled={reopenSubmitting}>
                      {reopenSubmitting ? "Genåbner..." : "Genåbn begivenhed"}
                    </button>
                  ) : showCancelConfirm ? (
                    <div className="space-y-3">
                      <p className="text-sm font-semibold text-ink">Er du sikker på, at du vil aflyse begivenheden?</p>
                      <p className="text-xs text-ink/60">Alle deltagere vil stadig kunne se, at begivenheden er aflyst.</p>
                      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                        <button type="button" className="btn-ghost w-full sm:w-auto" onClick={() => setShowCancelConfirm(false)}>
                          Annuller
                        </button>
                        <button
                          type="button"
                          className="w-full rounded-control bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 sm:w-auto"
                          onClick={cancelEvent}
                          disabled={cancelSubmitting}
                        >
                          {cancelSubmitting ? "Aflyser..." : "Ja, aflys begivenhed"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      className="btn-ghost w-full sm:w-auto sm:min-w-[13rem]"
                      onClick={() => setShowCancelConfirm(true)}
                      disabled={cancelSubmitting}
                    >
                      Aflys begivenhed
                    </button>
                  )}
                </CollapsibleCard>
              ) : null}
              {canManageEvents && eventIdForSignup && !selectedEvent.canceledAt ? (
                <CollapsibleCard
                  title="Begivenhedstype"
                  storageKey="event-modal-kind"
                  defaultOpen={!isMobile}
                  className="order-6"
                  surface="card"
                  titleClassName="text-xs font-semibold text-ink/70"
                >
                  <div className="flex flex-wrap items-end justify-center gap-3 sm:justify-start">
                    <select
                      className="input min-w-[10rem] flex-1"
                      value={draftEventKind}
                      onChange={(event) => setDraftEventKind(event.target.value as "TRAINING" | "MATCH")}
                    >
                      <option value="TRAINING">Træning</option>
                      <option value="MATCH">Kamp</option>
                    </select>
                    <button
                      type="button"
                      className="btn-primary w-full sm:w-auto sm:min-w-[10rem]"
                      onClick={saveEventKind}
                      disabled={savingEventKind}
                    >
                      {savingEventKind ? "Gemmer..." : "Gem type"}
                    </button>
                  </div>
                </CollapsibleCard>
              ) : null}
              {canViewMatchMeta ? (
                <CollapsibleCard
                  title="Kampdetaljer"
                  storageKey="event-modal-match-meta"
                  defaultOpen={!isMobile}
                  className="order-7"
                  surface="card"
                  titleClassName="text-xs font-semibold text-ink/70"
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="min-w-0 space-y-2 overflow-hidden">
                      <label className="text-xs font-medium text-ink/70" htmlFor="meeting-time">Mødetid</label>
                      {canEditMatchMeta ? (
                        <input
                          id="meeting-time"
                          type="datetime-local"
                          className="input min-w-0 w-full max-w-full text-[13px] sm:text-[15px]"
                          value={editableMeetingAt}
                          onChange={(event) => setEditableMeetingAt(event.target.value)}
                        />
                      ) : (
                        <div className="input flex items-center justify-between gap-3">
                          <span className="min-w-0 truncate text-ink/75">{splitLocalDateTime(editableMeetingAt).date}</span>
                          <span className="rounded-full bg-ember/15 px-3 py-1 text-sm font-bold text-ember">
                            {splitLocalDateTime(editableMeetingAt).time}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 space-y-2 overflow-hidden">
                      <label className="text-xs font-medium text-ink/70" htmlFor="deadline-time">Svarfrist</label>
                      {canEditMatchMeta ? (
                        <input
                          id="deadline-time"
                          type="datetime-local"
                          className="input min-w-0 w-full max-w-full text-[13px] sm:text-[15px]"
                          value={editableDeadlineAt}
                          onChange={(event) => setEditableDeadlineAt(event.target.value)}
                          readOnly={isDeadlinePassed}
                          disabled={isDeadlinePassed}
                        />
                      ) : (
                        <div className="input flex items-center justify-between gap-3">
                          <span className="min-w-0 truncate text-ink/75">{splitLocalDateTime(editableDeadlineAt).date}</span>
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
                    <div className="mt-3 flex items-center justify-center sm:justify-end">
                      <button
                        className="btn-primary w-full sm:w-auto sm:min-w-[12rem]"
                        type="button"
                        onClick={saveMatchMeta}
                        disabled={savingMatchMeta}
                      >
                        {savingMatchMeta ? "Gemmer..." : "Gem kampdetaljer"}
                      </button>
                    </div>
                  ) : null}
                </CollapsibleCard>
              ) : null}
              {isMatchEvent && eventIdForSignup && !selectedEvent.canceledAt ? (
                <CollapsibleCard
                  title="Kampresultat og statistik"
                  storageKey="event-modal-match-result"
                  defaultOpen={!isMobile}
                  className="order-8"
                  surface="card"
                  titleClassName="text-xs font-semibold text-ink/70"
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-ink/70" htmlFor="match-home-goals">
                        Hold mål
                      </label>
                      {canManageEvents ? (
                        <input
                          id="match-home-goals"
                          type="number"
                          min={0}
                          className="input"
                          value={editableMatchHome}
                          onChange={(event) => setEditableMatchHome(event.target.value)}
                          placeholder="—"
                        />
                      ) : (
                        <p className="text-sm font-semibold text-ink">{editableMatchHome || "—"}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-ink/70" htmlFor="match-away-goals">
                        Modstander mål
                      </label>
                      {canManageEvents ? (
                        <input
                          id="match-away-goals"
                          type="number"
                          min={0}
                          className="input"
                          value={editableMatchAway}
                          onChange={(event) => setEditableMatchAway(event.target.value)}
                          placeholder="—"
                        />
                      ) : (
                        <p className="text-sm font-semibold text-ink">{editableMatchAway || "—"}</p>
                      )}
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    <p className="text-xs font-medium text-ink/70">
                      Mål, assists og kort
                    </p>
                    <div className="rounded-xl border border-ink/10 bg-white/70 px-3 py-2.5">
                      {matchStatSummaryEntries.length === 0 ? (
                        <p className="text-sm text-ink/60">Ingen registrerede mål, assists eller kort endnu.</p>
                      ) : (
                        <ul className="space-y-1.5">
                          {matchStatSummaryEntries.map((entry) => (
                            <li key={entry.userId} className="text-sm text-ink/80">
                              <span className="font-medium text-ink">{entry.name}</span>: {entry.summary}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                  {canManageEvents && !selectedEvent.canceledAt ? (
                    <div className="mt-3 flex justify-center sm:justify-end">
                      <button
                        type="button"
                        className="btn-primary w-full sm:w-auto sm:min-w-[12rem]"
                        onClick={() => setShowMatchStatsEditor(true)}
                      >
                        Rediger mål, assists og kort
                      </button>
                    </div>
                  ) : null}
                </CollapsibleCard>
              ) : null}
              {isMatchEvent && eventIdForSignup && !selectedEvent.canceledAt ? (
                <CollapsibleCard
                  title="Kampens spiller (MOTM)"
                  storageKey="event-modal-motm"
                  defaultOpen={!isMobile}
                  className="order-9"
                  surface="card"
                  titleClassName="text-xs font-semibold text-ink/70"
                >
                  {motmLoading ? <p className="text-sm text-ink/60">Indlæser afstemning...</p> : null}
                  {motmWinner ? (
                    <p className="text-sm text-ink/80">
                      <span className="font-semibold text-ink">Kampens spiller:</span> {motmWinner.name}
                    </p>
                  ) : null}
                  {!motmPoll && canManageMotmPoll ? (
                    <div className="mt-3 space-y-3">
                      <p className="text-xs text-ink/60">
                        Kun admin og bødekasseformand kan åbne en afstemning. Alle aktive spillere kan stemme, når den er åben.
                      </p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-ink/70" htmlFor="motm-votes-per">
                            Stemmer pr. person
                          </label>
                          <input
                            id="motm-votes-per"
                            type="number"
                            min={1}
                            max={10}
                            className="input"
                            value={motmVotesPerVoterDraft}
                            onChange={(event) => setMotmVotesPerVoterDraft(event.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-ink/70" htmlFor="motm-reveal">
                            Pladser i afsløring
                          </label>
                          <input
                            id="motm-reveal"
                            type="number"
                            min={1}
                            max={10}
                            className="input"
                            value={motmRevealCountDraft}
                            onChange={(event) => setMotmRevealCountDraft(event.target.value)}
                          />
                        </div>
                      </div>
                      <button type="button" className="btn-primary w-full sm:w-auto" onClick={openMotmPoll} disabled={motmSubmitting}>
                        {motmSubmitting ? "Åbner..." : "Åbn MOTM-afstemning"}
                      </button>
                    </div>
                  ) : null}
                  {motmPoll?.status === "OPEN" ? (
                    <div className="mt-3 space-y-4">
                      <div className="rounded-xl border border-ink/10 bg-white/70 px-3 py-2 text-xs text-ink/70">
                        <p>
                          <span className="font-semibold text-ink">Stemmer pr. person:</span> {motmPoll.votesPerVoter}
                        </p>
                        <p className="mt-1">
                          <span className="font-semibold text-ink">Afsløring:</span> Top {motmPoll.revealCount}
                        </p>
                        <p className="mt-1">
                          <span className="font-semibold text-ink">Har stemt:</span> {motmPoll.totalBallots}
                        </p>
                      </div>
                      {motmPoll.isCreator && motmPoll.voters ? (
                        <div>
                          <p className="text-xs font-semibold text-ink/70">Stemmeafgivere</p>
                          <ul className="mt-2 space-y-1 text-sm text-ink/80">
                            {motmPoll.voters.length === 0 ? (
                              <li className="text-ink/60">Ingen har stemt endnu.</li>
                            ) : (
                              motmPoll.voters.map((voter) => (
                                <li key={voter.userId}>{voter.name}</li>
                              ))
                            )}
                          </ul>
                        </div>
                      ) : null}
                      <div className="space-y-3">
                        <p className="text-xs font-semibold text-ink/70">Fordel dine stemmer</p>
                        <p className="text-xs text-ink/55">
                          Brug + og − til at fordele i alt {motmPoll.votesPerVoter} stemmer. Tryk{" "}
                          <span className="font-semibold">Gem stemme</span> for at gemme til serveren med det samme.
                        </p>
                      {motmPoll.isCreator ? (
                          <p className="text-xs text-ink/55">
                            Lukker du afstemningen selv, gemmes dine egne stemmer automatisk, hvis du allerede har fordelt alle
                            stemmer.
                          </p>
                        ) : null}
                        <div className="max-h-[40dvh] space-y-2 overflow-y-auto pr-1">
                          {members.map((member) => (
                            <div
                              key={`motm-${member.user.id}`}
                              className="flex items-center justify-between gap-3 rounded-xl border border-ink/10 bg-white/70 px-3 py-2 text-sm"
                            >
                              <span className="min-w-0 flex-1 truncate font-medium text-ink">
                                {member.user.name ?? "Ukendt"}
                              </span>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  className="btn-ghost h-9 w-9 px-0 text-base"
                                  onClick={() => adjustMotmVote(member.user.id, -1)}
                                  disabled={motmSubmitting || Number(motmVoteDraft[member.user.id] ?? "0") <= 0}
                                >
                                  -
                                </button>
                                <span className="inline-flex h-9 min-w-[2.75rem] items-center justify-center rounded-control border border-ink/10 bg-white px-3 font-semibold text-ink">
                                  {motmVoteDraft[member.user.id] ?? "0"}
                                </span>
                                <button
                                  type="button"
                                  className="btn-ghost h-9 w-9 px-0 text-base"
                                  onClick={() => adjustMotmVote(member.user.id, 1)}
                                  disabled={motmSubmitting || motmVoteTotal >= motmPoll.votesPerVoter}
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <p className="text-xs text-ink/60">
                            Total:{" "}
                            <span className="font-semibold text-ink">{motmVoteTotal}</span>{" "}
                            / {motmPoll.votesPerVoter}
                          </p>
                          <button
                            type="button"
                            className="btn-primary w-full sm:w-auto"
                            onClick={submitMotmVote}
                            disabled={motmSubmitting || motmVoteTotal !== motmPoll.votesPerVoter}
                          >
                            {motmSubmitting ? "Gemmer..." : "Gem stemme"}
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                        {motmPoll.isCreator ? (
                          <button
                            type="button"
                            className="btn-ghost w-full sm:w-auto"
                            onClick={closeMotmPoll}
                            disabled={motmSubmitting}
                          >
                            {motmSubmitting ? "Lukker..." : "Luk afstemning og vis resultat"}
                          </button>
                        ) : null}
                        {canManageMotmPoll ? (
                          <button
                            type="button"
                            className="btn-ghost w-full sm:w-auto"
                            onClick={resetMotmPoll}
                            disabled={motmSubmitting}
                          >
                            {motmSubmitting ? "Nulstiller..." : "Nulstil afstemning"}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                  {motmPoll?.status === "CLOSED" ? (
                    <div className="mt-3 space-y-3">
                      {motmPoll.isCreator && motmPoll.scoreboard.length > 0 ? (
                        <div>
                          <p className="text-xs font-semibold text-ink/70">Resultat</p>
                          <ul className="mt-2 space-y-1 text-sm text-ink/80">
                            {motmPoll.scoreboard.map((row) => (
                              <li key={row.userId} className="flex items-center justify-between gap-3">
                                <span>
                                  <span className="font-semibold text-ink/60">{row.rank}.</span> {row.name}
                                </span>
                                <span className="font-semibold text-ink">{row.votes}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {motmPoll.isCreator ? null : (
                        <p className="text-xs text-ink/60">
                          Kun personen der åbnede afstemningen kan se den fulde resultatliste.
                        </p>
                      )}
                      {canManageMotmPoll ? (
                        <button
                          type="button"
                          className="btn-ghost w-full sm:w-auto"
                          onClick={resetMotmPoll}
                          disabled={motmSubmitting}
                        >
                          {motmSubmitting ? "Nulstiller..." : "Nulstil afstemning"}
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </CollapsibleCard>
              ) : null}
              {canEditEventDuties ? (
                <CollapsibleCard
                  title="Praktisk"
                  storageKey="event-modal-praktisk"
                  defaultOpen={!isMobile}
                  className="order-10"
                  surface="card"
                  titleClassName="text-xs font-semibold text-ink/70"
                >
                  <div className="mt-5 grid gap-5 sm:grid-cols-2">
                    <div className="flex min-w-0 flex-col gap-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <label className="text-xs font-medium text-ink/70" htmlFor="thing-carrier">
                          Tingene
                        </label>
                        <button
                          type="button"
                          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-control border border-ink/15 bg-white/80 text-ink/80 hover:border-ink/25 hover:bg-white"
                          aria-label="Træk lod om tingene"
                          title="Træk lod"
                          disabled={dutyWheelOpening || eventDetailsLoading || Boolean(selectedEvent?.canceledAt)}
                          onClick={() => void openDutyWheelForEvent("thing")}
                        >
                          <DutyWheelOpenIcon className="h-[22px] w-[22px]" />
                        </button>
                      </div>
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
                    <div className="flex min-w-0 flex-col gap-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <label className="text-xs font-medium text-ink/70" htmlFor="beer-carrier">
                          Øl
                        </label>
                        <button
                          type="button"
                          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-control border border-ink/15 bg-white/80 text-ink/80 hover:border-ink/25 hover:bg-white"
                          aria-label="Træk lod om øl"
                          title="Træk lod"
                          disabled={dutyWheelOpening || eventDetailsLoading || Boolean(selectedEvent?.canceledAt)}
                          onClick={() => void openDutyWheelForEvent("beer")}
                        >
                          <DutyWheelOpenIcon className="h-[22px] w-[22px]" />
                        </button>
                      </div>
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
                  <div className="mt-5 flex border-t border-ink/10 pt-4 sm:justify-end">
                    <button
                      className="btn-primary w-full sm:w-auto"
                      type="button"
                      onClick={saveMatchMeta}
                      disabled={savingMatchMeta}
                    >
                      {savingMatchMeta ? "Gemmer..." : "Gem opgaver"}
                    </button>
                  </div>
                </CollapsibleCard>
              ) : null}
              <CollapsibleCard
                title="Din tilmelding"
                storageKey="event-modal-din-tilmelding"
                defaultOpen
                className="order-2"
                surface="card"
                titleClassName="text-xs font-semibold text-ink/70"
              >
                {signupLockedPastStart ? (
                  <div className="mb-4 border-b border-ink/10 pb-4">
                    <p className="mt-3 rounded-control border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-950">
                      Begivenheden er afviklet — dit svar kan ikke ændres her.
                    </p>
                  </div>
                ) : null}
                <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                  <button
                    type="button"
                    className={`rounded-control flex min-h-[3rem] items-center justify-center gap-2 px-3 py-2.5 text-sm font-semibold transition ${
                      signupStatus === "IN"
                        ? "bg-green-600 text-white shadow-md ring-2 ring-green-800 ring-offset-2 ring-offset-white"
                        : signupLockedPastStart || selectedEvent?.canceledAt
                          ? "cursor-not-allowed border-2 border-ink/10 bg-ink/[0.04] text-ink/35"
                          : "border-2 border-green-200 bg-green-50 text-green-900 hover:border-green-300 hover:bg-green-100"
                    } ${signupStatus === "IN" ? "cursor-not-allowed" : ""}`}
                    onClick={() => setSignup("IN")}
                    disabled={
                      Boolean(selectedEvent?.canceledAt) ||
                      signupLockedPastStart ||
                      signupSubmitting !== null ||
                      signupStatus === "IN" ||
                      eventDetailsLoading
                    }
                  >
                    {signupSubmitting === "IN" ? (
                      "Gemmer..."
                    ) : eventDetailsLoading ? (
                      "Henter..."
                    ) : (
                      <>
                        {signupStatus === "IN" ? (
                          <span className="text-lg font-bold leading-none" aria-hidden>
                            ✓
                          </span>
                        ) : null}
                        Jeg kommer
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    className={`rounded-control flex min-h-[3rem] items-center justify-center gap-2 px-3 py-2.5 text-sm font-semibold transition ${
                      signupStatus === "OUT"
                        ? "bg-red-600 text-white shadow-md ring-2 ring-red-900 ring-offset-2 ring-offset-white"
                        : signupLockedPastStart || selectedEvent?.canceledAt
                          ? "cursor-not-allowed border-2 border-ink/10 bg-ink/[0.04] text-ink/35"
                          : "border-2 border-red-200 bg-red-50 text-red-900 hover:border-red-300 hover:bg-red-100"
                    } ${signupStatus === "OUT" ? "cursor-not-allowed" : ""}`}
                    onClick={() => setSignup("OUT")}
                    disabled={
                      Boolean(selectedEvent?.canceledAt) ||
                      signupLockedPastStart ||
                      signupSubmitting !== null ||
                      signupStatus === "OUT" ||
                      eventDetailsLoading
                    }
                  >
                    {signupSubmitting === "OUT" ? (
                      "Gemmer..."
                    ) : eventDetailsLoading ? (
                      "Henter..."
                    ) : (
                      <>
                        {signupStatus === "OUT" ? (
                          <span className="text-lg font-bold leading-none" aria-hidden>
                            ✓
                          </span>
                        ) : null}
                        Jeg kan ikke
                      </>
                    )}
                  </button>
                </div>
                <div className="mt-5 space-y-2">
                  <div>
                    <label className="text-xs font-medium text-ink/70" htmlFor="reason">
                      Begrundelse ved afbud <span className="text-red-700">*</span>
                    </label>
                    <p id="reason-hint" className="mt-0.5 text-xs text-ink/50">
                      Påkrævet, når du vælger <strong>Jeg kan ikke</strong>.
                    </p>
                  </div>
                  <textarea
                    id="reason"
                    value={reason}
                    onChange={(event) => {
                      setReason(event.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="Fx. sygdom, skade, arbejde, familie…"
                    className="input min-h-[90px]"
                    disabled={Boolean(selectedEvent?.canceledAt) || signupLockedPastStart}
                    aria-describedby="reason-hint"
                  />
                  {error ? <p className="text-xs text-red-600">{error}</p> : null}
                </div>
              </CollapsibleCard>
              <CollapsibleCard
                title="Tilmeldinger"
                storageKey="event-modal-tilmeldinger"
                defaultOpen
                className="order-2"
                surface="card"
                titleClassName="text-xs font-semibold text-ink/70"
              >
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
              </CollapsibleCard>
              {editingSignupMember ? (
                <CollapsibleCard
                  title="Rediger tilmelding"
                  storageKey="event-modal-rediger-tilmelding"
                  defaultOpen={!isMobile}
                  className="order-5"
                  surface="card"
                  titleClassName="text-xs font-semibold text-ink/70"
                >
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
                    <div>
                      <label className="text-xs font-medium text-ink/70" htmlFor="editing-signup-reason">
                        Begrundelse <span className="text-red-700">*</span>
                      </label>
                      <p className="mt-0.5 text-xs text-ink/50">Påkrævet, når status er «Jeg kan ikke».</p>
                    </div>
                    <textarea
                      id="editing-signup-reason"
                      className="input min-h-[80px]"
                      placeholder="Fx. sygdom, skade, arbejde, familie…"
                      value={editingSignupReason}
                      onChange={(event) => setEditingSignupReason(event.target.value)}
                      aria-required={editingSignupStatus === "OUT"}
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
                </CollapsibleCard>
              ) : null}
              {(lateGroups.lateResponses.length > 0 || lateGroups.missingAfterDeadline.length > 0) &&
              activeDeadlineAt ? (
                <CollapsibleCard
                  title="Efter deadline"
                  storageKey="event-modal-efter-deadline"
                  defaultOpen={!isMobile}
                  className="order-10"
                  surface="card"
                  titleClassName="text-xs font-medium text-red-700"
                >
                  <div>
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
                </CollapsibleCard>
              ) : null}
              {canManageEvents && !eventDetailsLoading && (logs.length > 0 || eventLogs.length > 0) ? (
                <CollapsibleCard
                  title="Historik"
                  storageKey="event-modal-historik"
                  defaultOpen
                  className="order-3"
                  surface="card"
                  titleClassName="text-xs font-semibold text-ink/70"
                >
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
                </CollapsibleCard>
              ) : null}
            </div>
          </div>
        </div>
        {showMatchStatsEditor && canManageEvents && isMatchEvent && selectedEvent && !selectedEvent.canceledAt ? (
          <div
            className="modal-backdrop"
            onClick={() => {
              if (savingMatchStats) return;
              setShowMatchStatsEditor(false);
              setMatchStatSearch("");
            }}
          >
            <div className="modal-panel max-w-lg" style={{ overflowY: "hidden" }} onClick={(event) => event.stopPropagation()}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="label">Kampresultat</p>
                  <h4 className="mt-1 text-base font-semibold text-ink">Mål, assists og kort</h4>
                </div>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => {
                    if (savingMatchStats) return;
                    setShowMatchStatsEditor(false);
                    setMatchStatSearch("");
                  }}
                  disabled={savingMatchStats}
                >
                  Luk
                </button>
              </div>
              <div className="mt-4 space-y-2">
                <input
                  type="search"
                  className="input min-h-0 h-11"
                  placeholder="Søg spiller..."
                  value={matchStatSearch}
                  onChange={(event) => setMatchStatSearch(event.target.value)}
                />
                <div className="max-h-[52dvh] space-y-2 overflow-y-auto overscroll-contain pr-1">
                  {filteredMatchMembers.length === 0 ? (
                    <p className="text-sm text-ink/60">Ingen spillere matcher søgningen.</p>
                  ) : null}
                  {filteredMatchMembers.map((member) => (
                    <div
                      key={`stat-modal-${member.user.id}`}
                      className="rounded-xl border border-ink/10 bg-white/70 p-2.5 text-sm"
                    >
                      <span className="mb-2 block font-medium text-ink">{member.user.name ?? "Ukendt"}</span>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <div className="flex items-center gap-1">
                          <label className="sr-only" htmlFor={`modal-g-${member.user.id}`}>
                            Mål
                          </label>
                          <span className="text-xs text-ink/55">M</span>
                          <input
                            id={`modal-g-${member.user.id}`}
                            type="number"
                            min={0}
                            className="input min-h-0 h-10 w-full px-2 py-1 text-center"
                            value={matchStatRows[member.user.id]?.goals ?? "0"}
                            onChange={(event) =>
                              setMatchStatRows((prev) => ({
                                ...prev,
                                [member.user.id]: {
                                  goals: event.target.value,
                                  assists: prev[member.user.id]?.assists ?? "0",
                                  yellowCards: prev[member.user.id]?.yellowCards ?? "0",
                                  redCards: prev[member.user.id]?.redCards ?? "0"
                                }
                              }))
                            }
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <label className="sr-only" htmlFor={`modal-a-${member.user.id}`}>
                            Assists
                          </label>
                          <span className="text-xs text-ink/55">A</span>
                          <input
                            id={`modal-a-${member.user.id}`}
                            type="number"
                            min={0}
                            className="input min-h-0 h-10 w-full px-2 py-1 text-center"
                            value={matchStatRows[member.user.id]?.assists ?? "0"}
                            onChange={(event) =>
                              setMatchStatRows((prev) => ({
                                ...prev,
                                [member.user.id]: {
                                  goals: prev[member.user.id]?.goals ?? "0",
                                  assists: event.target.value,
                                  yellowCards: prev[member.user.id]?.yellowCards ?? "0",
                                  redCards: prev[member.user.id]?.redCards ?? "0"
                                }
                              }))
                            }
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <label className="sr-only" htmlFor={`modal-yc-${member.user.id}`}>
                            Gule kort
                          </label>
                          <span className="text-xs text-ink/55">Gul</span>
                          <input
                            id={`modal-yc-${member.user.id}`}
                            type="number"
                            min={0}
                            className="input min-h-0 h-10 w-full px-2 py-1 text-center"
                            value={matchStatRows[member.user.id]?.yellowCards ?? "0"}
                            onChange={(event) =>
                              setMatchStatRows((prev) => ({
                                ...prev,
                                [member.user.id]: {
                                  goals: prev[member.user.id]?.goals ?? "0",
                                  assists: prev[member.user.id]?.assists ?? "0",
                                  yellowCards: event.target.value,
                                  redCards: prev[member.user.id]?.redCards ?? "0"
                                }
                              }))
                            }
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <label className="sr-only" htmlFor={`modal-rc-${member.user.id}`}>
                            Røde kort
                          </label>
                          <span className="text-xs text-ink/55">Rød</span>
                          <input
                            id={`modal-rc-${member.user.id}`}
                            type="number"
                            min={0}
                            className="input min-h-0 h-10 w-full px-2 py-1 text-center"
                            value={matchStatRows[member.user.id]?.redCards ?? "0"}
                            onChange={(event) =>
                              setMatchStatRows((prev) => ({
                                ...prev,
                                [member.user.id]: {
                                  goals: prev[member.user.id]?.goals ?? "0",
                                  assists: prev[member.user.id]?.assists ?? "0",
                                  yellowCards: prev[member.user.id]?.yellowCards ?? "0",
                                  redCards: event.target.value
                                }
                              }))
                            }
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  className="btn-ghost w-full sm:w-auto"
                  onClick={() => {
                    if (savingMatchStats) return;
                    setShowMatchStatsEditor(false);
                    setMatchStatSearch("");
                  }}
                  disabled={savingMatchStats}
                >
                  Annuller
                </button>
                <button
                  type="button"
                  className="btn-primary w-full sm:w-auto sm:min-w-[12rem]"
                  onClick={saveMatchStats}
                  disabled={savingMatchStats}
                >
                  {savingMatchStats ? "Gemmer..." : "Gem kampstatistik"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
        {dutyWheelKind && dutyWheelMeta && eventIdForSignup ? (
          <DutyWheelModal
            kind={dutyWheelKind}
            eventId={eventIdForSignup}
            members={members}
            signups={eventSignups}
            beerPreviouslyUserIds={dutyWheelMeta.beerPreviouslyUserIds}
            nextEvent={dutyWheelMeta.nextEvent}
            onClose={() => {
              setDutyWheelKind(null);
              setDutyWheelMeta(null);
            }}
            onApplied={handleDutyWheelApplied}
            showToast={(message, variant) => pushToast(message, variant)}
          />
        ) : null}
        </>
      ) : null}
      <MotmRevealOverlay
        open={Boolean(revealState)}
        eventTitle={revealState?.eventTitle ?? ""}
        revealRows={revealState?.revealRows ?? []}
        scoreboard={revealState?.scoreboard ?? []}
        winner={revealState?.winner ?? null}
        onClose={() => setRevealState(null)}
      />
    </section>
  );
}
