import { NextResponse } from "next/server";
import { z } from "zod";
import { createNotifications } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { FINE_AUTOMATION_ROLES, requireActiveTeamMemberWithRoles, requireSession } from "@/lib/apiAuth";

const bodySchema = z.object({
  teamId: z.string().min(1),
  eventId: z.string().min(1)
});

export async function POST(request: Request) {
  const session = await requireSession();
  if (!session.ok) return session.response;

  const json = await request.json();
  const body = bodySchema.parse(json);

  const auth = await requireActiveTeamMemberWithRoles(session.userId, body.teamId, FINE_AUTOMATION_ROLES);
  if (!auth.ok) return auth.response;

  const event = await prisma.event.findFirst({
    where: { id: body.eventId, teamId: body.teamId },
    include: { signups: true }
  });

  if (!event) {
    return NextResponse.json({ error: "Event ikke fundet" }, { status: 404 });
  }

  if (new Date() < event.signupDeadline) {
    return NextResponse.json({ error: "Deadline er ikke passeret" }, { status: 400 });
  }

  const rule = await prisma.fineRule.findFirst({
    where: { teamId: body.teamId, isActive: true },
    orderBy: { createdAt: "asc" }
  });

  if (!rule) {
    return NextResponse.json({ error: "Ingen aktiv boederegel" }, { status: 400 });
  }

  const members = await prisma.membership.findMany({
    where: { teamId: body.teamId, status: "ACTIVE", role: { not: "SOME" } },
    include: { user: true }
  });

  const deadlineAt = event.signupDeadline;

  const signupMap = new Map(event.signups.map((signup) => [signup.userId, signup.status]));

  let created = 0;
  for (const member of members) {
    if (member.createdAt > deadlineAt) continue;
    const status = signupMap.get(member.userId);
    if (status === "IN" || status === "OUT") continue;

    const existingFine = await prisma.fine.findFirst({
      where: { eventId: event.id, userId: member.userId, teamId: body.teamId }
    });
    if (existingFine) continue;

    const fine = await prisma.fine.create({
      data: {
        teamId: body.teamId,
        userId: member.userId,
        eventId: event.id,
        amount: rule.amount,
        reason: rule.name,
        description: null,
        status: "FORESLAET",
        createdById: null,
        createdByLabel: "System"
      }
    });

    const managers = await prisma.membership.findMany({
      where: { teamId: body.teamId, role: { in: ["ADMIN", "BOEDEKASSEFORMAND"] } },
      select: { userId: true }
    });

    const notifications = managers
      .filter((manager) => manager.userId !== member.userId)
      .map((manager) => ({
        userId: manager.userId,
        teamId: body.teamId,
        type: "FINE_PROPOSED" as const,
        title: "System foreslår bøde",
        body: `${fine.reason} · ${fine.amount} kr`,
        link: "/dashboard/boder"
      }));

    if (notifications.length > 0) {
      await createNotifications(notifications);
    }
    created += 1;
  }

  return NextResponse.json({ created });
}
