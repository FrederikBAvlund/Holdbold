import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const listSchema = z.object({
  teamId: z.string().min(1)
});

const createSchema = z.object({
  teamId: z.string().min(1),
  title: z.string().min(1),
  date: z.string().min(1),
  location: z.string().min(1),
  signupDeadline: z.string().min(1),
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
    where: { teamId: body.teamId },
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
    await prisma.notification.createMany({ data: notifications });
  }

  return NextResponse.json({ event });
}
