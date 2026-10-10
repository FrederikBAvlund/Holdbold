import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { seasonClosedResponse } from "@/lib/seasons";
import { EVENT_MANAGER_ROLES, requireActiveTeamMemberWithRoles, requireSession } from "@/lib/apiAuth";

const updateSchema = z.object({
  endDate: z.string().datetime().nullable().optional(),
  kind: z.enum(["TRAINING", "MATCH"]).optional()
});

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await requireSession();
  if (!session.ok) return session.response;

  const seriesGuard = seasonClosedResponse(
    (await prisma.eventSeries.findUnique({ where: { id: params.id }, select: { season: { select: { closedAt: true } } } }))?.season
  );
  if (seriesGuard) return seriesGuard;

  const existing = await prisma.eventSeries.findUnique({
    where: { id: params.id },
    select: { teamId: true }
  });
  if (!existing) {
    return NextResponse.json({ error: "Gentagelse ikke fundet" }, { status: 404 });
  }

  const member = await requireActiveTeamMemberWithRoles(session.userId, existing.teamId, EVENT_MANAGER_ROLES);
  if (!member.ok) return member.response;

  const json = await request.json();
  const body = updateSchema.parse(json);

  const series = await prisma.eventSeries.update({
    where: { id: params.id },
    data: {
      ...(body.endDate !== undefined ? { endDate: body.endDate ? new Date(body.endDate) : null } : {}),
      ...(body.kind !== undefined ? { kind: body.kind } : {})
    }
  });

  return NextResponse.json({ series });
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const session = await requireSession();
  if (!session.ok) return session.response;

  const existing = await prisma.eventSeries.findUnique({
    where: { id: params.id },
    select: { teamId: true, season: { select: { closedAt: true } } }
  });
  if (!existing) {
    return NextResponse.json({ error: "Gentagelse ikke fundet" }, { status: 404 });
  }

  const seasonGuard = seasonClosedResponse(existing.season);
  if (seasonGuard) return seasonGuard;

  const member = await requireActiveTeamMemberWithRoles(session.userId, existing.teamId, ["ADMIN"]);
  if (!member.ok) return member.response;

  const now = new Date();
  // Fremtidige begivenheder uden bøder fjernes helt; afholdte begivenheder bevares.
  const futureEvents = await prisma.event.findMany({
    where: { seriesId: params.id, date: { gt: now }, fines: { none: {} } },
    select: { id: true }
  });
  const eventIds = futureEvents.map((event) => event.id);

  await prisma.$transaction([
    prisma.signupLog.deleteMany({ where: { eventId: { in: eventIds } } }),
    prisma.signup.deleteMany({ where: { eventId: { in: eventIds } } }),
    prisma.eventLog.deleteMany({ where: { eventId: { in: eventIds } } }),
    prisma.event.deleteMany({ where: { id: { in: eventIds } } }),
    prisma.eventSeries.update({ where: { id: params.id }, data: { endDate: now } })
  ]);

  return NextResponse.json({ ok: true, removedEvents: eventIds.length });
}
