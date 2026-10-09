import type { Absence, Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Db = PrismaClient | Prisma.TransactionClient;

export function absenceSignupReason(reason: string) {
  return `Fraværende: ${reason}`;
}

/** Godkendt, ikke stoppet og ikke udløbet. */
export function isAbsenceActive(
  absence: Pick<Absence, "status" | "endedAt" | "endDate">,
  now = new Date()
): boolean {
  return absence.status === "APPROVED" && absence.endedAt === null && absence.endDate >= now;
}

/**
 * Melder spilleren fra til alle kommende, ikke-aflyste begivenheder i fraværsperioden (kun åbne sæsoner).
 * Et selvvalgt "Jeg kan ikke" bevares; "Jeg kommer" og manglende svar bliver til fraværs-afbud.
 * Svar der allerede hører til et andet fravær røres ikke.
 */
export async function applyAbsenceToUpcomingEvents(absence: Absence, db: Db = prisma) {
  const now = new Date();
  const events = await db.event.findMany({
    where: {
      teamId: absence.teamId,
      canceledAt: null,
      date: { gt: now > absence.startDate ? now : absence.startDate, lte: absence.endDate },
      season: { closedAt: null }
    },
    select: { id: true }
  });
  if (events.length === 0) return 0;

  const existing = await db.signup.findMany({
    where: { userId: absence.userId, eventId: { in: events.map((e) => e.id) } },
    select: { id: true, eventId: true, status: true, absenceId: true }
  });
  const existingByEvent = new Map(existing.map((s) => [s.eventId, s]));
  const reason = absenceSignupReason(absence.reason);

  const toCreate: Prisma.SignupCreateManyInput[] = [];
  const toUpdateIds: string[] = [];
  for (const event of events) {
    const signup = existingByEvent.get(event.id);
    if (!signup) {
      toCreate.push({ eventId: event.id, userId: absence.userId, status: "OUT", reason, absenceId: absence.id });
    } else if (signup.absenceId === null && signup.status !== "OUT") {
      toUpdateIds.push(signup.id);
    }
  }

  if (toCreate.length > 0) await db.signup.createMany({ data: toCreate, skipDuplicates: true });
  if (toUpdateIds.length > 0) {
    await db.signup.updateMany({
      where: { id: { in: toUpdateIds } },
      data: { status: "OUT", reason, absenceId: absence.id }
    });
  }
  return toCreate.length + toUpdateIds.length;
}

/** Kaldes når en ny begivenhed oprettes, så spillere med aktivt fravær automatisk meldes fra. */
export async function applyActiveAbsencesToEvent(
  event: { id: string; teamId: string; date: Date },
  db: Db = prisma
) {
  const absences = await db.absence.findMany({
    where: {
      teamId: event.teamId,
      status: "APPROVED",
      endedAt: null,
      startDate: { lte: event.date },
      endDate: { gte: event.date }
    }
  });
  if (absences.length === 0) return;
  await db.signup.createMany({
    data: absences.map((absence) => ({
      eventId: event.id,
      userId: absence.userId,
      status: "OUT" as const,
      reason: absenceSignupReason(absence.reason),
      absenceId: absence.id
    })),
    skipDuplicates: true
  });
}

/**
 * Fjerner fraværs-afbud fra kommende begivenheder, så spilleren står som "Mangler svar" igen.
 * Er svarfristen allerede overskredet, beholdes mærkningen, så spilleren ikke straks får en
 * "manglende svar"-bøde på en begivenhed lige efter hjemkomsten (se processMissedSignupFines).
 */
export async function releaseAbsenceSignups(absenceId: string, db: Db = prisma) {
  const now = new Date();
  await db.signup.updateMany({
    where: { absenceId, event: { date: { gt: now }, signupDeadline: { gt: now } } },
    data: { status: "UNKNOWN", reason: null, absenceId: null }
  });
  await db.signup.updateMany({
    where: { absenceId, event: { date: { gt: now }, signupDeadline: { lte: now } } },
    data: { status: "UNKNOWN", reason: null }
  });
}
