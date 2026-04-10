import { NextResponse } from "next/server";
import { z } from "zod";
import { createNotifications } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import {
  EVENT_MANAGER_ROLES,
  requireActiveTeamMember,
  requireActiveTeamMemberWithRoles,
  requireSession
} from "@/lib/apiAuth";

const listSchema = z.object({
  teamId: z.string().min(1)
});

const createSchema = z.object({
  teamId: z.string().min(1),
  title: z.string().min(1),
  date: z.string().datetime(),
  location: z.string().min(1),
  signupDeadline: z.string().datetime(),
  kind: z.enum(["TRAINING", "MATCH"]).optional()
});

export async function GET(request: Request) {
  const session = await requireSession();
  if (!session.ok) return session.response;

  const { searchParams } = new URL(request.url);
  const teamId = searchParams.get("teamId") ?? "";
  const { teamId: parsedTeamId } = listSchema.parse({ teamId });

  const member = await requireActiveTeamMember(session.userId, parsedTeamId);
  if (!member.ok) return member.response;

  const events = await prisma.event.findMany({
    where: { teamId: parsedTeamId },
    orderBy: { date: "asc" },
    take: 100
  });

  return NextResponse.json({ events });
}

export async function POST(request: Request) {
  const session = await requireSession();
  if (!session.ok) return session.response;

  const json = await request.json();
  const body = createSchema.parse(json);

  const member = await requireActiveTeamMemberWithRoles(session.userId, body.teamId, EVENT_MANAGER_ROLES);
  if (!member.ok) return member.response;

  const createdById = session.userId;

  const event = await prisma.event.create({
    data: {
      teamId: body.teamId,
      title: body.title,
      date: new Date(body.date),
      location: body.location,
      signupDeadline: new Date(body.signupDeadline),
      source: "MANUAL",
      createdById,
      ...(body.kind ? { kind: body.kind } : {})
    }
  });

  const members = await prisma.membership.findMany({
    where: { teamId: body.teamId, status: "ACTIVE" },
    select: { userId: true }
  });

  const notifications = members
    .filter((m) => m.userId !== createdById)
    .map((m) => ({
      userId: m.userId,
      teamId: body.teamId,
      type: "EVENT" as const,
      title: `Ny begivenhed: ${event.title}`,
      body: `${new Date(event.date).toLocaleString("da-DK")} · ${event.location}`,
      link: "/dashboard/kalender"
    }));

  if (notifications.length > 0) {
    await createNotifications(notifications);
  }

  return NextResponse.json({ event });
}
