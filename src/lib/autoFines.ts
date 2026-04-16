import type { FineAutomationAction } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createNotifications } from "@/lib/notifications";
import {
  isPostDeadlineWithdrawal,
  isSameCalendarDayAsEvent,
  resolveAutomationTemplate,
  roleExcludedFromFineAutomation
} from "@/lib/fineAutomation";

export async function processMissedSignupFines(teamId: string) {
  const now = new Date();
  const nowMs = now.getTime();

  const [players, managers, dueEvents] = await Promise.all([
    prisma.membership.findMany({
      where: { teamId, status: "ACTIVE" },
      select: { userId: true, role: true, createdAt: true, user: { select: { name: true } } }
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
        date: true,
        kind: true,
        signupDeadline: true,
        signups: {
          select: { userId: true, status: true }
        },
        signupLogs: {
          select: { userId: true, status: true, createdAt: true },
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

    const playerById = new Map(players.map((member) => [member.userId, member]));

  let totalCreated = 0;

  for (const event of dueEvents) {
    const deadlineMs = new Date(event.signupDeadline).getTime();
    if (Number.isNaN(deadlineMs) || deadlineMs > nowMs) continue;

    const statusByUser = new Map(event.signups.map((signup) => [signup.userId, signup.status]));
    const latestLogByUser = new Map<string, { createdAt: Date; status: "IN" | "OUT" | "UNKNOWN" }>();
    for (const log of event.signupLogs) {
      if (!latestLogByUser.has(log.userId)) {
        latestLogByUser.set(log.userId, {
          createdAt: new Date(log.createdAt),
          status: log.status
        });
      }
    }

    const deadlineDate = new Date(event.signupDeadline);

    const missingUserIds: string[] = [];
    const lateUserIds: string[] = [];
    const sameDayWithdrawalUserIds: string[] = [];

    for (const member of players) {
      if (member.createdAt > deadlineDate) continue;
      const targetUserId = member.userId;
      const status = statusByUser.get(targetUserId);
      const latestLog = latestLogByUser.get(targetUserId);
      const eventDate = new Date(event.date);
      const latestLogAt = latestLog?.createdAt.getTime() ?? null;
      const previousStatus =
        latestLog === undefined
          ? undefined
          : event.signupLogs.find(
              (log) => log.userId === targetUserId && log.createdAt < latestLog.createdAt
            )?.status;
      const sameDayWithdrawal =
        status === "OUT" &&
        previousStatus === "IN" &&
        latestLog?.status === "OUT" &&
        latestLogAt !== null &&
        latestLogAt > deadlineMs &&
        isSameCalendarDayAsEvent(eventDate, latestLog.createdAt);

      const lateResponse =
        latestLog !== undefined &&
        isPostDeadlineWithdrawal(
          previousStatus,
          latestLog.status,
          latestLog.createdAt,
          deadlineDate,
          eventDate
        );
      const missingAfterDeadline = (!status || status === "UNKNOWN") && nowMs > deadlineMs;

      if (missingAfterDeadline) missingUserIds.push(targetUserId);
      else if (sameDayWithdrawal) sameDayWithdrawalUserIds.push(targetUserId);
      else if (lateResponse) lateUserIds.push(targetUserId);
    }

    const allCandidates = [...new Set([...missingUserIds, ...lateUserIds, ...sameDayWithdrawalUserIds])];
    if (allCandidates.length === 0) continue;

    const existingFines = await prisma.fine.findMany({
      where: {
        teamId,
        eventId: event.id,
        userId: { in: allCandidates }
      },
      select: { userId: true }
    });
    const existingUserIds = new Set(existingFines.map((fine) => fine.userId));

    const [missedResolved, statusResolved, sameDayResolved] = await Promise.all([
      resolveAutomationTemplate(teamId, "MISSED_SIGNUP_AT_DEADLINE", event.kind),
      resolveAutomationTemplate(teamId, "STATUS_CHANGE_AFTER_DEADLINE", event.kind),
      resolveAutomationTemplate(teamId, "SAME_DAY_WITHDRAWAL", event.kind)
    ]);

    type Row = {
      userId: string;
      templateId: string;
      amount: number;
      reason: string;
      description: string | null;
      automationAction: FineAutomationAction;
    };

    const rows: Row[] = [];

    for (const userId of missingUserIds) {
      if (existingUserIds.has(userId)) continue;
      if (!missedResolved) continue;
      const member = playerById.get(userId);
      if (!member || roleExcludedFromFineAutomation(member.role, missedResolved.excludedRoles)) continue;
      rows.push({
        userId,
        templateId: missedResolved.template.id,
        amount: missedResolved.template.amount,
        reason: missedResolved.template.title,
        description: missedResolved.template.description ?? null,
        automationAction: missedResolved.automationAction
      });
    }

    for (const userId of lateUserIds) {
      if (existingUserIds.has(userId)) continue;
      if (!statusResolved) continue;
      const member = playerById.get(userId);
      if (!member || roleExcludedFromFineAutomation(member.role, statusResolved.excludedRoles)) continue;
      rows.push({
        userId,
        templateId: statusResolved.template.id,
        amount: statusResolved.template.amount,
        reason: statusResolved.template.title,
        description: statusResolved.template.description ?? null,
        automationAction: statusResolved.automationAction
      });
    }

    for (const userId of sameDayWithdrawalUserIds) {
      if (existingUserIds.has(userId)) continue;
      if (!sameDayResolved) continue;
      const member = playerById.get(userId);
      if (!member || roleExcludedFromFineAutomation(member.role, sameDayResolved.excludedRoles)) continue;
      rows.push({
        userId,
        templateId: sameDayResolved.template.id,
        amount: sameDayResolved.template.amount,
        reason: sameDayResolved.template.title,
        description: sameDayResolved.template.description ?? null,
        automationAction: sameDayResolved.automationAction
      });
    }

    if (rows.length === 0) continue;

    await prisma.fine.createMany({
      data: rows.map((row) => ({
        teamId,
        userId: row.userId,
        eventId: event.id,
        templateId: row.templateId,
        amount: row.amount,
        reason: row.reason,
        description: row.description,
        status: "FORESLAET" as const,
        createdById: null,
        createdByLabel: "System",
        automationAction: row.automationAction
      }))
    });
    totalCreated += rows.length;

    const singlePlayerName = rows.length === 1 ? playerById.get(rows[0].userId)?.user.name ?? "ukendt spiller" : null;
    const body =
      rows.length === 1
        ? `${singlePlayerName} i "${event.title}" har fået foreslået bøde.`
        : `${rows.length} spiller(e) i "${event.title}" har fået foreslået bøde.`;

    const notifications = managers.map((manager) => ({
      userId: manager.userId,
      teamId,
      type: "FINE_PROPOSED" as const,
      title: "Foreslået bøde",
      body,
      link: "/dashboard/boder"
    }));
    if (notifications.length > 0) {
      await createNotifications(notifications);
    }
  }

  return { created: totalCreated, events: dueEvents.length };
}
