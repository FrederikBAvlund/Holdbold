import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rateLimit";
import { checkSlugAvailable } from "@/lib/reservedSlugs";
import { notifySuperAdminsOfTeamRequest } from "@/lib/teamRequests";

vi.mock("@/lib/apiAuth", () => ({ requireSession: vi.fn(async () => ({ ok: true, userId: "u1" })) }));
vi.mock("@/lib/prisma", () => ({ prisma: { teamRequest: { count: vi.fn(), create: vi.fn(), findMany: vi.fn() } } }));
vi.mock("@/lib/rateLimit", () => ({ checkRateLimit: vi.fn() }));
vi.mock("@/lib/reservedSlugs", () => ({
  checkSlugAvailable: vi.fn(),
  SLUG_ERROR_MESSAGES: { too_short: "kort", reserved: "reserveret", taken: "optaget" }
}));
vi.mock("@/lib/teamRequests", () => ({
  MAX_PENDING_TEAM_REQUESTS_PER_USER: 3,
  notifySuperAdminsOfTeamRequest: vi.fn()
}));

const request = (body: unknown) => new Request("http://localhost", { method: "POST", body: JSON.stringify(body) });
const valid = { name: "BK Skjold", slug: "bk-skjold", themePreset: "forest" };

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true } as never);
  vi.mocked(prisma.teamRequest.count).mockResolvedValue(0);
  vi.mocked(checkSlugAvailable).mockResolvedValue({ ok: true, slug: "bk-skjold" });
  vi.mocked(prisma.teamRequest.create).mockResolvedValue({
    id: "r1", name: "BK Skjold", slug: "bk-skjold", status: "PENDING", user: { name: "Mads", email: "m@x.dk" }
  } as never);
});

describe("POST /api/team-requests", () => {
  it("creates a pending request with the normalized slug and notifies the system admin", async () => {
    const response = await POST(request(valid));
    expect(response.status).toBe(201);
    expect(prisma.teamRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { userId: "u1", name: "BK Skjold", slug: "bk-skjold", themePreset: "forest" } })
    );
    expect(notifySuperAdminsOfTeamRequest).toHaveBeenCalledTimes(1);
  });

  it("rejects an unknown theme", async () => {
    expect((await POST(request({ ...valid, themePreset: "sunset" }))).status).toBe(400);
    expect(prisma.teamRequest.create).not.toHaveBeenCalled();
  });

  it("rejects a taken or reserved slug", async () => {
    vi.mocked(checkSlugAvailable).mockResolvedValue({ ok: false, reason: "taken", slug: "bk-skjold" });
    expect((await POST(request(valid))).status).toBe(409);
    expect(prisma.teamRequest.create).not.toHaveBeenCalled();
  });

  it("limits the number of pending requests per user", async () => {
    vi.mocked(prisma.teamRequest.count).mockResolvedValue(3);
    expect((await POST(request(valid))).status).toBe(409);
  });

  it("applies rate limiting", async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: false } as never);
    expect((await POST(request(valid))).status).toBe(429);
  });

  it("turns a concurrent slug collision into 409", async () => {
    vi.mocked(prisma.teamRequest.create).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "6" })
    );
    expect((await POST(request(valid))).status).toBe(409);
  });

  it("still succeeds when the admin notification fails", async () => {
    vi.mocked(notifySuperAdminsOfTeamRequest).mockRejectedValue(new Error("mail down"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect((await POST(request(valid))).status).toBe(201);
  });
});
