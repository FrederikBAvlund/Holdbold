import { prisma } from "@/lib/prisma";
import { DEFAULT_THEME_ID } from "@/lib/themePresets";
import type { GuideFacts } from "@/lib/guide/steps";

const exists = (row: unknown) => row !== null;

/** Henter alt guiden skal bruge for at vide, hvad der allerede er lavet på holdet og af brugeren. */
export async function loadGuideFacts(userId: string, teamId: string): Promise<GuideFacts> {
  const id = { select: { id: true } } as const;

  const [
    team,
    user,
    icalFeed,
    icalEvent,
    eventSeries,
    fineTemplate,
    fineAutomation,
    openAiKey,
    otherMember,
    roleHolder,
    pushSubscription,
    signup,
    absence,
    createdEvent,
    createdFine,
    approvedFine,
    markedFinePaid,
    createdCollection,
    decidedAbsence,
    createdMotmPoll
  ] = await Promise.all([
    prisma.team.findUnique({ where: { id: teamId }, select: { mobilePayBox: true, themePreset: true, themeConfig: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { image: true } }),
    prisma.icalFeed.findFirst({ where: { teamId }, ...id }),
    prisma.event.findFirst({ where: { teamId, source: "ICAL" }, ...id }),
    prisma.eventSeries.findFirst({ where: { teamId }, ...id }),
    prisma.fineTemplate.findFirst({ where: { teamId, status: "APPROVED" }, ...id }),
    prisma.fineAutomationSetting.findFirst({ where: { teamId, isActive: true }, ...id }),
    prisma.teamOpenAiCredential.findUnique({ where: { teamId }, select: { teamId: true } }),
    prisma.membership.findFirst({ where: { teamId, status: "ACTIVE", userId: { not: userId } }, ...id }),
    prisma.membership.findFirst({
      where: { teamId, status: "ACTIVE", role: { in: ["TRAENER", "BOEDEKASSEFORMAND", "SOME"] } },
      ...id
    }),
    prisma.pushSubscription.findFirst({ where: { userId }, ...id }),
    prisma.signup.findFirst({ where: { userId, status: { not: "UNKNOWN" }, absenceId: null, event: { teamId } }, ...id }),
    prisma.absence.findFirst({ where: { teamId, userId }, ...id }),
    prisma.event.findFirst({ where: { teamId, createdById: userId }, ...id }),
    prisma.fine.findFirst({ where: { teamId, createdById: userId }, ...id }),
    prisma.fine.findFirst({ where: { teamId, approvedById: userId }, ...id }),
    prisma.fine.findFirst({ where: { teamId, markedPaidById: userId }, ...id }),
    prisma.fineCollection.findFirst({ where: { teamId, createdById: userId }, ...id }),
    prisma.absence.findFirst({ where: { teamId, decidedById: userId }, ...id }),
    prisma.eventMotmPoll.findFirst({ where: { createdById: userId, event: { teamId } }, ...id })
  ]);

  return {
    team: {
      mobilePayBox: Boolean(team?.mobilePayBox?.trim()),
      calendarImported: exists(icalFeed) || exists(icalEvent),
      eventSeries: exists(eventSeries),
      fineTemplates: exists(fineTemplate),
      fineAutomation: exists(fineAutomation),
      openAiKey: exists(openAiKey),
      otherMembers: exists(otherMember),
      assignedRoles: exists(roleHolder),
      customTheme: Boolean(team && (team.themePreset !== DEFAULT_THEME_ID || team.themeConfig !== null))
    },
    user: {
      pushEnabled: exists(pushSubscription),
      signedUp: exists(signup),
      avatar: Boolean(user?.image),
      reportedAbsence: exists(absence),
      createdEvent: exists(createdEvent),
      createdFine: exists(createdFine),
      approvedFine: exists(approvedFine),
      markedFinePaid: exists(markedFinePaid),
      createdCollection: exists(createdCollection),
      decidedAbsence: exists(decidedAbsence),
      createdMotmPoll: exists(createdMotmPoll)
    }
  };
}
