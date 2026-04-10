export const LEADERBOARD_CATEGORIES = [
  "training_total",
  "match_total",
  "training_streak",
  "match_streak",
  "goals",
  "assists",
  "fines",
  "thing_duty",
  "beer_duty"
] as const;

export type LeaderboardCategory = (typeof LEADERBOARD_CATEGORIES)[number];

export const LEADERBOARD_CATEGORY_LABELS_DA: Record<LeaderboardCategory, string> = {
  training_total: "Flest træninger (total)",
  match_total: "Flest kampe (total)",
  training_streak: "Flest træninger i træk",
  match_streak: "Flest kampe i træk",
  goals: "Flest mål",
  assists: "Flest assists",
  fines: "Flest bøder",
  thing_duty: "Flest ting med hjem",
  beer_duty: "Flest øl"
};

export function isLeaderboardCategory(value: string): value is LeaderboardCategory {
  return (LEADERBOARD_CATEGORIES as readonly string[]).includes(value);
}

export type LeaderboardRow = {
  rank: number;
  userId: string;
  name: string;
  image: string | null;
  value: number;
};

export type LeaderboardTop = {
  userId: string;
  name: string;
  image: string | null;
  value: number;
};

/** Longest consecutive stretch of events where user had signup IN (missing/OUT/UNKNOWN breaks). */
export function longestAttendanceStreak(
  eventIdsOrdered: string[],
  inByEventId: Map<string, Set<string>>,
  userId: string
): number {
  let current = 0;
  let best = 0;
  for (const eid of eventIdsOrdered) {
    if (inByEventId.get(eid)?.has(userId)) {
      current += 1;
      if (current > best) best = current;
    } else {
      current = 0;
    }
  }
  return best;
}
