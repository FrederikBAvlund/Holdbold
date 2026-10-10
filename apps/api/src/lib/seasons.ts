import { NextResponse } from "next/server";
import type { Prisma, PrismaClient, Season } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Db = PrismaClient | Prisma.TransactionClient;

export const SEASON_CLOSED_MESSAGE = "Sæsonen er lukket – kun læsning";

/** Aktiv sæson = den uden closedAt. Oprettes automatisk hvis holdet mod forventning ikke har en. */
export async function getActiveSeason(teamId: string, db: Db = prisma): Promise<Season> {
  const existing = await db.season.findFirst({
    where: { teamId, closedAt: null },
    orderBy: { startedAt: "desc" }
  });
  if (existing) return existing;
  const count = await db.season.count({ where: { teamId } });
  return db.season.create({ data: { teamId, name: `Sæson ${count + 1}` } });
}

/** Finder den ønskede sæson (skal tilhøre holdet) – uden id returneres den aktive. */
export async function resolveSeason(teamId: string, seasonId?: string | null): Promise<Season | null> {
  if (!seasonId) return getActiveSeason(teamId);
  return prisma.season.findFirst({ where: { id: seasonId, teamId } });
}

export function isSeasonClosed(season: { closedAt: Date | null }): boolean {
  return season.closedAt !== null;
}

/** 403-svar hvis sæsonen er lukket, ellers null. */
export function seasonClosedResponse(season: { closedAt: Date | null } | null | undefined) {
  if (season && isSeasonClosed(season)) {
    return NextResponse.json({ error: SEASON_CLOSED_MESSAGE }, { status: 403 });
  }
  return null;
}

/** Tjek at en begivenhed ligger i en åben sæson. Returnerer svar ved lukket sæson, ellers null. */
export async function ensureEventSeasonOpen(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { season: { select: { closedAt: true } } }
  });
  return seasonClosedResponse(event?.season);
}

export async function ensureFineSeasonOpen(fineId: string) {
  const fine = await prisma.fine.findUnique({
    where: { id: fineId },
    select: { season: { select: { closedAt: true } } }
  });
  return seasonClosedResponse(fine?.season);
}

/** Ubetalte bøder følger med til næste sæson; betalte forbliver i den gamle. */
export const CARRY_OVER_FINE_STATUSES = ["UNPAID", "PAID_PENDING"] as const;

/** Lukker aktiv sæson, opretter ny og flytter ubetalte bøder – alt i én transaktion. */
export async function closeSeasonAndStartNew(teamId: string, name?: string) {
  return prisma.$transaction(async (tx) => {
    const active = await getActiveSeason(teamId, tx);
    const now = new Date();
    await tx.season.update({ where: { id: active.id }, data: { closedAt: now } });
    const count = await tx.season.count({ where: { teamId } });
    const next = await tx.season.create({
      data: { teamId, name: name?.trim() || `Sæson ${count + 1}`, startedAt: now }
    });
    const moved = await tx.fine.updateMany({
      where: { teamId, seasonId: active.id, status: { in: [...CARRY_OVER_FINE_STATUSES] } },
      data: { seasonId: next.id }
    });
    return { closed: active, next, carriedOverFines: moved.count };
  });
}
