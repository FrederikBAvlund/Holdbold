import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
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
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Ikke logget ind" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const teamId = searchParams.get("teamId") ?? "";
  const parsed = listSchema.parse({ teamId });

  const actingMembership = await prisma.membership.findFirst({
    where: { teamId: parsed.teamId, userId: session.user.id, status: "ACTIVE" },
    select: { id: true }
  });
  if (!actingMembership) {
    return NextResponse.json({ error: "Ikke adgang" }, { status: 403 });
  }

  const series = await prisma.eventSeries.findMany({
    where: { teamId: parsed.teamId },
    orderBy: { createdAt: "desc" }
  });

  return NextResponse.json({ series });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Ikke logget ind" }, { status: 401 });
  }

  const json = await request.json();
  const body = createSchema.parse(json);

  const actingMembership = await prisma.membership.findFirst({
    where: { teamId: body.teamId, userId: session.user.id, status: "ACTIVE" },
    select: { role: true }
  });
  if (!actingMembership) {
    return NextResponse.json({ error: "Ikke adgang" }, { status: 403 });
  }
  if (!["ADMIN", "TRAENER", "BOEDEKASSEFORMAND"].includes(actingMembership.role)) {
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
      createdById: session.user.id
    }
  });

  return NextResponse.json({ series });
}
