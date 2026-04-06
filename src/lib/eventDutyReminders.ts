import { prisma } from "@/lib/prisma";
import { createNotifications } from "@/lib/notifications";

export async function processEventDutyReminders(teamId: string) {
  const now = new Date();
  const windowStart = new Date(now.getTime() - 65 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + 5 * 60 * 1000);

  const events = await prisma.event.findMany({
    where: {
      teamId,
      canceledAt: null,
      OR: [{ thingCarrierId: { not: null } }, { beerCarrierId: { not: null } }],
      date: {
        gte: new Date(now.getTime() + 55 * 60 * 1000),
        lte: new Date(now.getTime() + 3 * 60 * 60 * 1000)
      }
    },
    select: {
      id: true,
      title: true,
      date: true,
      thingCarrierId: true,
      beerCarrierId: true
    },
    orderBy: { date: "asc" }
  });

  if (events.length === 0) {
    return { notificationsCreated: 0, events: 0 };
  }

  const reminders: Array<{
    userId: string;
    teamId: string;
    type: "EVENT";
    title: string;
    body: string;
    link: string;
  }> = [];

  const reminderLinks = events.map((event) => `/dashboard/kalender?eventId=${event.id}&kind=duty-reminder`);
  const candidateUserIds = Array.from(
    new Set(
      events.flatMap((event) => [event.thingCarrierId, event.beerCarrierId].filter((value): value is string => Boolean(value)))
    )
  );

  if (candidateUserIds.length === 0) {
    return { notificationsCreated: 0, events: events.length };
  }

  const existing = await prisma.notification.findMany({
    where: {
      teamId,
      type: "EVENT",
      title: "Husk ting til begivenhed",
      link: { in: reminderLinks },
      userId: { in: candidateUserIds }
    },
    select: { userId: true, link: true }
  });
  const existingKeys = new Set(existing.map((item) => `${item.userId}|${item.link}`));

  for (const event of events) {
    const reminderAt = new Date(new Date(event.date).getTime() - 2 * 60 * 60 * 1000);
    if (reminderAt < windowStart || reminderAt > windowEnd) {
      continue;
    }

    const rolesByUser = new Map<string, string[]>();
    if (event.thingCarrierId) {
      rolesByUser.set(event.thingCarrierId, [...(rolesByUser.get(event.thingCarrierId) ?? []), "tingene"]);
    }
    if (event.beerCarrierId) {
      rolesByUser.set(event.beerCarrierId, [...(rolesByUser.get(event.beerCarrierId) ?? []), "øl"]);
    }

    for (const [userId, items] of rolesByUser) {
      const link = `/dashboard/kalender?eventId=${event.id}&kind=duty-reminder`;
      const dedupeKey = `${userId}|${link}`;
      if (existingKeys.has(dedupeKey)) continue;

      const when = new Date(event.date).toLocaleString("da-DK", {
        timeZone: "Europe/Copenhagen"
      });

      reminders.push({
        userId,
        teamId,
        type: "EVENT",
        title: "Husk ting til begivenhed",
        body: `${event.title} (${when}) · Du skal tage ${items.join(" og ")}.`,
        link
      });
      existingKeys.add(dedupeKey);
    }
  }

  if (reminders.length > 0) {
    await createNotifications(reminders);
  }

  return { notificationsCreated: reminders.length, events: events.length };
}
