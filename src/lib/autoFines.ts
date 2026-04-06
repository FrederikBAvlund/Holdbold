import { prisma } from "@/lib/prisma";
import { createNotifications } from "@/lib/notifications";

const MISSED_SIGNUP_TEMPLATE_TITLE = "Ikke skrive sig til/fra på opslag";
const MISSED_SIGNUP_TEMPLATE_AMOUNT = 20;

export async function getOrCreateMissedSignupTemplate(teamId: string) {
  const existing = await prisma.fineTemplate.findFirst({
    where: {
      teamId,
      status: "APPROVED",
      title: {
        equals: MISSED_SIGNUP_TEMPLATE_TITLE,
        mode: "insensitive"
      }
    },
    select: {
      id: true,
      title: true,
      amount: true,
      description: true
    }
  });

  if (existing) return existing;

  const created = await prisma.fineTemplate.create({
    data: {
      teamId,
      title: MISSED_SIGNUP_TEMPLATE_TITLE,
      amount: MISSED_SIGNUP_TEMPLATE_AMOUNT,
      category: "SPILLER",
      description: "Systembøde for manglende svar eller ændring efter deadline",
      status: "APPROVED"
    },
    select: {
      id: true,
      title: true,
      amount: true,
      description: true
    }
  });

  return created;
}

export async function processMissedSignupFines(teamId: string) {
  const now = new Date();
  const nowMs = now.getTime();

  const [template, players, managers, dueEvents] = await Promise.all([
    getOrCreateMissedSignupTemplate(teamId),
    prisma.membership.findMany({
      where: { teamId, status: "ACTIVE", role: { not: "SOME" } },
      select: { userId: true, role: true }
    }),
    prisma.membership.findMany({
      where: { teamId, status: "ACTIVE", role: { in: ["ADMIN", "BOEDEKASSEFORMAND"] } },
      select: { userId: true }
    }),
    prisma.event.findMany({
      where: {
        teamId,
        canceledAt: null,
        signupDeadline: { lte: now }
      },
      select: {
        id: true,
        title: true,
        signupDeadline: true,
        signups: {
          select: { userId: true, status: true }
        },
        signupLogs: {
          select: { userId: true, createdAt: true },
          orderBy: { createdAt: "desc" }
        }
      },
      orderBy: { signupDeadline: "desc" },
      take: 300
    })
  ]);

  if (players.length === 0 || dueEvents.length === 0) {
    return { created: 0, events: 0 };
  }

  let totalCreated = 0;

  for (const event of dueEvents) {
    const deadlineMs = new Date(event.signupDeadline).getTime();
    if (Number.isNaN(deadlineMs) || deadlineMs > nowMs) continue;

    const statusByUser = new Map(event.signups.map((signup) => [signup.userId, signup.status]));
    const latestLogByUser = new Map<string, Date>();
    for (const log of event.signupLogs) {
      if (!latestLogByUser.has(log.userId)) {
        latestLogByUser.set(log.userId, new Date(log.createdAt));
      }
    }

    const candidateUserIds = players
      .filter((member) => member.role !== "SOME")
      .map((member) => member.userId)
      .filter((targetUserId) => {
        const status = statusByUser.get(targetUserId);
        const latestLogAt = latestLogByUser.get(targetUserId)?.getTime() ?? null;

        const lateResponse =
          (status === "IN" || status === "OUT") && latestLogAt !== null && latestLogAt > deadlineMs;
        const missingAfterDeadline = (!status || status === "UNKNOWN") && nowMs > deadlineMs;
        return lateResponse || missingAfterDeadline;
      });

    if (candidateUserIds.length === 0) continue;

    const existingFines = await prisma.fine.findMany({
      where: {
        teamId,
        eventId: event.id,
        userId: { in: candidateUserIds }
      },
      select: { userId: true }
    });
    const existingUserIds = new Set(existingFines.map((fine) => fine.userId));
    const userIdsToCreate = candidateUserIds.filter((userId) => !existingUserIds.has(userId));
    if (userIdsToCreate.length === 0) continue;

    await prisma.fine.createMany({
      data: userIdsToCreate.map((userId) => ({
        teamId,
        userId,
        eventId: event.id,
        templateId: template.id,
        amount: template.amount,
        reason: template.title,
        description: template.description ?? null,
        status: "FORESLAET" as const,
        createdById: null,
        createdByLabel: "System"
      }))
    });
    totalCreated += userIdsToCreate.length;

    const notifications = managers.map((manager) => ({
      userId: manager.userId,
      teamId,
      type: "FINE_PROPOSED" as const,
      title: "System foreslår bøder",
      body: `${userIdsToCreate.length} spiller(e) i "${event.title}" har fået foreslået bøde (${template.amount} kr).`,
      link: "/dashboard/boder"
    }));
    if (notifications.length > 0) {
      await createNotifications(notifications);
    }
  }

  return { created: totalCreated, events: dueEvents.length };
}
