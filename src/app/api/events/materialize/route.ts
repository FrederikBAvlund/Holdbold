import { NextResponse } from "next/server";
import { z } from "zod";
import { createNotifications } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  teamId: z.string().min(1),
  seriesId: z.string().min(1),
  date: z.string().datetime(),
  createdById: z.string().min(1).optional()
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
      createdById: body.createdById ?? null
    }
  });

  const members = await prisma.membership.findMany({
    where: { teamId: body.teamId, status: "ACTIVE" },
    select: { userId: true }
  });

  const notifications = members
    .filter((member) => member.userId !== body.createdById)
    .map((member) => ({
      userId: member.userId,
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
