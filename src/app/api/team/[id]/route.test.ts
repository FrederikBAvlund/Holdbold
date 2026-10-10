import { beforeEach, describe, expect, it, vi } from "vitest";
import { getServerSession } from "next-auth";
import { PATCH } from "./route";
import { prisma } from "@/lib/prisma";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/reservedSlugs", () => ({ checkSlugAvailable: vi.fn(), SLUG_ERROR_MESSAGES: {} }));
vi.mock("@/lib/prisma", () => ({
  prisma: { membership: { findFirst: vi.fn() }, team: { update: vi.fn() } }
}));

const patch = (body: unknown) =>
  PATCH(new Request("http://localhost/api/team/t1", { method: "PATCH", body: JSON.stringify(body) }), {
    params: { id: "t1" }
  });

const asRole = (role: string) => vi.mocked(prisma.membership.findFirst).mockResolvedValue({ roles: [role] } as never);

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u1" } } as never);
  vi.mocked(prisma.team.update).mockResolvedValue({ id: "t1" } as never);
});

describe("PATCH /api/team/[id]", () => {
  it("lader bødekasseformanden gemme MobilePay Box", async () => {
    asRole("BOEDEKASSEFORMAND");
    expect((await patch({ mobilePayBox: "1234AB" })).status).toBe(200);
    expect(prisma.team.update).toHaveBeenCalledWith({ where: { id: "t1" }, data: { mobilePayBox: "1234AB" } });
  });

  it("lader ikke bødekasseformanden ændre andre holdindstillinger", async () => {
    asRole("BOEDEKASSEFORMAND");
    expect((await patch({ mobilePayBox: "1234AB", themePreset: "forest" })).status).toBe(403);
    expect((await patch({ themePreset: "forest" })).status).toBe(403);
    expect(prisma.team.update).not.toHaveBeenCalled();
  });

  it("lader ikke spillere og trænere gemme MobilePay Box", async () => {
    for (const role of ["SPILLER", "TRAENER", "SOME"]) {
      asRole(role);
      expect((await patch({ mobilePayBox: "1234AB" })).status, role).toBe(403);
    }
    expect(prisma.team.update).not.toHaveBeenCalled();
  });

  it("lader admin ændre holdindstillinger", async () => {
    asRole("ADMIN");
    expect((await patch({ themePreset: "forest", mobilePayBox: null })).status).toBe(200);
  });
});
