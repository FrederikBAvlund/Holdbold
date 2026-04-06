import { NextResponse } from "next/server";
import { z } from "zod";
import { createNotifications } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

const listSchema = z.object({
  teamId: z.string().min(1)
});

const createSchema = z.object({
  teamId: z.string().min(1),
  title: z.string().min(1),
  date: z.string().datetime(),
  location: z.string().min(1),
  signupDeadline: z.string().datetime(),
  createdById: z.string().min(1)
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const teamId = searchParams.get("teamId") ?? "";
  const { teamId: parsedTeamId } = listSchema.parse({ teamId });

  const events = await prisma.event.findMany({
    where: { teamId: parsedTeamId },
    orderBy: { date: "asc" },
    take: 100
  });

  return NextResponse.json({ events });
}

export async function POST(request: Request) {
  const json = await request.json();
  const body = createSchema.parse(json);

  const event = await prisma.event.create({
    data: {
      teamId: body.teamId,
      title: body.title,
      date: new Date(body.date),
      location: body.location,
      signupDeadline: new Date(body.signupDeadline),
      source: "MANUAL",
      createdById: body.createdById
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
