import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const querySchema = z.object({
  teamId: z.string().min(1),
  start: z.string().datetime(),
  end: z.string().datetime(),
  userId: z.string().optional()
});

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function addMonths(date: Date, months: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function addYears(date: Date, years: number) {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + years);
  return d;
}

function nextOccurrence(date: Date, recurrence: string, interval: number) {
  switch (recurrence) {
    case "DAILY":
      return addDays(date, interval);
    case "WEEKLY":
      return addDays(date, interval * 7);
    case "MONTHLY":
      return addMonths(date, interval);
    case "YEARLY":
      return addYears(date, interval);
    default:
      return addDays(date, interval);
  }
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Ikke logget ind" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const parsed = querySchema.parse({
    teamId: searchParams.get("teamId") ?? "",
    start: searchParams.get("start") ?? "",
    end: searchParams.get("end") ?? "",
    userId: searchParams.get("userId") ?? undefined
  });

  const start = new Date(parsed.start);
  const end = new Date(parsed.end);

  const actingMembership = await prisma.membership.findFirst({
    where: { teamId: parsed.teamId, userId: session.user.id, status: "ACTIVE" },
    select: { role: true }
  });
  if (!actingMembership) {
    return NextResponse.json({ error: "Ikke adgang" }, { status: 403 });
  }

  if (
    parsed.userId &&
    parsed.userId !== session.user.id &&
    !["ADMIN", "BOEDEKASSEFORMAND", "TRAENER"].includes(actingMembership.role)
  ) {
    return NextResponse.json({ error: "Ikke adgang til andre spilleres tilmeldingsstatus" }, { status: 403 });
  }

  const events = await prisma.event.findMany({
    where: {
      teamId: parsed.teamId,
      date: { gte: start, lte: end }
    },
    include: {
      ...(parsed.userId
        ? {
            signups: {
              where: { userId: parsed.userId },
              take: 1
            }
          }
        : {}),
      canceledBy: {
        select: { name: true }
      }
    }
  });

  const seriesList = await prisma.eventSeries.findMany({
    where: { teamId: parsed.teamId }
  });

  const occurrences = [] as Array<{ id: string; title: string; date: Date; location: string; source: string; seriesId: string }>;

  const eventKeys = new Set(
    events
      .filter((event) => event.seriesId)
      .map((event) => `${event.seriesId}:${event.date.toISOString().slice(0, 10)}`)
  );

  for (const series of seriesList) {
    const endLimit = series.endDate ? new Date(Math.min(series.endDate.getTime(), end.getTime())) : end;
    let cursor = new Date(series.startDate);

    while (cursor <= endLimit) {
      if (cursor >= start && cursor <= end) {
        const key = `${series.id}:${cursor.toISOString().slice(0, 10)}`;
        if (eventKeys.has(key)) {
          cursor = nextOccurrence(cursor, series.recurrence, series.interval);
          continue;
        }
        occurrences.push({
          id: `series:${series.id}:${cursor.toISOString()}`,
          title: series.title,
          date: new Date(cursor),
          location: series.location,
          source: "SERIES",
          seriesId: series.id
        });
      }
      cursor = nextOccurrence(cursor, series.recurrence, series.interval);
      if (cursor.getFullYear() > end.getFullYear() + 2) break;
    }
  }

  return NextResponse.json({
    events: events.map((event) => ({
      id: event.id,
      title: event.title,
      date: event.date,
      location: event.location,
      meetingTime: event.meetingTime,
      signupDeadline: event.signupDeadline,
      source: event.source,
      seriesId: event.seriesId,
      signupStatus: event.signups?.[0]?.status ?? null,
      canceledAt: event.canceledAt,
      canceledByName: event.canceledBy?.name ?? null
    })),
    occurrences
  });
}
