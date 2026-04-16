import { NextResponse } from "next/server";
import { z } from "zod";
import { EVENT_MANAGER_ROLES, requireActiveTeamMember, requireSession } from "@/lib/apiAuth";
import { normalizeMotmSelections } from "@/lib/motm";
import { buildMotmPollApiView, eventMotmAvailabilityError } from "@/lib/motmPolls";
import { prisma } from "@/lib/prisma";

const voteSchema = z.object({
  selections: z.array(
    z.object({
      userId: z.string().min(1),
      weight: z.number().int().min(1)
    })
  )
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

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await requireSession();
  if (!session.ok) return session.response;

  const event = await prisma.event.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      teamId: true,
      kind: true,
      canceledAt: true
    }
  });
  if (!event) {
    return NextResponse.json({ error: "Begivenhed ikke fundet" }, { status: 404 });
  }

  const member = await requireActiveTeamMember(session.userId, event.teamId);
  if (!member.ok) return member.response;

  const availabilityError = eventMotmAvailabilityError(event);
  if (availabilityError) {
    return NextResponse.json({ error: availabilityError }, { status: 400 });
  }

  const poll = await prisma.eventMotmPoll.findUnique({
    where: { eventId: params.id },
    select: {
      id: true,
      createdById: true,
      status: true,
      votesPerVoter: true
    }
  });
  if (!poll) {
    return NextResponse.json({ error: "Afstemningen er ikke åbnet endnu" }, { status: 404 });
  }
  if (poll.status !== "OPEN") {
    return NextResponse.json({ error: "Afstemningen er lukket" }, { status: 400 });
  }

  const body = voteSchema.parse(await request.json());
  let selections;
  try {
    selections = normalizeMotmSelections(body.selections, poll.votesPerVoter);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ugyldige stemmer" },
      { status: 400 }
    );
  }

  const targetIds = selections.map((selection) => selection.userId);
  const validTargets = await prisma.membership.findMany({
    where: {
      teamId: event.teamId,
      status: "ACTIVE",
      userId: { in: targetIds }
    },
    select: { userId: true }
  });
  const validSet = new Set(validTargets.map((target) => target.userId));
  const invalidTarget = targetIds.find((targetId) => !validSet.has(targetId));
  if (invalidTarget) {
    return NextResponse.json({ error: "Der blev valgt en spiller, som ikke er aktiv på holdet" }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    const ballot = await tx.eventMotmBallot.upsert({
      where: {
        pollId_voterId: {
          pollId: poll.id,
          voterId: session.userId
        }
      },
      update: {},
      create: {
        pollId: poll.id,
        voterId: session.userId
      },
      select: { id: true }
    });

    await tx.eventMotmVote.deleteMany({
      where: { ballotId: ballot.id }
    });

    await tx.eventMotmVote.createMany({
      data: selections.map((selection) => ({
        ballotId: ballot.id,
        targetUserId: selection.userId,
        weight: selection.weight
      }))
    });
  });

  const updatedPoll = await prisma.eventMotmPoll.findUnique({
    where: { eventId: params.id },
    include: pollInclude
  });
  if (!updatedPoll) {
    return NextResponse.json({ error: "Afstemningen kunne ikke hentes" }, { status: 500 });
  }

  return NextResponse.json({
    poll: buildMotmPollApiView(updatedPoll, session.userId, EVENT_MANAGER_ROLES.includes(member.role))
  });
}
