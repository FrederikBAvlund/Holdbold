import type { EventKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  LEADERBOARD_CATEGORIES,
  LEADERBOARD_TIE_SUMMARY_CATEGORIES,
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

  let rank = 1;
  let previousValue: number | null = null;
  return sorted.map((u, i) => {
    const value = valueByUser.get(u.id) ?? 0;
    if (previousValue === null) {
      rank = 1;
    } else if (value < previousValue) {
      rank = i + 1;
    }
    previousValue = value;
    return {
      rank,
      userId: u.id,
      name: u.name,
      image: u.image,
      value
    };
  });
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

async function attendanceTotals(teamId: string, seasonId: string, kind: EventKind, memberIds: Set<string>) {
  const now = new Date();
  const rows = await prisma.signup.groupBy({
    by: ["userId"],
    where: {
      status: "IN",
      userId: { in: [...memberIds] },
      event: {
        teamId,
        seasonId,
        kind,
        canceledAt: null,
        date: { lt: now }
      }
    },
    _count: { _all: true }
  });
  return countsToMap(rows, memberIds);
}

async function attendanceStreaks(teamId: string, seasonId: string, kind: EventKind, memberIds: Set<string>) {
  const now = new Date();
  const events = await prisma.event.findMany({
    where: { teamId, seasonId, kind, canceledAt: null, date: { lt: now } },
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
  seasonId: string,
  field: "goals" | "assists" | "yellowCards" | "redCards",
  memberIds: Set<string>
) {
  const now = new Date();
  const rows = await prisma.eventMatchPlayerStat.groupBy({
    by: ["userId"],
    where: {
      userId: { in: [...memberIds] },
      event: {
        teamId,
        seasonId,
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

/** Sum af skyld i den valgte sæson (samme statusfilter som dashboardets bøder). */
async function fineSeasonDebtTotals(teamId: string, seasonId: string, memberIds: Set<string>) {
  const rows = await prisma.fine.groupBy({
    by: ["userId"],
    where: {
      teamId,
      seasonId,
      userId: { in: [...memberIds] },
      status: { in: ["UNPAID", "PAID_PENDING", "PAID_APPROVED"] }
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
  seasonId: string,
  field: "thingCarrierId" | "beerCarrierId",
  memberIds: Set<string>
) {
  const baseWhere = {
    teamId,
    seasonId,
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

async function motmWinsCounts(teamId: string, seasonId: string, memberIds: Set<string>) {
  const now = new Date();
  const rows = await prisma.event.groupBy({
    by: ["matchMotmUserId"],
    where: {
      teamId,
      seasonId,
      kind: "MATCH",
      canceledAt: null,
      date: { lt: now },
      matchMotmUserId: { not: null, in: [...memberIds] }
    },
    _count: { _all: true }
  });
  const m = new Map<string, number>();
  for (const id of memberIds) m.set(id, 0);
  for (const row of rows) {
    const uid = row.matchMotmUserId;
    if (uid && memberIds.has(uid)) m.set(uid, row._count._all);
  }
  return m;
}

async function valuesForCategory(
  teamId: string,
  seasonId: string,
  category: LeaderboardCategory,
  memberUsers: MemberUser[]
): Promise<Map<string, number>> {
  const memberIds = new Set(memberUsers.map((u) => u.id));
  switch (category) {
    case "training_total":
      return attendanceTotals(teamId, seasonId, "TRAINING", memberIds);
    case "match_total":
      return attendanceTotals(teamId, seasonId, "MATCH", memberIds);
    case "training_streak":
      return attendanceStreaks(teamId, seasonId, "TRAINING", memberIds);
    case "match_streak":
      return attendanceStreaks(teamId, seasonId, "MATCH", memberIds);
    case "goals":
      return sumPlayerStats(teamId, seasonId, "goals", memberIds);
    case "assists":
      return sumPlayerStats(teamId, seasonId, "assists", memberIds);
    case "yellow_cards":
      return sumPlayerStats(teamId, seasonId, "yellowCards", memberIds);
    case "red_cards":
      return sumPlayerStats(teamId, seasonId, "redCards", memberIds);
    case "fines":
      return fineSeasonDebtTotals(teamId, seasonId, memberIds);
    case "thing_duty":
      return dutyCounts(teamId, seasonId, "thingCarrierId", memberIds);
    case "beer_duty":
      return dutyCounts(teamId, seasonId, "beerCarrierId", memberIds);
    case "motm_wins":
      return motmWinsCounts(teamId, seasonId, memberIds);
  }
}

export async function getLeaderboardRows(
  teamId: string,
  category: LeaderboardCategory,
  seasonId: string
): Promise<LeaderboardRow[]> {
  const memberUsers = await loadActiveMembers(teamId);
  if (memberUsers.length === 0) return [];
  const values = await valuesForCategory(teamId, seasonId, category, memberUsers);
  return sortRows(memberUsers, values);
}

export async function getLeaderboardSummary(teamId: string, seasonId: string): Promise<{
  summary: Record<LeaderboardCategory, LeaderboardTop[]>;
}> {
  const memberUsers = await loadActiveMembers(teamId);
  if (memberUsers.length === 0) {
    const empty = {} as Record<LeaderboardCategory, LeaderboardTop[]>;
    for (const c of LEADERBOARD_CATEGORIES) empty[c] = [];
    return { summary: empty };
  }
  const tieSummary = new Set<LeaderboardCategory>(LEADERBOARD_TIE_SUMMARY_CATEGORIES);
  const categories = LEADERBOARD_CATEGORIES;
  const valueMaps = await Promise.all(
    categories.map((cat) => valuesForCategory(teamId, seasonId, cat, memberUsers))
  );
  const summary = {} as Record<LeaderboardCategory, LeaderboardTop[]>;
  for (let i = 0; i < categories.length; i++) {
    const cat = categories[i]!;
    const values = valueMaps[i]!;
    const rows = sortRows(memberUsers, values);
    const firstPositive = rows.find((r) => r.value > 0) ?? null;
    if (!firstPositive) {
      summary[cat] = [];
      continue;
    }
    if (tieSummary.has(cat)) {
      const maxVal = firstPositive.value;
      summary[cat] = rows
        .filter((r) => r.value === maxVal)
        .map((r) => ({
          userId: r.userId,
          name: r.name,
          image: r.image,
          value: r.value
        }));
    } else {
      summary[cat] = [
        {
          userId: firstPositive.userId,
          name: firstPositive.name,
          image: firstPositive.image,
          value: firstPositive.value
        }
      ];
    }
  }
  return { summary };
}
