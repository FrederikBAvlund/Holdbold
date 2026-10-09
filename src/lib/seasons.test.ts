import { describe, expect, it } from "vitest";
import {
  CARRY_OVER_FINE_STATUSES,
  SEASON_CLOSED_MESSAGE,
  isSeasonClosed,
  seasonClosedResponse
} from "@/lib/seasons";

describe("seasons", () => {
  it("regner kun sæsoner med closedAt som lukkede", () => {
    expect(isSeasonClosed({ closedAt: null })).toBe(false);
    expect(isSeasonClosed({ closedAt: new Date() })).toBe(true);
  });

  it("returnerer 403 for lukket sæson og null for åben/ukendt", async () => {
    const res = seasonClosedResponse({ closedAt: new Date() });
    expect(res?.status).toBe(403);
    expect(await res?.json()).toEqual({ error: SEASON_CLOSED_MESSAGE });
    expect(seasonClosedResponse({ closedAt: null })).toBeNull();
    expect(seasonClosedResponse(null)).toBeNull();
  });

  it("overfører kun ubetalte bøder til ny sæson", () => {
    expect([...CARRY_OVER_FINE_STATUSES]).toEqual(["UNPAID", "PAID_PENDING"]);
  });
});
