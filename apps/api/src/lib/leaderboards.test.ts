import { describe, expect, it } from "vitest";
import {
  LEADERBOARD_CATEGORIES,
  LEADERBOARD_CATEGORY_LABELS_DA,
  longestAttendanceStreak
} from "./leaderboardsShared";

describe("leaderboard categories", () => {
  it("has a Danish label for every category", () => {
    for (const category of LEADERBOARD_CATEGORIES) {
      expect(LEADERBOARD_CATEGORY_LABELS_DA[category]).toBeTruthy();
    }
  });
});

describe("longestAttendanceStreak", () => {
  it("returns 0 when no events", () => {
    const map = new Map<string, Set<string>>();
    expect(longestAttendanceStreak([], map, "u1")).toBe(0);
  });

  it("counts longest consecutive IN", () => {
    const map = new Map<string, Set<string>>([
      ["e1", new Set(["u1"])],
      ["e2", new Set(["u1"])],
      ["e3", new Set()],
      ["e4", new Set(["u1"])],
      ["e5", new Set(["u1"])]
    ]);
    expect(longestAttendanceStreak(["e1", "e2", "e3", "e4", "e5"], map, "u1")).toBe(2);
  });
});
