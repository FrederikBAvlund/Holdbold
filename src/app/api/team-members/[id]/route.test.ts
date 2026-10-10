import { beforeEach, describe, expect, it, vi } from "vitest";
import { getServerSession } from "next-auth";
import { PATCH } from "./route";
import { prisma } from "@/lib/prisma";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/membershipNotify", () => ({ notifyMembershipActivated: vi.fn() }));
vi.mock("@/lib/notificationRefs", () => ({ notificationRef: { membership: vi.fn() }, resolveNotifications: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { membership: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn(), count: vi.fn() } }
}));

const patch = (body: unknown) =>
  PATCH(new Request("http://localhost/api/team-members/m2", { method: "PATCH", body: JSON.stringify(body) }), {
    params: { id: "m2" }
  });

function target(roles: string[], guideRoles: string[] = roles) {
  vi.mocked(prisma.membership.findUnique).mockResolvedValue({
    id: "m2",
    teamId: "t1",
    userId: "u2",
    status: "ACTIVE",
    roles,
    guideRoles
  } as never);
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u1" } } as never);
  vi.mocked(prisma.membership.findFirst).mockResolvedValue({ roles: ["ADMIN"] } as never);
  vi.mocked(prisma.membership.update).mockResolvedValue({ id: "m2" } as never);
});

describe("PATCH /api/team-members/[id]", () => {
  it("giver et medlem flere roller og beholder guiden til de nye dele", async () => {
    target(["SPILLER"]);
    expect((await patch({ roles: ["BOEDEKASSEFORMAND", "SPILLER", "TRAENER"] })).status).toBe(200);
    expect(prisma.membership.update).toHaveBeenCalledWith({
      where: { id: "m2" },
      data: { roles: ["TRAENER", "BOEDEKASSEFORMAND", "SPILLER"], guideRoles: ["SPILLER"] }
    });
  });

  it("kræver mindst én rolle", async () => {
    target(["SPILLER"]);
    expect((await patch({ roles: [] })).status).toBe(400);
    expect(prisma.membership.update).not.toHaveBeenCalled();
  });

  it("lader kun admin ændre roller", async () => {
    target(["SPILLER"]);
    vi.mocked(prisma.membership.findFirst).mockResolvedValue({ roles: ["TRAENER", "BOEDEKASSEFORMAND"] } as never);
    expect((await patch({ roles: ["TRAENER"] })).status).toBe(403);
  });

  it("lader ikke holdet stå uden admin", async () => {
    target(["ADMIN"]);
    vi.mocked(prisma.membership.count).mockResolvedValue(0);
    expect((await patch({ roles: ["SPILLER"] })).status).toBe(409);
    expect(prisma.membership.update).not.toHaveBeenCalled();
  });

  it("må fjerne admin, når der er en anden admin", async () => {
    target(["ADMIN"]);
    vi.mocked(prisma.membership.count).mockResolvedValue(1);
    expect((await patch({ roles: ["SPILLER"] })).status).toBe(200);
  });
});
