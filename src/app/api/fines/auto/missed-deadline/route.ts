import { NextResponse } from "next/server";
import { z } from "zod";
import { createNotifications } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { FINE_AUTOMATION_ROLES, requireActiveTeamMemberWithRoles, requireSession } from "@/lib/apiAuth";
import { resolveAutomationTemplate, roleExcludedFromFineAutomation } from "@/lib/fineAutomation";

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
    select: {
      id: true,
      teamId: true,
      title: true,
      kind: true,
      signupDeadline: true,
      signups: { select: { userId: true, status: true } }
    }
  });

  if (!event) {
    return NextResponse.json({ error: "Event ikke fundet" }, { status: 404 });
  }

  if (new Date() < event.signupDeadline) {
    return NextResponse.json({ error: "Deadline er ikke passeret" }, { status: 400 });
  }

  const resolved = await resolveAutomationTemplate(body.teamId, "MISSED_SIGNUP_AT_DEADLINE", event.kind);
  if (!resolved) {
    return NextResponse.json({ error: "Ingen aktiv automatisering for manglende tilmelding" }, { status: 400 });
  }

  const members = await prisma.membership.findMany({
    where: { teamId: body.teamId, status: "ACTIVE" },
    select: { userId: true, role: true, createdAt: true, user: { select: { name: true } } }
  });

  const deadlineAt = event.signupDeadline;

  const signupMap = new Map(event.signups.map((signup) => [signup.userId, signup.status]));

  let created = 0;
  let singlePlayerName: string | null = null;
  for (const member of members) {
    if (member.createdAt > deadlineAt) continue;
    if (roleExcludedFromFineAutomation(member.role, resolved.excludedRoles)) continue;
    const status = signupMap.get(member.userId);
    if (status === "IN" || status === "OUT") continue;

    const existingFine = await prisma.fine.findFirst({
      where: { eventId: event.id, userId: member.userId, teamId: body.teamId }
    });
    if (existingFine) continue;

    const template = resolved.template;
    await prisma.fine.create({
      data: {
        teamId: body.teamId,
        userId: member.userId,
        eventId: event.id,
        templateId: template.id,
        amount: template.amount,
        reason: template.title,
        description: template.description ?? null,
        status: "FORESLAET",
        createdById: null,
        createdByLabel: "System",
        automationAction: resolved.automationAction
      }
    });
    created += 1;
    if (created === 1) {
      singlePlayerName = member.user.name;
    } else {
      singlePlayerName = null;
    }
  }

  if (created > 0) {
    const managers = await prisma.membership.findMany({
      where: { teamId: body.teamId, role: { in: ["ADMIN", "BOEDEKASSEFORMAND"] } },
      select: { userId: true }
    });

    const template = resolved.template;
    const notifications = managers.map((manager) => ({
      userId: manager.userId,
      teamId: body.teamId,
      type: "FINE_PROPOSED" as const,
      title: "Foreslået bøde",
      body:
        created === 1
          ? `${singlePlayerName ?? "En spiller"} · ${template.title} · ${template.amount} kr`
          : `${created} foreslåede bøder · ${template.title} · ${template.amount} kr`,
      link: "/dashboard/boder"
    }));

    if (notifications.length > 0) {
      await createNotifications(notifications);
    }
  }

  return NextResponse.json({ created });
}
