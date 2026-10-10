import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "./prisma";
import { importFeedEvents, parseIcsEvents } from "./icalFeed";

function ics(events: Array<{ uid: string; start: string; summary: string; location?: string }>) {
  return [
    "BEGIN:VCALENDAR",
    ...events.flatMap((e) => [
      "BEGIN:VEVENT",
      `UID:${e.uid}`,
      `DTSTART:${e.start}`,
      `SUMMARY:${e.summary}`,
      `LOCATION:${e.location ?? ""}`,
      "END:VEVENT"
    ]),
    "END:VCALENDAR"
  ].join("\r\n");
}

function inDays(days: number, hour = 17) {
  const d = new Date(Date.now() + days * 86_400_000);
  d.setUTCHours(hour, 0, 0, 0);
  return d;
}

function icsDate(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

describe("parseIcsEvents", () => {
  it("læser uid, start, titel og sted", () => {
    const [event] = parseIcsEvents(ics([{ uid: "abc", start: "20271010T170000Z", summary: "A \\, B", location: "Banen" }]));
    expect(event.uid).toBe("abc");
    expect(event.start.toISOString()).toBe("2027-10-10T17:00:00.000Z");
    expect(event.summary).toBe("A , B");
    expect(event.location).toBe("Banen");
  });
});

describe("importFeedEvents", () => {
  const suffix = Math.random().toString(36).slice(2, 8);
  let teamId = "";
  let feedId = "";
  let memberId = "";

  beforeAll(async () => {
    const team = await prisma.team.create({ data: { name: `Import ${suffix}`, slug: `import-${suffix}` } });
    teamId = team.id;
    const feed = await prisma.icalFeed.create({ data: { teamId, name: "test", url: `https://example.test/${suffix}` } });
    feedId = feed.id;
    const user = await prisma.user.create({ data: { name: "Medlem", email: `m-${suffix}@test.dk` } });
    memberId = user.id;
    await prisma.membership.create({ data: { userId: memberId, teamId, role: "SPILLER", status: "ACTIVE" } });
  });

  afterAll(async () => {
    await prisma.notification.deleteMany({ where: { teamId } });
    await prisma.event.deleteMany({ where: { teamId } });
    await prisma.icalFeed.deleteMany({ where: { teamId } });
    await prisma.season.deleteMany({ where: { teamId } });
    await prisma.membership.deleteMany({ where: { teamId } });
    await prisma.user.delete({ where: { id: memberId } });
    await prisma.team.delete({ where: { id: teamId } });
  });

  function run(events: ReturnType<typeof parseIcsEvents>) {
    return importFeedEvents({ teamId, feedId, events });
  }

  it("opretter en kamp og opdaterer den i stedet for at lave dublet, når DBU flytter tidspunktet", async () => {
    const first = inDays(10);
    const created = await run(parseIcsEvents(ics([{ uid: "match-1", start: icsDate(first), summary: "Kamp 1", location: "Hjemme" }])));
    expect(created).toMatchObject({ created: 1, updated: 0 });

    const moved = inDays(11, 18);
    const result = await run(parseIcsEvents(ics([{ uid: "match-1", start: icsDate(moved), summary: "Kamp 1", location: "Hjemme" }])));
    expect(result).toMatchObject({ created: 0, updated: 1, moved: 1 });

    const events = await prisma.event.findMany({ where: { teamId, externalUid: { startsWith: "match-1" } } });
    expect(events).toHaveLength(1);
    expect(events[0].date.toISOString()).toBe(moved.toISOString());
    // Standardfrist og -mødetid følger med flytningen.
    expect(events[0].signupDeadline.getTime()).toBe(moved.getTime() - 24 * 3_600_000);
    expect(events[0].meetingTime?.getTime()).toBe(moved.getTime() - 3_600_000);

    const notices = await prisma.notification.findMany({ where: { teamId, userId: memberId, title: "Kamp ændret" } });
    expect(notices).toHaveLength(1);
  });

  it("bevarer en frist, træneren selv har sat, når kampen flyttes", async () => {
    const start = inDays(20);
    await run(parseIcsEvents(ics([{ uid: "match-2", start: icsDate(start), summary: "Kamp 2" }])));
    const custom = new Date(start.getTime() - 48 * 3_600_000);
    await prisma.event.updateMany({ where: { teamId, externalUid: { startsWith: "match-2" } }, data: { signupDeadline: custom } });

    const moved = inDays(21);
    await run(parseIcsEvents(ics([{ uid: "match-2", start: icsDate(moved), summary: "Kamp 2" }])));
    const event = await prisma.event.findFirstOrThrow({ where: { teamId, externalUid: { startsWith: "match-2" } } });
    expect(event.date.toISOString()).toBe(moved.toISOString());
    expect(event.signupDeadline.toISOString()).toBe(custom.toISOString());
  });

  it("rører ikke kampe, som en træner/admin selv har rettet", async () => {
    const start = inDays(30);
    await run(parseIcsEvents(ics([{ uid: "match-3", start: icsDate(start), summary: "Kamp 3", location: "Ude" }])));
    await prisma.event.updateMany({
      where: { teamId, externalUid: { startsWith: "match-3" } },
      data: { location: "Ny bane", manualOverride: true }
    });

    const result = await run(
      parseIcsEvents(ics([{ uid: "match-3", start: icsDate(inDays(31)), summary: "Kamp 3", location: "Ude" }]))
    );
    expect(result).toMatchObject({ created: 0, updated: 0 });
    const event = await prisma.event.findFirstOrThrow({ where: { teamId, externalUid: { startsWith: "match-3" } } });
    expect(event.date.toISOString()).toBe(start.toISOString());
    expect(event.location).toBe("Ny bane");
  });

  it("gør ingenting, når intet er ændret", async () => {
    const start = inDays(40);
    const events = parseIcsEvents(ics([{ uid: "match-4", start: icsDate(start), summary: "Kamp 4" }]));
    await run(events);
    expect(await run(events)).toMatchObject({ created: 0, updated: 0 });
  });
});
