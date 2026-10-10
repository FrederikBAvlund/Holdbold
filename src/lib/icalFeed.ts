import { prisma } from "@/lib/prisma";
import { applyActiveAbsencesToEvent } from "@/lib/absences";
import { createNotifications } from "@/lib/notifications";
import { getActiveSeason } from "@/lib/seasons";
import { formatDateTimeCopenhagen } from "@/lib/format";

const HOUR = 60 * 60 * 1000;
/** Frist og mødetid følger starttidspunktet, så længe de står på standardværdien. */
const DEFAULT_DEADLINE_HOURS = 24;
const DEFAULT_MEETING_HOURS = 1;
/** Feeds hentes automatisk igen, når sidste hentning er ældre end dette. */
export const FEED_REFRESH_MS = 3 * HOUR;

export function subtractHours(date: Date, hours: number) {
  return new Date(date.getTime() - hours * 60 * 60 * 1000);
}

export function normalizeIcalUrl(input: string) {
  const value = input.trim();
  if (value.startsWith("webcal://")) {
    return `https://${value.slice("webcal://".length)}`;
  }
  return value;
}

export function feedNameFromUrl(input: string) {
  try {
    const url = new URL(input);
    return url.hostname;
  } catch {
    return "DBU iCal";
  }
}

export type ParsedIcsEvent = {
  uid: string;
  start: Date;
  summary: string;
  location: string;
  recurrenceId?: Date;
};

type IcsProp = {
  value: string;
  params: Record<string, string>;
};

function unfoldIcsLines(text: string) {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rawLines = normalized.split("\n");
  const lines: string[] = [];
  for (const raw of rawLines) {
    if ((raw.startsWith(" ") || raw.startsWith("\t")) && lines.length > 0) {
      lines[lines.length - 1] += raw.slice(1);
    } else {
      lines.push(raw);
    }
  }
  return lines;
}

function parseIcsLine(line: string): { name: string; value: string; params: Record<string, string> } | null {
  const colonIndex = line.indexOf(":");
  if (colonIndex === -1) return null;

  const left = line.slice(0, colonIndex);
  const value = line.slice(colonIndex + 1);
  const [nameRaw, ...paramParts] = left.split(";");
  const name = nameRaw.trim().toUpperCase();
  const params: Record<string, string> = {};

  for (const part of paramParts) {
    const eqIndex = part.indexOf("=");
    if (eqIndex === -1) continue;
    const key = part.slice(0, eqIndex).trim().toUpperCase();
    const paramValue = part.slice(eqIndex + 1).trim();
    params[key] = paramValue;
  }

  return { name, value, params };
}

function decodeIcsText(value: string) {
  return value
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

function parseIcsDate(value: string): Date | null {
  const raw = value.trim();
  if (!raw) return null;

  const dateOnlyMatch = raw.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const month = Number(dateOnlyMatch[2]) - 1;
    const day = Number(dateOnlyMatch[3]);
    const result = new Date(year, month, day, 12, 0, 0, 0);
    return Number.isNaN(result.getTime()) ? null : result;
  }

  const dtMatch = raw.match(
    /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/
  );
  if (!dtMatch) return null;

  const year = Number(dtMatch[1]);
  const month = Number(dtMatch[2]) - 1;
  const day = Number(dtMatch[3]);
  const hour = Number(dtMatch[4]);
  const minute = Number(dtMatch[5]);
  const second = Number(dtMatch[6] ?? "0");
  const isUtc = Boolean(dtMatch[7]);

  const result = isUtc
    ? new Date(Date.UTC(year, month, day, hour, minute, second, 0))
    : new Date(year, month, day, hour, minute, second, 0);
  return Number.isNaN(result.getTime()) ? null : result;
}

export function parseIcsEvents(icsText: string): ParsedIcsEvent[] {
  const lines = unfoldIcsLines(icsText);
  const events: ParsedIcsEvent[] = [];

  let inEvent = false;
  let props: Record<string, IcsProp> = {};

  for (const lineRaw of lines) {
    const line = lineRaw.trimEnd();
    if (!line) continue;

    if (line.toUpperCase() === "BEGIN:VEVENT") {
      inEvent = true;
      props = {};
      continue;
    }

    if (line.toUpperCase() === "END:VEVENT") {
      const uid = decodeIcsText(props.UID?.value ?? "").trim();
      const start = parseIcsDate(props.DTSTART?.value ?? "");
      if (uid && start) {
        events.push({
          uid,
          start,
          summary: decodeIcsText(props.SUMMARY?.value ?? "Kamp").trim() || "Kamp",
          location: decodeIcsText(props.LOCATION?.value ?? "").trim(),
          recurrenceId: parseIcsDate(props["RECURRENCE-ID"]?.value ?? "")
            ?? undefined
        });
      }
      inEvent = false;
      props = {};
      continue;
    }

    if (!inEvent) continue;
    const parsed = parseIcsLine(line);
    if (!parsed) continue;
    // Keep first occurrence for each property; enough for our use-case.
    if (!props[parsed.name]) {
      props[parsed.name] = { value: parsed.value, params: parsed.params };
    }
  }

  return events;
}

export async function fetchIcsText(url: string): Promise<{ ok: true; text: string } | { ok: false; status: number; details: string }> {
  const response = await fetch(url, {
    headers: {
      Accept: "text/calendar,text/plain;q=0.9,*/*;q=0.8",
      "User-Agent": "Mozilla/5.0 (compatible; HoldboldBot/1.0; +https://localhost)"
    }
  });
  if (!response.ok) {
    const bodyText = await response.text().catch(() => "");
    return { ok: false, status: response.status, details: `Status ${response.status}. ${bodyText.slice(0, 240)}` };
  }
  return { ok: true, text: await response.text() };
}

export type FeedImportResult = { created: number; updated: number; moved: number };

/**
 * Lægger kampene fra et feed ind på holdet. Eksisterende kampe opdateres, også hvis DBU har flyttet
 * starttidspunktet, medmindre en træner/admin selv har rettet dem (manualOverride).
 */
export async function importFeedEvents(input: {
  teamId: string;
  feedId: string;
  events: ParsedIcsEvent[];
  /** Brugeren der udløste importen – får ikke selv notifikation. Tom ved automatisk sync. */
  actorId?: string | null;
}): Promise<FeedImportResult> {
  const { teamId, feedId, events, actorId } = input;
  const activeSeason = await getActiveSeason(teamId);
  const now = Date.now();

  // Et feed-id uden RECURRENCE-ID er kun entydigt, hvis det ikke også bruges af overstyrede forekomster.
  const baseUidCount = new Map<string, number>();
  for (const event of events) {
    baseUidCount.set(event.uid, (baseUidCount.get(event.uid) ?? 0) + 1);
  }

  let created = 0;
  let updated = 0;
  let moved = 0;
  const changedNotices: Array<{ eventId: string; title: string; start: Date; what: string }> = [];

  for (const event of events) {
    const start = event.start;
    const baseUid = event.uid;
    const occurrenceKey = event.recurrenceId ? event.recurrenceId.toISOString() : start.toISOString();
    const uid = `${baseUid}:${occurrenceKey}`;

    const title = event.summary || "Kamp";
    const location = event.location || "";

    let existing = await prisma.event.findFirst({
      where: { teamId, externalUid: { in: [uid, baseUid] } }
    });
    // Flytter DBU kampen, ændres starttidspunktet i nøglen – find den på feed-id'et i stedet.
    if (!existing && !event.recurrenceId && baseUidCount.get(baseUid) === 1) {
      existing = await prisma.event.findFirst({
        where: { teamId, externalUid: { startsWith: `${baseUid}:` } }
      });
    }

    if (existing) {
      if (existing.seasonId !== activeSeason.id) continue; // arkiveret kamp i lukket sæson røres ikke
      if (existing.manualOverride) continue; // rettet manuelt af træner/admin – import overskriver det ikke
      if (existing.date.getTime() < now) continue; // afviklede kampe røres ikke

      const dateChanged = existing.date.getTime() !== start.getTime();
      const titleChanged = existing.title !== title;
      const locationChanged = existing.location !== location;
      const keyChanged = existing.externalUid !== uid || existing.feedId !== feedId;
      if (!dateChanged && !titleChanged && !locationChanged && !keyChanged) continue;

      const hadDefaultDeadline =
        existing.signupDeadline.getTime() === existing.date.getTime() - DEFAULT_DEADLINE_HOURS * HOUR;
      const hadDefaultMeeting =
        !existing.meetingTime || existing.meetingTime.getTime() === existing.date.getTime() - DEFAULT_MEETING_HOURS * HOUR;

      await prisma.event.update({
        where: { id: existing.id },
        data: {
          title,
          date: start,
          location,
          ...(dateChanged && hadDefaultDeadline
            ? { signupDeadline: subtractHours(start, DEFAULT_DEADLINE_HOURS) }
            : {}),
          ...(dateChanged && hadDefaultMeeting ? { meetingTime: subtractHours(start, DEFAULT_MEETING_HOURS) } : {}),
          feedId,
          externalUid: uid,
          source: "ICAL"
        }
      });
      if (dateChanged || titleChanged || locationChanged) {
        updated += 1;
        const what = [dateChanged ? "tidspunkt" : null, locationChanged ? "sted" : null, titleChanged ? "titel" : null]
          .filter(Boolean)
          .join(" og ");
        if (dateChanged) moved += 1;
        if (dateChanged || locationChanged) changedNotices.push({ eventId: existing.id, title, start, what });
      }
    } else {
      const createdEvent = await prisma.event.create({
        data: {
          teamId,
          seasonId: activeSeason.id,
          title,
          date: start,
          location,
          signupDeadline: subtractHours(start, DEFAULT_DEADLINE_HOURS),
          meetingTime: subtractHours(start, DEFAULT_MEETING_HOURS),
          source: "ICAL",
          externalUid: uid,
          feedId,
          kind: "MATCH"
        }
      });
      await applyActiveAbsencesToEvent(createdEvent);
      created += 1;
    }
  }

  const members =
    created > 0 || changedNotices.length > 0
      ? await prisma.membership.findMany({
          where: { teamId, status: "ACTIVE", ...(actorId ? { userId: { not: actorId } } : {}) },
          select: { userId: true }
        })
      : [];

  if (created > 0 && members.length > 0) {
    await createNotifications(
      members.map((member) => ({
        userId: member.userId,
        teamId,
        type: "EVENT" as const,
        title: "Kampkalender opdateret",
        body: `${created} nye kampe importeret fra iCal`,
        link: "/dashboard/kalender"
      }))
    );
  }

  for (const notice of changedNotices) {
    if (members.length === 0) break;
    await createNotifications(
      members.map((member) => ({
        userId: member.userId,
        teamId,
        type: "EVENT" as const,
        title: "Kamp ændret",
        body: `${notice.title}: ${notice.what} er ændret (${formatDateTimeCopenhagen(notice.start)})`,
        link: `/dashboard/kalender/${notice.eventId}`
      }))
    );
  }

  return { created, updated, moved };
}

/** Henter og importerer ét gemt feed (bruges af cron). Returnerer null, hvis hentningen fejlede. */
export async function syncStoredFeed(feed: { id: string; teamId: string; url: string }) {
  const fetched = await fetchIcsText(feed.url);
  if (!fetched.ok) return null;
  const events = parseIcsEvents(fetched.text);
  if (events.length === 0) return null;
  const result = await importFeedEvents({ teamId: feed.teamId, feedId: feed.id, events });
  await prisma.icalFeed.update({ where: { id: feed.id }, data: { lastImportedAt: new Date() } });
  return result;
}

/** Synker alle feeds, der ikke er hentet for nylig. Fejl i ét feed stopper ikke de øvrige. */
export async function syncDueFeeds(teamId?: string) {
  const feeds = await prisma.icalFeed.findMany({
    where: {
      ...(teamId ? { teamId } : {}),
      OR: [{ lastImportedAt: null }, { lastImportedAt: { lt: new Date(Date.now() - FEED_REFRESH_MS) } }]
    },
    select: { id: true, teamId: true, url: true }
  });
  const total = { feeds: 0, created: 0, updated: 0, failed: 0 };
  for (const feed of feeds) {
    try {
      const result = await syncStoredFeed(feed);
      if (!result) {
        total.failed += 1;
        continue;
      }
      total.feeds += 1;
      total.created += result.created;
      total.updated += result.updated;
    } catch (error) {
      console.error("Kunne ikke synke iCal-feed", feed.id, error);
      total.failed += 1;
    }
  }
  return total;
}
