import type { EventKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  LEADERBOARD_CATEGORIES,
  longestAttendanceStreak,
  type LeaderboardCategory,
  type LeaderboardRow,
  type LeaderboardTop
} from "@/lib/leaderboardsShared";

type MemberUser = { id: string; name: string; image: string | null };

function sortRows(
  memberUsers: MemberUser[],
  valueByUser: Map<string, number>
): LeaderboardRow[] {
  const sorted = [...memberUsers].sort((a, b) => {
    const va = valueByUser.get(a.id) ?? 0;
    const vb = valueByUser.get(b.id) ?? 0;
    if (vb !== va) return vb - va;
    return a.name.localeCompare(b.name, "da");
  });
  return sorted.map((u, i) => ({
    rank: i + 1,
    userId: u.id,
    name: u.name,
    image: u.image,
    value: valueByUser.get(u.id) ?? 0
  }));
}

function countsToMap(
  rows: { userId: string; _count: { _all: number } }[],
  memberIds: Set<string>
): Map<string, number> {
  const m = new Map<string, number>();
  for (const id of memberIds) m.set(id, 0);
  for (const row of rows) {
    if (memberIds.has(row.userId)) m.set(row.userId, row._count._all);
  }
  return m;
}

async function loadActiveMembers(teamId: string): Promise<MemberUser[]> {
  const memberships = await prisma.membership.findMany({
    where: { teamId, status: "ACTIVE" },
    include: {
      user: { select: { id: true, name: true, image: true } }
    }
  });
  return memberships.map((m) => m.user);
}

async function attendanceTotals(teamId: string, kind: EventKind, memberIds: Set<string>) {
  const now = new Date();
  const rows = await prisma.signup.groupBy({
    by: ["userId"],
    where: {
      status: "IN",
      userId: { in: [...memberIds] },
      event: {
        teamId,
        kind,
        canceledAt: null,
        date: { lt: now }
      }
    },
    _count: { _all: true }
  });
  return countsToMap(rows, memberIds);
}

async function attendanceStreaks(teamId: string, kind: EventKind, memberIds: Set<string>) {
  const now = new Date();
  const events = await prisma.event.findMany({
    where: { teamId, kind, canceledAt: null, date: { lt: now } },
    orderBy: [{ date: "asc" }, { id: "asc" }],
    select: { id: true }
  });
  if (events.length === 0) {
    return new Map([...memberIds].map((id) => [id, 0] as const));
  }
  const eventIds = events.map((e) => e.id);
  const ins = await prisma.signup.findMany({
    where: {
      eventId: { in: eventIds },
      status: "IN",
      userId: { in: [...memberIds] }
    },
    select: { eventId: true, userId: true }
  });
  const inByEvent = new Map<string, Set<string>>();
  for (const row of ins) {
    if (!inByEvent.has(row.eventId)) inByEvent.set(row.eventId, new Set());
    inByEvent.get(row.eventId)!.add(row.userId);
  }
  const out = new Map<string, number>();
  for (const uid of memberIds) {
    out.set(uid, longestAttendanceStreak(eventIds, inByEvent, uid));
  }
  return out;
}

async function sumPlayerStats(
  teamId: string,
  field: "goals" | "assists",
  memberIds: Set<string>
) {
  const now = new Date();
  const rows = await prisma.eventMatchPlayerStat.groupBy({
    by: ["userId"],
    where: {
      userId: { in: [...memberIds] },
      event: {
        teamId,
        kind: "MATCH",
        canceledAt: null,
        date: { lt: now }
      }
    },
    _sum: { [field]: true }
  });
  const m = new Map<string, number>();
  for (const id of memberIds) m.set(id, 0);
  for (const row of rows) {
    const v = row._sum[field] ?? 0;
    if (memberIds.has(row.userId)) m.set(row.userId, v);
  }
  return m;
}

/** Klub-sæson: 1. aug – 31. jul (lokalt). */
function clubSeasonBounds(reference = new Date()): { from: Date; to: Date } {
  const y = reference.getFullYear();
  const m = reference.getMonth();
  if (m >= 7) {
    return {
      from: new Date(y, 7, 1, 0, 0, 0, 0),
      to: new Date(y + 1, 6, 31, 23, 59, 59, 999)
    };
  }
  return {
    from: new Date(y - 1, 7, 1, 0, 0, 0, 0),
    to: new Date(y, 6, 31, 23, 59, 59, 999)
  };
}

/** Sum af skyld i indeværende sæson (samme statusfilter som dashboardets bøder). */
async function fineSeasonDebtTotals(teamId: string, memberIds: Set<string>) {
  const { from, to } = clubSeasonBounds();
  const rows = await prisma.fine.groupBy({
    by: ["userId"],
    where: {
      teamId,
      userId: { in: [...memberIds] },
      status: { in: ["UNPAID", "PAID_PENDING", "PAID_APPROVED"] },
      createdAt: { gte: from, lte: to }
    },
    _sum: { amount: true }
  });
  const m = new Map<string, number>();
  for (const id of memberIds) m.set(id, 0);
  for (const row of rows) {
    const v = row._sum.amount ?? 0;
    if (memberIds.has(row.userId)) m.set(row.userId, v);
  }
  return m;
}

async function dutyCounts(
  teamId: string,
  field: "thingCarrierId" | "beerCarrierId",
  memberIds: Set<string>
) {
  const baseWhere = {
    teamId,
    canceledAt: null
  };
  const m = new Map<string, number>();
  for (const id of memberIds) m.set(id, 0);

  if (field === "thingCarrierId") {
    const rows = await prisma.event.groupBy({
      by: ["thingCarrierId"],
      where: {
        ...baseWhere,
        thingCarrierId: { not: null, in: [...memberIds] }
      },
      _count: { _all: true }
    });
    for (const row of rows) {
      const uid = row.thingCarrierId;
      if (uid && memberIds.has(uid)) m.set(uid, row._count._all);
    }
  } else {
    const rows = await prisma.event.groupBy({
      by: ["beerCarrierId"],
      where: {
        ...baseWhere,
        beerCarrierId: { not: null, in: [...memberIds] }
      },
      _count: { _all: true }
    });
    for (const row of rows) {
      const uid = row.beerCarrierId;
      if (uid && memberIds.has(uid)) m.set(uid, row._count._all);
    }
  }
  return m;
}

async function valuesForCategory(
  teamId: string,
  category: LeaderboardCategory,
  memberUsers: MemberUser[]
): Promise<Map<string, number>> {
  const memberIds = new Set(memberUsers.map((u) => u.id));
  switch (category) {
    case "training_total":
      return attendanceTotals(teamId, "TRAINING", memberIds);
    case "match_total":
      return attendanceTotals(teamId, "MATCH", memberIds);
    case "training_streak":
      return attendanceStreaks(teamId, "TRAINING", memberIds);
    case "match_streak":
      return attendanceStreaks(teamId, "MATCH", memberIds);
    case "goals":
      return sumPlayerStats(teamId, "goals", memberIds);
    case "assists":
      return sumPlayerStats(teamId, "assists", memberIds);
    case "fines":
      return fineSeasonDebtTotals(teamId, memberIds);
    case "thing_duty":
      return dutyCounts(teamId, "thingCarrierId", memberIds);
    case "beer_duty":
      return dutyCounts(teamId, "beerCarrierId", memberIds);
  }
}

export async function getLeaderboardRows(
  teamId: string,
  category: LeaderboardCategory
): Promise<LeaderboardRow[]> {
  const memberUsers = await loadActiveMembers(teamId);
  if (memberUsers.length === 0) return [];
  const values = await valuesForCategory(teamId, category, memberUsers);
  return sortRows(memberUsers, values);
}

export async function getLeaderboardSummary(teamId: string): Promise<{
  summary: Record<LeaderboardCategory, LeaderboardTop | null>;
}> {
  const memberUsers = await loadActiveMembers(teamId);
  if (memberUsers.length === 0) {
    const empty = {} as Record<LeaderboardCategory, LeaderboardTop | null>;
    for (const c of LEADERBOARD_CATEGORIES) empty[c] = null;
    return { summary: empty };
  }
  const categories = LEADERBOARD_CATEGORIES;
  const valueMaps = await Promise.all(
    categories.map((cat) => valuesForCategory(teamId, cat, memberUsers))
  );
  const summary = {} as Record<LeaderboardCategory, LeaderboardTop | null>;
  for (let i = 0; i < categories.length; i++) {
    const cat = categories[i]!;
    const values = valueMaps[i]!;
    const rows = sortRows(memberUsers, values);
    const top = rows.find((r) => r.value > 0) ?? null;
    summary[cat] = top
      ? { userId: top.userId, name: top.name, image: top.image, value: top.value }
      : null;
  }
  return { summary };
}
