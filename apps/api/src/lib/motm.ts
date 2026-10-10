export type MotmSelectionInput = {
  userId: string;
  weight: number;
};

export type MotmScoreSeed = {
  userId: string;
  name: string;
  image: string | null;
  votes: number;
};

export type MotmScoreRow = MotmScoreSeed & {
  rank: number;
};

export function normalizeMotmSelections(
  selections: MotmSelectionInput[],
  votesPerVoter: number
): MotmSelectionInput[] {
  if (!Number.isInteger(votesPerVoter) || votesPerVoter < 1) {
    throw new Error("Ugyldigt antal stemmer per vælger");
  }
  if (!Array.isArray(selections) || selections.length === 0) {
    throw new Error("Vælg mindst én spiller");
  }

  const byUser = new Map<string, number>();
  for (const selection of selections) {
    const userId = selection.userId?.trim();
    if (!userId) {
      throw new Error("Ugyldig spiller i afstemningen");
    }
    if (!Number.isInteger(selection.weight) || selection.weight < 1) {
      throw new Error("Stemmer skal være positive heltal");
    }
    byUser.set(userId, (byUser.get(userId) ?? 0) + selection.weight);
  }

  const normalized = [...byUser.entries()].map(([userId, weight]) => ({ userId, weight }));
  const totalVotes = normalized.reduce((sum, item) => sum + item.weight, 0);
  if (totalVotes !== votesPerVoter) {
    throw new Error(`Du skal fordele præcis ${votesPerVoter} stemmer`);
  }

  return normalized.sort((a, b) => {
    if (b.weight !== a.weight) return b.weight - a.weight;
    return a.userId.localeCompare(b.userId);
  });
}

export function buildMotmScoreRows(seeds: MotmScoreSeed[]): MotmScoreRow[] {
  return [...seeds]
    .filter((seed) => seed.votes > 0)
    .sort((a, b) => {
      if (b.votes !== a.votes) return b.votes - a.votes;
      return a.name.localeCompare(b.name, "da");
    })
    .map((seed, index) => ({ ...seed, rank: index + 1 }));
}

export function buildRevealRows(rows: MotmScoreRow[], revealCount: number): MotmScoreRow[] {
  const safeRevealCount = Math.max(1, Math.trunc(revealCount || 0));
  return rows.slice(0, safeRevealCount);
}

export function winnerFromRows(rows: MotmScoreRow[]): MotmScoreRow | null {
  return rows[0] ?? null;
}
