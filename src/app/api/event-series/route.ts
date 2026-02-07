import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const listSchema = z.object({
  teamId: z.string().min(1)
});

const createSchema = z.object({
  teamId: z.string().min(1),
  title: z.string().min(1),
  location: z.string().min(1),
  startDate: z.string().min(1),
  recurrence: z.enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]),
  interval: z.number().int().positive().optional(),
  endDate: z.string().optional(),
  signupDeadlineHoursBefore: z.number().int().positive().optional(),
  createdById: z.string().min(1)
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const teamId = searchParams.get("teamId") ?? "";
  const parsed = listSchema.parse({ teamId });

  const series = await prisma.eventSeries.findMany({
    where: { teamId: parsed.teamId },
    orderBy: { createdAt: "desc" }
  });

  return NextResponse.json({ series });
}

export async function POST(request: Request) {
  const json = await request.json();
  const body = createSchema.parse(json);

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
      createdById: body.createdById
    }
  });

  return NextResponse.json({ series });
}
