import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/apiAuth";
import { sendMail } from "@/lib/mail";

vi.mock("@/lib/apiAuth", () => ({ requireSuperAdmin: vi.fn() }));
vi.mock("@/lib/mail", () => ({ sendMail: vi.fn() }));
vi.mock("@/lib/notifications", () => ({ createNotifications: vi.fn(async () => undefined) }));
vi.mock("@/lib/notificationRefs", () => ({
  notificationRef: { teamRequest: (id: string) => `team-request:${id}` },
  resolveNotifications: vi.fn(async () => undefined)
}));
vi.mock("@/lib/prisma", () => ({ prisma: { teamRequest: { findUnique: vi.fn(), updateMany: vi.fn() } } }));

const context = { params: { id: "r1" } };
const body = (reason?: string) => new Request("http://localhost", { method: "POST", body: JSON.stringify({ reason }) });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireSuperAdmin).mockResolvedValue({ ok: true, userId: "admin" });
  vi.mocked(prisma.teamRequest.findUnique).mockResolvedValue({
    id: "r1", userId: "u1", name: "BK Skjold", user: { name: "Mads", email: "mads@example.dk" }
  } as never);
  vi.mocked(prisma.teamRequest.updateMany).mockResolvedValue({ count: 1 });
});

describe("reject team request", () => {
  it("is limited to system admins", async () => {
    vi.mocked(requireSuperAdmin).mockResolvedValue({ ok: false, response: NextResponse.json({}, { status: 403 }) });
    expect((await POST(body(), context)).status).toBe(403);
    expect(prisma.teamRequest.updateMany).not.toHaveBeenCalled();
  });

  it("marks the request rejected (releasing the slug) and emails the requester with the reason", async () => {
    expect((await POST(body("Duplikat"), context)).status).toBe(200);
    expect(prisma.teamRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "r1", status: "PENDING" },
        data: expect.objectContaining({ status: "REJECTED", rejectionReason: "Duplikat" })
      })
    );
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: "mads@example.dk", text: expect.stringContaining("Duplikat") }));
  });

  it("refuses requests that are already decided", async () => {
    vi.mocked(prisma.teamRequest.updateMany).mockResolvedValue({ count: 0 });
    expect((await POST(body(), context)).status).toBe(409);
    expect(sendMail).not.toHaveBeenCalled();
  });
});
