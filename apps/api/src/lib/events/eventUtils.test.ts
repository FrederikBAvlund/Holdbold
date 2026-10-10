import { describe, expect, it } from "vitest";
import { buildRecurrenceSummary, computeLateGroups, deadlineLabel, mergeHistory, sumVotes } from "./eventUtils";

const member = (id: string, role = "SPILLER") => ({ role, user: { id } });

describe("computeLateGroups", () => {
  const deadlineAt = "2026-10-10T12:00:00.000Z";
  const after = "2026-10-10T13:00:00.000Z";
  const before = "2026-10-10T11:00:00.000Z";

  it("finder sene svar og manglende svar efter fristen og springer SoMe over", () => {
    const members = [member("a"), member("b"), member("c"), member("d", "SOME")];
    const statusByUser = new Map([
      ["a", "IN"],
      ["b", "OUT"]
    ]);
    const logs = [
      { id: "1", status: "IN", createdAt: after, user: { id: "a", name: "A" } },
      { id: "2", status: "OUT", createdAt: before, user: { id: "b", name: "B" } }
    ];
    const result = computeLateGroups({ members, statusByUser, logs, deadlineAt, now: Date.parse(after) });
    expect(result.lateResponses.map((m) => m.user.id)).toEqual(["a"]);
    expect(result.missingAfterDeadline.map((m) => m.user.id)).toEqual(["c"]);
  });

  it("bruger nyeste log pr. spiller og falder tilbage til fristen fra logs", () => {
    const logs = [
      { id: "2", status: "OUT", createdAt: before, deadlineAt, user: { id: "a", name: "A" } },
      { id: "1", status: "IN", createdAt: after, deadlineAt, user: { id: "a", name: "A" } }
    ];
    const result = computeLateGroups({
      members: [member("a")],
      statusByUser: new Map([["a", "OUT"]]),
      logs,
      deadlineAt: null,
      now: Date.parse(after)
    });
    expect(result.lateResponses).toHaveLength(0);
    expect(result.deadlineAt).toBe(deadlineAt);
  });

  it("returnerer tomt uden frist", () => {
    const result = computeLateGroups({ members: [member("a")], statusByUser: new Map(), logs: [], deadlineAt: null });
    expect(result.lateResponses).toHaveLength(0);
    expect(result.missingAfterDeadline).toHaveLength(0);
  });
});

describe("mergeHistory", () => {
  it("fletter og sorterer nyeste først og markerer sene svar", () => {
    const entries = mergeHistory(
      [
        {
          id: "s1",
          status: "IN",
          createdAt: "2026-01-02T10:00:00Z",
          deadlineAt: "2026-01-02T09:00:00Z",
          user: { id: "u", name: "Ulla" }
        }
      ],
      [
        { id: "e1", type: "CANCEL", message: "Aflyst", createdAt: "2026-01-03T10:00:00Z", actor: { name: "Admin" } },
        { id: "e2", type: "SIGNUP", message: "skjult", createdAt: "2026-01-04T10:00:00Z" }
      ]
    );
    expect(entries.map((e) => e.id)).toEqual(["event-e1", "signup-s1"]);
    expect(entries[1].late).toBe(true);
  });
});

describe("sumVotes", () => {
  it("summerer og ignorerer negative værdier", () => {
    expect(sumVotes({ a: 2, b: 1, c: -3 })).toBe(3);
  });
});

describe("buildRecurrenceSummary", () => {
  const start = new Date(2026, 9, 13, 18, 30); // tirsdag
  it("beskriver ugentlige gentagelser", () => {
    expect(buildRecurrenceSummary({ kind: "TRAINING", start, recurrence: "WEEKLY", interval: 1 })).toBe(
      "Træning hver tirsdag kl. 18.30"
    );
    expect(buildRecurrenceSummary({ kind: "TRAINING", start, recurrence: "WEEKLY", interval: 2 })).toBe(
      "Træning hver 2. tirsdag kl. 18.30"
    );
  });
  it("beder om dato uden start", () => {
    expect(buildRecurrenceSummary({ kind: "MATCH", start: null, recurrence: "ONCE", interval: 1 })).toBe(
      "Kamp – vælg dato og tid"
    );
  });
});

describe("deadlineLabel", () => {
  it("formulerer frister menneskeligt", () => {
    expect(deadlineLabel(24)).toBe("dagen før");
    expect(deadlineLabel(48)).toBe("2 dage før");
    expect(deadlineLabel(12)).toBe("12 timer før");
  });
});
