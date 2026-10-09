import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { getTeamOpenAiKey } from "@/lib/teamOpenAiKey";

vi.mock("@/lib/apiAuth", () => ({
  FINE_AUTOMATION_ROLES: [],
  requireSession: vi.fn(async () => ({ ok: true, userId: "user" })),
  requireActiveTeamMemberWithRoles: vi.fn(async () => ({ ok: true }))
}));
vi.mock("@/lib/teamOpenAiKey", () => ({ getTeamOpenAiKey: vi.fn(async () => "test-key") }));
vi.mock("@/lib/prisma", () => ({
  prisma: { membership: { findMany: vi.fn(async () => [{ user: { id: "u1", name: "André Lundgren" } }]) }, fineTemplate: { findMany: vi.fn(async () => []) } }
}));
vi.mock("@/lib/seasons", () => ({
  getActiveSeason: vi.fn(async () => ({ closedAt: null })),
  seasonClosedResponse: vi.fn(() => null)
}));

describe("voice token", () => {
  beforeEach(() => {
    vi.mocked(getTeamOpenAiKey).mockResolvedValue("test-key");
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it.each([null, new Error("secret")])("stops before OpenAI when the team key is unavailable", async (key) => {
    if (key instanceof Error) vi.mocked(getTeamOpenAiKey).mockRejectedValueOnce(key);
    else vi.mocked(getTeamOpenAiKey).mockResolvedValueOnce(key);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(new Request("http://localhost", {
      method: "POST", body: JSON.stringify({ teamId: "team" })
    }));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("secret");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([true, false])("opretter dialog med spoken=%s uden spillerliste i transskriptionsprompten", async (spoken) => {
    const fetchMock = vi.fn(async (_url: string, _options: RequestInit) => Response.json({
      value: "ek-test", expires_at: 12345, session: { type: "realtime" }
    }));
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(new Request("http://localhost/api/fines/voice/token", {
      method: "POST", body: JSON.stringify({ teamId: "team", spoken })
    }));
    expect(response.status).toBe(200);
    expect(getTeamOpenAiKey).toHaveBeenCalledWith("team");
    expect(await response.json()).toEqual({ token: "ek-test", expiresAt: 12345 });
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.openai.com/v1/realtime/client_secrets");
    const body = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(body.session.type).toBe("realtime");
    expect(body.session.model).toBe("gpt-realtime-2.1-mini");
    expect(body.session.output_modalities).toEqual([spoken ? "audio" : "text"]);
    expect(body.session.instructions).toContain("André Lundgren");
    expect(body.session.audio.input.transcription).toEqual({ model: "gpt-4o-transcribe", language: "da" });
    expect(body.session.tools.map((t: { name: string }) => t.name)).toEqual(["get_fine_drafts", "set_fine_drafts"]);
  });

  it("afviser et succesrespons uden et brugbart token", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ expires_at: 12345 })));
    const response = await POST(new Request("http://localhost/api/fines/voice/token", {
      method: "POST", body: JSON.stringify({ teamId: "team" })
    }));
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "Kunne ikke starte transskription" });
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
