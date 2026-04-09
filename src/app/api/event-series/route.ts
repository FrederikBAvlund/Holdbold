import { NextResponse } from "next/server";
import { z } from "zod";
import { EVENT_MANAGER_ROLES, requireActiveTeamMember, requireSession } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";

const listSchema = z.object({
  teamId: z.string().min(1)
});

const createSchema = z.object({
  teamId: z.string().min(1),
  title: z.string().min(1),
  location: z.string().min(1),
  startDate: z.string().datetime(),
  recurrence: z.enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]),
  interval: z.number().int().positive().optional(),
  endDate: z.string().datetime().optional(),
  signupDeadlineHoursBefore: z.number().int().positive().optional()
});

export async function GET(request: Request) {
  const session = await requireSession();
  if (!session.ok) return session.response;

  const { searchParams } = new URL(request.url);
  const teamId = searchParams.get("teamId") ?? "";
  const parsed = listSchema.parse({ teamId });

  const member = await requireActiveTeamMember(session.userId, parsed.teamId);
  if (!member.ok) return member.response;

  const series = await prisma.eventSeries.findMany({
    where: { teamId: parsed.teamId },
    orderBy: { createdAt: "desc" }
  });

  return NextResponse.json({ series });
}

export async function POST(request: Request) {
  const session = await requireSession();
  if (!session.ok) return session.response;

  const json = await request.json();
  const body = createSchema.parse(json);

  const member = await requireActiveTeamMember(session.userId, body.teamId);
  if (!member.ok) return member.response;
  if (!EVENT_MANAGER_ROLES.includes(member.role)) {
    return NextResponse.json({ error: "Kun trænere/admin kan oprette gentagelser" }, { status: 403 });
  }

  const series = await prisma.eventSeries.create({
    data: {
      teamId: body.teamId,
      title: body.title,
      location: body.location,
      startDate: new Date(body.startDate),
      recurrence: body.recurrence,
      interval: body.interval ?? 1,
      endDate: body.endDate ? new Date(body.endDate) : null,
      signupDeadlineHoursBefore: body.signupDeadlineHoursBefore ?? 24,
      createdById: session.userId
    }
  });

  return NextResponse.json({ series });
}
