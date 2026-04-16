import { NextResponse } from "next/server";
import { EVENT_MANAGER_ROLES, requireActiveTeamMember, requireSession } from "@/lib/apiAuth";
import { buildScoreRowsFromPollBallots, buildMotmPollApiView } from "@/lib/motmPolls";
import { prisma } from "@/lib/prisma";

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

export async function POST(_request: Request, { params }: { params: { id: string } }) {
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
  if (!EVENT_MANAGER_ROLES.includes(member.role)) {
    return NextResponse.json({ error: "Ikke adgang" }, { status: 403 });
  }

  const poll = await prisma.$transaction(async (tx) => {
    const current = await tx.eventMotmPoll.findUnique({
      where: { eventId: params.id },
      include: pollInclude
    });
    if (!current) return null;

    if (current.status === "CLOSED") {
      return current;
    }

    const rows = buildScoreRowsFromPollBallots(current.ballots);
    const winnerUserId = rows[0]?.userId ?? null;

    await tx.eventMotmPoll.update({
      where: { id: current.id },
      data: {
        status: "CLOSED",
        closedAt: new Date()
      }
    });

    await tx.event.update({
      where: { id: params.id },
      data: {
        matchMotmUserId: winnerUserId
      }
    });

    await tx.eventLog.create({
      data: {
        eventId: params.id,
        actorId: session.userId,
        type: "SIGNUP",
        message: winnerUserId ? "MOTM-afstemning lukket og vinder fundet" : "MOTM-afstemning lukket uden stemmer"
      }
    });

    return tx.eventMotmPoll.findUnique({
      where: { id: current.id },
      include: pollInclude
    });
  });

  if (!poll) {
    return NextResponse.json({ error: "Afstemningen er ikke åbnet endnu" }, { status: 404 });
  }

  return NextResponse.json({
    poll: buildMotmPollApiView(poll, session.userId, true)
  });
}
