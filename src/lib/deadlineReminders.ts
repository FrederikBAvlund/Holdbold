import { prisma } from "@/lib/prisma";
import { createNotifications } from "@/lib/notifications";

export async function processUpcomingSignupDeadlineReminders(teamId: string) {
  const now = new Date();
  const inOneHour = new Date(now.getTime() + 60 * 60 * 1000);

  const [events, memberships] = await Promise.all([
    prisma.event.findMany({
      where: {
        teamId,
        canceledAt: null,
        signupDeadline: {
          gte: now,
          lte: inOneHour
        }
      },
      select: {
        id: true,
        title: true,
        signupDeadline: true,
        signups: {
          select: {
            userId: true,
            status: true
          }
        }
      },
      orderBy: { signupDeadline: "asc" }
    }),
    prisma.membership.findMany({
      where: {
        teamId,
        status: "ACTIVE"
      },
      select: {
        userId: true
      }
    })
  ]);

  if (events.length === 0 || memberships.length === 0) {
    return { notificationsCreated: 0, events: events.length };
  }

  const activeUserIds = memberships.map((m) => m.userId);
  const eventLinks = events.map((event) => `/dashboard/kalender?eventId=${event.id}`);

  const existingReminderNotifications = await prisma.notification.findMany({
    where: {
      teamId,
      type: "EVENT",
      title: "Svarfrist om 1 time",
      link: { in: eventLinks },
      userId: { in: activeUserIds }
    },
    select: {
      userId: true,
      link: true
    }
  });

  const sentKeys = new Set(existingReminderNotifications.map((n) => `${n.userId}|${n.link}`));
  const notifications: Array<{
    userId: string;
    teamId: string;
    type: "EVENT";
    title: string;
    body: string;
    link: string;
  }> = [];

  for (const event of events) {
    const statusByUserId = new Map(event.signups.map((signup) => [signup.userId, signup.status]));
    const eventLink = `/dashboard/kalender?eventId=${event.id}`;
    const deadlineText = new Date(event.signupDeadline).toLocaleString("da-DK", {
      timeZone: "Europe/Copenhagen"
    });

    for (const userId of activeUserIds) {
      const status = statusByUserId.get(userId);
      const hasAnswered = status === "IN" || status === "OUT";
      if (hasAnswered) continue;

      const dedupeKey = `${userId}|${eventLink}`;
      if (sentKeys.has(dedupeKey)) continue;

      notifications.push({
        userId,
        teamId,
        type: "EVENT",
        title: "Svarfrist om 1 time",
        body: `${event.title} · svarfrist ${deadlineText}`,
        link: eventLink
      });
      sentKeys.add(dedupeKey);
    }
  }

  if (notifications.length > 0) {
    await createNotifications(notifications);
  }

  return { notificationsCreated: notifications.length, events: events.length };
}

