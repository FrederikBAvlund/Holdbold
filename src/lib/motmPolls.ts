import type { EventMotmPollStatus } from "@prisma/client";
import { buildMotmScoreRows, buildRevealRows, winnerFromRows, type MotmScoreRow } from "@/lib/motm";

type PollVoteRecord = {
  weight: number;
  targetUser: {
    id: string;
    name: string;
    image: string | null;
  };
};

type PollBallotRecord = {
  voterId: string;
  createdAt: Date;
  voter: {
    id: string;
    name: string;
  };
  votes: PollVoteRecord[];
};

type PollRecord = {
  id: string;
  createdById: string;
  status: EventMotmPollStatus;
  votesPerVoter: number;
  revealCount: number;
  closedAt: Date | null;
  ballots: PollBallotRecord[];
};

export type MotmPollApiView = {
  id: string;
  status: EventMotmPollStatus;
  createdById: string;
  votesPerVoter: number;
  revealCount: number;
  closedAt: string | null;
  totalBallots: number;
  canManage: boolean;
  isCreator: boolean;
  myVotes: Array<{ userId: string; weight: number }>;
  voters: Array<{ userId: string; name: string; createdAt: string }> | null;
  scoreboard: Array<{ rank: number; userId: string; name: string; image: string | null; votes: number }>;
  revealRows: Array<{ rank: number; userId: string; name: string; image: string | null; votes: number }>;
  winner: { userId: string; name: string; image: string | null; votes: number } | null;
};

export function eventMotmAvailabilityError(event: {
  kind: string;
  canceledAt: Date | null;
}): string | null {
  if (event.kind !== "MATCH") return "Kun kampe kan have MOTM-afstemninger";
  if (event.canceledAt) return "Aflyste kampe kan ikke have MOTM-afstemninger";
  return null;
}

export function buildScoreRowsFromPollBallots(ballots: PollBallotRecord[]): MotmScoreRow[] {
  const totals = new Map<string, { userId: string; name: string; image: string | null; votes: number }>();
  for (const ballot of ballots) {
    for (const vote of ballot.votes) {
      const existing = totals.get(vote.targetUser.id);
      if (existing) {
        existing.votes += vote.weight;
      } else {
        totals.set(vote.targetUser.id, {
          userId: vote.targetUser.id,
          name: vote.targetUser.name,
          image: vote.targetUser.image,
          votes: vote.weight
        });
      }
    }
  }
  return buildMotmScoreRows([...totals.values()]);
}

export function buildMotmPollApiView(
  poll: PollRecord,
  viewerUserId: string,
  canManage: boolean
): MotmPollApiView {
  const tallies = buildScoreRowsFromPollBallots(poll.ballots);
  const myBallot = poll.ballots.find((ballot) => ballot.voterId === viewerUserId);
  const myVotes = (myBallot?.votes ?? [])
    .map((vote) => ({ userId: vote.targetUser.id, weight: vote.weight }))
    .sort((a, b) => {
      if (b.weight !== a.weight) return b.weight - a.weight;
      return a.userId.localeCompare(b.userId);
    });
  const isCreator = poll.createdById === viewerUserId;
  const scoreboard = poll.status === "CLOSED" && isCreator ? tallies : [];
  const revealRows = poll.status === "CLOSED" && isCreator ? buildRevealRows(tallies, poll.revealCount) : [];
  const winner = poll.status === "CLOSED" && isCreator ? winnerFromRows(tallies) : null;

  return {
    id: poll.id,
    status: poll.status,
    createdById: poll.createdById,
    votesPerVoter: poll.votesPerVoter,
    revealCount: poll.revealCount,
    closedAt: poll.closedAt?.toISOString() ?? null,
    totalBallots: poll.ballots.length,
    canManage,
    isCreator,
    myVotes,
    voters: isCreator
      ? [...poll.ballots]
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
          .map((ballot) => ({
            userId: ballot.voter.id,
            name: ballot.voter.name,
            createdAt: ballot.createdAt.toISOString()
          }))
      : null,
    scoreboard: scoreboard.map((row) => ({
      rank: row.rank,
      userId: row.userId,
      name: row.name,
      image: row.image,
      votes: row.votes
    })),
    revealRows: revealRows.map((row) => ({
      rank: row.rank,
      userId: row.userId,
      name: row.name,
      image: row.image,
      votes: row.votes
    })),
    winner: winner
      ? {
          userId: winner.userId,
          name: winner.name,
          image: winner.image,
          votes: winner.votes
        }
      : null
  };
}
