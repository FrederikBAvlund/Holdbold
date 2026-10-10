import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "./prisma";
import { ensureSeriesEvents, removeSeriesEventsAfter, seriesOccurrenceDates } from "./seriesEvents";

describe("seriesOccurrenceDates", () => {
  const base = { startDate: new Date("2027-01-04T17:00:00Z"), recurrence: "WEEKLY", interval: 1, endDate: null };

  it("giver ugentlige datoer i intervallet", () => {
    const dates = seriesOccurrenceDates(base, new Date("2027-01-10T00:00:00Z"), new Date("2027-02-01T00:00:00Z"));
    expect(dates.map((d) => d.toISOString().slice(0, 10))).toEqual(["2027-01-11", "2027-01-18", "2027-01-25"]);
  });

  it("stopper ved slutdatoen", () => {
    const dates = seriesOccurrenceDates(
      { ...base, endDate: new Date("2027-01-12T00:00:00Z") },
      new Date("2027-01-01T00:00:00Z"),
      new Date("2027-03-01T00:00:00Z")
    );
    expect(dates).toHaveLength(2);
  });
});

describe("ensureSeriesEvents", () => {
  const suffix = Math.random().toString(36).slice(2, 8);
  let teamId = "";
  let seasonId = "";
  let memberId = "";
  let seriesId = "";

  beforeAll(async () => {
    const team = await prisma.team.create({ data: { name: `Serie ${suffix}`, slug: `serie-${suffix}` } });
    teamId = team.id;
    const season = await prisma.season.create({ data: { teamId, name: "S" } });
    seasonId = season.id;
    const user = await prisma.user.create({ data: { name: "Medlem", email: `s-${suffix}@test.dk` } });
    memberId = user.id;
    await prisma.membership.create({ data: { userId: memberId, teamId, roles: ["SPILLER"], status: "ACTIVE" } });
    const start = new Date(Date.now() + 86_400_000);
    start.setUTCHours(17, 0, 0, 0);
    const series = await prisma.eventSeries.create({
      data: { teamId, seasonId, title: "Træning", location: "Banen", startDate: start, recurrence: "WEEKLY" }
    });
    seriesId = series.id;
  });

  afterAll(async () => {
    await prisma.notification.deleteMany({ where: { teamId } });
    await prisma.event.deleteMany({ where: { teamId } });
    await prisma.eventSeries.deleteMany({ where: { teamId } });
    await prisma.season.deleteMany({ where: { teamId } });
    await prisma.membership.deleteMany({ where: { teamId } });
    await prisma.user.delete({ where: { id: memberId } });
    await prisma.team.delete({ where: { id: teamId } });
  });

  it("opretter begivenheder frem i tiden uden notifikationer, og er idempotent", async () => {
    const created = await ensureSeriesEvents(seriesId);
    expect(created).toBeGreaterThanOrEqual(15);
    expect(await ensureSeriesEvents(seriesId)).toBe(0);
    expect(await prisma.notification.count({ where: { teamId } })).toBe(0);
    const first = await prisma.event.findFirstOrThrow({ where: { seriesId }, orderBy: { date: "asc" } });
    expect(first.source).toBe("SERIES");
    expect(first.signupDeadline.getTime()).toBe(first.date.getTime() - 24 * 3_600_000);
  });

  it("fjerner begivenheder efter en ny slutdato", async () => {
    const before = await prisma.event.count({ where: { seriesId } });
    const cutoff = new Date(Date.now() + 15 * 86_400_000);
    const removed = await removeSeriesEventsAfter(seriesId, cutoff);
    expect(removed).toBeGreaterThan(0);
    expect(await prisma.event.count({ where: { seriesId } })).toBe(before - removed);
    expect(await prisma.event.count({ where: { seriesId, date: { gt: cutoff } } })).toBe(0);
  });
});
