import { prisma } from "@/lib/prisma";
import { applyActiveAbsencesToEvent } from "@/lib/absences";

/** Hvor langt frem gentagne begivenheder oprettes som rigtige begivenheder. */
export const SERIES_HORIZON_DAYS = 120;
/** Værn mod løbske serier (fx daglige gentagelser uden slutdato). */
const MAX_OCCURRENCES_PER_RUN = 200;

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

export function nextOccurrence(date: Date, recurrence: string, interval: number) {
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

/** Datoer for en serie i [from, to], højst `limit` stk. Respekterer seriens slutdato. */
export function seriesOccurrenceDates(
  series: { startDate: Date; recurrence: string; interval: number; endDate: Date | null },
  from: Date,
  to: Date,
  limit = MAX_OCCURRENCES_PER_RUN
) {
  const dates: Date[] = [];
  const upper = series.endDate ? new Date(Math.min(series.endDate.getTime(), to.getTime())) : to;
  let cursor = new Date(series.startDate);
  while (cursor <= upper && dates.length < limit) {
    if (cursor >= from) dates.push(new Date(cursor));
    cursor = nextOccurrence(cursor, series.recurrence, series.interval);
  }
  return dates;
}

/**
 * Opretter manglende begivenheder for en serie, så langt frem som horisonten rækker.
 * Sker stille – holdet får ikke en "ny begivenhed"-notifikation for gentagelser.
 */
export async function ensureSeriesEvents(seriesId: string, now = new Date()) {
  const series = await prisma.eventSeries.findUnique({
    where: { id: seriesId },
    include: { season: { select: { closedAt: true } } }
  });
  if (!series || series.season.closedAt) return 0;

  const horizon = new Date(now.getTime() + SERIES_HORIZON_DAYS * 86_400_000);
  const dates = seriesOccurrenceDates(series, now, horizon);
  if (dates.length === 0) return 0;

  const existing = await prisma.event.findMany({
    where: { seriesId, date: { in: dates } },
    select: { date: true }
  });
  const existingTimes = new Set(existing.map((event) => event.date.getTime()));

  let created = 0;
  for (const date of dates) {
    if (existingTimes.has(date.getTime())) continue;
    const event = await prisma.event.create({
      data: {
        teamId: series.teamId,
        seriesId: series.id,
        seasonId: series.seasonId,
        title: series.title,
        date,
        location: series.location,
        signupDeadline: new Date(date.getTime() - series.signupDeadlineHoursBefore * 3_600_000),
        source: "SERIES",
        createdById: series.createdById,
        kind: series.kind
      }
    });
    await applyActiveAbsencesToEvent(event);
    created += 1;
  }
  return created;
}

/** Holder alle åbne serier på holdet opdateret (kaldes af cron). */
export async function ensureTeamSeriesEvents(teamId: string) {
  const seriesList = await prisma.eventSeries.findMany({
    where: {
      teamId,
      season: { closedAt: null },
      OR: [{ endDate: null }, { endDate: { gt: new Date() } }]
    },
    select: { id: true }
  });
  let created = 0;
  for (const series of seriesList) created += await ensureSeriesEvents(series.id);
  return created;
}

/**
 * Fjerner fremtidige begivenheder i en serie efter en given dato (fx når serien stoppes).
 * Begivenheder med bøder bevares, så regnskabet ikke ændres bagud.
 */
export async function removeSeriesEventsAfter(seriesId: string, after: Date) {
  const toRemove = await prisma.event.findMany({
    where: { seriesId, date: { gt: after }, fines: { none: {} } },
    select: { id: true }
  });
  const eventIds = toRemove.map((event) => event.id);
  if (eventIds.length === 0) return 0;
  await prisma.$transaction([
    prisma.signupLog.deleteMany({ where: { eventId: { in: eventIds } } }),
    prisma.signup.deleteMany({ where: { eventId: { in: eventIds } } }),
    prisma.eventLog.deleteMany({ where: { eventId: { in: eventIds } } }),
    prisma.event.deleteMany({ where: { id: { in: eventIds } } })
  ]);
  return eventIds.length;
}
