import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { checkSlugAvailable } from "./reservedSlugs";

vi.mock("@/lib/prisma", () => ({
  prisma: { team: { findUnique: vi.fn() }, teamRequest: { findFirst: vi.fn() } }
}));

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(prisma.team.findUnique).mockResolvedValue(null);
  vi.mocked(prisma.teamRequest.findFirst).mockResolvedValue(null);
});

describe("checkSlugAvailable", () => {
  it("normalizes the slug and accepts a free one", async () => {
    expect(await checkSlugAvailable("BK Skjold Ærø")).toEqual({ ok: true, slug: "bk-skjold-aeroe" });
  });

  it("rejects too short slugs", async () => {
    expect(await checkSlugAvailable("a")).toMatchObject({ ok: false, reason: "too_short" });
  });

  it("rejects reserved slugs", async () => {
    expect(await checkSlugAvailable("Admin")).toMatchObject({ ok: false, reason: "reserved" });
    expect(await checkSlugAvailable("opret-hold")).toMatchObject({ ok: false, reason: "reserved" });
  });

  it("rejects a slug used by an existing team", async () => {
    vi.mocked(prisma.team.findUnique).mockResolvedValue({ id: "t1" } as never);
    expect(await checkSlugAvailable("bk-skjold")).toMatchObject({ ok: false, reason: "taken" });
  });

  it("allows the team's own slug when ignoring that team", async () => {
    vi.mocked(prisma.team.findUnique).mockResolvedValue({ id: "t1" } as never);
    expect(await checkSlugAvailable("bk-skjold", { ignoreTeamId: "t1" })).toMatchObject({ ok: true });
  });

  it("reserves slugs while a request is pending", async () => {
    vi.mocked(prisma.teamRequest.findFirst).mockResolvedValue({ id: "r1" } as never);
    expect(await checkSlugAvailable("nyt-hold")).toMatchObject({ ok: false, reason: "taken" });
    expect(prisma.teamRequest.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { slug: "nyt-hold", status: "PENDING" } })
    );
  });
});
