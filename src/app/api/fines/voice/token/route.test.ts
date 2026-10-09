import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

vi.mock("@/lib/apiAuth", () => ({
  FINE_AUTOMATION_ROLES: [],
  requireSession: vi.fn(async () => ({ ok: true, userId: "user" })),
  requireActiveTeamMemberWithRoles: vi.fn(async () => ({ ok: true }))
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { membership: { findMany: vi.fn(async () => []) } }
}));
vi.mock("@/lib/seasons", () => ({
  getActiveSeason: vi.fn(async () => ({ closedAt: null })),
  seasonClosedResponse: vi.fn(() => null)
}));

describe("voice token errors", () => {
  beforeEach(() => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it.each([
    [401, "invalid_api_key", "API-nøglen er ugyldig"],
    [403, "permission_denied", "ikke adgang"],
    [429, "insufficient_quota", "mangler kredit"],
    [429, "rate_limit_exceeded", "for mange forespørgsler"]
  ])("forklarer upstream-fejl %s/%s uden følsomme oplysninger", async (status, code, message) => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({
      error: { code, type: "test_error", param: null, message: "secret-player test-key" }
    }, { status, headers: { "x-request-id": "request-123" } })));
    const response = await POST(new Request("http://localhost/api/fines/voice/token", {
      method: "POST", body: JSON.stringify({ teamId: "team" })
    }));
    expect(response.status).toBe(502);
    expect((await response.json()).error).toContain(message);
    expect(console.error).toHaveBeenCalledWith("OpenAI transcription session failed", {
      status, code, type: "test_error", param: null, requestId: "request-123"
    });
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("secret-player");
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("test-key");
  });

  it("håndterer en upstream-fejl uden JSON", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("Unavailable", { status: 503 })));
    const response = await POST(new Request("http://localhost/api/fines/voice/token", {
      method: "POST", body: JSON.stringify({ teamId: "team" })
    }));
    expect(response.status).toBe(502);
    expect((await response.json()).error).toContain("Prøv igen senere");
  });
});
