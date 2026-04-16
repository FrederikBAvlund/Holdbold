import { describe, expect, it } from "vitest";
import { buildMotmScoreRows, buildRevealRows, normalizeMotmSelections, winnerFromRows } from "./motm";
import { buildMotmPollApiView } from "./motmPolls";

describe("normalizeMotmSelections", () => {
  it("accepts stacked votes on one player", () => {
    expect(normalizeMotmSelections([{ userId: "a", weight: 2 }, { userId: "b", weight: 1 }], 3)).toEqual([
      { userId: "a", weight: 2 },
      { userId: "b", weight: 1 }
    ]);
  });

  it("rejects wrong total", () => {
    expect(() => normalizeMotmSelections([{ userId: "a", weight: 1 }], 3)).toThrow();
  });
});

describe("buildMotmScoreRows", () => {
  it("sorts by votes then Danish name", () => {
    const rows = buildMotmScoreRows([
      { userId: "b", name: "Berta", image: null, votes: 2 },
      { userId: "a", name: "Anna", image: null, votes: 2 }
    ]);
    expect(rows.map((r) => r.userId)).toEqual(["a", "b"]);
    expect(rows[0]?.rank).toBe(1);
  });
});

describe("buildRevealRows", () => {
  it("caps at revealCount", () => {
    const rows = buildMotmScoreRows([
      { userId: "a", name: "A", image: null, votes: 3 },
      { userId: "b", name: "B", image: null, votes: 2 },
      { userId: "c", name: "C", image: null, votes: 1 }
    ]);
    expect(buildRevealRows(rows, 2)).toHaveLength(2);
    expect(winnerFromRows(rows)?.userId).toBe("a");
  });
});

describe("buildMotmPollApiView", () => {
  const baseDate = new Date("2026-01-01T12:00:00.000Z");

  it("hides scoreboard while poll is open", () => {
    const view = buildMotmPollApiView(
      {
        id: "poll1",
        createdById: "admin",
        status: "OPEN",
        votesPerVoter: 2,
        revealCount: 2,
        closedAt: null,
        ballots: [
          {
            voterId: "v1",
            createdAt: baseDate,
            voter: { id: "v1", name: "V1" },
            votes: [
              {
                weight: 2,
                targetUser: { id: "p1", name: "Spiller 1", image: null }
              }
            ]
          }
        ]
      },
      "v1",
      true
    );
    expect(view.scoreboard).toEqual([]);
    expect(view.revealRows).toEqual([]);
    expect(view.winner).toBeNull();
  });

  it("shows scoreboard after close", () => {
    const view = buildMotmPollApiView(
      {
        id: "poll1",
        createdById: "admin",
        status: "CLOSED",
        votesPerVoter: 1,
        revealCount: 2,
        closedAt: baseDate,
        ballots: [
          {
            voterId: "v1",
            createdAt: baseDate,
            voter: { id: "v1", name: "V1" },
            votes: [{ weight: 1, targetUser: { id: "p1", name: "Spiller 1", image: null } }]
          }
        ]
      },
      "v1",
      false
    );
    expect(view.scoreboard.length).toBe(1);
    expect(view.winner?.userId).toBe("p1");
  });
});
