import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { requireActiveTeamMemberWithRoles } from "@/lib/apiAuth";

vi.mock("@/lib/apiAuth", () => ({
  FINE_AUTOMATION_ROLES: ["ADMIN", "BOEDEKASSEFORMAND"],
  requireSession: vi.fn(async () => ({ ok: true, userId: "user" })),
  requireActiveTeamMemberWithRoles: vi.fn()
}));
vi.mock("@/lib/prisma", () => ({ prisma: { teamOpenAiCredential: { findUnique: vi.fn() } } }));

const request = (query = "?teamId=team") => new Request(`http://localhost/api/fines/voice/status${query}`);

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(requireActiveTeamMemberWithRoles).mockResolvedValue({ ok: true, role: "ADMIN" } as never);
});

describe("voice status", () => {
  it("reports enabled when the team has a key, without exposing it", async () => {
    vi.mocked(prisma.teamOpenAiCredential.findUnique).mockResolvedValue({ teamId: "team" } as never);
    const response = await GET(request());
    expect(await response.json()).toEqual({ enabled: true });
  });

  it("reports disabled without a key", async () => {
    vi.mocked(prisma.teamOpenAiCredential.findUnique).mockResolvedValue(null);
    expect(await (await GET(request())).json()).toEqual({ enabled: false });
  });

  it("rejects missing teamId and unauthorized members before touching the database", async () => {
    expect((await GET(request(""))).status).toBe(400);
    vi.mocked(requireActiveTeamMemberWithRoles).mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 })
    } as never);
    expect((await GET(request())).status).toBe(403);
    expect(prisma.teamOpenAiCredential.findUnique).not.toHaveBeenCalled();
  });
});
