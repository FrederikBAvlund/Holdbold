import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  meetingTime: z.string().datetime().nullable().optional(),
  signupDeadline: z.string().datetime().optional()
});

const allowedRoles = new Set(["ADMIN", "BOEDEKASSEFORMAND"]);

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Ikke logget ind" }, { status: 401 });
  }

  const json = await request.json();
  const body = updateSchema.parse(json);

  const event = await prisma.event.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      teamId: true,
      date: true,
      source: true,
      signupDeadline: true
    }
  });
  if (!event) {
    return NextResponse.json({ error: "Begivenhed ikke fundet" }, { status: 404 });
  }
  if (event.source !== "ICAL") {
    return NextResponse.json({ error: "Kun kampbegivenheder kan redigeres her" }, { status: 400 });
  }

  const membership = await prisma.membership.findFirst({
    where: { teamId: event.teamId, userId: session.user.id, status: "ACTIVE" },
    select: { role: true }
  });
  if (!membership || !allowedRoles.has(membership.role)) {
    return NextResponse.json({ error: "Ikke adgang" }, { status: 403 });
  }

  const now = new Date();
  const newDeadline = body.signupDeadline ? new Date(body.signupDeadline) : undefined;
  const isDeadlinePassed = event.signupDeadline.getTime() <= now.getTime();

  if (newDeadline && isDeadlinePassed) {
    return NextResponse.json(
      { error: "Deadline er passeret og kan ikke ændres" },
      { status: 400 }
    );
  }

  const newMeetingTime =
    body.meetingTime === undefined
      ? undefined
      : body.meetingTime === null
        ? null
        : new Date(body.meetingTime);

  if (newMeetingTime && newMeetingTime.getTime() > event.date.getTime()) {
    return NextResponse.json(
      { error: "Mødetid skal være før kampstart" },
      { status: 400 }
    );
  }

  const updated = await prisma.event.update({
    where: { id: params.id },
    data: {
      ...(newDeadline ? { signupDeadline: newDeadline } : {}),
      ...(newMeetingTime !== undefined ? { meetingTime: newMeetingTime } : {})
    },
    select: {
      id: true,
      date: true,
      source: true,
      meetingTime: true,
      signupDeadline: true
    }
  });

  const formattedDate = updated.date.toLocaleString("da-DK");
  await prisma.eventLog.create({
    data: {
      eventId: updated.id,
      actorId: session.user.id,
      type: "SIGNUP",
      message: `Kampdetaljer opdateret (${formattedDate})`
    }
  });

  return NextResponse.json({
    event: {
      id: updated.id,
      date: updated.date,
      source: updated.source,
      meetingTime: updated.meetingTime,
      signupDeadline: updated.signupDeadline
    }
  });
}
