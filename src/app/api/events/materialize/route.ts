import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  teamId: z.string().min(1),
  seriesId: z.string().min(1),
  date: z.string().min(1)
});

export async function POST(request: Request) {
  const json = await request.json();
  const body = bodySchema.parse(json);

  const date = new Date(body.date);

  const existing = await prisma.event.findFirst({
    where: {
      teamId: body.teamId,
      seriesId: body.seriesId,
      date
    }
  });

  if (existing) {
    return NextResponse.json({ event: existing });
  }

  const series = await prisma.eventSeries.findFirst({
    where: { id: body.seriesId, teamId: body.teamId }
  });

  if (!series) {
    return NextResponse.json({ error: "Gentagelse ikke fundet" }, { status: 404 });
  }

  const deadline = new Date(date.getTime() - series.signupDeadlineHoursBefore * 60 * 60 * 1000);

  const event = await prisma.event.create({
    data: {
      teamId: body.teamId,
      seriesId: series.id,
      title: series.title,
      date,
      location: series.location,
      signupDeadline: deadline,
      source: "SERIES",
      createdById: null
    }
  });

  return NextResponse.json({ event });
}
