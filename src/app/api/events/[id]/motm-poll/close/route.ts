import { NextResponse } from "next/server";
import { requireActiveTeamMember, requireSession } from "@/lib/apiAuth";
import { resolveAutomationTemplate, roleExcludedFromFineAutomation } from "@/lib/fineAutomation";
import { buildScoreRowsFromPollBallots, buildMotmPollApiView } from "@/lib/motmPolls";
import { createNotifications } from "@/lib/notifications";
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

  const activeMember = await requireActiveTeamMember(session.userId, event.teamId);
  if (!activeMember.ok) return activeMember.response;

  let closedWinnerUserId: string | null = null;
  let poll;
  try {
    poll = await prisma.$transaction(async (tx) => {
      const current = await tx.eventMotmPoll.findUnique({
        where: { eventId: params.id },
        include: pollInclude
      });
      if (!current) return null;

      if (current.status === "CLOSED") {
        return current;
      }
      if (current.createdById !== session.userId) {
        throw new Error("ONLY_CREATOR_CAN_CLOSE");
      }

      const rows = buildScoreRowsFromPollBallots(current.ballots);
      const winnerUserId = rows[0]?.userId ?? null;
      closedWinnerUserId = winnerUserId;

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
  } catch (error) {
    if (error instanceof Error && error.message === "ONLY_CREATOR_CAN_CLOSE") {
      return NextResponse.json({ error: "Kun personen der åbnede afstemningen kan lukke den" }, { status: 403 });
    }
    throw error;
  }

  if (!poll) {
    return NextResponse.json({ error: "Afstemningen er ikke åbnet endnu" }, { status: 404 });
  }

  if (closedWinnerUserId) {
    const [resolved, winnerMembership, existingFine] = await Promise.all([
      resolveAutomationTemplate(event.teamId, "MATCH_MOTM_WINNER", "MATCH"),
      prisma.membership.findFirst({
        where: {
          teamId: event.teamId,
          userId: closedWinnerUserId,
          status: "ACTIVE"
        },
        select: {
          role: true,
          user: {
            select: {
              name: true
            }
          }
        }
      }),
      prisma.fine.findFirst({
        where: {
          teamId: event.teamId,
          eventId: event.id,
          userId: closedWinnerUserId,
          automationAction: "MATCH_MOTM_WINNER"
        },
        select: { id: true }
      })
    ]);

    if (
      resolved &&
      winnerMembership &&
      !existingFine &&
      !roleExcludedFromFineAutomation(winnerMembership.role, resolved.excludedRoles)
    ) {
      await prisma.fine.create({
        data: {
          teamId: event.teamId,
          userId: closedWinnerUserId,
          eventId: event.id,
          templateId: resolved.template.id,
          amount: resolved.template.amount,
          reason: resolved.template.title,
          description: resolved.template.description ?? null,
          status: "FORESLAET",
          createdById: null,
          createdByLabel: "System",
          automationAction: resolved.automationAction
        }
      });

      const managers = await prisma.membership.findMany({
        where: { teamId: event.teamId, role: { in: ["ADMIN", "BOEDEKASSEFORMAND"] } },
        select: { userId: true }
      });
      if (managers.length > 0) {
        await createNotifications(
          managers.map((manager) => ({
            userId: manager.userId,
            teamId: event.teamId,
            type: "FINE_PROPOSED" as const,
            title: "Foreslået bøde",
            body: `${winnerMembership.user.name ?? "Kampens spiller"} · ${resolved.template.title} · ${resolved.template.amount} kr`,
            link: "/dashboard/boder"
          }))
        );
      }
    }
  }

  return NextResponse.json({
    poll: buildMotmPollApiView(poll, session.userId, true)
  });
}
