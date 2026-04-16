import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    fineAutomationSetting: { findUnique: vi.fn() },
    fineTemplate: { findFirst: vi.fn(), create: vi.fn() }
  }
}));

import { prisma } from "@/lib/prisma";
import {
  isSameCalendarDayAsEvent,
  resolveAutomationTemplate,
  roleExcludedFromFineAutomation
} from "./fineAutomation";

describe("roleExcludedFromFineAutomation", () => {
  it("returns true when role is listed", () => {
    expect(roleExcludedFromFineAutomation("SOME", ["SOME"])).toBe(true);
    expect(roleExcludedFromFineAutomation("SPILLER", ["SOME"])).toBe(false);
  });
});

describe("isSameCalendarDayAsEvent", () => {
  it("matches calendar day in Europe/Copenhagen", () => {
    const eventDate = new Date("2026-04-16T20:00:00.000Z");
    const now = new Date("2026-04-16T08:00:00.000Z");
    expect(isSameCalendarDayAsEvent(eventDate, now)).toBe(true);
  });

  it("returns false on different local dates", () => {
    const eventDate = new Date("2026-04-16T12:00:00.000Z");
    const now = new Date("2026-04-17T12:00:00.000Z");
    expect(isSameCalendarDayAsEvent(eventDate, now, "Europe/Copenhagen")).toBe(false);
  });
});

describe("resolveAutomationTemplate", () => {
  beforeEach(() => {
    vi.mocked(prisma.fineAutomationSetting.findUnique).mockReset();
    vi.mocked(prisma.fineTemplate.findFirst).mockReset();
    vi.mocked(prisma.fineTemplate.create).mockReset();
  });

  it("uses templateMatchId for MATCH when configured", async () => {
    vi.mocked(prisma.fineAutomationSetting.findUnique).mockResolvedValue({
      id: "cfg",
      teamId: "team1",
      action: "SAME_DAY_WITHDRAWAL",
      appliesTraining: false,
      appliesMatch: true,
      templateTrainingId: null,
      templateMatchId: "tpl-match",
      excludedRoles: ["SOME"],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    } as Awaited<ReturnType<typeof prisma.fineAutomationSetting.findUnique>>);

    vi.mocked(prisma.fineTemplate.findFirst).mockResolvedValue({
      id: "tpl-match",
      title: "Kamp afbud",
      amount: 200,
      description: null
    } as Awaited<ReturnType<typeof prisma.fineTemplate.findFirst>>);

    const resolved = await resolveAutomationTemplate("team1", "SAME_DAY_WITHDRAWAL", "MATCH");
    expect(resolved?.template.title).toBe("Kamp afbud");
    expect(vi.mocked(prisma.fineAutomationSetting.findUnique)).toHaveBeenCalledTimes(1);
  });

  it("returns null for SAME_DAY when no row exists", async () => {
    vi.mocked(prisma.fineAutomationSetting.findUnique).mockResolvedValue(null);
    const resolved = await resolveAutomationTemplate("team1", "SAME_DAY_WITHDRAWAL", "MATCH");
    expect(resolved).toBeNull();
  });
});
