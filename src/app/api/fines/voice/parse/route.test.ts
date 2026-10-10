import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { getTeamOpenAiKey } from "@/lib/teamOpenAiKey";
import { requireActiveTeamMemberWithRoles } from "@/lib/apiAuth";

vi.mock("@/lib/apiAuth", () => ({
  FINE_AUTOMATION_ROLES: ["ADMIN", "BOEDEKASSEFORMAND"],
  requireSession: vi.fn(async () => ({ ok: true, userId: "user" })),
  requireActiveTeamMemberWithRoles: vi.fn()
}));
vi.mock("@/lib/seasons", () => ({ getActiveSeason: vi.fn(async () => ({})), seasonClosedResponse: vi.fn(() => null) }));
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
    vi.mocked(requireActiveTeamMemberWithRoles).mockResolvedValue({ ok: true, roles: ["ADMIN"] });
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

  it("sends the exact displayed text and names, never database IDs, then resolves guesses independently", async () => {
    vi.mocked(prisma.membership.findMany).mockResolvedValue([
      { user: { id: "internal-v", name: "Vitus Duus" } },
      { user: { id: "internal-e", name: "Oskar Engdal" } }
    ] as never);
    vi.mocked(prisma.fineTemplate.findMany).mockResolvedValue([{ id: "internal-t", title: "For sent", amount: 50 }] as never);
    const text = "  Bittus og Engdahl kom 20 minutter for sent.\n";
    const fetchMock = vi.fn(async (_url: string, _options: RequestInit) => Response.json({ choices: [{ message: { content: JSON.stringify({ fines: [
      { playerName: "Bittus", templateTitle: "For sent", title: "For sent", amount: 20, confidence: 0.9 },
      { playerName: "Engdahl", templateTitle: "For sent", title: "For sent", amount: 20, confidence: 0.9 }
    ] }) } }] }));
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(new Request("http://localhost", { method: "POST", body: JSON.stringify({ teamId: "team-b", segment: text }) }));
    const data = await response.json();
    expect(data.suggestions.map((row: any) => [row.userId, row.templateId, row.amount])).toEqual([
      ["internal-v", "internal-t", 50], ["internal-e", "internal-t", 50]
    ]);
    const sent = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(sent.messages[1].content.endsWith(text)).toBe(true);
    expect(JSON.stringify(sent)).not.toContain("internal-");
    expect(sent.response_format.json_schema.schema.properties.fines.items.properties).toHaveProperty("playerName");
  });

  it("authorizes membership before loading the secret", async () => {
    vi.mocked(requireActiveTeamMemberWithRoles).mockResolvedValue({ ok: false, response: NextResponse.json({}, { status: 403 }) });
    expect((await POST(request())).status).toBe(403);
    expect(getTeamOpenAiKey).not.toHaveBeenCalled();
  });
});
