import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { EVENT_MANAGER_ROLES } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  meetingTime: z.string().datetime().nullable().optional(),
  signupDeadline: z.string().datetime().optional(),
  thingCarrierId: z.string().min(1).nullable().optional(),
  beerCarrierId: z.string().min(1).nullable().optional(),
  kind: z.enum(["TRAINING", "MATCH"]).optional(),
  matchHomeGoals: z.number().int().min(0).nullable().optional(),
  matchAwayGoals: z.number().int().min(0).nullable().optional(),
  matchPlayerStats: z
    .array(
      z.object({
        userId: z.string().min(1),
        goals: z.number().int().min(0),
        assists: z.number().int().min(0)
      })
    )
    .optional()
});

const matchMetaRoles = new Set(["ADMIN", "BOEDEKASSEFORMAND"]);

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Ikke logget ind" }, { status: 401 });
  }

  const event = await prisma.event.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      teamId: true,
      title: true,
      date: true,
      location: true,
      source: true,
      kind: true,
      meetingTime: true,
      signupDeadline: true,
      thingCarrierId: true,
      beerCarrierId: true,
      canceledAt: true,
      matchHomeGoals: true,
      matchAwayGoals: true,
      matchMotmUser: {
        select: {
          id: true,
          name: true,
          image: true
        }
      },
      matchPlayerStats: {
        include: {
          user: { select: { id: true, name: true } }
        }
      }
    }
  });

  if (!event) {
    return NextResponse.json({ error: "Begivenhed ikke fundet" }, { status: 404 });
  }

  const membership = await prisma.membership.findFirst({
    where: { teamId: event.teamId, userId: session.user.id, status: "ACTIVE" },
    select: { role: true }
  });
  if (!membership) {
    return NextResponse.json({ error: "Ikke adgang" }, { status: 403 });
  }

  return NextResponse.json({ event });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Ikke logget ind" }, { status: 401 });
  }

  const json = await request.json();
  const body = updateSchema.parse(json);

  const event = await prisma.event.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      teamId: true,
      date: true,
      source: true,
      kind: true,
      signupDeadline: true,
      thingCarrierId: true,
      beerCarrierId: true
    }
  });
  if (!event) {
    return NextResponse.json({ error: "Begivenhed ikke fundet" }, { status: 404 });
  }

  const wantsMatchMetaUpdate = body.meetingTime !== undefined || body.signupDeadline !== undefined;
  const wantsDutyUpdate = body.thingCarrierId !== undefined || body.beerCarrierId !== undefined;
  const wantsKindUpdate = body.kind !== undefined;
  const wantsMatchScoreUpdate = body.matchHomeGoals !== undefined || body.matchAwayGoals !== undefined;
  const wantsPlayerStatsUpdate = body.matchPlayerStats !== undefined;

  const membership = await prisma.membership.findFirst({
    where: { teamId: event.teamId, userId: session.user.id, status: "ACTIVE" },
    select: { role: true }
  });
  if (!membership) {
    return NextResponse.json({ error: "Ikke adgang" }, { status: 403 });
  }

  const isEventManager = EVENT_MANAGER_ROLES.includes(membership.role);

  const effectiveKind = body.kind ?? event.kind;

  if (wantsMatchMetaUpdate) {
    if (effectiveKind !== "MATCH") {
      return NextResponse.json({ error: "Kun kampe har mødetid og svarfrist her" }, { status: 400 });
    }
    if (!matchMetaRoles.has(membership.role)) {
      return NextResponse.json({ error: "Ikke adgang" }, { status: 403 });
    }
  }

  if (wantsKindUpdate || wantsMatchScoreUpdate || wantsPlayerStatsUpdate) {
    if (!isEventManager) {
      return NextResponse.json({ error: "Kun trænere/admin kan opdatere kamptype og statistik" }, { status: 403 });
    }
  }

  if ((wantsMatchScoreUpdate || wantsPlayerStatsUpdate) && effectiveKind !== "MATCH") {
    return NextResponse.json({ error: "Statistik kan kun sættes for kampe" }, { status: 400 });
  }

  const now = new Date();
  const newDeadline = body.signupDeadline ? new Date(body.signupDeadline) : undefined;
  const isDeadlinePassed = event.signupDeadline.getTime() <= now.getTime();

  if (newDeadline && isDeadlinePassed) {
    return NextResponse.json(
      { error: "Deadline er passeret og kan ikke ændres" },
      { status: 400 }
    );
  }

  const newMeetingTime =
    body.meetingTime === undefined
      ? undefined
      : body.meetingTime === null
        ? null
        : new Date(body.meetingTime);

  if (newMeetingTime && newMeetingTime.getTime() > event.date.getTime()) {
    return NextResponse.json(
      { error: "Mødetid skal være før kampstart" },
      { status: 400 }
    );
  }

  if (wantsDutyUpdate) {
    const requestedUserIds = [body.thingCarrierId, body.beerCarrierId].filter(
      (value): value is string => Boolean(value)
    );
    if (requestedUserIds.length > 0) {
      const validAssignments = await prisma.membership.findMany({
        where: {
          teamId: event.teamId,
          status: "ACTIVE",
          userId: { in: requestedUserIds }
        },
        select: { userId: true }
      });
      const validUserIds = new Set(validAssignments.map((entry) => entry.userId));
      const invalidUserId = requestedUserIds.find((userId) => !validUserIds.has(userId));
      if (invalidUserId) {
        return NextResponse.json({ error: "Valgt bruger er ikke aktiv på holdet" }, { status: 400 });
      }
    }
  }

  if (wantsPlayerStatsUpdate && body.matchPlayerStats) {
    const statUserIds = body.matchPlayerStats.map((s) => s.userId);
    const valid = await prisma.membership.findMany({
      where: {
        teamId: event.teamId,
        status: "ACTIVE",
        userId: { in: statUserIds }
      },
      select: { userId: true }
    });
    const validSet = new Set(valid.map((v) => v.userId));
    const bad = statUserIds.find((id) => !validSet.has(id));
    if (bad) {
      return NextResponse.json({ error: "Statistik må kun indeholde aktive holdmedlemmer" }, { status: 400 });
    }
  }

  const clearingMatchData = body.kind === "TRAINING";

  const updated = await prisma.$transaction(async (tx) => {
    if (clearingMatchData) {
      await tx.eventMatchPlayerStat.deleteMany({ where: { eventId: event.id } });
      await tx.eventMotmPoll.deleteMany({ where: { eventId: event.id } });
    }

    if (wantsPlayerStatsUpdate && effectiveKind === "MATCH" && body.matchPlayerStats) {
      await tx.eventMatchPlayerStat.deleteMany({ where: { eventId: event.id } });
      const rows = body.matchPlayerStats.filter((s) => s.goals > 0 || s.assists > 0);
      if (rows.length > 0) {
        await tx.eventMatchPlayerStat.createMany({
          data: rows.map((s) => ({
            eventId: event.id,
            userId: s.userId,
            goals: s.goals,
            assists: s.assists
          }))
        });
      }
    }

    return tx.event.update({
      where: { id: event.id },
      data: {
        ...(newDeadline ? { signupDeadline: newDeadline } : {}),
        ...(newMeetingTime !== undefined ? { meetingTime: newMeetingTime } : {}),
        ...(body.thingCarrierId !== undefined ? { thingCarrierId: body.thingCarrierId } : {}),
        ...(body.beerCarrierId !== undefined ? { beerCarrierId: body.beerCarrierId } : {}),
        ...(body.kind !== undefined ? { kind: body.kind } : {}),
        ...(clearingMatchData
          ? { matchHomeGoals: null, matchAwayGoals: null, matchMotmUserId: null }
          : {}),
        ...(!clearingMatchData && body.matchHomeGoals !== undefined
          ? { matchHomeGoals: body.matchHomeGoals }
          : {}),
        ...(!clearingMatchData && body.matchAwayGoals !== undefined
          ? { matchAwayGoals: body.matchAwayGoals }
          : {})
      },
      select: {
        id: true,
        date: true,
        source: true,
        kind: true,
        meetingTime: true,
        signupDeadline: true,
        thingCarrierId: true,
        beerCarrierId: true,
        matchHomeGoals: true,
        matchAwayGoals: true,
        matchMotmUser: {
          select: {
            id: true,
            name: true,
            image: true
          }
        },
        matchPlayerStats: {
          include: {
            user: { select: { id: true, name: true } }
          }
        }
      }
    });
  });

  const formattedDate = updated.date.toLocaleString("da-DK");
  const changes: string[] = [];
  if (wantsMatchMetaUpdate) changes.push("kampdetaljer");
  if (wantsDutyUpdate) changes.push("opgaver");
  if (wantsKindUpdate) changes.push("type");
  if (wantsMatchScoreUpdate || wantsPlayerStatsUpdate) changes.push("kampstatistik");
  await prisma.eventLog.create({
    data: {
      eventId: updated.id,
      actorId: session.user.id,
      type: "SIGNUP",
      message: `${changes.join(" og ") || "Begivenhed"} opdateret (${formattedDate})`
    }
  });

  return NextResponse.json({
    event: {
      id: updated.id,
      date: updated.date,
      source: updated.source,
      kind: updated.kind,
      meetingTime: updated.meetingTime,
      signupDeadline: updated.signupDeadline,
      thingCarrierId: updated.thingCarrierId,
      beerCarrierId: updated.beerCarrierId,
      matchHomeGoals: updated.matchHomeGoals,
      matchAwayGoals: updated.matchAwayGoals,
      matchMotmUser: updated.matchMotmUser,
      matchPlayerStats: updated.matchPlayerStats
    }
  });
}
