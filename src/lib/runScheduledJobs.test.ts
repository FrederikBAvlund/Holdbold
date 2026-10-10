import { expect, it, vi } from "vitest";
import { runScheduledJobs } from "./runScheduledJobs";
import { processDueFineCollections } from "./fineCollections";
import { processMissedSignupFines } from "./autoFines";
import { processUpcomingSignupDeadlineReminders } from "./deadlineReminders";
import { processEventDutyReminders } from "./eventDutyReminders";
import { syncDueFeeds } from "./icalFeed";
import { ensureTeamSeriesEvents } from "./seriesEvents";

vi.mock("@/lib/prisma", () => ({ prisma: {
  team: { findMany: vi.fn(async () => [{ id: "team-a" }, { id: "team-b" }]) },
  fine: { count: vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(3)
    .mockResolvedValueOnce(0).mockResolvedValueOnce(1) }
} }));
vi.mock("@/lib/fineCollections", () => ({ processDueFineCollections: vi.fn(async () => {}) }));
vi.mock("@/lib/autoFines", () => ({ processMissedSignupFines: vi.fn(async () => ({ created: 2 })) }));
vi.mock("@/lib/deadlineReminders", () => ({ processUpcomingSignupDeadlineReminders: vi.fn(async () => ({ notificationsCreated: 3 })) }));
vi.mock("@/lib/eventDutyReminders", () => ({ processEventDutyReminders: vi.fn(async () => ({ notificationsCreated: 4 })) }));

vi.mock("@/lib/icalFeed", () => ({ syncDueFeeds: vi.fn(async () => ({ feeds: 3, failed: 1, created: 4, updated: 5 })) }));
vi.mock("@/lib/seriesEvents", () => ({ ensureTeamSeriesEvents: vi.fn(async () => 5) }));

it("preserves all scheduled jobs including recurring events and feed sync", async () => {
  expect(await runScheduledJobs()).toEqual({
    ok: true, teamsProcessed: 2, collectionSuggestionsCreated: 3,
    missedSignupSuggestionsCreated: 4, signupDeadlineRemindersSent: 6,
    eventDutyRemindersSent: 8, seriesEventsCreated: 10,
    icalFeedsSynced: 3, icalFeedsFailed: 1, icalEventsCreated: 4, icalEventsUpdated: 5
  });
  for (const job of [processDueFineCollections, processMissedSignupFines,
    processUpcomingSignupDeadlineReminders, processEventDutyReminders, ensureTeamSeriesEvents]) {
    expect(job).toHaveBeenCalledWith("team-a");
    expect(job).toHaveBeenCalledWith("team-b");
  }
  expect(syncDueFeeds).toHaveBeenCalledTimes(1);
  expect(vi.mocked(ensureTeamSeriesEvents).mock.invocationCallOrder[0]).toBeLessThan(
    vi.mocked(processMissedSignupFines).mock.invocationCallOrder[0]
  );
});
