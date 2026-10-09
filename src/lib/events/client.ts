// Klient-hjælpere til begivenheder: typer, URL'er og kald til de eksisterende API'er.

export type SignupStatus = "IN" | "OUT" | "UNKNOWN";
export type EventKind = "TRAINING" | "MATCH";

export type CalendarEvent = {
  id: string;
  title: string;
  date: string;
  location: string;
  meetingTime?: string | null;
  signupDeadline?: string | null;
  source: string;
  seriesId?: string | null;
  kind?: EventKind | string | null;
  thingCarrierId?: string | null;
  beerCarrierId?: string | null;
  matchHomeGoals?: number | null;
  matchAwayGoals?: number | null;
  signupStatus?: SignupStatus | null;
  canceledAt?: string | null;
  canceledByName?: string | null;
};

export type EventSignup = {
  id?: string;
  userId: string;
  status: SignupStatus;
  reason?: string | null;
  user: { id: string; name: string | null; image?: string | null };
};

export type EventDetail = {
  id: string;
  teamId: string;
  title: string;
  date: string;
  location: string;
  source: string;
  kind: EventKind;
  meetingTime: string | null;
  signupDeadline: string | null;
  thingCarrierId: string | null;
  beerCarrierId: string | null;
  canceledAt: string | null;
  matchHomeGoals: number | null;
  matchAwayGoals: number | null;
  matchMotmUser: { id: string; name: string | null; image: string | null } | null;
  matchPlayerStats?: Array<{
    userId: string;
    goals: number;
    assists: number;
    yellowCards: number;
    redCards: number;
  }>;
};

export const isSeriesOccurrence = (id: string) => id.startsWith("series:");

/** Begivenheds-URL. Serie-forekomster (id "series:{seriesId}:{iso}") materialiseres på siden. */
export function eventHref(id: string) {
  return `/dashboard/kalender/${encodeURIComponent(id)}`;
}

export function parseSeriesOccurrenceId(id: string) {
  if (!isSeriesOccurrence(id)) return null;
  const rest = id.slice("series:".length);
  const sep = rest.indexOf(":");
  if (sep < 0) return null;
  return { seriesId: rest.slice(0, sep), date: rest.slice(sep + 1) };
}

async function readJson(response: Response) {
  return response.json().catch(() => ({}));
}

function errorFrom(data: unknown, fallback: string) {
  const error = (data as { error?: unknown })?.error;
  return typeof error === "string" ? error : fallback;
}

export async function fetchCalendarEvents(params: {
  teamId: string;
  userId: string;
  start: Date;
  end: Date;
  /** Færdig querystring-del fra useDashboardTeam().seasonQuery ("&seasonId=…" eller tom). */
  seasonQuery?: string;
}): Promise<CalendarEvent[]> {
  const query = new URLSearchParams({
    teamId: params.teamId,
    start: params.start.toISOString(),
    end: params.end.toISOString(),
    userId: params.userId
  });
  const response = await fetch(`/api/calendar?${query.toString()}${params.seasonQuery ?? ""}`, { cache: "no-store" });
  if (!response.ok) throw new Error("Kunne ikke hente kalenderen");
  const data = await readJson(response);
  const events = ((data.events ?? []) as CalendarEvent[]).map((event) => ({ ...event }));
  const occurrences = ((data.occurrences ?? []) as CalendarEvent[]).map((event) => ({
    ...event,
    signupStatus: null
  }));
  return [...events, ...occurrences].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

/** Giver et rigtigt event-id; opretter forekomsten fra serien hvis nødvendigt. */
export async function materializeEvent(teamId: string, event: Pick<CalendarEvent, "id" | "seriesId" | "date">) {
  if (!isSeriesOccurrence(event.id)) return event.id;
  const parsed = parseSeriesOccurrenceId(event.id);
  const response = await fetch("/api/events/materialize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      teamId,
      seriesId: event.seriesId ?? parsed?.seriesId,
      date: new Date(event.date ?? parsed?.date ?? "").toISOString()
    })
  });
  const data = await readJson(response);
  if (!response.ok || !data.event?.id) throw new Error(errorFrom(data, "Kunne ikke åbne begivenheden"));
  return data.event.id as string;
}

export async function fetchEventDetail(eventId: string): Promise<EventDetail> {
  const response = await fetch(`/api/events/${eventId}`, { cache: "no-store" });
  const data = await readJson(response);
  if (!response.ok || !data.event) throw new Error(errorFrom(data, "Begivenheden blev ikke fundet"));
  return data.event as EventDetail;
}

export async function fetchEventSignups(eventId: string): Promise<EventSignup[]> {
  const response = await fetch(`/api/events/${eventId}/signups`, { cache: "no-store" });
  const data = await readJson(response);
  if (!response.ok) throw new Error(errorFrom(data, "Kunne ikke hente tilmeldinger"));
  return (data.signups ?? []) as EventSignup[];
}

export async function postSignup(eventId: string, body: { userId: string; status: SignupStatus; reason?: string }) {
  const response = await fetch(`/api/events/${eventId}/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: body.userId,
      status: body.status,
      ...(body.status === "OUT" ? { reason: body.reason?.trim() } : {})
    })
  });
  const data = await readJson(response);
  if (!response.ok) throw new Error(errorFrom(data, "Kunne ikke gemme dit svar"));
  return data;
}

export async function patchEvent(eventId: string, body: Record<string, unknown>) {
  const response = await fetch(`/api/events/${eventId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await readJson(response);
  if (!response.ok) throw new Error(errorFrom(data, "Kunne ikke gemme"));
  return data;
}

export function isPast(event: Pick<CalendarEvent, "date">, now = Date.now()) {
  return new Date(event.date).getTime() <= now;
}

export function isDeadlinePassed(event: Pick<CalendarEvent, "signupDeadline">, now = Date.now()) {
  return Boolean(event.signupDeadline && new Date(event.signupDeadline).getTime() < now);
}

export function groupSignups<M extends { user: { id: string; name: string | null; image?: string | null }; status?: string }>(
  members: M[],
  signups: EventSignup[]
) {
  const byUser = new Map(signups.map((signup) => [signup.userId, signup]));
  const coming: Array<{ member: M; signup: EventSignup }> = [];
  const notComing: Array<{ member: M; signup: EventSignup }> = [];
  const missing: Array<{ member: M; signup: null }> = [];
  for (const member of members) {
    if (member.status && member.status !== "ACTIVE") continue;
    const signup = byUser.get(member.user.id);
    if (signup?.status === "IN") coming.push({ member, signup });
    else if (signup?.status === "OUT") notComing.push({ member, signup });
    else missing.push({ member, signup: null });
  }
  const byName = (a: { member: M }, b: { member: M }) =>
    (a.member.user.name ?? "").localeCompare(b.member.user.name ?? "", "da");
  return { coming: coming.sort(byName), notComing: notComing.sort(byName), missing: missing.sort(byName) };
}
