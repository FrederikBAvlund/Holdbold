import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { processDueFineCollections } from "@/lib/fineCollections";
import { processMissedSignupFines } from "@/lib/autoFines";
import { processUpcomingSignupDeadlineReminders } from "@/lib/deadlineReminders";
import { processEventDutyReminders } from "@/lib/eventDutyReminders";
import { syncDueFeeds } from "@/lib/icalFeed";
import { ensureTeamSeriesEvents } from "@/lib/seriesEvents";

export const dynamic = "force-dynamic";

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    // In development we allow manual calls without secret.
    return process.env.NODE_ENV !== "production";
  }

  const authorization = request.headers.get("authorization");
  return authorization === `Bearer ${cronSecret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const teams = await prisma.team.findMany({
    select: { id: true }
  });

  const result = {
    teamsProcessed: 0,
    collectionSuggestionsCreated: 0,
    missedSignupSuggestionsCreated: 0,
    signupDeadlineRemindersSent: 0,
    eventDutyRemindersSent: 0,
    seriesEventsCreated: 0,
    icalFeedsSynced: 0,
    icalFeedsFailed: 0,
    icalEventsCreated: 0,
    icalEventsUpdated: 0
  };

  for (const team of teams) {
    result.teamsProcessed += 1;

    const beforeCollectionCount = await prisma.fine.count({
      where: {
        teamId: team.id,
        createdByLabel: "System",
        status: "FORESLAET",
        eventId: null
      }
    });
    await processDueFineCollections(team.id);
    const afterCollectionCount = await prisma.fine.count({
      where: {
        teamId: team.id,
        createdByLabel: "System",
        status: "FORESLAET",
        eventId: null
      }
    });
    result.collectionSuggestionsCreated += Math.max(0, afterCollectionCount - beforeCollectionCount);

    // Oprettes før påmindelser og bøder, så nye gentagelser også bliver dækket.
    result.seriesEventsCreated += await ensureTeamSeriesEvents(team.id);

    const missedResult = await processMissedSignupFines(team.id);
    result.missedSignupSuggestionsCreated += missedResult.created;

    const reminderResult = await processUpcomingSignupDeadlineReminders(team.id);
    result.signupDeadlineRemindersSent += reminderResult.notificationsCreated;

    const dutyReminderResult = await processEventDutyReminders(team.id);
    result.eventDutyRemindersSent += dutyReminderResult.notificationsCreated;
  }

  // DBU-feeds hentes igen, så flyttede kampe opdateres automatisk.
  const feedResult = await syncDueFeeds();
  result.icalFeedsSynced = feedResult.feeds;
  result.icalFeedsFailed = feedResult.failed;
  result.icalEventsCreated = feedResult.created;
  result.icalEventsUpdated = feedResult.updated;

  return NextResponse.json({
    ok: true,
    ...result
  });
}
