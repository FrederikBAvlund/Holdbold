import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { POST } from "./route";
import { getTeamOpenAiKey } from "@/lib/teamOpenAiKey";
import { requireActiveTeamMemberWithRoles } from "@/lib/apiAuth";

vi.mock("@/lib/apiAuth", () => ({
  FINE_AUTOMATION_ROLES: ["ADMIN", "BOEDEKASSEFORMAND"],
  requireSession: vi.fn(async () => ({ ok: true, userId: "user" })),
  requireActiveTeamMemberWithRoles: vi.fn()
}));
vi.mock("@/lib/teamOpenAiKey", () => ({ getTeamOpenAiKey: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  membership: { findMany: vi.fn(async () => []) },
  fineTemplate: { findMany: vi.fn(async () => []) }
} }));
const request = () => new Request("http://localhost", {
  method: "POST", body: JSON.stringify({ teamId: "team-b", segment: "En bøde" })
});

describe("voice parsing team key", () => {
  beforeEach(() => {
    vi.mocked(getTeamOpenAiKey).mockResolvedValue("sk-team-b-secret");
    vi.mocked(requireActiveTeamMemberWithRoles).mockResolvedValue({ ok: true, role: "ADMIN" });
  });
  afterEach(() => { vi.resetAllMocks(); vi.unstubAllGlobals(); });

  it("uses the selected team's key without exposing it in the response", async () => {
    const fetchMock = vi.fn(async () => Response.json({ choices: [{ message: { content: '{"fines":[]}' } }] }));
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(getTeamOpenAiKey).toHaveBeenCalledWith("team-b");
    expect(fetchMock.mock.calls[0]).toBeDefined();
    expect(fetchMock).toHaveBeenCalledWith("https://api.openai.com/v1/chat/completions", expect.objectContaining({
      headers: { Authorization: "Bearer sk-team-b-secret", "Content-Type": "application/json" }
    }));
    expect(await response.text()).not.toContain("sk-team-b-secret");
  });

  it.each([null, new Error("sk-secret")])("stops before OpenAI without a usable key", async (key) => {
    if (key instanceof Error) vi.mocked(getTeamOpenAiKey).mockRejectedValueOnce(key);
    else vi.mocked(getTeamOpenAiKey).mockResolvedValueOnce(key);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("sk-secret");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("authorizes membership before loading the secret", async () => {
    vi.mocked(requireActiveTeamMemberWithRoles).mockResolvedValue({ ok: false, response: NextResponse.json({}, { status: 403 }) });
    expect((await POST(request())).status).toBe(403);
    expect(getTeamOpenAiKey).not.toHaveBeenCalled();
  });
});
