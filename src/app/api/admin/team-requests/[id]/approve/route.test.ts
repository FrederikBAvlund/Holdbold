import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/apiAuth";
import { sendMail } from "@/lib/mail";
import { createTeamWithAdmin } from "@/lib/teams";

vi.mock("@/lib/apiAuth", () => ({ requireSuperAdmin: vi.fn() }));
vi.mock("@/lib/mail", () => ({ sendMail: vi.fn() }));
vi.mock("@/lib/notifications", () => ({ createNotifications: vi.fn(async () => undefined) }));
vi.mock("@/lib/notificationRefs", () => ({
  notificationRef: { teamRequest: (id: string) => `team-request:${id}` },
  resolveNotifications: vi.fn(async () => undefined)
}));
vi.mock("@/lib/teams", () => ({ createTeamWithAdmin: vi.fn() }));
vi.mock("@/lib/prisma", () => {
  const tx = { teamRequest: { updateMany: vi.fn(), update: vi.fn() } };
  return {
    prisma: {
      teamRequest: { findUnique: vi.fn() },
      $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
      __tx: tx
    }
  };
});

const context = { params: { id: "r1" } };
const pending = {
  id: "r1", userId: "u1", name: "BK Skjold", slug: "bk-skjold", themePreset: "forest", status: "PENDING",
  user: { id: "u1", name: "Mads", email: "mads@example.dk" }
};
const tx = (prisma as unknown as { __tx: { teamRequest: { updateMany: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> } } }).__tx;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireSuperAdmin).mockResolvedValue({ ok: true, userId: "admin" });
  vi.mocked(prisma.teamRequest.findUnique).mockResolvedValue(pending as never);
  tx.teamRequest.updateMany.mockResolvedValue({ count: 1 });
  vi.mocked(createTeamWithAdmin).mockResolvedValue({ id: "t1", name: "BK Skjold", slug: "bk-skjold" } as never);
});

describe("approve team request", () => {
  it("is limited to system admins", async () => {
    vi.mocked(requireSuperAdmin).mockResolvedValue({ ok: false, response: NextResponse.json({}, { status: 403 }) });
    expect((await POST(new Request("http://localhost"), context)).status).toBe(403);
    expect(createTeamWithAdmin).not.toHaveBeenCalled();
  });

  it("creates the team with the requester as admin, copies the theme and emails them", async () => {
    const response = await POST(new Request("http://localhost"), context);
    expect(response.status).toBe(200);
    expect(createTeamWithAdmin).toHaveBeenCalledWith(
      expect.anything(),
      { name: "BK Skjold", slug: "bk-skjold", themePreset: "forest", adminUserId: "u1" }
    );
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: "mads@example.dk" }));
  });

  it("refuses requests that are already decided", async () => {
    vi.mocked(prisma.teamRequest.findUnique).mockResolvedValue({ ...pending, status: "REJECTED" } as never);
    expect((await POST(new Request("http://localhost"), context)).status).toBe(409);
    expect(createTeamWithAdmin).not.toHaveBeenCalled();
  });

  it("does not create a second team when a concurrent approval won", async () => {
    tx.teamRequest.updateMany.mockResolvedValue({ count: 0 });
    expect((await POST(new Request("http://localhost"), context)).status).toBe(409);
    expect(createTeamWithAdmin).not.toHaveBeenCalled();
  });
});
