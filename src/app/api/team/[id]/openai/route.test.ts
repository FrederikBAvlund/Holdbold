import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { GET, PUT, DELETE } from "./route";
import { prisma } from "@/lib/prisma";
import { requireActiveTeamMemberWithRoles, requireSession } from "@/lib/apiAuth";
import { decryptTeamApiKey } from "@/lib/teamOpenAiKey";

vi.mock("@/lib/apiAuth", () => ({ requireSession: vi.fn(), requireActiveTeamMemberWithRoles: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { teamOpenAiCredential: {
  findUnique: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn()
} } }));
const context = { params: { id: "team-a" } };
const request = (body: unknown = { apiKey: "sk-private-secret" }) => new Request("http://localhost", {
  method: "PUT", body: JSON.stringify(body)
});

describe("team OpenAI settings", () => {
  beforeEach(() => {
    vi.stubEnv("TEAM_API_KEY_ENCRYPTION_KEY", "ab".repeat(32));
    vi.mocked(requireSession).mockResolvedValue({ ok: true, userId: "admin" });
    vi.mocked(requireActiveTeamMemberWithRoles).mockResolvedValue({ ok: true, roles: ["ADMIN"] });
  });
  afterEach(() => { vi.resetAllMocks(); vi.unstubAllEnvs(); });

  it("stores only ciphertext and returns status only", async () => {
    const response = await PUT(request(), context);
    expect(await response.json()).toEqual({ configured: true });
    const args = vi.mocked(prisma.teamOpenAiCredential.upsert).mock.calls[0][0];
    expect(args.where).toEqual({ teamId: "team-a" });
    expect(args.create.encryptedApiKey).not.toContain("sk-private-secret");
    expect(decryptTeamApiKey("team-a", args.create.encryptedApiKey)).toBe("sk-private-secret");
    expect(requireActiveTeamMemberWithRoles).toHaveBeenCalledWith("admin", "team-a", ["ADMIN"]);
  });

  it.each([true, false])("returns only configured=%s without fetching ciphertext", async (configured) => {
    vi.mocked(prisma.teamOpenAiCredential.findUnique).mockResolvedValue(configured ? { teamId: "team-a" } as never : null);
    const response = await GET(request(), context);
    expect(await response.json()).toEqual({ configured });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(prisma.teamOpenAiCredential.findUnique).toHaveBeenCalledWith({ where: { teamId: "team-a" }, select: { teamId: true } });
  });

  it.each([GET, PUT, DELETE])("rejects unauthenticated users before touching storage", async (handler) => {
    vi.mocked(requireSession).mockResolvedValue({ ok: false, response: NextResponse.json({}, { status: 401 }) });
    expect((await handler(request(), context)).status).toBe(401);
    expect(requireActiveTeamMemberWithRoles).not.toHaveBeenCalled();
    expect(prisma.teamOpenAiCredential.upsert).not.toHaveBeenCalled();
    expect(prisma.teamOpenAiCredential.findUnique).not.toHaveBeenCalled();
    expect(prisma.teamOpenAiCredential.deleteMany).not.toHaveBeenCalled();
  });

  it.each([GET, PUT, DELETE])("rejects non-admins and users from another team", async (handler) => {
    vi.mocked(requireActiveTeamMemberWithRoles).mockResolvedValue({ ok: false, response: NextResponse.json({}, { status: 403 }) });
    expect((await handler(request(), context)).status).toBe(403);
    expect(prisma.teamOpenAiCredential.upsert).not.toHaveBeenCalled();
    expect(prisma.teamOpenAiCredential.findUnique).not.toHaveBeenCalled();
    expect(prisma.teamOpenAiCredential.deleteMany).not.toHaveBeenCalled();
  });

  it.each(["", "invalid", "sk-has spaces", "sk-" + "a".repeat(512)])("rejects invalid input without storing it", async (apiKey) => {
    expect((await PUT(request({ apiKey }), context)).status).toBe(400);
    expect(prisma.teamOpenAiCredential.upsert).not.toHaveBeenCalled();
  });

  it("fails without encryption configuration without saving plaintext", async () => {
    vi.stubEnv("TEAM_API_KEY_ENCRYPTION_KEY", "");
    expect((await PUT(request(), context)).status).toBe(503);
    expect(prisma.teamOpenAiCredential.upsert).not.toHaveBeenCalled();
  });

  it("never returns internal errors containing secrets", async () => {
    vi.mocked(prisma.teamOpenAiCredential.upsert).mockRejectedValue(new Error("sk-private-secret"));
    const response = await PUT(request(), context);
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("sk-private-secret");
  });

  it("removes only the requested team's credential", async () => {
    const response = await DELETE(request(), context);
    expect(await response.json()).toEqual({ configured: false });
    expect(prisma.teamOpenAiCredential.deleteMany).toHaveBeenCalledWith({ where: { teamId: "team-a" } });
  });
});
