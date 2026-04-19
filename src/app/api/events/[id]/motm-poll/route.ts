import { NextResponse } from "next/server";
import { z } from "zod";
import { MOTM_MANAGER_ROLES, requireActiveTeamMember, requireSession } from "@/lib/apiAuth";
import { createNotifications } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { buildMotmPollApiView, eventMotmAvailabilityError } from "@/lib/motmPolls";
import { resolveProfileImageUrl } from "@/lib/profileImages";

function calendarFocusHrefForEvent(event: {
  id: string;
  title: string;
  date: Date;
  location: string;
  source: "MANUAL" | "SERIES" | "ICAL";
  seriesId: string | null;
}) {
  const params = new URLSearchParams();
  params.set("focusEvent", event.id);
  params.set("focusTitle", event.title);
  params.set("focusDate", event.date.toISOString());
  params.set("focusLocation", event.location);
  params.set("focusSource", event.source);
  if (event.seriesId) params.set("focusSeriesId", event.seriesId);
  return `/dashboard/kalender?${params.toString()}`;
}

const createPollSchema = z.object({
  votesPerVoter: z.number().int().min(1).max(10),
  revealCount: z.number().int().min(1).max(10)
});

const pollInclude = {
  ballots: {
    include: {
      voter: {
        select: {
          id: true,
          name: true
        }
      },
      votes: {
        include: {
          targetUser: {
            select: {
              id: true,
              name: true,
              image: true
            }
          }
        }
      }
    }
  }
} as const;

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const session = await requireSession();
  if (!session.ok) return session.response;

  const event = await prisma.event.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      teamId: true,
      kind: true,
      canceledAt: true,
      matchMotmUserId: true,
      matchMotmUser: {
        select: {
          id: true,
          name: true,
          image: true
        }
      }
    }
  });
  if (!event) {
    return NextResponse.json({ error: "Begivenhed ikke fundet" }, { status: 404 });
  }

  const member = await requireActiveTeamMember(session.userId, event.teamId);
  if (!member.ok) return member.response;

  const poll = await prisma.eventMotmPoll.findUnique({
    where: { eventId: params.id },
    include: pollInclude
  });

  const resolvedMotmImage = event.matchMotmUser
    ? await resolveProfileImageUrl(event.matchMotmUser.image)
    : null;

  return NextResponse.json({
    poll: poll ? buildMotmPollApiView(poll, session.userId, MOTM_MANAGER_ROLES.includes(member.role)) : null,
    matchMotmUser: event.matchMotmUser
      ? {
          id: event.matchMotmUser.id,
          name: event.matchMotmUser.name,
          image: resolvedMotmImage
        }
      : null
  });
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await requireSession();
  if (!session.ok) return session.response;

  const event = await prisma.event.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      teamId: true,
      kind: true,
      canceledAt: true,
      title: true,
      date: true,
      location: true,
      source: true,
      seriesId: true
    }
  });
  if (!event) {
    return NextResponse.json({ error: "Begivenhed ikke fundet" }, { status: 404 });
  }

  const member = await requireActiveTeamMember(session.userId, event.teamId);
  if (!member.ok) return member.response;
  if (!MOTM_MANAGER_ROLES.includes(member.role)) {
    return NextResponse.json({ error: "Ikke adgang" }, { status: 403 });
  }

  const availabilityError = eventMotmAvailabilityError(event);
  if (availabilityError) {
    return NextResponse.json({ error: availabilityError }, { status: 400 });
  }

  const body = createPollSchema.parse(await request.json());
  const existingPoll = await prisma.eventMotmPoll.findUnique({
    where: { eventId: params.id },
    select: { id: true }
  });
  if (existingPoll) {
    return NextResponse.json({ error: "Der findes allerede en MOTM-afstemning til denne kamp" }, { status: 409 });
  }

  const poll = await prisma.eventMotmPoll.create({
    data: {
      eventId: params.id,
      createdById: session.userId,
      votesPerVoter: body.votesPerVoter,
      revealCount: body.revealCount
    },
    include: pollInclude
  });

  await prisma.eventLog.create({
    data: {
      eventId: params.id,
      actorId: session.userId,
      type: "SIGNUP",
      message: "MOTM-afstemning åbnet"
    }
  });

  const signedUpRecipients = await prisma.signup.findMany({
    where: {
      eventId: params.id,
      status: "IN",
      userId: { not: session.userId },
      user: {
        memberships: {
          some: {
            teamId: event.teamId,
            status: "ACTIVE"
          }
        }
      }
    },
    select: { userId: true }
  });

  const calendarLink = calendarFocusHrefForEvent({
    id: event.id,
    title: event.title,
    date: event.date,
    location: event.location,
    source: event.source,
    seriesId: event.seriesId
  });

  const motmNotifications = signedUpRecipients.map((row) => ({
    userId: row.userId,
    teamId: event.teamId,
    type: "EVENT" as const,
    title: "MOTM-afstemning åbnet",
    body: `${event.title} · Tryk for at åbne begivenheden og stemme`,
    link: calendarLink
  }));

  if (motmNotifications.length > 0) {
    await createNotifications(motmNotifications);
  }

  return NextResponse.json({
    poll: buildMotmPollApiView(poll, session.userId, true)
  });
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const session = await requireSession();
  if (!session.ok) return session.response;

  const event = await prisma.event.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      teamId: true
    }
  });
  if (!event) {
    return NextResponse.json({ error: "Begivenhed ikke fundet" }, { status: 404 });
  }

  const member = await requireActiveTeamMember(session.userId, event.teamId);
  if (!member.ok) return member.response;
  if (!MOTM_MANAGER_ROLES.includes(member.role)) {
    return NextResponse.json({ error: "Ikke adgang" }, { status: 403 });
  }

  const existingPoll = await prisma.eventMotmPoll.findUnique({
    where: { eventId: params.id },
    select: {
      id: true,
      status: true
    }
  });
  if (!existingPoll) {
    return NextResponse.json({ error: "Afstemningen er ikke åbnet endnu" }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.event.update({
      where: { id: params.id },
      data: {
        matchMotmUserId: null
      }
    });

    await tx.eventMotmPoll.delete({
      where: { id: existingPoll.id }
    });

    await tx.eventLog.create({
      data: {
        eventId: params.id,
        actorId: session.userId,
        type: "SIGNUP",
        message:
          existingPoll.status === "CLOSED"
            ? "MOTM-afstemning nulstillet og gemte resultater slettet"
            : "MOTM-afstemning nulstillet"
      }
    });
  });

  return NextResponse.json({
    poll: null,
    matchMotmUser: null
  });
}
