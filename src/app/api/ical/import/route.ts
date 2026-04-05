import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { createNotifications } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  teamId: z.string().min(1),
  url: z
    .string()
    .min(1)
    .refine((value) => /^https?:\/\//i.test(value) || /^webcal:\/\//i.test(value), "Ugyldig URL"),
  name: z.string().min(1).optional()
});

const querySchema = z.object({
  teamId: z.string().min(1)
});

function subtractHours(date: Date, hours: number) {
  return new Date(date.getTime() - hours * 60 * 60 * 1000);
}

function normalizeIcalUrl(input: string) {
  const value = input.trim();
  if (value.startsWith("webcal://")) {
    return `https://${value.slice("webcal://".length)}`;
  }
  return value;
}

function feedNameFromUrl(input: string) {
  try {
    const url = new URL(input);
    return url.hostname;
  } catch {
    return "DBU iCal";
  }
}

type ParsedIcsEvent = {
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

function parseIcsEvents(icsText: string): ParsedIcsEvent[] {
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

async function requireAdminForTeam(teamId: string, userId: string) {
  const membership = await prisma.membership.findFirst({
    where: { teamId, userId, status: "ACTIVE" },
    select: { role: true }
  });
  return membership?.role === "ADMIN";
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Ikke logget ind" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const parsed = querySchema.parse({
    teamId: searchParams.get("teamId") ?? ""
  });

  const membership = await prisma.membership.findFirst({
    where: { teamId: parsed.teamId, userId: session.user.id, status: "ACTIVE" },
    select: { id: true }
  });
  if (!membership) {
    return NextResponse.json({ error: "Ikke adgang" }, { status: 403 });
  }

  const feeds = await prisma.icalFeed.findMany({
    where: { teamId: parsed.teamId },
    orderBy: { createdAt: "desc" }
  });

  return NextResponse.json({ feeds });
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Ikke logget ind" }, { status: 401 });
    }

    const json = await request.json();
    const body = bodySchema.parse(json);

    const canImport = await requireAdminForTeam(body.teamId, session.user.id);
    if (!canImport) {
      return NextResponse.json({ error: "Kun admin kan importere iCal" }, { status: 403 });
    }

    const normalizedUrl = normalizeIcalUrl(body.url);
    const feedName = body.name?.trim() || feedNameFromUrl(normalizedUrl);
    const response = await fetch(normalizedUrl, {
      headers: {
        Accept: "text/calendar,text/plain;q=0.9,*/*;q=0.8",
        "User-Agent": "Mozilla/5.0 (compatible; HoldboldBot/1.0; +https://localhost)"
      }
    });
    if (!response.ok) {
      const bodyText = await response.text().catch(() => "");
      const shortBody = bodyText.slice(0, 240);
      return NextResponse.json(
        {
          error: "Kunne ikke hente iCal",
          details: `Status ${response.status}. ${shortBody}`
        },
        { status: 400 }
      );
    }

    const icsText = await response.text();
    const events = parseIcsEvents(icsText);
    if (events.length === 0) {
      return NextResponse.json(
        {
          error: "Kunne ikke finde kampe i iCal",
          details: "Ingen VEVENT med UID og DTSTART blev fundet."
        },
        { status: 400 }
      );
    }

    const existingFeed = await prisma.icalFeed.findFirst({
      where: { teamId: body.teamId, url: normalizedUrl },
      select: { id: true }
    });

    const feed = existingFeed
      ? await prisma.icalFeed.update({
          where: { id: existingFeed.id },
          data: {
            name: feedName,
            lastImportedAt: new Date()
          }
        })
      : await prisma.icalFeed.create({
          data: {
            teamId: body.teamId,
            name: feedName,
            url: normalizedUrl,
            lastImportedAt: new Date()
          }
        });

    let created = 0;
    let updated = 0;

    const deadlineHours = 24;

    for (const event of events) {
      const start = event.start instanceof Date ? event.start : null;
      if (!start) continue;
      const baseUid = String(event.uid ?? `${feed.id}:${event.start?.toISOString?.() ?? ""}:${event.summary ?? "match"}`);
      const occurrenceKey = event.recurrenceId instanceof Date ? event.recurrenceId.toISOString() : start.toISOString();
      const uid = `${baseUid}:${occurrenceKey}`;
      if (!uid) continue;

      const title = event.summary ? String(event.summary) : "Kamp";
      const location = event.location ? String(event.location) : "";
      const signupDeadline = subtractHours(start, deadlineHours);
      const meetingTime = subtractHours(start, 1);

      const existing = await prisma.event.findFirst({
        where: {
          teamId: body.teamId,
          feedId: feed.id,
          OR: [{ externalUid: uid }, { externalUid: baseUid }]
        }
      });

      if (existing) {
        await prisma.event.update({
          where: { id: existing.id },
          data: {
            title,
            date: start,
            location,
            signupDeadline,
            meetingTime: existing.meetingTime ?? meetingTime,
            feedId: feed.id,
            externalUid: uid,
            source: "ICAL"
          }
        });
        updated += 1;
      } else {
        await prisma.event.create({
          data: {
            teamId: body.teamId,
            title,
            date: start,
            location,
            signupDeadline,
            meetingTime,
            source: "ICAL",
            externalUid: uid,
            feedId: feed.id
          }
        });
        created += 1;
      }
    }

    if (created > 0) {
      const members = await prisma.membership.findMany({
        where: { teamId: body.teamId, status: "ACTIVE" },
        select: { userId: true }
      });
      const notifications = members
        .filter((member) => member.userId !== session.user.id)
        .map((member) => ({
          userId: member.userId,
          teamId: body.teamId,
          type: "EVENT" as const,
          title: "Kampkalender opdateret",
          body: `${created} nye kampe importeret fra iCal`,
          link: "/dashboard/kalender"
        }));
      if (notifications.length > 0) {
        await createNotifications(notifications);
      }
    }

    return NextResponse.json({ created, updated, feedId: feed.id });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Ugyldigt input", details: error.flatten() }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Ukendt fejl";
    console.error("iCal import failed", error);
    return NextResponse.json({ error: "Import fejlede", details: message }, { status: 500 });
  }
}
