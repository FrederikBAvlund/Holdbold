import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createNotifications } from "@/lib/notifications";
import { notificationRef } from "@/lib/notificationRefs";
import {
  ABSENCE_MANAGER_ROLES,
  requireActiveTeamMember,
  requireSession
} from "@/lib/apiAuth";
import { hasAnyRole } from "@/lib/roles";

const createSchema = z.object({
  teamId: z.string().min(1),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  reason: z.string().trim().min(2, "Skriv kort hvorfor du er fraværende").max(200)
});

export async function GET(request: Request) {
  const session = await requireSession();
  if (!session.ok) return session.response;

  const teamId = new URL(request.url).searchParams.get("teamId") ?? "";
  if (!teamId) return NextResponse.json({ error: "teamId mangler" }, { status: 400 });

  const member = await requireActiveTeamMember(session.userId, teamId);
  if (!member.ok) return member.response;

  const canManage = hasAnyRole(member.roles, ABSENCE_MANAGER_ROLES);
  const absences = await prisma.absence.findMany({
    where: { teamId, ...(canManage ? {} : { userId: session.userId }) },
    include: {
      user: { select: { id: true, name: true } },
      decidedBy: { select: { id: true, name: true } }
    },
    orderBy: { createdAt: "desc" },
    take: 200
  });

  return NextResponse.json({ absences, canManage });
}

export async function POST(request: Request) {
  const session = await requireSession();
  if (!session.ok) return session.response;

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Ugyldige data" },
      { status: 400 }
    );
  }
  const body = parsed.data;

  const member = await requireActiveTeamMember(session.userId, body.teamId);
  if (!member.ok) return member.response;

  const startDate = new Date(body.startDate);
  const endDate = new Date(body.endDate);
  if (endDate < startDate) {
    return NextResponse.json({ error: "Slutdato må ikke ligge før startdato" }, { status: 400 });
  }
  if (endDate < new Date()) {
    return NextResponse.json({ error: "Fraværet skal slutte i fremtiden" }, { status: 400 });
  }

  const overlapping = await prisma.absence.findFirst({
    where: {
      teamId: body.teamId,
      userId: session.userId,
      status: { in: ["PENDING", "APPROVED"] },
      endedAt: null,
      startDate: { lte: endDate },
      endDate: { gte: startDate }
    },
    select: { id: true }
  });
  if (overlapping) {
    return NextResponse.json(
      { error: "Du har allerede et fravær i den periode" },
      { status: 409 }
    );
  }

  const absence = await prisma.absence.create({
    data: { teamId: body.teamId, userId: session.userId, startDate, endDate, reason: body.reason }
  });

  const [user, managers] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.userId }, select: { name: true } }),
    prisma.membership.findMany({
      where: { teamId: body.teamId, status: "ACTIVE", roles: { hasSome: [...ABSENCE_MANAGER_ROLES] } },
      select: { userId: true }
    })
  ]);
  await createNotifications(
    managers
      .filter((manager) => manager.userId !== session.userId)
      .map((manager) => ({
        userId: manager.userId,
        teamId: body.teamId,
        type: "GENERAL" as const,
        title: "Ny fraværsanmodning",
        body: `${user?.name ?? "En spiller"} · ${body.reason}`,
        link: "/dashboard/fravaer",
        refKey: notificationRef.absence(absence.id)
      }))
  );

  return NextResponse.json({ absence });
}
