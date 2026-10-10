import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mail";
import { createNotifications } from "@/lib/notifications";
import { notifyMembershipActivated } from "./membershipNotify";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    team: { findUnique: vi.fn() },
    pushSubscription: { count: vi.fn() }
  }
}));
vi.mock("@/lib/mail", () => ({ sendMail: vi.fn() }));
vi.mock("@/lib/notifications", () => ({ createNotifications: vi.fn() }));

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(prisma.user.findUnique).mockResolvedValue({ name: "Mads", email: "mads@example.dk" } as never);
  vi.mocked(prisma.team.findUnique).mockResolvedValue({ name: "BK Skjold" } as never);
});

describe("notifyMembershipActivated", () => {
  it("emails users who have not set up push notifications", async () => {
    vi.mocked(prisma.pushSubscription.count).mockResolvedValue(0);
    await notifyMembershipActivated({ userId: "u1", teamId: "t1" });
    expect(createNotifications).toHaveBeenCalledTimes(1);
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: "mads@example.dk", subject: expect.stringContaining("BK Skjold") }));
  });

  it("does not email users who already have push set up", async () => {
    vi.mocked(prisma.pushSubscription.count).mockResolvedValue(2);
    await notifyMembershipActivated({ userId: "u1", teamId: "t1" });
    expect(createNotifications).toHaveBeenCalledTimes(1);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("does not fail when the mail cannot be sent", async () => {
    vi.mocked(prisma.pushSubscription.count).mockResolvedValue(0);
    vi.mocked(sendMail).mockRejectedValue(new Error("boom"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(notifyMembershipActivated({ userId: "u1", teamId: "t1" })).resolves.toBeUndefined();
  });
});
